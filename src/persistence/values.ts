import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { persistenceFailure } from "./errors.ts";

type UnknownRecord = Record<string, unknown>;

export function exactRecord(value: unknown, keys: readonly string[], label: string): Readonly<UnknownRecord> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw persistenceFailure("INVALID_INPUT", `${label} must be an object with the exact field set`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw persistenceFailure("INVALID_INPUT", `${label} must be a canonical plain object`);
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) {
      throw persistenceFailure("INVALID_INPUT", `${label} must be an object with the exact field set`);
    }
    const allowed = new Set(keys);
    const result: UnknownRecord = Object.create(null) as UnknownRecord;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !allowed.has(key)) {
        throw persistenceFailure("INVALID_INPUT", `${label} contains an unknown field`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw persistenceFailure("INVALID_INPUT", `${label} contains an unsafe field`);
      }
      result[key] = descriptor.value;
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("INVALID_INPUT", `${label} could not be inspected safely`, {}, error);
  }
}

export function canonicalArray(value: unknown, label: string): readonly unknown[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      throw persistenceFailure("INVALID_INPUT", `${label} must be a canonical array`);
    }
    const ownKeys = Reflect.ownKeys(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      lengthDescriptor.enumerable ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      ownKeys.length !== lengthDescriptor.value + 1
    ) {
      throw persistenceFailure("INVALID_INPUT", `${label} must not contain extra or sparse members`);
    }
    const result: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw persistenceFailure("INVALID_INPUT", `${label} contains an unsafe member`);
      }
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("INVALID_INPUT", `${label} could not be inspected safely`, {}, error);
  }
}

export function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value))}\n`;
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

export interface FileIdentity {
  readonly dev: string;
  readonly ino: string;
  readonly mode: number;
  readonly size: number;
}

function statsIdentity(stats: ReturnType<typeof lstatSync>): FileIdentity {
  return Object.freeze({
    dev: String(stats.dev),
    ino: String(stats.ino),
    mode: stats.mode,
    size: stats.size,
  });
}

export function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size
  );
}

export function sameFileObjectIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    (left.mode & 0o170000) === (right.mode & 0o170000)
  );
}

export function pathEntryExistsNoFollow(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as { readonly code?: unknown } | null)?.code === "ENOENT") return false;
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Path entry presence could not be inspected safely", {}, error);
  }
}

export function inspectRegularFile(path: string): FileIdentity {
  try {
    const stats = lstatSync(path);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Expected a regular no-follow file");
    }
    return statsIdentity(stats);
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Regular file identity could not be established", {}, error);
  }
}

export function inspectPrivateRegularFile(path: string): FileIdentity {
  try {
    const before = inspectRegularFile(path);
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const descriptor = openSync(path, (constants.O_RDONLY ?? 0) | noFollow);
    try {
      const opened = statsIdentity(fstatSync(descriptor));
      if (!sameFileIdentity(before, opened)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "File identity changed before private-file inspection");
      }
      if (process.platform !== "win32" && (opened.mode & 0o077) !== 0) {
        throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Persistence file permissions are not user-only");
      }
      const terminal = inspectRegularFile(path);
      if (!sameFileIdentity(opened, terminal)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "File path changed during private-file inspection");
      }
      return terminal;
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Private persistence file could not be inspected", {}, error);
  }
}

export function enforcePrivateRegularFile(path: string): FileIdentity {
  try {
    const before = inspectRegularFile(path);
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const descriptor = openSync(path, (constants.O_RDWR ?? 0) | noFollow);
    try {
      const opened = statsIdentity(fstatSync(descriptor));
      if (!sameFileIdentity(before, opened)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "File identity changed before permission enforcement");
      }
      if (process.platform !== "win32" && (opened.mode & 0o077) !== 0) {
        fchmodSync(descriptor, 0o600);
        fsyncSync(descriptor);
      }
      const after = statsIdentity(fstatSync(descriptor));
      if (!sameFileObjectIdentity(opened, after) || opened.size !== after.size) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "File identity changed during permission enforcement");
      }
      if (process.platform !== "win32" && (after.mode & 0o077) !== 0) {
        throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Persistence file permissions are not user-only");
      }
      const terminal = inspectRegularFile(path);
      if (!sameFileIdentity(after, terminal)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "File path changed after permission enforcement");
      }
      return terminal;
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Persistence file permissions could not be enforced", {}, error);
  }
}

export function reservePrivateRegularFile(path: string): FileIdentity {
  try {
    const flags =
      (constants.O_RDWR ?? 0) |
      (constants.O_CREAT ?? 0) |
      (constants.O_EXCL ?? 0) |
      (constants.O_NOFOLLOW ?? 0);
    const descriptor = openSync(path, flags, 0o600);
    try {
      fsyncSync(descriptor);
      const identity = statsIdentity(fstatSync(descriptor));
      if (identity.size !== 0 || (process.platform !== "win32" && (identity.mode & 0o077) !== 0)) {
        throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Reserved persistence file is not private and empty");
      }
      return identity;
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Private file reservation failed", {}, error);
  }
}

export function readRegularFile(path: string): Readonly<{ bytes: Uint8Array; identity: FileIdentity }> {
  try {
    const before = inspectRegularFile(path);
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const descriptor = openSync(path, (constants.O_RDONLY ?? 0) | noFollow);
    try {
      const opened = statsIdentity(fstatSync(descriptor));
      if (!sameFileIdentity(before, opened)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "File identity changed before read");
      }
      const bytes = readFileSync(descriptor);
      const after = statsIdentity(fstatSync(descriptor));
      if (!sameFileIdentity(opened, after) || after.size !== bytes.byteLength) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "File identity changed during read");
      }
      return Object.freeze({ bytes, identity: after });
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Regular file could not be read safely", {}, error);
  }
}

export function writeExclusiveFile(path: string, value: string | Uint8Array): FileIdentity {
  try {
    const flags =
      (constants.O_WRONLY ?? 0) |
      (constants.O_CREAT ?? 0) |
      (constants.O_EXCL ?? 0) |
      (constants.O_NOFOLLOW ?? 0);
    const descriptor = openSync(path, flags, 0o600);
    try {
      writeFileSync(descriptor, value);
      fsyncSync(descriptor);
      const identity = statsIdentity(fstatSync(descriptor));
      if (identity.size <= 0) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "Exclusive file publication produced no bytes");
      }
      return identity;
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Exclusive file publication failed", {}, error);
  }
}

export function unlinkOwnedFile(
  path: string,
  expected: FileIdentity,
  expectedSha256?: string,
): void {
  try {
    const read = expectedSha256 === undefined ? null : readRegularFile(path);
    const observed = read === null ? inspectRegularFile(path) : read.identity;
    if (!sameFileIdentity(expected, observed)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Owned file identity changed before unlink");
    }
    if (expectedSha256 !== undefined && read !== null && sha256(read.bytes) !== expectedSha256) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Owned file content changed before unlink");
    }
    unlinkSync(path);
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Owned file could not be unlinked safely", {}, error);
  }
}

export function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw persistenceFailure("INTEGRITY_ERROR", `${label} is not valid UTF-8`, {}, error);
  }
}
