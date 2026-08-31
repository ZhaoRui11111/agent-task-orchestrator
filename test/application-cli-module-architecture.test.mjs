import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import {
  EXPECTED_CLI_NODE_BUILTINS,
  EXPECTED_MIGRATION_FILES,
  EXPECTED_PRODUCTION_SOURCE_FILES,
  productionBoundaryFailures,
  repoRoot,
} from "../scripts/repo-utils.mjs";

const APPLICATION_MODULES = Object.freeze([
  "src/application-model.ts",
  "src/application-input.ts",
  "src/application-policy.ts",
  "src/application-domain.ts",
  "src/application-service.ts",
]);
const APPLICATION_FACADE = "src/application.ts";
const APPLICATION_EDGES = Object.freeze([
  "src/application-domain.ts->src/application-model.ts",
  "src/application-domain.ts->src/application-policy.ts",
  "src/application-input.ts->src/application-model.ts",
  "src/application-policy.ts->src/application-input.ts",
  "src/application-policy.ts->src/application-model.ts",
  "src/application-service.ts->src/application-domain.ts",
  "src/application-service.ts->src/application-input.ts",
  "src/application-service.ts->src/application-model.ts",
  "src/application-service.ts->src/application-policy.ts",
].sort());

const CLI_MODULES = Object.freeze([
  "src/cli-api-model.ts",
  "src/cli-api-parser.ts",
  "src/cli-api-presentation.ts",
  "src/cli-api-runtime.ts",
]);
const CLI_FACADE = "src/cli-api.ts";
const CLI_EDGES = Object.freeze([
  "src/cli-api-parser.ts->src/cli-api-model.ts",
  "src/cli-api-presentation.ts->src/cli-api-model.ts",
  "src/cli-api-runtime.ts->src/cli-api-model.ts",
  "src/cli-api-runtime.ts->src/cli-api-parser.ts",
  "src/cli-api-runtime.ts->src/cli-api-presentation.ts",
].sort());

const APPLICATION_RUNTIME_EXPORTS = Object.freeze([
  "APPLICATION_ERROR_CODES",
  "createApplicationService",
  "createApplicationServiceWithHooks",
  "isCanonicalCancellationReason",
].sort());
const APPLICATION_TYPE_EXPORTS = Object.freeze([
  "ApplicationCommand",
  "ApplicationDetail",
  "ApplicationError",
  "ApplicationErrorCode",
  "ApplicationFailure",
  "ApplicationIngress",
  "ApplicationResult",
  "ApplicationService",
  "ApplicationSuccess",
  "BootstrapCommand",
  "CapabilityEpochResult",
  "CapabilityUpgradeCommand",
  "ConfirmationRequest",
  "ProjectCommandResult",
  "RenewalCommand",
  "TrustedActorAssertion",
].sort());

const CLI_RUNTIME_EXPORTS = Object.freeze([
  "CLI_API_VERSION",
  "PUBLIC_ERROR_TABLE",
  "mapProductFailureToPublicCode",
  "parseCliArguments",
  "runCli",
].sort());
const CLI_TYPE_EXPORTS = Object.freeze([
  "CliFormat",
  "CliRunOptions",
  "CliRunResult",
  "PublicErrorCode",
].sort());

const EXPECTED_COMMAND_IDS = Object.freeze([
  "status",
  "doctor",
  "init",
  "restore",
  "authorization.renew",
  "authorization.list",
  "authorization.show",
  "authorization.issue",
  "authorization.revoke",
  "authorization.evaluate",
  "project.register",
  "project.show",
  "project.update",
  "project.disable",
  "task.create",
  "task.show",
  "task.update-body",
  "task.set-parent",
  "task.clear-parent",
  "task.mark-ready",
  "task.cancel",
  "dependency.add",
  "dependency.remove",
  "backup.create",
  "authorization.upgrade",
  "dispatch.run",
  "dispatch.resume",
  "execution.inspect",
  "execution.resume",
  "execution.retry",
  "execution.request-cancel",
  "manual.outcome-report",
  "execution.accept-manual-completion",
]);

