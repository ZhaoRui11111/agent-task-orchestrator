const REQUIRED_IMPLEMENTATION = Object.freeze({
  application: "implemented",
  port: "implemented",
  scheduledIngress: "implemented",
  testBackend: "no_effect_fake",
});

function fail(message) {
  throw new Error(message);
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(`${label} field inventory drifted`);
  }
}

export function validateSchedulerEvidence(record) {
  requireExactKeys(
    record,
    [
      "adapterImplemented",
      "contractId",
      "evidenceMode",
      "externalE2E",
      "implementation",
      "productBoundary",
      "schemaVersion",
      "supportClaim",
    ],
    "scheduler evidence",
  );
  if (record.schemaVersion !== 1) fail("unsupported scheduler evidence schema");
  if (record.contractId !== "ato.scheduler/v1") fail("scheduler contract identity drifted");
  if (record.evidenceMode !== "library_contract_only") fail("scheduler evidence mode drifted");
  if (record.adapterImplemented !== false || record.externalE2E !== "not_run" || record.supportClaim !== false) {
    fail("library-only evidence cannot create an adapter, external E2E, or support claim");
  }
  requireExactKeys(record.implementation, Object.keys(REQUIRED_IMPLEMENTATION), "scheduler implementation");
  for (const [key, expected] of Object.entries(REQUIRED_IMPLEMENTATION)) {
    if (record.implementation[key] !== expected) fail(`scheduler implementation field drifted: ${key}`);
  }
  requireExactKeys(
    record.productBoundary,
    ["defaultComposition", "platform", "schedulerOperationRoute"],
    "scheduler product boundary",
  );
  if (
    record.productBoundary.defaultComposition !== "absent" ||
    record.productBoundary.platform !== "unselected" ||
    record.productBoundary.schedulerOperationRoute !== "absent"
  ) {
    fail("scheduler product boundary drifted");
  }
  return Object.freeze({
    boundaryStatus: "passed",
    contractId: "ato.scheduler/v1",
    adapterImplemented: false,
    externalE2E: "not_run",
    supportClaim: false,
  });
}
