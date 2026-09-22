#!/usr/bin/env node
/**
 * Screenshot every screen the client can reach through its dev-only `?screen=`
 * jumps (`packages/client/src/scenes/boot.ts`), at every device size — desktop,
 * tablet and phone, the last two in both portrait and landscape — and write
 * them under `artifacts/app-screenshots/<device>/` with an index page.
 *
 * Unlike `shoot-app.mjs` (one shot, for the QA loop), this is the whole-app
 * sweep. It starts its own Vite dev server on a private port (a different
 * origin, so its IndexedDB never collides with another running session's)
 * unless `--url` points at one that is already up. Each shot waits until the
 * screen's own Phaser scene is active (`__mcGame`, exposed in dev builds only)
 * and the card art has stopped loading, then lets the tweens settle.
 *
 * `Math.random` is replaced with a seeded generator before the app loads, so
 * the random deals the `board`/`pause`/`rules`/`inspect`/`setup-deal` jumps
 * roll are the same on every run and a re-run only changes the PNGs whose
 * screen actually changed. `--random` turns that off.
 *
 * Usage:
 *   pnpm screenshots
 *   pnpm screenshots -- --devices mobile-portrait,mobile-landscape --screens board,inspect
 *   pnpm screenshots -- --url http://localhost:5173 --dpr 2
 *
 * Options:
 *   --devices <list>     Comma-separated device names (default: all; see DEVICES)
 *   --screens <list>     Comma-separated screen names (default: all; see SCREENS)
 *   --out <dir>          Output directory (default artifacts/app-screenshots)
 *   --url <origin>       Use an already-running dev server instead of starting one
 *   --port <n>           Port for the server this script starts (default 5191)
 *   --dpr <n>            Device scale factor (default 1; 2 for retina-sharp, ~4x the bytes)
 *   --concurrency <n>    Pages captured at once (default 3)
 *   --settle <ms>        Wait after the scene is ready, before capturing (default 1500)
 *   --timeout <ms>       Per-screen readiness timeout (default 60000)
 *   --random             Don't seed Math.random
 *   --browser <channel>  Playwright Chromium channel (default chrome; "chromium" for the bundled one)
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Viewport sizes. Tablet is an iPad (1024×768), phone an iPhone 14/15 (390×844). */
const DEVICES = {
  desktop: { width: 1440, height: 900, touch: false, mobile: false },
  "tablet-landscape": { width: 1024, height: 768, touch: true, mobile: false },
  "tablet-portrait": { width: 768, height: 1024, touch: true, mobile: false },
  "mobile-portrait": { width: 390, height: 844, touch: true, mobile: true },
  "mobile-landscape": { width: 844, height: 390, touch: true, mobile: true },
};

/**
 * Every `?screen=` jump boot.ts knows, plus Title (no jump). `scene` is the key
 * (scenes/keys.ts) that is active once the screen has drawn. `keys` are pressed
 * once it is, `until` is a scene key to wait on being gone afterwards, and
 * `settle` overrides `--settle` for a screen whose own motion runs longer. Game
 * over has no dev jump yet, so it isn't here.
 */
const SCREENS = [
  { name: "title", query: "", scene: "Title" },
  { name: "scenario-select", query: "screen=scenario-select", scene: "ScenarioSelect" },
  { name: "seats", query: "screen=seats", scene: "Seats" },
  { name: "table-setup", query: "screen=table-setup", scene: "Setup" },
  { name: "setup-deal", query: "screen=setup-deal", scene: "SetupDeal" },
  { name: "decks", query: "screen=decks", scene: "Decks" },
  { name: "deck-check", query: "screen=deck-check", scene: "DeckCheck" },
  { name: "deck-builder", query: "screen=deck-builder", scene: "DeckBuilder" },
  // `screen=board` lands on the opening mulligan; ArrowLeft wraps focus to Decline (keep the hand) and Enter presses it.
  { name: "board-mulligan", query: "screen=board", scene: "ChoiceOverlay" },
  {
    name: "board",
    query: "screen=board",
    scene: "ChoiceOverlay",
    keys: ["ArrowLeft", "Enter"],
    until: "ChoiceOverlay",
    // Past the "Round 1 · Player phase" banner (`BANNER_MS`, scenes/board/motion.ts).
    settle: 4500,
  },
  { name: "inspect", query: "screen=inspect", scene: "InspectOverlay" },
  { name: "choice", query: "screen=choice", scene: "ChoiceOverlay" },
  // The walkthrough reveals one beat per `REVEAL_INTERVAL_MS` (scenes/villain-phase.ts) before it reaches the interrupt.
  { name: "villain-interrupt", query: "screen=villain-interrupt", scene: "VillainPhaseOverlay", settle: 6000 },
  { name: "pause", query: "screen=pause", scene: "PauseOverlay" },
  { name: "rules-glossary", query: "screen=rules&tab=glossary", scene: "RulesOverlay" },
  { name: "rules-villain-phase", query: "screen=rules&tab=villainPhase", scene: "RulesOverlay" },
  { name: "rules-card-list", query: "screen=rules&tab=cardList", scene: "RulesOverlay" },
  { name: "settings", query: "screen=settings", scene: "SettingsOverlay" },
];

const SEED = 20260922;

