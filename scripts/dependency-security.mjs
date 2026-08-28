import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { invariant, repoRoot } from "./repo-utils.mjs";

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const lockPath = path.join(repoRoot, "pnpm-lock.yaml");

invariant(!packageJson.dependencies || Object.keys(packageJson.dependencies).length === 0, "production dependencies are prohibited in EP-00B");
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
invariant(/integrity: sha512-[A-Za-z0-9+/=]+/u.test(lock), "lockfile lacks registry integrity evidence");
invariant(!/requiresBuild: true/u.test(lock), "dependency requiring build/install execution is prohibited");
invariant(!/^\s{2}(?!typescript@)[^\s].*@[^:]+:$/gmu.test(lock), "unexpected package entered lockfile");
invariant(!/https?:\/\/[^/\s]+@/iu.test(lock), "lockfile contains credential-shaped registry authority");
invariant(!/(?:_authToken|authorization|api[_-]?key)\s*:/iu.test(lock), "lockfile contains credential-shaped metadata");

console.log(
  JSON.stringify({
    status: "passed",
    productionDependencies: 0,
    developmentDependencies: ["typescript@5.9.3"],
    onlineAudit: "separate_network_authorized_gate",
  }),
);
