#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceCheckoutRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.NODE_NO_WARNINGS = "1";
process.emitWarning = () => {};
const { runCli } = await import("./cli-api.ts");
const result = await runCli(process.argv.slice(2), { sourceCheckoutRoot });
process.stdout.write(result.stdout);
process.exitCode = result.exitCode;
