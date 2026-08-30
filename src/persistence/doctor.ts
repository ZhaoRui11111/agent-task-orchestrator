import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { readApplicationState, readVersionThreeApplicationState } from "./application-repository.ts";
import { inspectRestoreInventory, verifyBackupGeneration } from "./backup.ts";
import { openDiagnosticDatabase, verifyDatabaseIntegrity } from "./database.ts";
import { PersistenceError } from "./errors.ts";
import { currentSchemaVersion, inspectSchemaEvidence } from "./migrations.ts";
import { readDomainSnapshot } from "./repository.ts";
import { inspectExistingRuntimeLayout, listConnectionReceiptNames } from "./runtime.ts";
import {
  inspectRegularFile,
  pathEntryExistsNoFollow,
} from "./values.ts";

export type DoctorHealth =
  | "healthy"
  | "not_initialized"
  | "upgrade_required"
  | "partial_runtime"
  | "runtime_active"
  | "restore_pending"
  | "restore_ambiguous"
  | "runtime_unsafe"
  | "schema_newer"
  | "migration_invalid"
  | "state_corrupt"
  | "backup_invalid";

export interface DoctorResult {
  readonly health: DoctorHealth;
  readonly initialized: boolean | null;
  readonly schemaVersion: number | null;
  readonly activeUse: boolean | null;
  readonly backupInventory: "not_checked" | "empty" | "valid" | "invalid";
  readonly restoreState: "not_checked" | "none" | "pending" | "ambiguous";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function result(
  health: DoctorHealth,
  initialized: boolean | null,
  schemaVersion: number | null,
  activeUse: boolean | null,
  backupInventory: DoctorResult["backupInventory"],
  restoreState: DoctorResult["restoreState"],
): DoctorResult {
  return Object.freeze({ health, initialized, schemaVersion, activeUse, backupInventory, restoreState });
}

function absent(pathValue: string): boolean {
  try {
    lstatSync(pathValue);
    return false;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}

function unsafeDirectory(pathValue: string): boolean {
  try {
    const stat = lstatSync(pathValue);
    return !stat.isDirectory() || stat.isSymbolicLink();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    return true;
  }
}

function unsafeOwnedTree(pathValue: string): boolean {
  try {
    const stat = lstatSync(pathValue);
    if (stat.isSymbolicLink()) return true;
    if (stat.isFile()) return false;
    if (!stat.isDirectory()) return true;
    return readdirSync(pathValue).some((name) => unsafeOwnedTree(path.join(pathValue, name)));
  } catch {
    return true;
  }
}

function inspectRuntimeDoctorInternal(
  runtimeRoot: string,
  sourceCheckoutRoot: string,
  backupInspection: "verify" | "defer",
): DoctorResult {
  if (absent(runtimeRoot)) return result("not_initialized", false, null, false, "empty", "none");
  const requiredDirectories = [
    runtimeRoot,
    path.join(runtimeRoot, "backups"),
    path.join(runtimeRoot, "backups", ".staging"),
    path.join(runtimeRoot, "backups", "generations"),
    path.join(runtimeRoot, "connections"),
    path.join(runtimeRoot, "restore"),
    path.join(runtimeRoot, "restore", "staging"),
    path.join(runtimeRoot, "restore", "retained"),
    path.join(runtimeRoot, "restore", "receipts"),
  ];
  if (requiredDirectories.some(unsafeDirectory)) {
    return result("runtime_unsafe", null, null, null, "not_checked", "not_checked");
  }
  if (requiredDirectories.some(absent)) return result("partial_runtime", null, null, null, "not_checked", "not_checked");
  try {
    const layout = inspectExistingRuntimeLayout({ runtimeRoot, sourceCheckoutRoot, projectRoots: [] });
    const receiptNames = listConnectionReceiptNames(layout);
    const lockPresent = pathEntryExistsNoFollow(layout.lifecycleLockPath);
    if (lockPresent) inspectRegularFile(layout.lifecycleLockPath);
    const active = lockPresent || receiptNames.length !== 0;
    const restoreState = inspectRestoreInventory(layout);
    let backupInventory: DoctorResult["backupInventory"] = backupInspection === "verify" ? "empty" : "not_checked";
    if (backupInspection === "verify") {
      const staging = readdirSync(layout.backupStagingRoot);
      const generations = readdirSync(layout.backupGenerationsRoot);
      if (staging.length !== 0) {
        for (const name of staging) {
          const stagePath = path.join(layout.backupStagingRoot, name);
          if (unsafeDirectory(stagePath) || unsafeOwnedTree(stagePath)) {
            return result("runtime_unsafe", null, null, active, "not_checked", restoreState);
          }
        }
        backupInventory = "invalid";
      } else if (generations.length !== 0) {
        backupInventory = "valid";
        for (const generationId of generations) {
          if (!UUID_PATTERN.test(generationId)) {
            backupInventory = "invalid";
            break;
          }
          try {
            verifyBackupGeneration(layout, generationId);
          } catch (error) {
            if (error instanceof PersistenceError &&
                (error.code === "PATH_IDENTITY_CHANGED" || error.code === "UNSAFE_RUNTIME_ROOT")) throw error;
            backupInventory = "invalid";
            break;
          }
        }
      }
    }
    if (restoreState === "ambiguous") return result("restore_ambiguous", null, null, active, backupInventory, restoreState);
    if (restoreState === "pending") return result("restore_pending", null, null, active, backupInventory, restoreState);
    if (active) return result("runtime_active", null, null, true, backupInventory, restoreState);
    if (!pathEntryExistsNoFollow(layout.databasePath)) {
      return result(backupInventory === "invalid" ? "backup_invalid" : "not_initialized", false, null, false, backupInventory, restoreState);
    }
    const database = openDiagnosticDatabase(layout.databasePath);
    try {
      let evidence;
      try {
        evidence = inspectSchemaEvidence(database);
      } catch (error) {
        if (error instanceof PersistenceError && error.code === "SCHEMA_NEWER") {
          const observed = typeof error.details.databaseVersion === "number" ? error.details.databaseVersion : null;
          return result("schema_newer", null, observed, false, backupInventory, restoreState);
        }
        if (error instanceof PersistenceError &&
            (error.code === "MIGRATION_CHECKSUM_MISMATCH" || error.code === "MIGRATION_HISTORY_MISMATCH" || error.code === "MIGRATION_FAILED")) {
          return result("migration_invalid", null, null, false, backupInventory, restoreState);
        }
        throw error;
      }
      verifyDatabaseIntegrity(database);
      if (evidence.schemaVersion < 2) {
        return result(backupInventory === "invalid" ? "backup_invalid" : "upgrade_required", false, evidence.schemaVersion, false, backupInventory, restoreState);
      }
      readDomainSnapshot(database);
      if (evidence.schemaVersion === 2) {
        return result(backupInventory === "invalid" ? "backup_invalid" : "upgrade_required", false, 2, false, backupInventory, restoreState);
      }
      if (evidence.schemaVersion === 3) {
        let state;
        try {
          state = readVersionThreeApplicationState(database);
        } catch (error) {
          if (error instanceof PersistenceError &&
              (error.code === "CORRUPT_ROW" || error.code === "INTEGRITY_ERROR")) {
            return result("state_corrupt", null, 3, false, backupInventory, restoreState);
          }
          throw error;
        }
        const applicationEmpty = state.projects.length === 0 && state.bootstrap === null &&
          state.identity === null && state.grants.length === 0 && state.epochs.length === 0 &&
          state.requests.length === 0 && state.decisions.length === 0 &&
          state.audit.length === 0 && state.lifecycle.length === 0;
        if (state.bootstrap === null && !applicationEmpty) {
          return result("state_corrupt", null, 3, false, backupInventory, restoreState);
        }
        return result(
          backupInventory === "invalid" ? "backup_invalid" : "upgrade_required",
          state.bootstrap !== null,
          3,
          false,
          backupInventory,
          restoreState,
        );
      }
      if (evidence.schemaVersion !== currentSchemaVersion()) {
        return result("schema_newer", null, evidence.schemaVersion, false, backupInventory, restoreState);
      }
      const state = readApplicationState(database);
      let health: DoctorHealth;
      let initialized: boolean;
      if (state.bootstrap === null) {
        const applicationEmpty = state.projects.length === 0 && state.identity === null && state.grants.length === 0 &&
          state.epochs.length === 0 && state.requests.length === 0 && state.decisions.length === 0 &&
          state.audit.length === 0 && state.lifecycle.length === 0;
        if (!applicationEmpty) return result("state_corrupt", null, 4, false, backupInventory, restoreState);
        health = "not_initialized";
        initialized = false;
      } else if (state.bootstrap.vocabularyVersion === 3 && state.identity === null) {
        health = "upgrade_required";
        initialized = true;
      } else {
        health = "healthy";
        initialized = true;
      }
      if (backupInventory === "invalid") health = "backup_invalid";
      return result(health, initialized, 4, false, backupInventory, restoreState);
    } finally {
      database.close();
    }
  } catch (error) {
    if (error instanceof PersistenceError) {
      if (error.code === "MIGRATION_CHECKSUM_MISMATCH" || error.code === "MIGRATION_HISTORY_MISMATCH" || error.code === "MIGRATION_FAILED") {
        return result("migration_invalid", null, null, false, "not_checked", "not_checked");
      }
      if (error.code === "CORRUPT_ROW" || error.code === "INTEGRITY_ERROR") {
        return result("state_corrupt", null, null, false, "not_checked", "not_checked");
      }
    }
    return result("runtime_unsafe", null, null, null, "not_checked", "not_checked");
  }
}

export function inspectRuntimeDoctor(runtimeRoot: string, sourceCheckoutRoot: string): DoctorResult {
  return inspectRuntimeDoctorInternal(runtimeRoot, sourceCheckoutRoot, "verify");
}

export function inspectRuntimeForRestoreAuthorizationPreflight(
  runtimeRoot: string,
  sourceCheckoutRoot: string,
): DoctorResult {
  return inspectRuntimeDoctorInternal(runtimeRoot, sourceCheckoutRoot, "defer");
}
