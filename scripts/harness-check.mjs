import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "AGENTS.md",
  "README.md",
  "docs/business-rules.md",
  "docs/architecture.md",
  "docs/acceptance-plan.md",
  "harness/README.md",
  "harness/feature-list.json",
  "harness/progress.md",
  ".env.example"
];
const requiredScripts = [
  "build",
  "test"
];
const requiredEnvNames = [
  "TEST_DATABASE_URL"
];
const errors = [];

for (const file of requiredFiles) {
  try { await access(resolve(root, file)); }
  catch { errors.push(`Missing required file: ${file}`); }
}

let pkg;
try { pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")); }
catch (error) { errors.push(`Cannot read package.json: ${error.message}`); }

if (pkg) {
  for (const name of requiredScripts) {
    if (typeof pkg.scripts?.[name] !== "string") errors.push(`Missing npm script: ${name}`);
  }
}

let ledger;
try {
  ledger = JSON.parse(await readFile(resolve(root, "harness/feature-list.json"), "utf8"));
  if (ledger.schema_version !== 1 || !Array.isArray(ledger.features)) errors.push("Invalid harness feature ledger schema.");
  for (const feature of ledger.features ?? []) {
    if (!feature.id || !feature.title || !["planned","in_progress","blocked","implemented_unverified","verified","accepted","deferred"].includes(feature.status)) {
      errors.push(`Invalid feature ledger entry: ${feature.id ?? "(missing id)"}`);
    }
  }
} catch (error) { errors.push(`Cannot parse harness/feature-list.json: ${error.message}`); }

for (const name of requiredEnvNames) {
  if (!process.env[name]) {
    console.log(`INFO: ${name} is not set; isolated integration tests may require it.`);
  }
}

if (errors.length) {
  console.error("Harness preflight failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Harness preflight passed.");
  console.log(`Checked ${requiredFiles.length} required files, ${requiredScripts.length} npm scripts, and ${ledger.features.length} feature records.`);
  console.log("No environment variable values were read or printed.");
}
