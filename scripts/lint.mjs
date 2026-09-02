import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EXPECTED_PRODUCTION_SOURCE_FILES,
  gitInventory,
  invariant,
  packagePolicyFailures,
  productionBoundaryFailures,
  repoRoot,
  repositoryInventoryFailures,
  run,
} from "./repo-utils.mjs";

const inventory = gitInventory();
const textExtensions = new Set([".ts", ".mjs", ".json", ".md", ".yaml", ".yml"]);
const failures = repositoryInventoryFailures(inventory);

if (failures.length > 0) {
  throw new Error(`lint failed:\n${failures.join("\n")}`);
}

for (const relative of inventory) {
  if (!textExtensions.has(path.extname(relative).toLowerCase())) {
    continue;
  }
  const text = readFileSync(path.join(repoRoot, relative), "utf8");
  if (!text.endsWith("\n")) {
    failures.push(`${relative}: missing final newline`);
  }
  const lines = text.split(/\n/u);
  lines.forEach((line, index) => {
    if (/[ \t]+$/u.test(line)) {
      failures.push(`${relative}:${index + 1}: trailing whitespace`);
    }
  });
  if (relative.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch (error) {
      failures.push(`${relative}: malformed JSON: ${error.message}`);
    }
  }
  if ((relative.endsWith(".yml") || relative.endsWith(".yaml")) && relative !== "pnpm-lock.yaml") {
    try {
      JSON.parse(text);
    } catch (error) {
      failures.push(`${relative}: repository YAML must use the JSON-compatible subset: ${error.message}`);
    }
  }
}

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const tsconfig = JSON.parse(readFileSync(path.join(repoRoot, "tsconfig.json"), "utf8"));
const nodeVersion = readFileSync(path.join(repoRoot, ".node-version"), "utf8").trim();
const npmrc = readFileSync(path.join(repoRoot, ".npmrc"), "utf8");

if (packageJson.engines?.node !== nodeVersion || nodeVersion !== "24.19.0") {
  failures.push("Node selection drifted across package.json and .node-version");
}
if (packageJson.engines?.pnpm !== "11.19.0" || packageJson.packageManager !== "pnpm@11.19.0") {
  failures.push("pnpm selection drifted");
}
if (packageJson.devDependencies?.typescript !== "5.9.3") {
  failures.push("TypeScript must remain exactly pinned at 5.9.3");
}
if (packageJson.type !== "module" || packageJson.private !== true) {
  failures.push("package must remain private-by-default ESM");
}
failures.push(...packagePolicyFailures(packageJson, npmrc));
if (packageJson.exports?.["."]?.import !== "./dist/index.js" || packageJson.bin?.ato !== "./dist/cli.js") {
  failures.push("package export or console boundary drifted");
}
if (tsconfig.compilerOptions?.module !== "NodeNext" || tsconfig.compilerOptions?.moduleResolution !== "NodeNext") {
  failures.push("TypeScript NodeNext module strategy drifted");
}
if (tsconfig.compilerOptions?.rewriteRelativeImportExtensions !== true) {
  failures.push("TypeScript source/package relative-extension parity drifted");
}
if (tsconfig.compilerOptions?.noUnusedLocals !== true || tsconfig.compilerOptions?.noUnusedParameters !== true) {
  failures.push("TypeScript unused declaration enforcement drifted");
}
if (EXPECTED_PRODUCTION_SOURCE_FILES.length !== 45) {
  failures.push("production source count drifted");
}
failures.push(
  ...productionBoundaryFailures(inventory, (relative) =>
    readFileSync(path.join(repoRoot, relative), "utf8"),
  ),
);

const diffCheck = run("git", ["diff", "--check"]);
const stagedDiffCheck = run("git", ["diff", "--cached", "--check"]);
invariant(diffCheck.status === 0 && stagedDiffCheck.status === 0, "Git diff whitespace check failed");

if (failures.length > 0) {
  throw new Error(`lint failed:\n${failures.join("\n")}`);
}

console.log(JSON.stringify({
  status: "passed",
  files: inventory.length,
  sourceFiles: EXPECTED_PRODUCTION_SOURCE_FILES.length,
}));
