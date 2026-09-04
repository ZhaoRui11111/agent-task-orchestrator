const REQUIRED_CAPABILITIES = [
  "completion_evidence",
  "cwd_project_binding",
  "new_thread",
  "same_thread_resume",
];
const REQUIRED_EVIDENCE = Object.freeze({
  completion_evidence: "pinned structured turn terminal event distinct from model text and bound to one local durable turn",
  cwd_project_binding: "pinned working-directory option plus exact local owned-workspace verification before effect",
  new_thread: "pinned streamed start operation whose first identity event supplies the durable thread identity",
  same_thread_resume: "pinned resume operation preserving the exact supplied durable thread identity",
});
const OFFICIAL_HOSTS = new Set(["developers.openai.com", "learn.chatgpt.com", "platform.openai.com"]);
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
    [
      "capabilities", "evidenceMode", "externalE2E", "officialDocumentation", "pinnedPackage",
      "schemaVersion", "supportClaim", "windowsObservation",
    ],
    "Codex evidence",
  );
  if (record.schemaVersion !== 2) fail("unsupported Codex evidence schema");
  if (record.evidenceMode !== "package_validated") fail("unknown Codex evidence mode");
  if (record.externalE2E !== "not_run" || record.supportClaim !== false) {
    fail("package-only evidence cannot create an external support claim");
  }
  requireExactKeys(record.officialDocumentation, ["sources", "status"], "official documentation");
  if (record.officialDocumentation.status !== "verified" ||
    !Array.isArray(record.officialDocumentation.sources) || record.officialDocumentation.sources.length !== 2) {
    fail("official Codex documentation evidence is incomplete");
  }
  for (const source of record.officialDocumentation.sources) validateOfficialSource(source);
  requireExactKeys(
    record.pinnedPackage,
    ["accountExecution", "inspectionStatus", "integrity", "name", "runtimeDependency", "version"],
    "pinned package",
  );
  if (record.pinnedPackage.name !== "@openai/codex-sdk" || record.pinnedPackage.version !== "0.153.2" ||
    record.pinnedPackage.runtimeDependency !== "@openai/codex@0.153.2" ||
    record.pinnedPackage.integrity !==
      "sha512-If4CYvo+Zpf6CCKxhuoyhgNbaS93UI9pYfscWr529CxCQK5fhlLQA29efutQVwuj8w9EcMhNM4rjn7zu67S+/w==" ||
    record.pinnedPackage.inspectionStatus !== "passed" || record.pinnedPackage.accountExecution !== "not_run") {
    fail("pinned Codex package evidence drifted");
  }
  requireExactKeys(record.windowsObservation, ["reason", "status"], "Windows observation");
  if (record.windowsObservation.status !== "not_run" ||
    record.windowsObservation.reason !== "account_network_and_execution_not_authorized") {
    fail("Windows observation boundary drifted");
  }
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
  if (record.capabilities.some((item) => item.status !== "package_verified")) {
    fail("pinned-package capabilities must use the exact package_verified status");
  }
  return {
    boundaryStatus: "passed",
    evidenceMode: "package_validated",
    packagePreflight: "passed",
    externalE2E: "not_run",
    supportClaim: false,
  };
}