const EXPECTED_PUBLIC_ERRORS = Object.freeze([
  "CLI_INVALID_INPUT",
  "CLI_UNSUPPORTED_VERSION",
  "RUNTIME_NOT_INITIALIZED",
  "RUNTIME_ALREADY_INITIALIZED",
  "CAPABILITY_RENEWAL_NOT_DUE",
  "AUTHORIZATION_DENIED",
  "CONFIRMATION_REQUIRED",
  "SCOPE_EXPANSION_DENIED",
  "PROJECT_NOT_FOUND",
  "TASK_NOT_FOUND",
  "GRANT_NOT_FOUND",
  "BACKUP_NOT_FOUND",
  "EXECUTION_NOT_FOUND",
  "DISPATCH_RUN_NOT_FOUND",
  "STALE_REVISION",
  "DOMAIN_REJECTED",
  "PROJECT_ALREADY_REGISTERED",
  "PROJECT_REGISTRY_REJECTED",
  "RESULT_LIMIT_EXCEEDED",
  "OPERATION_CONFLICT",
  "STALE_FENCE",
  "LEASE_EXPIRED",
  "RECONCILIATION_REQUIRED",
  "RUNTIME_UNSAFE",
  "RUNTIME_ACTIVE",
  "SCHEMA_UNSUPPORTED",
  "MIGRATION_INVALID",
  "STATE_CORRUPT",
  "BACKUP_INVALID",
  "PERSISTENCE_UNAVAILABLE",
  "ADAPTER_FAILURE",
  "DATA_LOSS_ACK_REQUIRED",
  "RESTORE_CONFLICT",
  "RESTORE_BLOCKED",
  "RESTORE_RECOVERY_REQUIRED",
  "AMBIGUOUS_EXTERNAL_STATE",
  "INTERNAL_ERROR",
]);

const EXPECTED_CLI_BUILTINS = Object.freeze({
  "src/cli-api-model.ts": Object.freeze([]),
  "src/cli-api-parser.ts": Object.freeze(["node:path"]),
  "src/cli-api-presentation.ts": Object.freeze([]),
  "src/cli-api-runtime.ts": Object.freeze(["node:crypto"]),
  "src/cli-api.ts": Object.freeze([]),
  "src/cli.ts": Object.freeze(["node:path", "node:url"]),
});

function readSource(relative) {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

function parseSource(relative) {
  const parsed = ts.createSourceFile(
    relative,
    readSource(relative),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert.deepEqual(parsed.parseDiagnostics, [], `${relative} has TypeScript parse diagnostics`);
  return parsed;
}

function staticModuleSpecifiers(relative) {
  const specifiers = [];
  for (const statement of parseSource(relative).statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
}

function resolveLocalModule(relative, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier));
}

function internalEdges(modules, facade) {
  const moduleSet = new Set(modules);
  const edges = [];
  for (const relative of modules) {
    for (const specifier of staticModuleSpecifiers(relative)) {
      const resolved = resolveLocalModule(relative, specifier);
      assert.notEqual(resolved, facade, `${relative} imports its aggregate facade`);
      if (moduleSet.has(resolved)) edges.push(`${relative}->${resolved}`);
    }
  }
  return edges.sort();
}

function assertAcyclic(modules, edges) {
  const targets = new Map(modules.map((relative) => [relative, []]));
  for (const edge of edges) {
    const [source, target] = edge.split("->");
    targets.get(source).push(target);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(relative) {
    assert.equal(visiting.has(relative), false, `module cycle reaches ${relative}`);
    if (visited.has(relative)) return;
    visiting.add(relative);
    for (const target of targets.get(relative)) visit(target);
    visiting.delete(relative);
    visited.add(relative);
  }
  for (const relative of modules) visit(relative);
}

function facadeExports(relative, allowedTargets) {
  const runtime = [];
  const types = [];
  const sourceFile = parseSource(relative);
  assert.ok(sourceFile.statements.length > 0, `${relative} facade is empty`);
  for (const statement of sourceFile.statements) {
    assert.ok(ts.isExportDeclaration(statement), `${relative} contains non-export logic`);
    assert.ok(statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier),
      `${relative} contains a local export`);
    assert.ok(statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause),
      `${relative} contains a wildcard/default export`);
    const target = resolveLocalModule(relative, statement.moduleSpecifier.text);
    assert.ok(allowedTargets.has(target), `${relative} re-exports an unapproved module`);
    for (const element of statement.exportClause.elements) {
      assert.equal(element.propertyName, undefined, `${relative} aliases ${element.name.text}`);
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  return Object.freeze({ runtime: runtime.sort(), types: types.sort() });
}

function tokenOwners(modules, token) {
  return modules.filter((relative) => readSource(relative).includes(token));
}

function unwrapExpression(expression) {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) || ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)) current = current.expression;
  if (ts.isCallExpression(current) && current.arguments.length === 1 &&
    ts.isPropertyAccessExpression(current.expression) &&
    ts.isIdentifier(current.expression.expression) && current.expression.expression.text === "Object" &&
    current.expression.name.text === "freeze") return unwrapExpression(current.arguments[0]);
  return current;
}

