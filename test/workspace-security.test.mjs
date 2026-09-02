import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { createWorkspaceApplicationService } from "../src/index.ts";

const applicationPath = path.join(import.meta.dirname, "..", "src", "workspace-application.ts");
const modelPath = path.join(import.meta.dirname, "..", "src", "persistence", "application-repository-model.ts");

function parsedSource(fileName) {
  return ts.createSourceFile(
    fileName,
    readFileSync(fileName, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

test("workspace writer callbacks contain no trusted ingress, backend, or external validation call", () => {
  const source = parsedSource(applicationPath);
  const callbacks = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      node.expression.text === "withApplicationTransaction" && node.arguments.length === 2
    ) callbacks.push(node.arguments[1]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callbacks.length >= 5);
  const forbidden = /\b(?:trustedContext|nextIdentifier|phaseIdentity|confirmationForCleanup|invokeWorkspaceBackend|validateRuntime|readApplicationStateForOwner)\s*\(|\b(?:ingress|backend)\s*\./u;
  for (const callback of callbacks) {
    assert.doesNotMatch(callback.getText(source), forbidden);
    assert.doesNotMatch(callback.getText(source), /hooks\.afterStage/u);
  }
  const fullText = source.getFullText();
  assert.equal((fullText.match(/invokeWorkspaceBackend\s*\(/gu) ?? []).length, 1);
  assert.equal((fullText.match(/confirmationForCleanup\s*\(ingress/gu) ?? []).length, 1);
});

test("malformed workspace commands fail before trusted ingress, persistence, or backend access", () => {
  let ingressCalls = 0;
  let backendCalls = 0;
  let getterCalls = 0;
  const ingress = Object.freeze({
    currentActor() { ingressCalls += 1; throw new Error("trusted ingress must not run"); },
    now() { ingressCalls += 1; throw new Error("trusted ingress must not run"); },
    nextId() { ingressCalls += 1; throw new Error("trusted ingress must not run"); },
    confirmHighRisk() { ingressCalls += 1; throw new Error("trusted ingress must not run"); },
  });
  const backend = new Proxy({}, {
    get() { backendCalls += 1; throw new Error("backend must not run"); },
  });
  const service = createWorkspaceApplicationService({}, backend, ingress, {
    adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
  });
  const malformed = Object.create(null);
  Object.defineProperty(malformed, "kind", {
    enumerable: true,
    get() { getterCalls += 1; return "workspace.reserve"; },
  });
  const exceptional = new Proxy({}, { ownKeys() { throw new Error("hostile ownKeys"); } });
  const cases = [
    ["reserve", { kind: "workspace.reserve" }],
    ["create", { kind: "workspace.create" }],
    ["inspect", { kind: "workspace.inspect" }],
    ["recover", { kind: "workspace.recover" }],
    ["cleanup", { kind: "workspace.cleanup" }],
    ["reserve", malformed],
    ["reserve", exceptional],
  ];
  for (const [operation, value] of cases) {
    const result = service[operation](value);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_INPUT");
  }
  assert.equal(getterCalls, 0);
  assert.equal(ingressCalls, 0);
  assert.equal(backendCalls, 0);
});

test("dedicated workspace event evidence has one exact bounded redacted field set", () => {
  const source = parsedSource(modelPath);
  let eventInterface = null;
  function visit(node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === "WorkspaceEventRecord") eventInterface = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(eventInterface);
  const names = eventInterface.members.map((member) => member.name?.getText(source));
  assert.deepEqual(names, [
    "eventId",
    "operationId",
    "intentId",
    "eventKind",
    "outcome",
    "reasonCode",
    "actorId",
    "correlationId",
    "causationId",
    "workspaceId",
    "generation",
    "generationRevision",
    "observationNumber",
    "evidenceReference",
    "createdAt",
  ]);
  assert.equal(names.some((name) => /path|body|message|stack|sql|environment|credential|secret/iu.test(name)), false);
});
