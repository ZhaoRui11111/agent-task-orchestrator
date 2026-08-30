import { existsSync, readFileSync, readSync, rmdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createOwnedGeneration,
  createOwnedGenerationAt,
  invariant,
  removeOwnedGeneration,
  taskArtifactsRoot,
} from "../../scripts/repo-utils.mjs";

const workerArguments = process.argv.slice(2);
if (workerArguments.length === 1 && workerArguments[0] === "pause-after-root-inspection") {
  const generation = createOwnedGenerationAt(taskArtifactsRoot, "paused-creator", {
    afterRootInspection() {
      process.stdout.write("ROOT_INSPECTED\n");
      const release = Buffer.alloc(1);
      invariant(readSync(0, release, 0, release.length, null) === 1, "paused creator release was not received");
    },
  });
  rmdirSync(generation);
  console.log(JSON.stringify({ mode: "pause-after-root-inspection", status: "created-and-removed" }));
} else if (workerArguments.length !== 0) {
  const [workerId, barrierPath, cyclesText] = workerArguments;
  const cycles = Number.parseInt(cyclesText, 10);
  invariant(workerArguments.length === 3, "worker argument count is invalid");
  invariant(/^[0-9]+$/u.test(workerId ?? ""), "worker id is invalid");
  invariant(path.isAbsolute(barrierPath ?? ""), "worker barrier path must be absolute");
  invariant(Number.isSafeInteger(cycles) && cycles > 0, "worker cycle count is invalid");

  const waitCell = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 30_000;
  while (!existsSync(barrierPath)) {
    invariant(Date.now() < deadline, "worker start barrier timed out");
    Atomics.wait(waitCell, 0, 0, 10);
  }

  const generations = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const generation = createOwnedGeneration(`concurrency-w${workerId}`);
    const marker = path.join(generation, "owner.txt");
    writeFileSync(marker, `${workerId}:${cycle}`, { encoding: "utf8", flag: "wx" });
    invariant(readFileSync(marker, "utf8") === `${workerId}:${cycle}`, "worker generation marker drifted");
    generations.push(path.basename(generation));
    removeOwnedGeneration(generation);
    invariant(!existsSync(generation), "worker generation survived cleanup");
  }

  console.log(JSON.stringify({ workerId, generations }));
}
