import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  sqliteInteger,
  sqliteText,
  type SqliteDatabase,
  verifyDatabaseIntegrity,
} from "./database.ts";
import { normalizeSqliteFailure, persistenceFailure } from "./errors.ts";
import {
  canonicalJson,
  decodeUtf8,
  isCanonicalUtcTimestamp,
  isNonemptyString,
  readRegularFile,
  sha256,
} from "./values.ts";

export interface MigrationDescriptor {
  readonly version: number;
  readonly id: string;
  readonly fileName: string;
  readonly checksumSha256: string;
  readonly sql: string;
}

export interface MigrationHistoryEntry {
  readonly version: number;
  readonly migrationId: string;
  readonly checksumSha256: string;
  readonly appliedAt: string;
  readonly applicationVersion: string;
}

export interface SchemaEvidence {
  readonly schemaVersion: number;
  readonly registryIdentity: string;
  readonly schemaFingerprint: string;
  readonly history: readonly MigrationHistoryEntry[];
}

export interface MigrationResult extends SchemaEvidence {
  readonly createdFresh: boolean;
  readonly appliedVersions: readonly number[];
}

export interface MigrationOptions {
  readonly applicationVersion: string;
}

interface MigrationSource {
  readonly version: number;
  readonly id: string;
  readonly fileName: string;
  readonly canonicalLineEnding: "lf" | "crlf";
  readonly checksumSha256: string;
}

const MIGRATION_SOURCES = Object.freeze([
  Object.freeze({
    version: 1,
    id: "current-baseline",
    fileName: "0001-current-baseline.sql",
    canonicalLineEnding: "lf",
    checksumSha256: "48AEAA28BCA5152BC930149483E649D6C91E1E63D64D5BD29958492860AA95A5",
  }),
] satisfies readonly MigrationSource[]);

let cachedRegistry: readonly MigrationDescriptor[] | undefined;
const FINGERPRINT_COLUMNS = Object.freeze(["type", "name", "tbl_name", "sql"] as const);

function migrationUrl(fileName: string): URL {
  return new URL(`../../migrations/${fileName}`, import.meta.url);
}

function canonicalMigrationSql(source: MigrationSource, bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw persistenceFailure("MIGRATION_CHECKSUM_MISMATCH", "Migration source starts with a BOM", {
      version: source.version,
    });
  }
  const decoded = decodeUtf8(bytes, `migration ${source.fileName}`);
  if (decoded.trim().length === 0) {
    throw persistenceFailure("MIGRATION_CHECKSUM_MISMATCH", "Migration source is empty", {
      version: source.version,
    });
  }
  if (!decoded.endsWith("\n")) {
    throw persistenceFailure("MIGRATION_CHECKSUM_MISMATCH", "Migration source has no terminal newline", {
      version: source.version,
    });
  }
  const lfTransport = decoded.replaceAll("\r\n", "\n");
  if (lfTransport.includes("\r")) {
    throw persistenceFailure("MIGRATION_CHECKSUM_MISMATCH", "Migration source contains a lone carriage return", {
      version: source.version,
    });
  }
  const crlfTransport = lfTransport.replaceAll("\n", "\r\n");
  if (decoded !== lfTransport && decoded !== crlfTransport) {
    throw persistenceFailure("MIGRATION_CHECKSUM_MISMATCH", "Migration source has mixed line endings", {
      version: source.version,
    });
  }
  const canonical = source.canonicalLineEnding === "lf" ? lfTransport : crlfTransport;
  if (sha256(canonical) !== source.checksumSha256) {
    throw persistenceFailure("MIGRATION_CHECKSUM_MISMATCH", "Migration source does not match its released checksum", {
      version: source.version,
    });
  }
  return canonical;
}

