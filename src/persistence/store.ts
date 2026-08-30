import {
  bindApplicationDatabase,
  readApplicationState,
  readVersionThreeApplicationState,
  unbindApplicationDatabase,
  type ApplicationLifecycleAuthorization,
} from "./application-repository.ts";
import {
  createBackupUnderLock,
  type BackupGeneration,
  type BackupTestHooks,
} from "./backup.ts";
import {
  checkpointWal,
  type CheckpointResult,
  type ConnectionPolicyEvidence,
  type SqliteDatabase,
  openPrimaryDatabase,
  openReadOnlyDatabase,
  verifyConnectionPolicy,
  verifyDatabaseIntegrity,
} from "./database.ts";
import { persistenceFailure } from "./errors.ts";
import {
  currentSchemaVersion,
  inspectSchemaEvidence,
  migrateDatabase,
  type MigrationResult,
} from "./migrations.ts";
import { readDomainSnapshot } from "./repository.ts";
import {
  assertConnectionReceiptHeld,
  assertRuntimeLayout,
  createConnectionReceipt,
  ensureNoConnectionReceipts,
  hasRestoreIntent,
  listConnectionReceiptNames,
  releaseConnectionReceipt,
  type ConnectionReceipt,
  type RuntimeLayout,
  withLifecycleLock,
} from "./runtime.ts";
import {
  enforcePrivateRegularFile,
  exactRecord,
  inspectRegularFile,
  isNonemptyString,
  pathEntryExistsNoFollow,
} from "./values.ts";

export interface OpenPersistenceOptions {
  readonly applicationVersion: string;
}

type StoreState = "open" | "database_closed" | "closed";
const BACKUP_FOR_TESTING = Symbol("backup-for-testing");

function enforcePrivatePrimaryFiles(layout: RuntimeLayout): void {
  assertRuntimeLayout(layout);
  for (const filePath of [layout.databasePath, `${layout.databasePath}-wal`, `${layout.databasePath}-shm`]) {
    if (pathEntryExistsNoFollow(filePath)) enforcePrivateRegularFile(filePath);
  }
  assertRuntimeLayout(layout);
}

function inspectBeforeWritableOpen(layout: RuntimeLayout): number | null {
  assertRuntimeLayout(layout);
  if (!pathEntryExistsNoFollow(layout.databasePath)) return null;
  const identity = inspectRegularFile(layout.databasePath);
  if (identity.size === 0) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Existing primary database is empty and cannot be replaced");
  }
  const database = openReadOnlyDatabase(layout.databasePath);
  try {
    const evidence = inspectSchemaEvidence(database);
    verifyDatabaseIntegrity(database);
    if (evidence.schemaVersion >= 4) readApplicationState(database);
    else if (evidence.schemaVersion === 3) readVersionThreeApplicationState(database);
    else if (evidence.schemaVersion >= 2) readDomainSnapshot(database);
    return evidence.schemaVersion;
  } finally {
    database.close();
    assertRuntimeLayout(layout);
  }
}

function parseOpenOptions(value: unknown): OpenPersistenceOptions {
  const record = exactRecord(value, ["applicationVersion"], "open persistence options");
  if (!isNonemptyString(record.applicationVersion)) {
    throw persistenceFailure("INVALID_INPUT", "applicationVersion must be nonempty");
  }
  return Object.freeze({ applicationVersion: record.applicationVersion });
}

export interface PersistenceStore {
  readonly migration: MigrationResult;
  readonly connectionPolicy: ConnectionPolicyEvidence;
  readonly layout: RuntimeLayout;
  readonly applicationVersion: string;
  checkpoint(mode?: "PASSIVE" | "RESTART" | "TRUNCATE"): CheckpointResult;
  createBackup(authorization: ApplicationLifecycleAuthorization): Promise<BackupGeneration>;
  close(): Promise<void>;
}

class PersistenceStoreOwner implements PersistenceStore {
  readonly migration: MigrationResult;
  readonly connectionPolicy: ConnectionPolicyEvidence;
  readonly layout: RuntimeLayout;
  readonly applicationVersion: string;

  readonly #database: SqliteDatabase;
  readonly #receipt: ConnectionReceipt;
  #state: StoreState = "open";
  #applicationWritesBlocked = false;

  constructor(
    database: SqliteDatabase,
    layout: RuntimeLayout,
    applicationVersion: string,
    receipt: ConnectionReceipt,
    migration: MigrationResult,
    connectionPolicy: ConnectionPolicyEvidence,
  ) {
    this.#database = database;
    this.layout = layout;
    this.applicationVersion = applicationVersion;
    this.#receipt = receipt;
    this.migration = migration;
    this.connectionPolicy = connectionPolicy;
    bindApplicationDatabase(this, database, () => this.#assertOpen(), () => this.#assertApplicationWriteAllowed());
  }

  #assertOpen(): void {
    if (this.#state !== "open" || !this.#database.isOpen) {
      throw persistenceFailure("STORE_CLOSED", "Persistence store is closed");
    }
    assertRuntimeLayout(this.layout);
    assertConnectionReceiptHeld(this.layout, this.#receipt);
  }

  #assertApplicationWriteAllowed(): void {
    if (this.#applicationWritesBlocked) {
      throw persistenceFailure("BACKUP_CONFLICT", "Application writes are blocked by a lifecycle operation");
    }
  }

