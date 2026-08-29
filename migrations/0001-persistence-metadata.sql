CREATE TABLE schema_metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  domain_initialized INTEGER NOT NULL CHECK (domain_initialized IN (0, 1)),
  registry_identity TEXT NOT NULL CHECK (length(registry_identity) = 64),
  schema_fingerprint TEXT NOT NULL CHECK (length(schema_fingerprint) = 64),
  updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
) STRICT;

CREATE TABLE migration_history (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  migration_id TEXT NOT NULL UNIQUE CHECK (length(migration_id) > 0),
  checksum_sha256 TEXT NOT NULL CHECK (length(checksum_sha256) = 64),
  applied_at TEXT NOT NULL CHECK (length(applied_at) > 0),
  application_version TEXT NOT NULL CHECK (length(application_version) > 0)
) STRICT;
