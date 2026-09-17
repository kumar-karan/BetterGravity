// Drives the native patcher from a terminal so install, repair, and uninstall
// can be exercised without building and launching the installer UI.
//
//   node scripts/dev-patch.mjs inspect
//   node scripts/dev-patch.mjs install
//   node scripts/dev-patch.mjs uninstall
//   node scripts/dev-patch.mjs install "D:\\Custom\\Antigravity"
//
// The patcher is bundled on the fly with the same esbuild settings the installer
// uses, so this exercises production code rather than a parallel implementation.

import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// The installer's staging directory rather than the runtime package's own
// output, so this deploys exactly the file set a released installer would.
const runtimeSource = path.join(root, "apps", "installer", "dist-electron", "runtime");

if (!existsSync(runtimeSource)) {
  console.error("The installer has not been built. Run `pnpm build` first.");
  process.exit(1);
}

const staging = await mkdtemp(path.join(os.tmpdir(), "bettergravity-devpatch-"));

try {
  const bundle = path.join(staging, "patcher.cjs");
  await build({
    entryPoints: [path.join(root, "packages", "patcher", "src", "native", "index.ts")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron", "original-fs"],
    logLevel: "warning"
  });

  const patcher = createRequire(import.meta.url)(bundle);

  const noClose = process.argv.includes("--no-close");
  const filteredArgs = process.argv.slice(2).filter((arg) => arg !== "--no-close");
  const operation = filteredArgs[0] ?? "inspect";
  const installationPath = filteredArgs[1] ?? patcher.findAntigravityInstallation();

  if (!installationPath) {
    console.error("No Antigravity installation was found.");
    process.exit(1);
  }

  console.log(`Antigravity: ${installationPath}\n`);
  const onProgress = ({ percent, message }) => console.log(`  ${String(percent).padStart(3)}%  ${message}`);

  const options = {
    runtimeSource,
    ...(noClose ? { closeHost: async () => undefined } : {})
  };

  if (operation === "inspect") {
    console.log(JSON.stringify(patcher.inspectInstallation(installationPath), null, 2));
  } else if (operation === "uninstall") {
    const result = await patcher.uninstall(installationPath, onProgress);
    console.log(`\n${result.message}`);
  } else {
    const result = await patcher.runOperation(operation, installationPath, options, onProgress);
    console.log(`\n${result.message}`);
  }
} finally {
  await rm(staging, { recursive: true, force: true });
}
