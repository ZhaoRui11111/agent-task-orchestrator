import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import * as repositoryFacade from "../src/persistence/application-repository.ts";
import { EXPECTED_PRODUCTION_SOURCE_FILES, repoRoot } from "../scripts/repo-utils.mjs";

const MODULE_NAMES = Object.freeze([
  "digest",
  "lifecycle",
  "model",
  "readers",
  "state",
  "transaction",
]);

const EXPECTED_INTERNAL_EDGES = Object.freeze({
  digest: ["model"],
  lifecycle: ["digest", "model", "state"],
  model: [],
  readers: ["model"],
  state: ["digest", "model", "readers"],
  transaction: ["digest", "model", "readers", "state"],
});

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "ApplicationTransaction",
  "DISPATCHER_AUDIT_CODES",
  "DISPATCHER_MEMBER_CODES",
  "DISPATCHER_RECONCILIATION_CODES",
  "applicationAuditKind",
  "applicationStateSha256",
  "applicationStateSha256ForLifecycleAuthorization",
  "bindApplicationDatabase",
  "commitDomainForOwner",
  "initializeDomainForOwner",
  "lifecycleAuthorizationSha256",
  "parseApplicationLifecycleAuthorization",
  "readApplicationState",
  "readApplicationStateForOwner",
  "readDomainForOwner",
  "unbindApplicationDatabase",
  "validateLifecycleAuthorizationForUse",
  "validateLifecycleAuthorizationForUseUntransactional",
  "withApplicationTransaction",
]);

function sourcePath(name) {
  return path.join(repoRoot, "src", "persistence", `application-repository-${name}.ts`);
}

function readSource(name) {
  return readFileSync(sourcePath(name), "utf8");
}

function internalEdges(source) {
  return [...new Set(
    [...source.matchAll(/from "\.\/application-repository-([a-z]+)\.ts"/gu)]
      .map((match) => match[1]),
  )].sort();
}

test("application repository facade preserves the exact runtime surface and contains only explicit re-exports", () => {
  const facade = readFileSync(path.join(repoRoot, "src", "persistence", "application-repository.ts"), "utf8");
  assert.deepEqual(Object.keys(repositoryFacade).sort(), [...EXPECTED_RUNTIME_EXPORTS].sort());
  assert.doesNotMatch(facade, /^\s*import\b/mu);
  assert.doesNotMatch(facade, /export\s+\*/u);
  assert.doesNotMatch(facade, /\b(?:class|function|const|let|var)\s+[A-Za-z_$]/u);
  assert.doesNotMatch(facade, /\b(?:SELECT|INSERT|UPDATE|DELETE|BEGIN)\b|WeakMap|node:sqlite/u);

  const model = readSource("model");
  const modelTypes = [...model.matchAll(/^export (?:interface|type) ([A-Za-z0-9_]+)/gmu)]
    .map((match) => match[1])
    .sort();
  const facadeTypeBlock = facade.match(/export type \{([\s\S]*?)\} from "\.\/application-repository-model\.ts";/u);
  assert.notEqual(facadeTypeBlock, null);
  const facadeTypes = [...facadeTypeBlock[1].matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\b/gu)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(facadeTypes, modelTypes);
});

test("six implementation modules have the exact acyclic dependency graph and never import the facade", () => {
  for (const name of MODULE_NAMES) {
    const source = readSource(name);
    assert.deepEqual(internalEdges(source), EXPECTED_INTERNAL_EDGES[name], name);
    assert.doesNotMatch(source, /from "\.\/application-repository\.ts"/u, name);
  }
  const model = readSource("model");
  assert.doesNotMatch(model, /database\.ts|SqliteDatabase|\b(?:SELECT|INSERT|UPDATE|DELETE|BEGIN)\b/u);
});

test("readers own all application-family SELECTs and transaction owns the one binding, class, and write boundary", () => {
  const sources = Object.fromEntries(MODULE_NAMES.map((name) => [name, readSource(name)]));
  assert.match(sources.readers, /\bSELECT\b/u);
  for (const name of MODULE_NAMES.filter((candidate) => candidate !== "readers")) {
    assert.doesNotMatch(sources[name], /\bSELECT\b/u, name);
  }
  const combined = MODULE_NAMES.map((name) => sources[name]).join("\n");
  assert.equal((combined.match(/new WeakMap</gu) ?? []).length, 1);
  assert.equal((combined.match(/export class ApplicationTransaction\b/gu) ?? []).length, 1);
  assert.equal((combined.match(/\brunWriteTransaction\s*\(/gu) ?? []).length, 1);
  assert.match(sources.transaction, /new WeakMap</u);
  assert.match(sources.transaction, /export class ApplicationTransaction\b/u);
  assert.match(sources.transaction, /\brunWriteTransaction\s*\(/u);
});

test("source and packed inventories include every generated artifact for all six modules", () => {
  const packageSmoke = readFileSync(path.join(repoRoot, "scripts", "package-smoke.mjs"), "utf8");
  for (const name of MODULE_NAMES) {
    const source = `src/persistence/application-repository-${name}.ts`;
    assert.equal(EXPECTED_PRODUCTION_SOURCE_FILES.includes(source), true, source);
    for (const suffix of ["d.ts", "d.ts.map", "js", "js.map"]) {
      const entry = `package/dist/persistence/application-repository-${name}.${suffix}`;
      assert.equal(packageSmoke.includes(`"${entry}"`), true, entry);
    }
  }
});