  checkpoint(mode: "PASSIVE" | "RESTART" | "TRUNCATE" = "PASSIVE"): CheckpointResult {
    this.#assertOpen();
    return checkpointWal(this.#database, mode);
  }

  async createBackup(authorization: ApplicationLifecycleAuthorization): Promise<BackupGeneration> {
    return this.#createBackup(authorization, {});
  }

  async [BACKUP_FOR_TESTING](
    authorization: ApplicationLifecycleAuthorization,
    hooks: BackupTestHooks,
  ): Promise<BackupGeneration> {
    return this.#createBackup(authorization, hooks);
  }

  async #createBackup(
    authorization: ApplicationLifecycleAuthorization,
    hooks: BackupTestHooks,
  ): Promise<BackupGeneration> {
    this.#assertOpen();
    return withLifecycleLock(this.layout, "backup", async (token) => {
      this.#assertOpen();
      const receiptNames = listConnectionReceiptNames(this.layout);
      if (receiptNames.length !== 1 || receiptNames[0] !== `${this.#receipt.receiptId}.json`) {
        throw persistenceFailure("ACTIVE_CONNECTIONS", "Manual backup requires the sole current connection receipt");
      }
      this.#applicationWritesBlocked = true;
      try {
        return await createBackupUnderLock(
          this.#database,
          this.layout,
          this.applicationVersion,
          "manual",
          token,
          hooks,
          authorization,
        );
      } finally {
        this.#applicationWritesBlocked = false;
      }
    });
  }

  async close(): Promise<void> {
    if (this.#state === "closed") return;
    await withLifecycleLock(this.layout, "close", (token) => {
      if (this.#state === "open") {
        assertConnectionReceiptHeld(this.layout, this.#receipt);
        unbindApplicationDatabase(this);
        this.#database.close();
        this.#state = "database_closed";
      }
      releaseConnectionReceipt(this.layout, this.#receipt, token);
      this.#state = "closed";
    });
  }
}

export function createBackupForTesting(
  store: PersistenceStore,
  authorization: ApplicationLifecycleAuthorization,
  hooks: BackupTestHooks,
): Promise<BackupGeneration> {
  if (!(store instanceof PersistenceStoreOwner)) {
    throw persistenceFailure("INVALID_INPUT", "Test backup requires a persistence store owner");
  }
  return store[BACKUP_FOR_TESTING](authorization, hooks);
}

export async function openPersistence(
  layout: RuntimeLayout,
  optionsInput: unknown,
): Promise<PersistenceStore> {
  assertRuntimeLayout(layout);
  const options = parseOpenOptions(optionsInput);
  const targetSchemaVersion = currentSchemaVersion();
  return withLifecycleLock(layout, "open", async (token) => {
    if (hasRestoreIntent(layout)) {
      throw persistenceFailure("RESTORE_RECOVERY_REQUIRED", "Pending restore intent blocks normal open");
    }
    const receiptNames = listConnectionReceiptNames(layout);
    const existingVersion = inspectBeforeWritableOpen(layout);
    if (existingVersion === null) {
      if (receiptNames.length !== 0) {
        throw persistenceFailure("ACTIVE_CONNECTIONS", "Connection receipts block first initialization");
      }
    } else if (existingVersion < targetSchemaVersion) {
      ensureNoConnectionReceipts(layout);
    }

    assertRuntimeLayout(layout);
    const database = openPrimaryDatabase(layout.databasePath);
    assertRuntimeLayout(layout);
    let receipt: ConnectionReceipt | undefined;
    try {
      const migration = await migrateDatabase(database, {
        applicationVersion: options.applicationVersion,
        beforeUpgrade: async () => {
          ensureNoConnectionReceipts(layout);
          const generation = await createBackupUnderLock(
            database,
            layout,
            options.applicationVersion,
            "pre_upgrade",
            token,
          );
          return generation.generationId;
        },
      });
      verifyDatabaseIntegrity(database);
      readApplicationState(database);
      enforcePrivatePrimaryFiles(layout);
      const connectionPolicy = verifyConnectionPolicy(database);
      receipt = createConnectionReceipt(layout, options.applicationVersion, token);
      return new PersistenceStoreOwner(
        database,
        layout,
        options.applicationVersion,
        receipt,
        migration,
        connectionPolicy,
      );
    } catch (error) {
      if (receipt !== undefined) {
        try {
          releaseConnectionReceipt(layout, receipt, token);
        } catch {
          // The original open failure remains authoritative; the receipt residue fails closed.
        }
      }
      if (database.isOpen) database.close();
      throw error;
    }
  });
}
