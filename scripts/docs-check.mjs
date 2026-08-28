import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gitInventory, invariant, repoRoot, repositoryInventoryFailures, run } from "./repo-utils.mjs";

const inventory = gitInventory();
const markdown = inventory.filter((item) => item.endsWith(".md"));
const failures = repositoryInventoryFailures(inventory);
let localLinks = 0;

function exactCaseRegularFile(target) {
  const relative = path.relative(repoRoot, target);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return false;
  }
  let current = repoRoot;
  for (const segment of relative.split(path.sep)) {
    const parentStat = lstatSync(current);
    if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
      return false;
    }
    const names = readdirSync(current);
    if (!names.includes(segment)) {
      return false;
    }
    current = path.join(current, segment);
  }
  const stat = lstatSync(current);
  return stat.isFile() && !stat.isSymbolicLink();
}

for (const relative of markdown) {
  const text = readFileSync(path.join(repoRoot, relative), "utf8");
  const links = text.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu);
  for (const match of links) {
    let destination = match[1].trim();
    if (destination.startsWith("<") && destination.endsWith(">")) {
      destination = destination.slice(1, -1);
    }
    if (/^(?:[a-z]+:|#)/iu.test(destination)) {
      continue;
    }
    destination = destination.split("#", 1)[0];
    if (destination.length === 0) {
      continue;
    }
    localLinks += 1;
    const decoded = decodeURIComponent(destination);
    const target = path.resolve(path.dirname(path.join(repoRoot, relative)), decoded);
    if (!exactCaseRegularFile(target)) {
      failures.push(`${relative}: unresolved or nonregular exact-case link ${destination}`);
    }
  }
}

run("git", ["diff", "--check"]);
run("git", ["diff", "--cached", "--check"]);
invariant(failures.length === 0, `documentation check failed:\n${failures.join("\n")}`);
console.log(JSON.stringify({ status: "passed", markdownFiles: markdown.length, localLinks, forbidden: 0 }));
