import { DatabaseSync } from "node:sqlite";
import { normalizeSqliteFailure, persistenceFailure } from "./errors.ts";
import {
  enforcePrivateRegularFile,
  type FileIdentity,
  inspectPrivateRegularFile,
  pathEntryExistsNoFollow,
  reservePrivateRegularFile,
  sameFileObjectIdentity,
} from "./values.ts";

export const SQLITE_BUSY_TIMEOUT_MS = 5_000 as const;

export type SqliteValue = null | number | bigint | string | Uint8Array;

export interface SqliteRunResult {
  readonly changes: number | bigint;
  readonly lastInsertRowid: number | bigint;
}

export interface SqliteStatement {
  all(...values: SqliteValue[]): Record<string, unknown>[];
  get(...values: SqliteValue[]): Record<string, unknown> | undefined;
  run(...values: SqliteValue[]): SqliteRunResult;
  setReadBigInts(enabled: boolean): void;
}

export interface SqliteDatabase {
  readonly isOpen: boolean;
  readonly isTransaction: boolean;
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  serialize(schema?: string): Uint8Array;
}

export interface ConnectionPolicyEvidence {
  readonly foreignKeys: true;
  readonly journalMode: "wal";
  readonly synchronous: "FULL";
  readonly readUncommitted: false;
  readonly busyTimeoutMs: 5000;
}

export interface CheckpointResult {
  readonly busy: number;
  readonly logFrames: number;
  readonly checkpointedFrames: number;
}

function pragmaValue(database: SqliteDatabase, name: string): unknown {
  const row = database.prepare(`PRAGMA ${name}`).get();
  if (row === undefined) {
    throw persistenceFailure("CONNECTION_POLICY_FAILED", "SQLite pragma returned no row", { pragma: name });
  }
  const values = Object.values(row);
  if (values.length !== 1) {
    throw persistenceFailure("CONNECTION_POLICY_FAILED", "SQLite pragma returned an ambiguous row", { pragma: name });
  }
  return values[0];
}

function safeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw persistenceFailure("INTEGRITY_ERROR", `${label} is not a safe SQLite integer`);
  }
  return value;
}

function sqliteMemberPaths(databasePath: string): readonly string[] {
  return Object.freeze([databasePath, `${databasePath}-wal`, `${databasePath}-shm`]);
}

function captureSqliteFileBindings(databasePath: string, reserveMain: boolean): Map<string, FileIdentity> {
  const bindings = new Map<string, FileIdentity>();
  for (const [index, memberPath] of sqliteMemberPaths(databasePath).entries()) {
    const present = pathEntryExistsNoFollow(memberPath);
    if (index === 0 && reserveMain && !present) {
      bindings.set(memberPath, reservePrivateRegularFile(memberPath));
    } else if (present) {
      bindings.set(memberPath, inspectPrivateRegularFile(memberPath));
    } else if (index === 0) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "SQLite main database is absent");
    }
  }
  return bindings;
}

function assertSqliteFileBindings(
  databasePath: string,
  bindings: Map<string, FileIdentity>,
): void {
  for (const memberPath of sqliteMemberPaths(databasePath)) {
    const expected = bindings.get(memberPath);
    if (expected !== undefined) {
      if (!pathEntryExistsNoFollow(memberPath)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "Bound SQLite file disappeared during open");
      }
      const observed = enforcePrivateRegularFile(memberPath);
      if (!sameFileObjectIdentity(expected, observed)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "Bound SQLite file changed during open");
      }
    } else if (pathEntryExistsNoFollow(memberPath)) {
      bindings.set(memberPath, enforcePrivateRegularFile(memberPath));
    }
  }
}

export function openPrimaryDatabase(
  databasePath: string,
): SqliteDatabase {
  const bindings = captureSqliteFileBindings(databasePath, true);
  let database: SqliteDatabase;
  try {
    database = new DatabaseSync(databasePath, { timeout: SQLITE_BUSY_TIMEOUT_MS });
  } catch (error) {
    assertSqliteFileBindings(databasePath, bindings);
    throw persistenceFailure("SQLITE_OPEN_FAILED", "Primary SQLite database could not be opened", {}, error);
  }
  try {
    assertSqliteFileBindings(databasePath, bindings);
    database.exec("PRAGMA foreign_keys=ON");
    database.exec("PRAGMA journal_mode=WAL");
    database.exec("PRAGMA synchronous=FULL");
    database.exec("PRAGMA read_uncommitted=OFF");
    database.exec(`PRAGMA busy_timeout=${SQLITE_BUSY_TIMEOUT_MS}`);
    assertSqliteFileBindings(databasePath, bindings);
    verifyConnectionPolicy(database);
    assertSqliteFileBindings(databasePath, bindings);
    return database;
  } catch (error) {
    let bindingError: unknown;
    try {
      assertSqliteFileBindings(databasePath, bindings);
    } catch (failure) {
      bindingError = failure;
    }
    if (database.isOpen) database.close();
    if (bindingError !== undefined) {
      throw normalizeSqliteFailure(bindingError, "CONNECTION_POLICY_FAILED");
    }
    throw normalizeSqliteFailure(error, "CONNECTION_POLICY_FAILED");
  }
}

