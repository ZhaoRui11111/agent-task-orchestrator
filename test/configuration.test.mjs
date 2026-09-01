import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { packagePolicyFailures, repoRoot } from "../scripts/repo-utils.mjs";

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const npmrc = readFileSync(path.join(repoRoot, ".npmrc"), "utf8");
const gitAttributes = readFileSync(path.join(repoRoot, ".gitattributes"), "utf8");
const docGardenerPolicy = JSON.parse(readFileSync(path.join(repoRoot, ".doc-gardener.json"), "utf8"));

test("package commands and pnpm configuration are exact and fail closed", () => {
  assert.deepEqual(packagePolicyFailures(packageJson, npmrc), []);
  for (const script of ["test", "verify:offline"]) {
    const mutated = { ...packageJson, scripts: { ...packageJson.scripts, [script]: "node -e \"process.exit(0)\"" } };
    assert.match(packagePolicyFailures(mutated, npmrc).join("\n"), /script command inventory drifted/u);
  }
  assert.match(packagePolicyFailures(packageJson, `${npmrc}ignore-scripts=false\n`).join("\n"), /line inventory drifted/u);
  assert.match(
    packagePolicyFailures(packageJson, `${npmrc}//registry.npmjs.org/:_authToken=sentinel-secret\n`).join("\n"),
    /credential-shaped/u,
  );
});

test("Windows CI skeleton calls the same frozen local commands", () => {
  const workflow = JSON.parse(readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8"));
  const steps = workflow.jobs.windows.steps;
  const commands = steps.filter((step) => typeof step.run === "string").map((step) => step.run);
  assert.deepEqual(commands, [
    "npm install --global pnpm@11.19.0 --ignore-scripts --registry=https://registry.npmjs.org/",
    "pnpm install --frozen-lockfile --ignore-scripts --store-dir=.pnpm-store --registry=https://registry.npmjs.org/",
    "pnpm verify:offline",
    "pnpm dependency:audit",
  ]);
  assert.equal(workflow.jobs.windows["runs-on"], "windows-2022");
  assert.deepEqual(workflow.permissions, { contents: "read" });
});

test("Dependabot is limited to the npm ecosystem and weekly updates", () => {
  const config = JSON.parse(readFileSync(path.join(repoRoot, ".github", "dependabot.yml"), "utf8"));
  assert.equal(config.version, 2);
  assert.deepEqual(config.updates.map((item) => item["package-ecosystem"]), ["npm"]);
  assert.deepEqual(config.updates.map((item) => item.schedule.interval), ["weekly"]);
});

test("every shipped migration has one explicit canonical checkout line ending", () => {
  assert.deepEqual(
    gitAttributes.split("\n").filter((line) => line.startsWith("migrations/")),
    [
      "migrations/0001-current-baseline.sql text eol=lf",
    ],
  );
});

test("repository doc-gardener policy excludes only generated trees and classifies only immutable plan history", () => {
  assert.deepEqual(docGardenerPolicy, {
    ignore_globs_add: [
      ".worktrees/**",
      "node_modules/**",
      "dist/**",
      ".pnpm-store/**",
    ],
    document_role_globs: {
      historical_evidence: [
        "docs/plans/completed/**/*.md",
        "docs/plans/evidence/**/*.md",
      ],
    },
  });
  assert.equal(JSON.stringify(packageJson.scripts).includes("doc_gardener"), false);
});
