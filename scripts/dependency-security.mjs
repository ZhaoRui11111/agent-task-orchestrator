import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { invariant, repoRoot } from "./repo-utils.mjs";

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const lockPath = path.join(repoRoot, "pnpm-lock.yaml");

invariant(
  JSON.stringify(packageJson.dependencies) === JSON.stringify({ "@openai/codex-sdk": "0.153.2" }),
  "production dependency inventory must contain only exact @openai/codex-sdk 0.153.2",
);
invariant(
  JSON.stringify(packageJson.devDependencies) === JSON.stringify({ typescript: "5.9.3" }),
  "development dependency inventory must contain only exact TypeScript 5.9.3",
);
for (const lifecycle of ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly"]) {
  invariant(!(lifecycle in packageJson.scripts), `package lifecycle script ${lifecycle} is prohibited`);
}
invariant(existsSync(lockPath), "pnpm-lock.yaml is required; no dependency result can pass without it");

const lock = readFileSync(lockPath, "utf8");
invariant(/^lockfileVersion: ['"]9\.0['"]$/mu.test(lock), "unexpected pnpm lockfile version");
invariant(/specifier: 5\.9\.3/u.test(lock), "lockfile TypeScript specifier drifted");
invariant(/version: 5\.9\.3/u.test(lock), "lockfile TypeScript resolution drifted");
invariant(/typescript@5\.9\.3:/u.test(lock), "lockfile lacks exact TypeScript package entry");
invariant(/'@openai\/codex-sdk':\r?\n\s+specifier: 0\.153\.2\r?\n\s+version: 0\.153\.2/u.test(lock),
  "lockfile Codex SDK importer drifted");
invariant(/'@openai\/codex-sdk@0\.153\.2':/u.test(lock), "lockfile lacks exact Codex SDK package entry");
invariant(/'@openai\/codex@0\.153\.2':/u.test(lock), "lockfile lacks exact Codex CLI dependency entry");
invariant(/integrity: sha512-[A-Za-z0-9+/=]+/u.test(lock), "lockfile lacks registry integrity evidence");
invariant(!/requiresBuild: true/u.test(lock), "dependency requiring build/install execution is prohibited");
const packageSection = lock.match(/\npackages:\r?\n([\s\S]*?)\r?\nsnapshots:/u)?.[1] ?? "";
const packageEntries = [...packageSection.matchAll(/^  (.+):$/gmu)]
  .map((match) => match[1].replace(/^'|'$/gu, ""))
  .sort();
const expectedPackageEntries = [
  "@openai/codex-sdk@0.153.2",
  "@openai/codex@0.153.2",
  "@openai/codex@0.153.2-darwin-arm64",
  "@openai/codex@0.153.2-darwin-x64",
  "@openai/codex@0.153.2-linux-arm64",
  "@openai/codex@0.153.2-linux-x64",
  "@openai/codex@0.153.2-win32-arm64",
  "@openai/codex@0.153.2-win32-x64",
  "typescript@5.9.3",
].sort();
invariant(JSON.stringify(packageEntries) === JSON.stringify(expectedPackageEntries),
  "unexpected package entered lockfile");
invariant(!/https?:\/\/[^/\s]+@/iu.test(lock), "lockfile contains credential-shaped registry authority");
invariant(!/(?:_authToken|authorization|api[_-]?key)\s*:/iu.test(lock), "lockfile contains credential-shaped metadata");

console.log(
  JSON.stringify({
    status: "passed",
    productionDependencies: ["@openai/codex-sdk@0.153.2"],
    developmentDependencies: ["typescript@5.9.3"],
    onlineAudit: "separate_network_authorized_gate",
  }),
);
