import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateCodexEvidence } from "../scripts/codex-contract-lib.mjs";
import { repoRoot } from "../scripts/repo-utils.mjs";

const current = JSON.parse(
  readFileSync(path.join(repoRoot, "docs", "feasibility", "codex-stable-public-contract.json"), "utf8"),
);

test("current Codex evidence passes only as an explicit blocked boundary", () => {
  assert.deepEqual(validateCodexEvidence(current), {
    boundaryStatus: "passed",
    evidenceMode: "blocked",
    externalE2E: "not_run",
    supportClaim: false,
  });
});

test("blocked Codex evidence cannot create a support claim", () => {
  assert.throws(() => validateCodexEvidence({ ...current, supportClaim: true }), /support claim/u);
});

test("validated Codex mode refuses absent official and real evidence", () => {
  const structurallyValidated = {
    ...current,
    evidenceMode: "validated",
    officialDocumentation: { status: "not_run", sources: [] },
    windowsObservation: {
      status: "not_run",
      environment: "not-observed",
      procedure: "not-run",
      result: "not-run",
    },
    supportClaim: true,
  };
  assert.throws(() => validateCodexEvidence(structurallyValidated), /accepts blocked evidence only/u);
});

test("Codex evidence rejects raw thread or path identities", () => {
  assert.throws(() => validateCodexEvidence({ ...current, threadID: "forbidden" }), /sensitive\/raw field/u);
});

test("Codex evidence rejects unknown private-interface fields", () => {
  assert.throws(() => validateCodexEvidence({ ...current, privateInterface: true }), /field inventory/u);
});

test("synthetic positive shape cannot create E2E or support evidence", () => {
  const synthetic = {
    ...current,
    evidenceMode: "validated",
    officialDocumentation: { status: "validated", sources: ["https://developers.openai.com/codex/stable-public-fixture"] },
    windowsObservation: {
      status: "validated",
      environment: "synthetic-validator-fixture",
      procedure: "synthetic-validator-fixture",
      result: "synthetic-validator-fixture",
    },
    capabilities: current.capabilities.map((capability) => ({ ...capability, status: "validated" })),
    supportClaim: true,
  };
  assert.throws(() => validateCodexEvidence(synthetic), /accepts blocked evidence only/u);
  assert.throws(
    () =>
      validateCodexEvidence({
        ...synthetic,
        officialDocumentation: { status: "validated", sources: ["https://example.com/"] },
      }),
    /nonofficial OpenAI source/u,
  );
  assert.throws(
    () =>
      validateCodexEvidence({
        ...synthetic,
        officialDocumentation: {
          status: "validated",
          sources: ["https://user:secret@developers.openai.com/codex/?token=sentinel#raw"],
        },
      }),
    /user-info|sensitive/u,
  );
  assert.throws(
    () =>
      validateCodexEvidence({
        ...synthetic,
        windowsObservation: {
          status: "validated",
          environment: "win32",
          procedure: "read C:\\Users\\raw-user\\project and raw prompt",
          result: "raw model text only",
        },
      }),
    /sensitive\/raw value/u,
  );
});

test("blocked capability criteria cannot be replaced with fabricated or sensitive proof", () => {
  const fabricated = {
    ...current,
    capabilities: current.capabilities.map((capability, index) =>
      index === 0 ? { ...capability, requiredEvidence: "raw model text only" } : capability,
    ),
  };
  assert.throws(() => validateCodexEvidence(fabricated), /evidence criterion drifted/u);
});