export function assertNewSqliteMemberBindingForTesting(
  databasePath: string,
  createMember: () => void,
  replaceMember: () => void,
): void {
  const bindings = captureSqliteFileBindings(databasePath, false);
  createMember();
  assertSqliteFileBindings(databasePath, bindings);
  replaceMember();
  assertSqliteFileBindings(databasePath, bindings);
}

export function openReadOnlyDatabase(databasePath: string): SqliteDatabase {
  const bindings = captureSqliteFileBindings(databasePath, false);
  let database: SqliteDatabase | undefined;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true, timeout: SQLITE_BUSY_TIMEOUT_MS });
    assertSqliteFileBindings(databasePath, bindings);
    database.exec("PRAGMA foreign_keys=ON");
    database.exec("PRAGMA synchronous=FULL");
    database.exec("PRAGMA read_uncommitted=OFF");
    database.exec(`PRAGMA busy_timeout=${SQLITE_BUSY_TIMEOUT_MS}`);
    assertSqliteFileBindings(databasePath, bindings);
    if (
      pragmaValue(database, "foreign_keys") !== 1 ||
      pragmaValue(database, "synchronous") !== 2 ||
      pragmaValue(database, "read_uncommitted") !== 0 ||
      pragmaValue(database, "busy_timeout") !== SQLITE_BUSY_TIMEOUT_MS
    ) {
      throw persistenceFailure("CONNECTION_POLICY_FAILED", "Read-only SQLite connection policy drifted");
    }
    assertSqliteFileBindings(databasePath, bindings);
    return database;
  } catch (error) {
    let bindingError: unknown;
    try {
      assertSqliteFileBindings(databasePath, bindings);
    } catch (failure) {
      bindingError = failure;
    }
    if (database?.isOpen) {
      try {
        database.close();
      } catch {
        // The setup or policy error remains authoritative.
      }
    }
    if (bindingError !== undefined) {
      throw normalizeSqliteFailure(bindingError, "SQLITE_OPEN_FAILED");
    }
    assertSqliteFileBindings(databasePath, bindings);
    throw normalizeSqliteFailure(error, "SQLITE_OPEN_FAILED");
  }
}

export function normalizeStandaloneDatabase(databasePath: string): void {
  const bindings = captureSqliteFileBindings(databasePath, false);
  let database: SqliteDatabase | undefined;
  let journalTransitionStarted = false;
  try {
    database = new DatabaseSync(databasePath, { timeout: SQLITE_BUSY_TIMEOUT_MS });
    assertSqliteFileBindings(databasePath, bindings);
    database.exec("PRAGMA foreign_keys=ON");
    database.exec("PRAGMA synchronous=FULL");
    assertSqliteFileBindings(databasePath, bindings);
    journalTransitionStarted = true;
    database.exec("PRAGMA journal_mode=DELETE");
    const row = database.prepare("PRAGMA journal_mode").get();
    if (row === undefined || String(Object.values(row)[0]).toLowerCase() !== "delete") {
      throw persistenceFailure("BACKUP_INVALID", "Standalone backup did not normalize to DELETE journal mode");
    }
    verifyDatabaseIntegrity(database);
  } catch (error) {
    let bindingError: unknown;
    if (!journalTransitionStarted) {
      try {
        assertSqliteFileBindings(databasePath, bindings);
      } catch (failure) {
        bindingError = failure;
      }
    }
    if (database?.isOpen) {
      try {
        database.close();
      } catch {
        // The normalization or binding failure remains authoritative.
      }
    }
    if (bindingError !== undefined) {
      throw normalizeSqliteFailure(bindingError, "BACKUP_INVALID");
    }
    throw normalizeSqliteFailure(error, "BACKUP_INVALID");
  }
  database.close();

  const expectedMain = bindings.get(databasePath);
  if (expectedMain === undefined) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Standalone database binding lost its main file");
  }
  const terminalMain = enforcePrivateRegularFile(databasePath);
  if (!sameFileObjectIdentity(expectedMain, terminalMain)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Standalone database identity changed during normalization");
  }
  for (const memberPath of sqliteMemberPaths(databasePath).slice(1)) {
    if (pathEntryExistsNoFollow(memberPath)) {
      inspectPrivateRegularFile(memberPath);
      throw persistenceFailure("BACKUP_INVALID", "Standalone backup retained a SQLite sidecar after normalization");
    }
  }
}

