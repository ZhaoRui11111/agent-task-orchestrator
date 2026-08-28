const REQUIRED_CAPABILITIES = [
  "completion_evidence",
  "cwd_project_binding",
  "new_thread",
  "same_thread_resume",
];
const REQUIRED_EVIDENCE = Object.freeze({
  completion_evidence: "stable public inspection result distinct from raw model text and bound to the exact execution turn",
  cwd_project_binding: "stable public input and receipt proving the accepted working directory and project identity",
  new_thread: "stable public operation plus real returned durable thread identity",
  same_thread_resume: "stable public continuation operation preserving the exact prior thread identity",
});
const OFFICIAL_HOSTS = new Set(["developers.openai.com", "platform.openai.com"]);
const FORBIDDEN_KEYS = new Set([
  "apikey",
  "api_key",
  "authorization",
  "cwd",
  "prompt",
  "secret",
  "threadid",
  "thread_id",
  "token",
  "workingdirectory",
]);

function fail(message) {
  throw new Error(message);
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) fail(`${label} field inventory drifted`);
}

function rejectSensitiveKeys(value, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveKeys(item, [...trail, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) fail(`sensitive/raw field is prohibited: ${[...trail, key].join(".")}`);
    rejectSensitiveKeys(child, [...trail, key]);
  }
}

function rejectSensitiveValues(value, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveValues(item, [...trail, String(index)]));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) rejectSensitiveValues(child, [...trail, key]);
    return;
  }
  if (typeof value !== "string") return;
  const secretAssignment = /(?:authorization|client_secret|password|passwd|access_token)\s*[:=]\s*\S+/iu;
  const windowsPath = /(?:^|[\s"'(])(?:[a-z]:[\\/]|\\\\)[^\s"')]+/iu;
  const openAiKey = new RegExp(`(?<![A-Za-z0-9])${"s"}${"k-"}(?:proj-)?[A-Za-z0-9_-]{20,}`, "u");
  if (secretAssignment.test(value) || windowsPath.test(value) || openAiKey.test(value)) {
    fail(`sensitive/raw value is prohibited: ${trail.join(".")}`);
  }
}

function validateOfficialSource(source) {
  if (typeof source !== "string") fail("official source must be an HTTPS URL string");
  let url;
  try {
    url = new URL(source);
  } catch {
    fail(`invalid official OpenAI source: ${source}`);
  }
  if (url.protocol !== "https:" || !OFFICIAL_HOSTS.has(url.hostname)) fail(`nonofficial OpenAI source: ${source}`);
  if (url.username || url.password || url.search || url.hash) fail("official source URL cannot retain user-info, query, or fragment");
  if (url.port || url.pathname === "/") fail("official source URL must identify a stable public documentation page");
}

export function validateCodexEvidence(record) {
  rejectSensitiveKeys(record);
  rejectSensitiveValues(record);
  requireExactKeys(
    record,
    ["schemaVersion", "evidenceMode", "officialDocumentation", "windowsObservation", "capabilities", "supportClaim"],
    "Codex evidence",
  );
  if (record.schemaVersion !== 1) fail("unsupported Codex evidence schema");
  if (!Array.isArray(record.capabilities)) fail("capabilities must be an array");
  for (const capability of record.capabilities) {
    requireExactKeys(capability, ["id", "status", "requiredEvidence"], `capability ${capability?.id ?? "unknown"}`);
    if (typeof capability.requiredEvidence !== "string" || capability.requiredEvidence.length === 0) {
      fail(`capability ${capability.id} lacks its evidence criterion`);
    }
    if (REQUIRED_EVIDENCE[capability.id] !== capability.requiredEvidence) {
      fail(`capability ${capability.id} evidence criterion drifted`);
    }
  }
  const ids = record.capabilities.map((item) => item.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(REQUIRED_CAPABILITIES)) fail("required Codex capability inventory drifted");

  if (record.evidenceMode === "blocked") {
    requireExactKeys(record.officialDocumentation, ["status", "reason", "sources"], "blocked official documentation");
    requireExactKeys(record.windowsObservation, ["status", "reason"], "blocked Windows observation");
    if (record.supportClaim !== false) fail("blocked evidence cannot create a support claim");
    if (record.officialDocumentation?.status !== "not_run" || record.officialDocumentation?.reason !== "network_not_authorized") {
      fail("blocked official-documentation result is not exact");
    }
    if (!Array.isArray(record.officialDocumentation.sources) || record.officialDocumentation.sources.length !== 0) {
      fail("blocked mode cannot retain documentation sources");
    }
    if (
      record.windowsObservation?.status !== "not_run" ||
      record.windowsObservation?.reason !== "account_network_and_execution_not_authorized"
    ) {
      fail("blocked Windows observation is not exact");
    }
    if (record.capabilities.some((item) => item.status !== "unverified")) fail("blocked capabilities must remain unverified");
    return { boundaryStatus: "passed", evidenceMode: "blocked", externalE2E: "not_run", supportClaim: false };
  }

  if (record.evidenceMode !== "validated") fail("unknown Codex evidence mode");
  requireExactKeys(record.officialDocumentation, ["status", "sources"], "validated official documentation");
  requireExactKeys(record.windowsObservation, ["status", "environment", "procedure", "result"], "validated Windows observation");
  if (!Array.isArray(record.officialDocumentation.sources)) fail("validated sources must be an array");
  for (const source of record.officialDocumentation.sources) validateOfficialSource(source);
  fail(
    "validated Codex evidence is unavailable: EP-00B has no authorized stable-public verifier and accepts blocked evidence only",
  );
}
