import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EXPECTED_PRODUCTION_SOURCE_FILES,
  gitInventory,
  invariant,
  productionBoundaryFailures,
  repoRoot,
} from "./repo-utils.mjs";
import { validateCodexEvidence } from "./codex-contract-lib.mjs";

const evidencePath = path.join(repoRoot, "docs", "feasibility", "codex-stable-public-contract.json");
const record = JSON.parse(readFileSync(evidencePath, "utf8"));
const result = validateCodexEvidence(record);

const productionFiles = gitInventory().filter((item) => item.startsWith("src/"));
invariant(
  JSON.stringify(productionFiles) === JSON.stringify(EXPECTED_PRODUCTION_SOURCE_FILES),
  "unexpected production source inventory",
);
invariant(
  productionBoundaryFailures(gitInventory(), (relative) => readFileSync(path.join(repoRoot, relative), "utf8")).length === 0,
  "production boundary validation failed",
);
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
invariant(packageJson.dependencies?.["@openai/codex-sdk"] === "0.153.2", "Codex SDK package pin drifted");
const worker = readFileSync(path.join(repoRoot, "src", "codex-sdk-worker.ts"), "utf8");
for (const required of [
  'from "@openai/codex-sdk"',
  'PINNED_CODEX_SDK_VERSION = "0.153.2"',
  ".startThread(threadOptions)",
  ".resumeThread(request.threadId!, threadOptions)",
  ".runStreamed(request.input",
  "workingDirectory: request.workingDirectory",
  'event.type === "thread.started"',
  'event.type === "turn.completed"',
  'event.type === "turn.failed"',
]) invariant(worker.includes(required), `pinned Codex SDK driver surface drifted: ${required}`);
const publicIndex = readFileSync(path.join(repoRoot, "src", "index.ts"), "utf8");
for (const required of [
  "CODEX_PRODUCT_ERROR_CODES",
  "createCodexProductApplication",
  "CodexDispatchRunCommand",
  "CodexDispatchView",
  "CodexProductApplicationService",
  "CodexProductConfirmationRequest",
  "CodexProductError",
  "CodexProductErrorCode",
  "CodexProductFailure",
  "CodexProductIngress",
  "CodexProductResult",
  "CodexProductSuccess",
  "CodexProfileActivateCommand",
  "CodexProfileDeactivateCommand",
  "CodexProfileInspectCommand",
  "CodexProfileView",
]) invariant(publicIndex.includes(required), `supported Codex product export is absent: ${required}`);
for (const forbidden of [
  "CodexCredentialResolver",
  "CodexExecutionBackendConfiguration",
  "CodexProductApplicationDependencies",
  "CodexProductApplicationHooks",
  "CodexProfileConfigurationInput",
  "CodexSdkDriver",
  "createCodexExecutionBackend",
  "createCodexProductApplicationWithDependencies",
  "createCodexTargetedDispatcherService",
  "createInjectedCodexReliableExecutionService",
  "createProcessEnvironmentCodexCredentialResolver",
  "createProductCodexSdkDriver",
  "lookupCodexContinuationReplayForCli",
]) invariant(!publicIndex.includes(forbidden), `Codex private seam escaped the package root: ${forbidden}`);

console.log(process.argv.includes("--json") ? JSON.stringify(result) : JSON.stringify(result, null, 2));
