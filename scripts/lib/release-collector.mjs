// Centralized logic for gathering release artifacts (Desktop installers, Android APK)
// into the unified <repoRoot>/release/ directory and generating checksum manifests.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..", "..");
export const defaultReleaseDir = path.join(repoRoot, "release");
export const clientDir = path.join(repoRoot, "packages", "client");
export const tauriTargetDir = path.join(clientDir, "src-tauri", "target");
export const androidAppDir = path.join(clientDir, "android", "app");

/**
 * Resolves the canonical project release version.
 * Checks tauri.conf.json, then package.json, falling back to "0.1.0".
 */
export function getProjectVersion() {
  const tauriConfPath = path.join(clientDir, "src-tauri", "tauri.conf.json");
  if (fs.existsSync(tauriConfPath)) {
    try {
      const conf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
      if (conf.version) return conf.version;
    } catch {
      // ignore
    }
  }

  const pkgJsonPath = path.join(repoRoot, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      if (pkg.version) return pkg.version;
    } catch {
      // ignore
    }
  }

  return "0.1.0";
}

/**
 * Release asset names say which OS, architecture and kind of installer each file is, so a player picks the right
 * download from the release page: `MarvelChampions-<version>-<OS>-<architecture>[-<kind>].<ext>`, e.g.
 * `MarvelChampions-0.21.0-macOS-AppleSilicon-arm64.dmg`. Hyphens, not spaces: GitHub turns a space in an asset name
 * into a dot. Both the CI release job (stage-release-assets.mjs) and local builds name files here, and the in-app
 * update notice matches these names (packages/client/src/platform/update-check.ts).
 *
 * Every name carries its card language (`MC_CARD_LANG`, issue #337) right after the version, English included:
 * `MarvelChampions-0.37.0-EN-Windows-x64-Setup.exe`, `MarvelChampions-0.37.0-ES-Android.apk`. That is where the update
 * notice reads it (`assetLanguage` in packages/client/src/art/card-language.ts); releases before the tag have none and
 * are English.
 */
export const ASSET_PREFIX = "MarvelChampions";

/** `MarvelChampions-<version>-<LANG>`; English unless `MC_CARD_LANG` names another language. */
function assetStem(version, lang = process.env.MC_CARD_LANG) {
  return `${ASSET_PREFIX}-${version}-${(lang || "en").toUpperCase()}`;
}

export function androidApkName(version, lang) {
  return `${assetStem(version, lang)}-Android.apk`;
}

const DESKTOP_EXTENSIONS = [".app.tar.gz", ".dmg", ".msi", ".exe", ".deb", ".rpm", ".AppImage"];

/**
 * The release name of one Tauri bundle, from its file name and path (the target triple when built with `--target`,
 * else the name's own arch, else this machine's). Null for anything that isn't an installer.
 */
export function desktopAssetName(fileName, fullPath, version, lang) {
  const ext = DESKTOP_EXTENSIONS.find((e) => fileName.endsWith(e));
  if (ext === undefined) return null;
  const arm = /aarch64|arm64/i.test(fullPath) || (!/x86_64|x64|amd64/i.test(fullPath) && process.arch === "arm64");
  const arch = arm ? "arm64" : "x64";
  let variant;
  if (ext === ".dmg" || ext === ".app.tar.gz") variant = arm ? "macOS-AppleSilicon-arm64" : "macOS-Intel-x64";
  // The NSIS setup.exe installs for the current user and needs no admin rights: what most players want. The .msi
  // installs for every user of the machine, under Program Files.
  else if (ext === ".exe") variant = `Windows-${arch}-Setup`;
  else if (ext === ".msi") variant = `Windows-${arch}-AllUsers`;
  else variant = `Linux-${arch}`;
  return `${assetStem(version, lang)}-${variant}${ext}`;
}

/**
 * Computes sha256 of a file.
 */
export function computeSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/**
 * Recursively find files matching a predicate.
 */
