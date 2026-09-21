// Spawning build tools the same way on macOS, Linux and Windows.
//
// `spawnSync("pnpm", …)` is fine on macOS and Linux but dies with ENOENT on Windows: there `pnpm` on PATH is
// `pnpm.cmd` (or `pnpm.exe` under mise), which spawn() only resolves through a shell — and Node refuses to run
// a .cmd/.bat file without `shell: true` at all (CVE-2024-27980). A shell means cmd.exe re-parses every
// argument, so a keystore password or a path with a space has to be quoted by hand. Hence two helpers:
//
//   pnpm(args)       the pnpm that is running this script (npm_execpath), spawned directly with no shell, so
//                    the arguments arrive untouched. Falls back to `pnpm` on PATH (through the shell on
//                    Windows) when the script was started by hand with `node scripts/…`.
//   run(file, args)  any other command line tool. On Windows it goes through cmd.exe with each argument
//                    quoted, because tools like apksigner are .bat wrappers there.

import { spawnSync } from "node:child_process";
import path from "node:path";

const win32 = process.platform === "win32";

/** Quote one argument for cmd.exe, which is what Node's `shell: true` uses on Windows. */
export function quoteForCmd(arg) {
  if (arg !== "" && !/[\s"&|<>^()!]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function spawn(file, args, shell, options) {
  // With a shell, Node only concatenates the arguments (and Node 24 warns about it), so hand it one command
  // line that we quoted ourselves.
  return shell
    ? spawnSync([file, ...args].map(quoteForCmd).join(" "), { ...options, shell: true })
    : spawnSync(file, args, options);
}

/** Run a command and wait. `stdio` is inherited unless `capture` is set, in which case stdout/stderr are returned as text. */
export function run(file, args, { cwd, env = process.env, capture = false } = {}) {
  const result = spawn(file, args, win32, {
    cwd,
    env,
    stdio: capture ? "pipe" : "inherit",
    encoding: capture ? "utf8" : undefined,
  });
  if (result.error && !capture) console.error(`[run] ${file}: ${result.error.message}`);
  return result;
}

function pnpmCommand() {
  const execpath = process.env.npm_execpath;
  if (!execpath || !path.basename(execpath).toLowerCase().includes("pnpm")) {
    return { file: "pnpm", prefix: [], shell: win32 }; // started by hand; rely on PATH
  }
  // corepack/npm-installed pnpm is a JS entry point; the mise/standalone install is a native binary.
  if (/\.[cm]?js$/i.test(execpath)) return { file: process.execPath, prefix: [execpath], shell: false };
  return { file: execpath, prefix: [], shell: false };
}

/** Run pnpm with the given arguments and wait, inheriting stdio. */
export function pnpm(args, { cwd, env = process.env } = {}) {
  const { file, prefix, shell } = pnpmCommand();
  const result = spawn(file, [...prefix, ...args], shell, { cwd, env, stdio: "inherit" });
  if (result.error) console.error(`[run] pnpm: ${result.error.message}`);
  return result;
}