function variableInitializer(relative, name) {
  for (const statement of parseSource(relative).statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer !== undefined) {
        return unwrapExpression(declaration.initializer);
      }
    }
  }
  assert.fail(`${relative} does not define ${name}`);
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  assert.fail("computed property is not permitted in a frozen CLI table");
}

function commandIds() {
  const initializer = variableInitializer("src/cli-api-model.ts", "COMMAND_SPECS");
  assert.ok(ts.isArrayLiteralExpression(initializer), "COMMAND_SPECS is not a frozen array literal");
  return initializer.elements.map((element) => {
    const unwrapped = unwrapExpression(element);
    assert.ok(ts.isObjectLiteralExpression(unwrapped), "COMMAND_SPECS contains a non-object member");
    const id = unwrapped.properties.find((property) =>
      ts.isPropertyAssignment(property) && propertyName(property.name) === "id");
    assert.ok(id !== undefined && ts.isPropertyAssignment(id), "command spec lacks an id");
    const value = unwrapExpression(id.initializer);
    assert.ok(ts.isStringLiteral(value), "command id is not a string literal");
    return value.text;
  });
}

function publicErrorCodes() {
  const initializer = variableInitializer("src/cli-api-model.ts", "PUBLIC_ERROR_TABLE");
  assert.ok(ts.isObjectLiteralExpression(initializer), "PUBLIC_ERROR_TABLE is not a frozen object literal");
  return initializer.properties.map((property) => {
    assert.ok(ts.isPropertyAssignment(property), "PUBLIC_ERROR_TABLE contains a non-property member");
    return propertyName(property.name);
  });
}

function nodeBuiltins(relative) {
  return staticModuleSpecifiers(relative).filter((specifier) => specifier.startsWith("node:")).sort();
}

test("Application modules have the exact DAG, facade, and sole transaction owner", () => {
  assert.equal(APPLICATION_MODULES.length, 5);
  const edges = internalEdges(APPLICATION_MODULES, APPLICATION_FACADE);
  assert.deepEqual(edges, APPLICATION_EDGES);
  assertAcyclic(APPLICATION_MODULES, edges);

  const exports = facadeExports(APPLICATION_FACADE, new Set(APPLICATION_MODULES));
  assert.deepEqual(exports.runtime, APPLICATION_RUNTIME_EXPORTS);
  assert.deepEqual(exports.types, APPLICATION_TYPE_EXPORTS);
  assert.equal(exports.runtime.length, 4);
  assert.equal(exports.types.length, 16);

  for (const token of ["PersistenceStore", "withApplicationTransaction", "createApplicationServiceInternal"]) {
    assert.deepEqual(tokenOwners(APPLICATION_MODULES, token), ["src/application-service.ts"]);
  }
  assert.equal(
    [...readSource("src/application-service.ts").matchAll(/\bfunction\s+createApplicationServiceInternal\b/gu)].length,
    1,
  );
});

