#!/usr/bin/env node

import { getScaffoldStatus } from "./index.ts";

console.log(JSON.stringify(getScaffoldStatus()));
