import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateSchedulerEvidence } from "../scripts/scheduler-contract-lib.mjs";
import { repoRoot } from "../scripts/repo-utils.mjs";

const current = JSON.parse(
  readFileSync(path.join(repoRoot, "docs", "feasibility", "scheduler-local-contract.json"), "utf8"),
);

test("current scheduler evidence passes only at the library boundary", () => {
  assert.deepEqual(validateSchedulerEvidence(current), {
    boundaryStatus: "passed",
    contractId: "ato.scheduler/v1",
    adapterImplemented: false,
    externalE2E: "not_run",
    supportClaim: false,
  });
});

test("library-only evidence cannot claim an adapter, external E2E, or support", () => {
  assert.throws(() => validateSchedulerEvidence({ ...current, adapterImplemented: true }), /cannot create/u);
  assert.throws(() => validateSchedulerEvidence({ ...current, externalE2E: "passed" }), /cannot create/u);
  assert.throws(() => validateSchedulerEvidence({ ...current, supportClaim: true }), /cannot create/u);
});

test("scheduler evidence refuses contract and product-boundary drift", () => {
  assert.throws(() => validateSchedulerEvidence({ ...current, contractId: "ato.scheduler/v0" }), /identity/u);
  assert.throws(
    () => validateSchedulerEvidence({
      ...current,
      productBoundary: { ...current.productBoundary, schedulerOperationRoute: "implemented" },
    }),
    /product boundary/u,
  );
  assert.throws(() => validateSchedulerEvidence({ ...current, concreteAdapter: "invented" }), /inventory/u);
});
