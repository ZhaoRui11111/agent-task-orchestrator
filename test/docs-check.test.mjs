import assert from "node:assert/strict";
import test from "node:test";

import {
  markdownAnchors,
  markdownHeadingSlug,
  splitLocalMarkdownDestination,
} from "../scripts/docs-check.mjs";

test("Markdown heading slugs preserve rendered text and repository contract identifiers", () => {
  assert.equal(markdownHeadingSlug("SchedulerBackend: `ato.scheduler/v1`"), "schedulerbackend-atoschedulerv1");
  assert.equal(markdownHeadingSlug("**Exact** action_vocabulary & scope"), "exact-action_vocabulary--scope");
  assert.equal(markdownHeadingSlug("修复：范围"), "修复范围");
});

test("Markdown anchors ignore fenced examples and suffix duplicate headings", () => {
  const anchors = markdownAnchors(`
# Status and direction

## Repeated heading
## Repeated heading!

\`\`\`md
## Hidden example
\`\`\`

<a id="stable-explicit-anchor"></a>
`);

  assert.deepEqual(
    [...anchors],
    ["status-and-direction", "repeated-heading", "repeated-heading-1", "stable-explicit-anchor"],
  );
  assert.equal(anchors.has("hidden-example"), false);
});

test("local Markdown destinations distinguish same-file, cross-file, and external fragments", () => {
  assert.deepEqual(splitLocalMarkdownDestination("#gate-identity-and-freshness"), {
    destination: "#gate-identity-and-freshness",
    linkPath: "",
    fragment: "gate-identity-and-freshness",
  });
  assert.deepEqual(splitLocalMarkdownDestination("persistence-contract.md#transaction-and-repository-boundary"), {
    destination: "persistence-contract.md#transaction-and-repository-boundary",
    linkPath: "persistence-contract.md",
    fragment: "transaction-and-repository-boundary",
  });
  assert.equal(splitLocalMarkdownDestination("https://example.com/docs#contract"), null);
});
