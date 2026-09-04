import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EXPECTED_PRODUCTION_SOURCE_FILES,
  gitInventory,
  invariant,
  productionBoundaryFailures,
  repoRoot,
} from "./repo-utils.mjs";
import { validateSchedulerEvidence } from "./scheduler-contract-lib.mjs";

const inventory = gitInventory();
const evidencePath = path.join(repoRoot, "docs", "feasibility", "scheduler-local-contract.json");
const result = validateSchedulerEvidence(JSON.parse(readFileSync(evidencePath, "utf8")));
const readSource = (relative) => readFileSync(path.join(repoRoot, relative), "utf8");
const productionFiles = inventory.filter((item) => item.startsWith("src/"));

invariant(
  JSON.stringify(productionFiles) === JSON.stringify(EXPECTED_PRODUCTION_SOURCE_FILES),
  "unexpected production source inventory",
);
invariant(
  productionBoundaryFailures(inventory, readSource).length === 0,
  "production boundary validation failed",
);
invariant(
  JSON.stringify(productionFiles.filter((item) => /scheduler/iu.test(item))) === JSON.stringify([
    "src/persistence/scheduler-receipt-digest.ts",
    "src/scheduler-application.ts",
    "src/scheduler-port.ts",
  ]),
  "scheduler production inventory contains an unapproved concrete adapter",
);

const port = readSource("src/scheduler-port.ts");
for (const required of [
  'SCHEDULER_CONTRACT_ID = "ato.scheduler/v1"',
  "parseSchedulerBackendRequest",
  "parseSchedulerBackendResult",
  "parseSchedulerDispatchTrigger",
  "invokeSchedulerBackend",
]) invariant(port.includes(required), `scheduler port surface drifted: ${required}`);
invariant(!/from\s+["']node:/u.test(port), "scheduler port imported infrastructure");

const application = readSource("src/scheduler-application.ts");
for (const required of [
  "createSchedulerApplicationService",
  "createSchedulerApplicationServiceWithHooks",
  "SchedulerBackend",
]) invariant(application.includes(required), `scheduler application surface drifted: ${required}`);

const publicIndex = readSource("src/index.ts");
invariant(publicIndex.includes('from "./scheduler-port.ts";'), "scheduler port is not exported");
for (const required of [
  "SCHEDULER_CONTRACT_ID",
  "parseSchedulerBackendRequest",
  "parseSchedulerBackendResult",
  "parseSchedulerDispatchTrigger",
  "invokeSchedulerBackend",
]) invariant(publicIndex.includes(required), `scheduler package export drifted: ${required}`);
invariant(
  !publicIndex.includes("schedulerReceiptSemanticsAreValid"),
  "internal scheduler receipt validator escaped the package root",
);
invariant(publicIndex.includes('export * from "./scheduler-application.ts";'), "scheduler application is not exported");
invariant(!/fake-scheduler|FakeScheduler/iu.test(publicIndex), "test-only scheduler Fake escaped the package root");

for (const relative of [
  "src/product-runtime.ts",
  "src/cli-api.ts",
  "src/cli-api-model.ts",
  "src/cli-api-parser.ts",
  "src/cli-api-runtime.ts",
  "src/cli.ts",
]) {
  invariant(
    !/createScheduler|deliverScheduled|SchedulerBackend|scheduler\.(?:register|inspect|remove)/u.test(readSource(relative)),
    `default product or CLI scheduler operation route escaped into ${relative}`,
  );
}

invariant(
  inventory.includes("test/fixtures/fake-scheduler-backend.mjs") &&
    !productionFiles.some((item) => /fake/iu.test(item)),
  "scheduler Fake boundary drifted",
);

console.log(process.argv.includes("--json") ? JSON.stringify(result) : JSON.stringify(result, null, 2));
