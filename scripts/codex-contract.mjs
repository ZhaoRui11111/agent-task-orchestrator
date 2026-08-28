import { readFileSync } from "node:fs";
import path from "node:path";
import { gitInventory, invariant, repoRoot } from "./repo-utils.mjs";
import { validateCodexEvidence } from "./codex-contract-lib.mjs";

const evidencePath = path.join(repoRoot, "docs", "feasibility", "codex-stable-public-contract.json");
const record = JSON.parse(readFileSync(evidencePath, "utf8"));
const result = validateCodexEvidence(record);

const productionFiles = gitInventory().filter((item) => item.startsWith("src/"));
invariant(productionFiles.length === 2, "unexpected production source inventory");
for (const relative of productionFiles) {
  const source = readFileSync(path.join(repoRoot, relative), "utf8");
  invariant(!/codex|openai|@openai/iu.test(source), `${relative} depends on a Codex/OpenAI implementation`);
}

console.log(process.argv.includes("--json") ? JSON.stringify(result) : JSON.stringify(result, null, 2));
