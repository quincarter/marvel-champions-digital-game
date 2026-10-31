import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { collectSteamInstaller, repoRoot, steamInstallerName } from "./release-collector.mjs";

describe("the Install for Steam release assets", () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-release-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("names the script without a version, so its releases/latest/download link never changes", () => {
    assert.equal(steamInstallerName("linux"), "MarvelChampions-Linux-Install-for-Steam.sh");
    assert.equal(steamInstallerName("darwin"), "MarvelChampions-macOS-Install-for-Steam.sh");
    assert.equal(steamInstallerName("win32"), "MarvelChampions-Windows-Install-for-Steam.cmd");
    assert.equal(steamInstallerName("aix"), null);
  });

  it("stages the same bytes as the repo's script: nothing about a release is stamped in", () => {
    const [script] = collectSteamInstaller("darwin", dir);
    assert.equal(
      fs.readFileSync(script.path, "utf8"),
      fs.readFileSync(path.join(repoRoot, "scripts", "macos", "install-for-steam.sh"), "utf8"),
    );
  });

  it("gives Windows one .cmd with CRLF line ends", () => {
    const [script] = collectSteamInstaller("win32", dir);
    const text = fs.readFileSync(script.path, "utf8");
    assert.ok(text.startsWith("<# : Install for Steam launcher."));
    assert.match(text, /\.SYNOPSIS/);
    assert.doesNotMatch(text, /[^\r]\n/);
  });

  // Windows' tar has no Unix modes to keep; the release is staged on Linux.
  it("keeps the Linux script executable in its archive, beside its art", { skip: process.platform === "win32" }, () => {
    const staged = collectSteamInstaller("linux", dir);
    assert.deepEqual(
      staged.map((asset) => asset.name),
      ["MarvelChampions-Linux-Install-for-Steam.sh", "MarvelChampions-Linux-Install-for-Steam.tar.gz"],
    );
    const listing = execFileSync("tar", ["-tvzf", staged[1].path], { encoding: "utf8" });
    assert.match(listing, /^-rwxr-xr-x .*MarvelChampions-Install-for-Steam\/install-for-steam\.sh$/m);
    assert.match(listing, /steam-art\/hero\.jpg$/m);
  });
});