function parse(argv) {
  const options = {
    devices: Object.keys(DEVICES),
    screens: SCREENS.map((screen) => screen.name),
    out: "artifacts/app-screenshots",
    port: 5191,
    dpr: 1,
    concurrency: 3,
    settle: 1500,
    timeout: 60000,
    random: false,
    browser: "chrome",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--random") {
      options.random = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    index += 1;
    switch (key) {
      case "devices":
      case "screens":
        options[key] = value.split(",").map((item) => item.trim());
        break;
      case "out":
      case "url":
      case "browser":
        options[key] = value;
        break;
      case "port":
      case "dpr":
      case "concurrency":
      case "settle":
      case "timeout":
        options[key] = Number(value);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  for (const device of options.devices) {
    if (!DEVICES[device]) throw new Error(`Unknown device: ${device} (${Object.keys(DEVICES).join(", ")})`);
  }
  for (const name of options.screens) {
    if (!SCREENS.some((screen) => screen.name === name)) {
      throw new Error(`Unknown screen: ${name} (${SCREENS.map((screen) => screen.name).join(", ")})`);
    }
  }
  return options;
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dev server at ${url} didn't come up within ${timeoutMs} ms`);
}

/** Starts the client's Vite dev server on `port`; resolves once it answers. */
async function startServer(port) {
  const child = spawn("pnpm", ["--filter", "@mc/client", "exec", "vite", "--port", String(port), "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
    // Its own process group, so stopping it also stops the vite process pnpm spawned.
    detached: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const exited = new Promise((_, reject) =>
    child.on("exit", (code) => reject(new Error(`Dev server exited (${code}):\n${output}`))),
  );
  const origin = `http://localhost:${port}`;
  await Promise.race([waitForServer(origin, 60000), exited]);
  return {
    origin,
    stop: () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    },
  };
}

/** mulberry32, installed before any app script runs. */
function seedRandom(seed) {
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function shoot(browser, origin, deviceName, screen, index, options) {
  const device = DEVICES[deviceName];
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: options.dpr,
    hasTouch: device.touch,
    isMobile: device.mobile,
  });
  if (!options.random) await context.addInitScript(seedRandom, SEED);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    // The bare "Failed to load resource" line has no URL; the response handler below reports it instead.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      errors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  const file = path.join(options.out, deviceName, `${String(index + 1).padStart(2, "0")}-${screen.name}.png`);
  try {
    await page.goto(`${origin}/${screen.query ? `?${screen.query}` : ""}`, { waitUntil: "load" });
    await page.waitForFunction((key) => globalThis.__mcGame?.scene.isActive(key) === true, screen.scene, {
      timeout: options.timeout,
      polling: 200,
    });
    for (const key of screen.keys ?? []) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
    }
    if (screen.until) {
      await page.waitForFunction((key) => globalThis.__mcGame?.scene.isActive(key) === false, screen.until, {
        timeout: options.timeout,
        polling: 200,
      });
    }
    // Card art streams in after the scene starts; give it a chance to finish.
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(screen.settle ?? options.settle);
    await page.screenshot({ path: file });
    return { file, errors };
  } catch (error) {
    return { file: null, errors: [...errors, `capture failed: ${error.message.split("\n")[0]}`] };
  } finally {
    await context.close();
  }
}

/** A Markdown contact sheet: one section per screen, one column per device. */
function indexPage(devices, screens, results) {
  const lines = [
    "# App screenshots",
    "",
    "Generated by `pnpm screenshots` (`scripts/shoot-screens.mjs`). Don't edit by hand; re-run the script.",
    "",
    "| Device | Viewport |",
    "| --- | --- |",
    ...devices.map((name) => `| ${name} | ${DEVICES[name].width}×${DEVICES[name].height} |`),
    "",
  ];
  for (const screen of screens) {
    lines.push(`## ${screen.name}`, "");
    lines.push(`| ${devices.join(" | ")} |`, `| ${devices.map(() => "---").join(" | ")} |`);
    const cells = devices.map((device) => {
      const file = results.get(`${device}/${screen.name}`);
      return file ? `<img src="${device}/${path.basename(file)}" width="240">` : "_failed_";
    });
    lines.push(`| ${cells.join(" | ")} |`, "");
  }
  return lines.join("\n");
}

async function main() {
  const options = parse(process.argv.slice(2));
  const screens = SCREENS.filter((screen) => options.screens.includes(screen.name));
  for (const device of options.devices) await mkdir(path.join(options.out, device), { recursive: true });

  const server = options.url ? { origin: options.url.replace(/\/$/, ""), stop: () => {} } : null;
  const running = server ?? (await startServer(options.port));
  console.log(`Dev server: ${running.origin}`);
  const browser = await chromium.launch({ channel: options.browser, headless: true });

  // Numbered by position in SCREENS, not in the filtered list, so a partial run overwrites the same files.
  const jobs = options.devices.flatMap((device) =>
    screens.map((screen) => ({ device, screen, index: SCREENS.indexOf(screen) })),
  );
  const results = new Map();
  let failures = 0;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const { file, errors } = await shoot(browser, running.origin, job.device, job.screen, job.index, options);
      results.set(`${job.device}/${job.screen.name}`, file);
      if (!file) failures += 1;
      console.log(`${file ? "✓" : "✗"} ${job.device} ${job.screen.name}${file ? ` → ${file}` : ""}`);
      for (const error of errors) console.error(`    ${error}`);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
  } finally {
    await browser.close();
    running.stop();
  }

  // Only a full sweep rewrites the index; a partial run would drop the rows it skipped.
  if (options.devices.length === Object.keys(DEVICES).length && screens.length === SCREENS.length) {
    await writeFile(path.join(options.out, "README.md"), indexPage(options.devices, screens, results));
  }
  console.log(`\n${jobs.length - failures}/${jobs.length} screenshots written to ${options.out}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
