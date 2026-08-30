import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gitInventory, invariant, repoRoot, repositoryInventoryFailures, run } from "./repo-utils.mjs";

function pathIdentity(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

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

function decodeCharacterReference(match, hexadecimal, decimal, named) {
  if (hexadecimal || decimal) {
    const value = Number.parseInt(hexadecimal ?? decimal, hexadecimal ? 16 : 10);
    try {
      return String.fromCodePoint(value);
    } catch {
      return match;
    }
  }
  return Object.freeze({ amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' })[named] ?? match;
}

function visibleHeadingText(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/gu, "$1")
    .replace(/<[^>]*>/gu, "")
    .replace(/`+([^`]+)`+/gu, "$1")
    .replace(/\*\*([^*]+)\*\*/gu, "$1")
    .replace(/__([^_]+)__/gu, "$1")
    .replace(/\*([^*]+)\*/gu, "$1")
    .replace(/_([^_]+)_/gu, "$1")
    .replace(/~~([^~]+)~~/gu, "$1")
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~\\])/gu, "$1")
    .replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|(amp|apos|gt|lt|quot));/giu, decodeCharacterReference);
}

export function markdownHeadingSlug(value) {
  let slug = "";
  for (const character of visibleHeadingText(value).trim().toLowerCase()) {
    if (/\s/u.test(character)) {
      slug += "-";
    } else if (character === "-" || character === "_") {
      slug += character;
    } else if (/[\p{P}\p{C}]/u.test(character)) {
      continue;
    } else if (character.codePointAt(0) < 128 && /\p{S}/u.test(character)) {
      continue;
    } else {
      slug += character;
    }
  }
  return slug;
}

export function markdownAnchors(markdownText) {
  const anchors = new Set();
  const headingCounts = new Map();
  let fence = null;

  for (const line of markdownText.split(/\r?\n/u)) {
    const possibleFence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (fence) {
      if (
        possibleFence &&
        possibleFence[1][0] === fence.character &&
        possibleFence[1].length >= fence.length &&
        /^[ \t]*$/u.test(possibleFence[2])
      ) {
        fence = null;
      }
      continue;
    }
    if (possibleFence) {
      fence = Object.freeze({ character: possibleFence[1][0], length: possibleFence[1].length });
      continue;
    }

    const heading = line.match(/^ {0,3}#{1,6}(?:[ \t]+|$)(.*)$/u);
    if (heading) {
      const text = heading[1].replace(/[ \t]+#+[ \t]*$/u, "");
      const base = markdownHeadingSlug(text);
      if (base.length > 0) {
        const occurrence = headingCounts.get(base) ?? 0;
        anchors.add(occurrence === 0 ? base : `${base}-${occurrence}`);
        headingCounts.set(base, occurrence + 1);
      }
    }

    for (const explicit of line.matchAll(/<a\b[^>]*\b(?:id|name)\s*=\s*(["'])(.*?)\1[^>]*>/giu)) {
      if (explicit[2].length > 0) anchors.add(explicit[2]);
    }
  }
  return anchors;
}

export function splitLocalMarkdownDestination(rawDestination) {
  let destination = rawDestination.trim();
  if (destination.startsWith("<") && destination.endsWith(">")) {
    destination = destination.slice(1, -1);
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(destination)) {
    return null;
  }
  const fragmentIndex = destination.indexOf("#");
  return Object.freeze({
    destination,
    linkPath: fragmentIndex === -1 ? destination : destination.slice(0, fragmentIndex),
    fragment: fragmentIndex === -1 ? null : destination.slice(fragmentIndex + 1),
  });
}

function decodedComponent(value, relative, label, failures) {
  try {
    return decodeURIComponent(value);
  } catch {
    failures.push(`${relative}: malformed percent-encoding in local link ${label} ${value}`);
    return null;
  }
}

export function checkDocumentation() {
  const inventory = gitInventory();
  const markdown = inventory.filter((item) => item.endsWith(".md"));
  const failures = repositoryInventoryFailures(inventory);
  const anchorCache = new Map();
  let localLinks = 0;
  let localFragments = 0;

  function anchorsFor(target) {
    const identity = pathIdentity(target);
    if (!anchorCache.has(identity)) {
      anchorCache.set(identity, markdownAnchors(readFileSync(target, "utf8")));
    }
    return anchorCache.get(identity);
  }

  for (const relative of markdown) {
    const source = path.join(repoRoot, relative);
    const text = readFileSync(source, "utf8");
    const links = text.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu);
    for (const match of links) {
      const parsed = splitLocalMarkdownDestination(match[1]);
      if (!parsed || (parsed.linkPath.length === 0 && parsed.fragment === null)) {
        continue;
      }

      let target = source;
      if (parsed.linkPath.length > 0) {
        localLinks += 1;
        const decodedPath = decodedComponent(parsed.linkPath, relative, "path", failures);
        if (decodedPath === null) continue;
        target = path.resolve(path.dirname(source), decodedPath);
        if (!exactCaseRegularFile(target)) {
          failures.push(`${relative}: unresolved or nonregular exact-case link ${parsed.linkPath}`);
          continue;
        }
      }

      if (parsed.fragment !== null) {
        localFragments += 1;
        const fragment = decodedComponent(parsed.fragment, relative, "fragment", failures);
        if (fragment === null) continue;
        if (fragment.length === 0) {
          failures.push(`${relative}: empty Markdown fragment in ${parsed.destination}`);
          continue;
        }
        if (path.extname(target).toLowerCase() === ".md" && !anchorsFor(target).has(fragment)) {
          const targetLabel = parsed.linkPath.length > 0 ? parsed.linkPath : relative;
          failures.push(`${relative}: unresolved Markdown fragment #${parsed.fragment} in ${targetLabel}`);
        }
      }
    }
  }

  run("git", ["diff", "--check"]);
  run("git", ["diff", "--cached", "--check"]);
  invariant(failures.length === 0, `documentation check failed:\n${failures.join("\n")}`);
  return Object.freeze({ status: "passed", markdownFiles: markdown.length, localLinks, localFragments, forbidden: 0 });
}

if (process.argv[1] && pathIdentity(process.argv[1]) === pathIdentity(fileURLToPath(import.meta.url))) {
  console.log(JSON.stringify(checkDocumentation()));
}
