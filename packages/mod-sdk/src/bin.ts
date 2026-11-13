/** The `mc-pack` executable: runs the CLI on the process's arguments and exits with its code. */
import { runCli } from "./cli.js";

process.exitCode = await runCli(process.argv.slice(2));
