import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateCodexEvidence } from "../scripts/codex-contract-lib.mjs";
import { repoRoot } from "../scripts/repo-utils.mjs";

const current = JSON.parse(
  readFileSync(path.join(repoRoot, "docs", "feasibility", "codex-stable-public-contract.json"), "utf8"),
);

test("current Codex evidence passes only as pinned-package preflight evidence", () => {
  assert.deepEqual(validateCodexEvidence(current), {
    boundaryStatus: "passed",
    evidenceMode: "package_validated",
    packagePreflight: "passed",
    productComposition: true,
    administratorPolicyAttestation: "not_run",
    externalE2E: "not_run",
    supportClaim: false,
  });
});

test("package-only Codex evidence cannot create a support claim", () => {
  assert.throws(() => validateCodexEvidence({ ...current, supportClaim: true }), /support claim/u);
  assert.throws(
    () => validateCodexEvidence({ ...current, administratorPolicyAttestation: "passed" }),
    /administrator or external support claim/u,
  );
  assert.throws(
    () => validateCodexEvidence({ ...current, productComposition: false }),
    /product composition evidence is absent/u,
  );
});

test("package-validated Codex mode refuses absent official or pinned-package evidence", () => {
  const withoutOfficialEvidence = {
    ...current,
    officialDocumentation: { status: "not_run", sources: [] },
  };
  assert.throws(() => validateCodexEvidence(withoutOfficialEvidence), /documentation evidence is incomplete/u);
  assert.throws(
    () => validateCodexEvidence({
      ...current,
      pinnedPackage: { ...current.pinnedPackage, inspectionStatus: "not_run" },
    }),
    /pinned Codex package evidence drifted/u,
  );
  assert.throws(() => validateCodexEvidence({ ...current, evidenceMode: "validated" }), /unknown Codex evidence mode/u);
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
    externalE2E: "passed",
    windowsObservation: {
      status: "passed",
      reason: "synthetic-validator-fixture",
    },
    capabilities: current.capabilities.map((capability) => ({ ...capability, status: "validated" })),
    supportClaim: true,
  };
  assert.throws(
    () => validateCodexEvidence(synthetic),
    /package-only product evidence cannot create an administrator or external support claim/u,
  );
  assert.throws(
    () =>
      validateCodexEvidence({
        ...current,
        officialDocumentation: {
          ...current.officialDocumentation,
          sources: ["https://example.com/codex", current.officialDocumentation.sources[1]],
        },
      }),
    /nonofficial OpenAI source/u,
  );
  assert.throws(
    () =>
      validateCodexEvidence({
        ...current,
        officialDocumentation: {
          ...current.officialDocumentation,
          sources: [
            "https://user:secret@developers.openai.com/codex/sdk?token=sentinel#raw",
            current.officialDocumentation.sources[1],
          ],
        },
      }),
    /user-info|sensitive/u,
  );
  assert.throws(
    () =>
      validateCodexEvidence({
        ...current,
        windowsObservation: {
          status: "not_run",
          reason: "read C:\\Users\\raw-user\\project and raw prompt",
        },
      }),
    /sensitive\/raw value/u,
  );
});

test("package capability criteria cannot be replaced with fabricated or sensitive proof", () => {
  const fabricated = {
    ...current,
    capabilities: current.capabilities.map((capability, index) =>
      index === 0 ? { ...capability, requiredEvidence: "raw model text only" } : capability,
    ),
  };
  assert.throws(() => validateCodexEvidence(fabricated), /evidence criterion drifted/u);
});
