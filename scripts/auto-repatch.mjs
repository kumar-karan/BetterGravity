import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const devPatch = path.join(root, "scripts", "dev-patch.mjs");
const logDir = path.join(process.env.HOME || "", "Library", "Application Support", "BetterGravity");
const logFile = path.join(logDir, "autopatch.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, line);
  } catch {}
  process.stdout.write(line);
}

try {
  const inspectOutput = execFileSync(process.execPath, [devPatch, "inspect"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30000
  });

  // Extract JSON payload from inspect output
  const jsonMatch = inspectOutput.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log(`Failed to parse inspect output: ${inspectOutput}`);
    process.exit(1);
  }

  const info = JSON.parse(jsonMatch[0]);
  if (info.patchState === "unpatched" || info.patchState === "needs-repatch") {
    log(`Detected Antigravity ${info.antigravityVersion} with patchState=${info.patchState}. Reapplying BetterGravity patch...`);
    const installOutput = execFileSync(process.execPath, [devPatch, "install", "--no-close"], {
      cwd: root,
      encoding: "utf8",
      timeout: 60000
    });
    log(`Patch applied successfully:\n${installOutput.trim()}`);
  } else {
    // Already patched
    log(`Antigravity ${info.antigravityVersion} is already patched (${info.patchState}). Nothing to do.`);
  }
} catch (error) {
  log(`Error during auto-repatch: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exit(1);
}