export function canonicalizeMigrationSqlForTesting(version: number, bytes: Uint8Array): string {
  const source = MIGRATION_SOURCES[version - 1];
  if (!Number.isSafeInteger(version) || source === undefined || source.version !== version) {
    throw persistenceFailure("INVALID_INPUT", "Migration version has no source descriptor", { version });
  }
  return canonicalMigrationSql(source, bytes);
}

function validateRegistry(registry: readonly MigrationDescriptor[]): void {
  if (registry.length !== 1) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Migration registry must contain exactly one current baseline");
  }
  const ids = new Set<string>();
  const checksums = new Set<string>();
  for (const [index, migration] of registry.entries()) {
    if (migration.version !== index + 1 || !isNonemptyString(migration.id)) {
      throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Migration registry is not a contiguous sequence");
    }
    if (ids.has(migration.id) || checksums.has(migration.checksumSha256)) {
      throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Migration registry identity is not unique");
    }
    ids.add(migration.id);
    checksums.add(migration.checksumSha256);
  }
}

export function loadMigrationRegistry(): readonly MigrationDescriptor[] {
  if (cachedRegistry !== undefined) return cachedRegistry;
  const descriptors = MIGRATION_SOURCES.map((source) => {
    const migrationPath = fileURLToPath(migrationUrl(source.fileName));
    const sql = canonicalMigrationSql(source, readRegularFile(migrationPath).bytes);
    return Object.freeze({
      version: source.version,
      id: source.id,
      fileName: source.fileName,
      checksumSha256: source.checksumSha256,
      sql,
    });
  });
  validateRegistry(descriptors);
  cachedRegistry = Object.freeze(descriptors);
  return cachedRegistry;
}

export function migrationRegistryIdentity(registry: readonly MigrationDescriptor[]): string {
  validateRegistry(registry);
  return sha256(
    canonicalJson(
      registry.map((migration) => ({
        checksumSha256: migration.checksumSha256,
        id: migration.id,
        version: migration.version,
      })),
    ),
  );
}

function schemaRows(database: SqliteDatabase): readonly Readonly<Record<string, string>>[] {
  const rows = database
    .prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
    )
    .all();
  return Object.freeze(
    rows.map((row) => {
      const result: Record<string, string> = Object.create(null) as Record<string, string>;
      for (const column of FINGERPRINT_COLUMNS) {
        result[column] = sqliteText(row[column], `sqlite_schema.${column}`);
      }
      return Object.freeze(result);
    }),
  );
}

export function liveSchemaFingerprint(database: SqliteDatabase): string {
  return sha256(canonicalJson(schemaRows(database)));
}

function expectedSchemaFingerprint(registry: readonly MigrationDescriptor[]): string {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(registry[0]!.sql);
    return liveSchemaFingerprint(database);
  } finally {
    database.close();
  }
}

function userTableNames(database: SqliteDatabase): readonly string[] {
  return Object.freeze(
    database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => sqliteText(row.name, "sqlite_schema.name")),
  );
}

function emptySchemaEvidence(database: SqliteDatabase): SchemaEvidence | null {
  const schemaObjects = database
    .prepare("SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")
    .all()
    .map((row) => sqliteText(row.name, "sqlite_schema.name"));
  if (schemaObjects.length === 0) {
    const userVersion = database.prepare("PRAGMA user_version").get();
    if (userVersion === undefined || sqliteInteger(Object.values(userVersion)[0], "user_version") !== 0) {
      throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Empty database has a nonzero user_version");
    }
    return null;
  }
  const tables = userTableNames(database);
  if (!tables.includes("schema_metadata") || !tables.includes("migration_history")) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Database has tables but no complete migration metadata");
  }
  return Object.freeze({ schemaVersion: 0, registryIdentity: "", schemaFingerprint: "", history: Object.freeze([]) });
}

