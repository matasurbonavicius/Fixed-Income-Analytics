// Cross-platform pre-publish smoke test.
//
// Simulates a real consumer install end to end:
//   1. build the library
//   2. `npm pack` -> the exact tarball that would be published
//   3. install that tarball into smoke-test/ (no workspace/symlink shortcuts)
//   4. run smoke-test/consume.mjs, which imports from "fixed-income-analytics"
//
// This catches mistakes the unit tests can't: a wrong `exports` map, a file
// missing from the `files` allow-list, or a broken type entry point.

import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const smokeDir = join(root, "smoke-test");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}  (in ${cwd})`);
  // npm.cmd must go through a shell on Windows (spawnSync can't exec .cmd
  // directly); node.exe must NOT, or its space-containing path breaks under
  // the shell. Use the shell only for the batch-file launcher.
  const useShell = process.platform === "win32" && cmd.endsWith(".cmd");
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: useShell });
}

// 1 + 2: build and pack into the repo root.
run(npm, ["run", "build"], root);
run(npm, ["pack"], root);

// Find the tarball we just produced and move it next to the consumer.
const tarball = readdirSync(root).find((f) => f.endsWith(".tgz"));
if (!tarball) throw new Error("npm pack did not produce a .tgz");
const tarballInSmoke = join(smokeDir, tarball);
copyFileSync(join(root, tarball), tarballInSmoke);

// 3: clean install of the tarball into the isolated consumer dir.
rmSync(join(smokeDir, "node_modules"), { recursive: true, force: true });
run(npm, ["install", "--no-save", `./${tarball}`], smokeDir);

// 4: run the consumer.
run(process.execPath, ["consume.mjs"], smokeDir);

// Tidy the copied tarballs (root one is gitignored; harmless either way).
rmSync(tarballInSmoke, { force: true });
rmSync(join(root, tarball), { force: true });

console.log("\n✓ Consumer smoke test completed successfully.");