test("CLI modules have the exact DAG, facade, tables, and sole effect owner", () => {
  assert.equal(CLI_MODULES.length, 4);
  const edges = internalEdges(CLI_MODULES, CLI_FACADE);
  assert.deepEqual(edges, CLI_EDGES);
  assertAcyclic(CLI_MODULES, edges);

  const exports = facadeExports(CLI_FACADE, new Set(CLI_MODULES));
  assert.deepEqual(exports.runtime, CLI_RUNTIME_EXPORTS);
  assert.deepEqual(exports.types, CLI_TYPE_EXPORTS);
  assert.equal(exports.runtime.length, 5);
  assert.equal(exports.types.length, 4);
  assert.deepEqual(commandIds(), EXPECTED_COMMAND_IDS);
  assert.deepEqual(publicErrorCodes(), EXPECTED_PUBLIC_ERRORS);
  assert.equal(commandIds().length, 33);
  assert.equal(publicErrorCodes().length, 37);

  for (const token of [
    "runCli",
    "selectTrustedLocalRuntimeRoot",
    "inspectRuntimeDoctor",
    "prepareLocalRuntime",
    "loadLocalRuntime",
    "openPersistence",
    "createApplicationService",
    "createManualExecutionBackend",
    "createProductRuntime",
    "restoreBackup",
  ]) assert.deepEqual(tokenOwners(CLI_MODULES, token), ["src/cli-api-runtime.ts"]);
  assert.equal(
    [...readSource("src/cli-api-runtime.ts").matchAll(/\basync\s+function\s+runCli\b/gu)].length,
    1,
  );

  const runtime = readSource("src/cli-api-runtime.ts");
  const runCliStart = runtime.search(/\basync\s+function\s+runCli\b/u);
  const runCliBody = runtime.slice(runCliStart);
  const parsePosition = runCliBody.indexOf("parseCliArguments(");
  const selectionPosition = runCliBody.indexOf("selectTrustedLocalRuntimeRoot(");
  const openPosition = runCliBody.indexOf("openPersistence(");
  assert.ok(runCliStart >= 0 && parsePosition >= 0 && selectionPosition > parsePosition && openPosition > selectionPosition,
    "CLI parsing and unsupported-version refusal must precede runtime selection/open");
  assert.match(readSource("src/cli-api-parser.ts"), /CLI_UNSUPPORTED_VERSION/u);
});

test("CLI Node built-ins equal the exact per-file map and repo-utils rejects family-wide exceptions", () => {
  assert.equal(EXPECTED_PRODUCTION_SOURCE_FILES.length, 43);
  assert.deepEqual(EXPECTED_CLI_NODE_BUILTINS, EXPECTED_CLI_BUILTINS);
  for (const [relative, expected] of Object.entries(EXPECTED_CLI_BUILTINS)) {
    assert.deepEqual(nodeBuiltins(relative), expected, `${relative} Node built-ins drifted`);
  }

  const inventory = [...EXPECTED_PRODUCTION_SOURCE_FILES, ...EXPECTED_MIGRATION_FILES].sort();
  assert.deepEqual(productionBoundaryFailures(inventory, readSource), []);
  const sources = new Map(EXPECTED_PRODUCTION_SOURCE_FILES.map((relative) => [relative, readSource(relative)]));
  sources.set("src/cli-api-model.ts", `import "node:path";\n${sources.get("src/cli-api-model.ts")}`);
  const widened = productionBoundaryFailures(inventory, (relative) => sources.get(relative));
  assert.ok(widened.some((failure) => failure === "src/cli-api-model.ts: CLI Node built-in mapping drifted"));

  const repoUtils = readSource("scripts/repo-utils.mjs");
  assert.doesNotMatch(repoUtils, /relative\.startsWith\(\s*["']src\/cli/iu);
  assert.doesNotMatch(repoUtils, /relative\s*===\s*["']src\/cli\.ts["']\s*\|\|\s*relative\s*===\s*["']src\/cli-api\.ts["']/u);
});