export function inspectSchemaEvidence(
  database: SqliteDatabase,
  registry: readonly MigrationDescriptor[] = loadMigrationRegistry(),
): SchemaEvidence {
  validateRegistry(registry);
  const initial = emptySchemaEvidence(database);
  if (initial === null) return initial ?? Object.freeze({ schemaVersion: 0, registryIdentity: "", schemaFingerprint: "", history: Object.freeze([]) });

  let metadata: Record<string, unknown> | undefined;
  let historyRows: readonly Record<string, unknown>[];
  try {
    metadata = database
      .prepare(
        "SELECT singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at FROM schema_metadata",
      )
      .get();
    historyRows = database
      .prepare(
        "SELECT version, migration_id, checksum_sha256, applied_at, application_version FROM migration_history ORDER BY version",
      )
      .all();
  } catch (error) {
    throw normalizeSqliteFailure(error, "MIGRATION_HISTORY_MISMATCH");
  }
  if (metadata === undefined || sqliteInteger(metadata.singleton, "schema_metadata.singleton") !== 1) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Schema metadata singleton is missing");
  }
  const schemaVersion = sqliteInteger(metadata.schema_version, "schema_metadata.schema_version");
  const domainInitialized = sqliteInteger(
    metadata.domain_initialized,
    "schema_metadata.domain_initialized",
  );
  if (domainInitialized !== 0 && domainInitialized !== 1) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Domain initialization marker is invalid");
  }
  if (schemaVersion > 1) {
    throw persistenceFailure("SCHEMA_NEWER", "Database schema is newer than this binary", {
      databaseVersion: schemaVersion,
      supportedVersion: 1,
    });
  }
  if (schemaVersion !== 1) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Schema metadata version is invalid");
  }
  const registryIdentity = sqliteText(metadata.registry_identity, "schema_metadata.registry_identity");
  const schemaFingerprint = sqliteText(metadata.schema_fingerprint, "schema_metadata.schema_fingerprint");
  const updatedAt = sqliteText(metadata.updated_at, "schema_metadata.updated_at");
  if (!isCanonicalUtcTimestamp(updatedAt)) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Schema metadata timestamp is not canonical UTC");
  }
  const userVersionRow = database.prepare("PRAGMA user_version").get();
  if (
    userVersionRow === undefined ||
    sqliteInteger(Object.values(userVersionRow)[0], "user_version") !== schemaVersion
  ) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "PRAGMA user_version does not match schema metadata");
  }
  if (historyRows.length !== 1) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Migration history must contain the current baseline only");
  }
  const history: MigrationHistoryEntry[] = historyRows.map((row, index) => {
    const version = sqliteInteger(row.version, "migration_history.version");
    const migrationId = sqliteText(row.migration_id, "migration_history.migration_id");
    const checksumSha256 = sqliteText(row.checksum_sha256, "migration_history.checksum_sha256");
    const appliedAt = sqliteText(row.applied_at, "migration_history.applied_at");
    const applicationVersion = sqliteText(row.application_version, "migration_history.application_version");
    const expected = registry[index];
    if (expected === undefined || version !== index + 1 || migrationId !== expected.id) {
      throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Migration history does not match the current baseline", {
        version,
      });
    }
    if (checksumSha256 !== expected.checksumSha256) {
      throw persistenceFailure("MIGRATION_CHECKSUM_MISMATCH", "Applied migration checksum does not match source", {
        version,
      });
    }
    if (!isCanonicalUtcTimestamp(appliedAt)) {
      throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Migration history timestamp is not canonical UTC", {
        version,
      });
    }
    return Object.freeze({ version, migrationId, checksumSha256, appliedAt, applicationVersion });
  });
  if (history.at(-1)?.appliedAt !== updatedAt) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Schema metadata timestamp does not match history");
  }
  const expectedRegistryIdentity = migrationRegistryIdentity(registry);
  if (registryIdentity !== expectedRegistryIdentity) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Stored registry identity does not match history");
  }
  const expectedFingerprint = expectedSchemaFingerprint(registry);
  const observedFingerprint = liveSchemaFingerprint(database);
  if (schemaFingerprint !== expectedFingerprint || observedFingerprint !== expectedFingerprint) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Live schema does not match the migration registry");
  }
  verifyDatabaseIntegrity(database);
  return Object.freeze({
    schemaVersion,
    registryIdentity,
    schemaFingerprint,
    history: Object.freeze(history),
  });
}