export function verifyConnectionPolicy(database: SqliteDatabase): ConnectionPolicyEvidence {
  if (
    pragmaValue(database, "foreign_keys") !== 1 ||
    String(pragmaValue(database, "journal_mode")).toLowerCase() !== "wal" ||
    pragmaValue(database, "synchronous") !== 2 ||
    pragmaValue(database, "read_uncommitted") !== 0 ||
    pragmaValue(database, "busy_timeout") !== SQLITE_BUSY_TIMEOUT_MS
  ) {
    throw persistenceFailure("CONNECTION_POLICY_FAILED", "Primary SQLite connection policy drifted");
  }
  return Object.freeze({
    foreignKeys: true,
    journalMode: "wal",
    synchronous: "FULL",
    readUncommitted: false,
    busyTimeoutMs: SQLITE_BUSY_TIMEOUT_MS,
  });
}

function isPromiseLike(value: unknown): boolean {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
  try {
    return typeof (value as { readonly then?: unknown }).then === "function";
  } catch {
    return true;
  }
}

export function runReadSnapshot<T>(database: SqliteDatabase, callback: () => T): T {
  try {
    database.exec("BEGIN");
    const value = callback();
    if (isPromiseLike(value)) {
      throw persistenceFailure(
        "ASYNC_TRANSACTION_FORBIDDEN",
        "Read transaction callbacks must be synchronous",
      );
    }
    database.exec("COMMIT");
    return value;
  } catch (error) {
    if (database.isTransaction) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // The original typed failure remains authoritative.
      }
    }
    throw normalizeSqliteFailure(error, "TRANSACTION_FAILED");
  }
}

export function runWriteTransaction<T>(database: SqliteDatabase, callback: () => T): T {
  try {
    database.exec("BEGIN IMMEDIATE");
    const value = callback();
    if (isPromiseLike(value)) {
      throw persistenceFailure(
        "ASYNC_TRANSACTION_FORBIDDEN",
        "Write transaction callbacks must be synchronous",
      );
    }
    database.exec("COMMIT");
    return value;
  } catch (error) {
    if (database.isTransaction) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // The original typed failure remains authoritative.
      }
    }
    throw normalizeSqliteFailure(error, "TRANSACTION_FAILED");
  }
}

export function verifyDatabaseIntegrity(database: SqliteDatabase): void {
  try {
    const quickCheck = pragmaValue(database, "quick_check");
    if (quickCheck !== "ok") {
      throw persistenceFailure("INTEGRITY_ERROR", "SQLite quick_check did not return ok");
    }
    const foreignKeyFailures = database.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyFailures.length !== 0) {
      throw persistenceFailure("INTEGRITY_ERROR", "SQLite foreign_key_check found a violation", {
        failures: foreignKeyFailures.length,
      });
    }
  } catch (error) {
    throw normalizeSqliteFailure(error, "INTEGRITY_ERROR");
  }
}

export function checkpointWal(database: SqliteDatabase, mode: "PASSIVE" | "RESTART" | "TRUNCATE"): CheckpointResult {
  if (mode !== "PASSIVE" && mode !== "RESTART" && mode !== "TRUNCATE") {
    throw persistenceFailure("INVALID_INPUT", "Checkpoint mode is invalid");
  }
  let row: Record<string, unknown> | undefined;
  try {
    row = database.prepare(`PRAGMA wal_checkpoint(${mode})`).get();
  } catch (error) {
    throw normalizeSqliteFailure(error, "TRANSACTION_FAILED");
  }
  if (row === undefined || Reflect.ownKeys(row).length !== 3) {
    throw persistenceFailure("INTEGRITY_ERROR", "SQLite checkpoint returned an invalid result");
  }
  return Object.freeze({
    busy: safeInteger(row.busy, "checkpoint busy count"),
    logFrames: safeInteger(row.log, "checkpoint log frame count"),
    checkpointedFrames: safeInteger(row.checkpointed, "checkpoint completed frame count"),
  });
}

export function sqliteInteger(value: unknown, label: string): number {
  return safeInteger(value, label);
}

export function sqliteText(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not SQLite TEXT`);
  }
  return value;
}

export function sqliteNullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return sqliteText(value, label);
}