function findFilesRec(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRec(full, predicate));
    } else if (entry.isFile() && predicate(entry.name, full)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Collects all generated Tauri desktop installers into the release directory.
 * @returns {Array<{ name: string, path: string, size: number, sha256: string }>}
 */
export function collectDesktopBundles(releaseDir = defaultReleaseDir) {
  fs.mkdirSync(releaseDir, { recursive: true });
  const collected = [];

  if (!fs.existsSync(tauriTargetDir)) {
    return collected;
  }

  // Look for bundle directories under target
  // e.g. target/release/bundle or target/x86_64-pc-windows-msvc/release/bundle
  const isBundleInstaller = (name, fullPath) => {
    // Only care about files inside a "bundle" directory
    if (!fullPath.includes(`${path.sep}bundle${path.sep}`)) return false;

    // Supported bundle types:
    // macOS: .dmg, .app.tar.gz
    // Windows: .msi, -setup.exe or *.exe under nsis/
    // Linux: .deb, .AppImage, .rpm
    if (name.endsWith(".dmg")) return true;
    if (name.endsWith(".app.tar.gz")) return true;
    if (name.endsWith(".msi")) return true;
    if (name.endsWith(".exe") && (name.includes("-setup") || fullPath.includes(`${path.sep}nsis${path.sep}`)))
      return true;
    if (name.endsWith(".deb")) return true;
    if (name.endsWith(".AppImage")) return true;
    if (name.endsWith(".rpm")) return true;

    return false;
  };

  const installerFiles = findFilesRec(tauriTargetDir, isBundleInstaller);

  const version = getProjectVersion();
  for (const src of installerFiles) {
    const fileName = desktopAssetName(path.basename(src), src, version) ?? path.basename(src);
    const dest = path.join(releaseDir, fileName);
    fs.copyFileSync(src, dest);
    const stat = fs.statSync(dest);
    const sha256 = computeSha256(dest);
    collected.push({
      name: fileName,
      path: dest,
      size: stat.size,
      sha256,
    });
  }

  return collected;
}

/**
 * The "Install for Steam" script for this machine's OS (scripts/<os>/install-for-steam.*), which adds the installed
 * game to Steam as a non-Steam game with its library art. Each desktop leg of the release stages its own OS's, with
 * the release's tag stamped in so it fetches that release's art; both macOS legs stage the same file. Windows ships a
 * .cmd: the launcher (scripts/windows/install-for-steam-launcher.cmd) with the .ps1 after it, which runs on a
 * double-click where a downloaded unsigned .ps1 is blocked (#474).
 */
const STEAM_INSTALLERS = {
  linux: { source: path.join("linux", "install-for-steam.sh"), name: "Linux-Install-for-Steam.sh" },
  win32: {
    source: path.join("windows", "install-for-steam.ps1"),
    launcher: path.join("windows", "install-for-steam-launcher.cmd"),
    name: "Windows-Install-for-Steam.cmd",
  },
  darwin: { source: path.join("macos", "install-for-steam.sh"), name: "macOS-Install-for-Steam.sh" },
};

export function steamInstallerName(platform, version) {
  const installer = STEAM_INSTALLERS[platform];
  return installer ? `${ASSET_PREFIX}-${version}-${installer.name}` : null;
}

/**
 * Stages this OS's Install for Steam script into the release directory.
 * @returns {{ name: string, path: string, size: number, sha256: string } | null}
 */
export function collectSteamInstaller(platform = process.platform, releaseDir = defaultReleaseDir) {
  const installer = STEAM_INSTALLERS[platform];
  if (!installer) return null;
  fs.mkdirSync(releaseDir, { recursive: true });
  const version = getProjectVersion();
  const name = steamInstallerName(platform, version);
  const dest = path.join(releaseDir, name);
  const read = (file) => fs.readFileSync(path.join(repoRoot, "scripts", file), "utf8");
  let script = read(installer.source).replaceAll("__MC_RELEASE_TAG__", `v${version}`);
  // cmd misreads labels and jumps in a batch file with bare LF line ends, so the stitched .cmd uses CRLF throughout.
  if (installer.launcher) script = (read(installer.launcher) + script).replace(/\r?\n/g, "\r\n");
  fs.writeFileSync(dest, script, { mode: 0o755 });
  const stat = fs.statSync(dest);
  return { name, path: dest, size: stat.size, sha256: computeSha256(dest) };
}

/**
 * Collects the signed release APK into the release directory.
 * @returns {{ name: string, path: string, size: number, sha256: string } | null}
 */
export function collectAndroidApk(versionName, releaseDir = defaultReleaseDir) {
  fs.mkdirSync(releaseDir, { recursive: true });

  const signedApk = path.join(androidAppDir, "build", "outputs", "apk", "release", "app-release-signed.apk");
  if (!fs.existsSync(signedApk)) {
    return null;
  }

  const destName = androidApkName(versionName || getProjectVersion());
  const destPath = path.join(releaseDir, destName);
  fs.copyFileSync(signedApk, destPath);

  const stat = fs.statSync(destPath);
  const sha256 = computeSha256(destPath);

  return {
    name: destName,
    path: destPath,
    size: stat.size,
    sha256,
  };
}

/**
 * Returns all current artifacts in the release directory.
 */
export function getReleaseArtifacts(releaseDir = defaultReleaseDir) {
  if (!fs.existsSync(releaseDir)) return [];
  const entries = fs.readdirSync(releaseDir, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries) {
    if (!entry.isFile() || entry.name === "SHA256SUMS.txt") continue;
    const fullPath = path.join(releaseDir, entry.name);
    const stat = fs.statSync(fullPath);
    const sha256 = computeSha256(fullPath);
    artifacts.push({
      name: entry.name,
      path: fullPath,
      size: stat.size,
      sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
      sha256,
    });
  }

  return artifacts;
}

/**
 * Writes SHA256SUMS.txt manifest in the release directory.
 */
export function writeChecksumManifest(releaseDir = defaultReleaseDir) {
  const artifacts = getReleaseArtifacts(releaseDir);
  if (artifacts.length === 0) return null;

  const manifestPath = path.join(releaseDir, "SHA256SUMS.txt");
  const lines = artifacts.map((a) => `${a.sha256}  ${a.name}`);
  fs.writeFileSync(manifestPath, `${lines.join("\n")}\n`, "utf8");

  return manifestPath;
}