function applyCurrentBaseline(
  database: SqliteDatabase,
  registry: readonly MigrationDescriptor[],
  migration: MigrationDescriptor,
  applicationVersion: string,
): void {
  const appliedAt = new Date().toISOString();
  try {
    database.exec("BEGIN IMMEDIATE");
    database.exec(migration.sql);
    const fingerprint = liveSchemaFingerprint(database);
    const expectedFingerprint = expectedSchemaFingerprint(registry);
    if (fingerprint !== expectedFingerprint) {
      throw persistenceFailure("MIGRATION_FAILED", "Current baseline schema postcondition did not match its registry", {
        version: migration.version,
      });
    }
    database
      .prepare(
        "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (?, ?, ?, ?, ?)",
      )
      .run(migration.version, migration.id, migration.checksumSha256, appliedAt, applicationVersion);
    const identity = migrationRegistryIdentity(registry);
    database
      .prepare(
        "INSERT INTO schema_metadata(singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at) VALUES (1, 1, 0, ?, ?, ?)",
      )
      .run(identity, fingerprint, appliedAt);
    database.exec(`PRAGMA user_version=${migration.version}`);
    verifyDatabaseIntegrity(database);
    database.exec("COMMIT");
  } catch (error) {
    if (database.isTransaction) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Preserve the migration failure that caused rollback.
      }
    }
    throw normalizeSqliteFailure(error, "MIGRATION_FAILED");
  }
}

async function migrateDatabaseWithRegistry(
  database: SqliteDatabase,
  options: MigrationOptions,
  registry: readonly MigrationDescriptor[],
): Promise<MigrationResult> {
  if (!isNonemptyString(options.applicationVersion)) {
    throw persistenceFailure("INVALID_INPUT", "applicationVersion must be nonempty");
  }
  validateRegistry(registry);
  let evidence = inspectSchemaEvidence(database, registry);
  const createdFresh = evidence.schemaVersion === 0;
  const appliedVersions: number[] = [];
  if (createdFresh) {
    const baseline = registry[0]!;
    applyCurrentBaseline(database, registry, baseline, options.applicationVersion);
    appliedVersions.push(1);
  }
  evidence = inspectSchemaEvidence(database, registry);
  return Object.freeze({
    ...evidence,
    createdFresh,
    appliedVersions: Object.freeze(appliedVersions),
  });
}

export async function migrateDatabase(database: SqliteDatabase, options: MigrationOptions): Promise<MigrationResult> {
  return migrateDatabaseWithRegistry(database, options, loadMigrationRegistry());
}

export async function migrateDatabaseWithRegistryForTesting(
  database: SqliteDatabase,
  options: MigrationOptions,
  registry: readonly MigrationDescriptor[],
): Promise<MigrationResult> {
  return migrateDatabaseWithRegistry(database, options, registry);
}

export function currentSchemaVersion(): number {
  return loadMigrationRegistry().length;
}

export function readDomainInitialized(database: SqliteDatabase): boolean {
  let row: Record<string, unknown> | undefined;
  try {
    row = database
      .prepare("SELECT domain_initialized FROM schema_metadata WHERE singleton=1")
      .get();
  } catch (error) {
    throw normalizeSqliteFailure(error, "MIGRATION_HISTORY_MISMATCH");
  }
  if (row === undefined) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Domain initialization marker is absent");
  }
  const value = sqliteInteger(row.domain_initialized, "schema_metadata.domain_initialized");
  if (value !== 0 && value !== 1) {
    throw persistenceFailure("MIGRATION_HISTORY_MISMATCH", "Domain initialization marker is invalid");
  }
  return value === 1;
}
