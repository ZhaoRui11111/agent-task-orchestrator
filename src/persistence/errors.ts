export const PERSISTENCE_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "UNSAFE_RUNTIME_ROOT",
  "PATH_IDENTITY_CHANGED",
  "LIFECYCLE_BUSY",
  "LIFECYCLE_IDENTITY_CHANGED",
  "ACTIVE_CONNECTIONS",
  "CONNECTION_RECEIPT_CHANGED",
  "STORE_CLOSED",
  "SQLITE_OPEN_FAILED",
  "CONNECTION_POLICY_FAILED",
  "BUSY",
  "TRANSACTION_FAILED",
  "ASYNC_TRANSACTION_FORBIDDEN",
  "MIGRATION_HISTORY_MISMATCH",
  "MIGRATION_CHECKSUM_MISMATCH",
  "MIGRATION_FAILED",
  "SCHEMA_NEWER",
  "SCHEMA_UNSUPPORTED",
  "INTEGRITY_ERROR",
  "CORRUPT_ROW",
  "REVISION_CONFLICT",
  "NOT_FOUND",
  "BACKUP_INVALID",
  "BACKUP_CONFLICT",
  "RESTORE_ACK_REQUIRED",
  "RESTORE_CONFLICT",
  "RESTORE_RECOVERY_REQUIRED",
  "RESTORE_BLOCKED",
] as const);

export type PersistenceErrorCode = (typeof PERSISTENCE_ERROR_CODES)[number];
export type PersistenceErrorDetail = string | number | boolean | null;

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly details: Readonly<Record<string, PersistenceErrorDetail>>;

  constructor(
    code: PersistenceErrorCode,
    message: string,
    details: Readonly<Record<string, PersistenceErrorDetail>> = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "PersistenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function persistenceFailure(
  code: PersistenceErrorCode,
  message: string,
  details: Readonly<Record<string, PersistenceErrorDetail>> = {},
  cause?: unknown,
): PersistenceError {
  return new PersistenceError(code, message, details, cause === undefined ? undefined : { cause });
}

export function normalizeSqliteFailure(error: unknown, fallback: PersistenceErrorCode): PersistenceError {
  if (error instanceof PersistenceError) return error;
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;
  const code = record?.code;
  const message = record?.message;
  if (
    code === "ERR_SQLITE_ERROR" &&
    typeof message === "string" &&
    /(?:busy|locked)/iu.test(message)
  ) {
    return persistenceFailure("BUSY", "SQLite writer contention exceeded the configured bound", {}, error);
  }
  return persistenceFailure(fallback, "SQLite persistence operation failed", {}, error);
}
