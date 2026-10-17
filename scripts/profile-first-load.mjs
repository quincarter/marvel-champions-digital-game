#!/usr/bin/env node
/**
 * Measures how much the main thread blocks while the client first loads, with the CPU slowed down to stand in for an
 * older phone or tablet. It serves a built client (`pnpm --filter @mc/client build` first), opens it in headless Chrome
 * with Chrome's own CPU throttling, and reports the long tasks (over 50 ms) and the frames that took over 50 ms, from
 * navigation until the page has been quiet for a while. Each `--click` then opens a screen the way a player would
 * and measures that screen's first draw the same way.
 *
 * Usage:
 *   node scripts/profile-first-load.mjs --throttle 6 --runs 3
 *   node scripts/profile-first-load.mjs --click 720,560 --label "Scenario select" --cpuprofile artifacts/perf/load.cpuprofile
 *
 * Options:
 *   --dist <dir>        The built client (default packages/client/dist)
 *   --throttle <n>      Chrome CPU slowdown factor (default 6, "low-end mobile" in DevTools)
 *   --size <WxH>        Viewport (default 1280x800, a tablet in landscape)
 *   --runs <n>          Fresh-profile runs to take the median of (default 3)
 *   --quiet <ms>        How long without a long task counts as settled (default 3000)
 *   --click <x,y>       After load settles, click there and measure until quiet again. Repeatable.
 *   --label <name>      Names the preceding --click in the report
 *   --cpuprofile <path> Also write a CPU profile of the last run (open it in DevTools' Performance panel)
 *   --json <path>       Write the full result as JSON
 *   --seed <n>          Seeds Math.random, so every run (and a before/after pair) picks the same title art (default 1)
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function parse(argv) {
  const options = {
    dist: "packages/client/dist",
    throttle: 6,
    size: "1280x800",
    runs: 3,
    quiet: 3000,
    clicks: [],
    cpuprofile: null,
    json: null,
    seed: 1,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    const value = argv[index + 1];
    index += 1;
    switch (arg) {
      case "--dist":
        options.dist = value;
        break;
      case "--throttle":
        options.throttle = Number(value);
        break;
      case "--size":
        options.size = value;
        break;
      case "--runs":
        options.runs = Number(value);
        break;
      case "--quiet":
        options.quiet = Number(value);
        break;
      case "--click": {
        const [x, y] = value.split(",").map(Number);
        options.clicks.push({ x, y, label: `click ${value}` });
        break;
      }
      case "--label":
        options.clicks[options.clicks.length - 1].label = value;
        break;
      case "--cpuprofile":
        options.cpuprofile = value;
        break;
      case "--seed":
        options.seed = Number(value);
        break;
      case "--json":
        options.json = value;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
};

/** A plain static server over the build, so the measurement has no dev-server transforms in it. */
function serve(root) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    let file = path.join(root, decodeURIComponent(url.pathname));
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

/** Runs in the page before any of its scripts: records long tasks and every frame's length. */
function instrument(seed) {
  // mulberry32: the same picks every run, so runs and builds are compared on the same art.
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const record = { longTasks: [], frames: [] };
  window.__perf = record;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) record.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }).observe({ type: "longtask", buffered: true });
  let last = performance.now();
  const tick = (now) => {
    record.frames.push({ start: last, duration: now - last });
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Waits until no long task has started for `quiet` ms, and returns the time it settled at. */
async function settle(page, from, quiet) {
  const deadline = Date.now() + 90_000;
  for (;;) {
    await page.waitForTimeout(500);
    const { lastEnd, now } = await page.evaluate((since) => {
      const tasks = window.__perf.longTasks.filter((task) => task.start >= since);
      const lastEnd = tasks.length ? Math.max(...tasks.map((task) => task.start + task.duration)) : since;
      return { lastEnd, now: performance.now() };
    }, from);
    if (now - lastEnd >= quiet || Date.now() > deadline) return lastEnd;
  }
}

async function window_(page, from, to) {
  return page.evaluate(
    ({ from, to }) => {
      const tasks = window.__perf.longTasks.filter((task) => task.start >= from && task.start <= to);
      const frames = window.__perf.frames.filter((frame) => frame.start >= from && frame.start <= to);
      const durations = tasks.map((task) => task.duration);
      return {
        settledMs: Math.round(to - from),
        longTasks: tasks.length,
        longestTaskMs: Math.round(Math.max(0, ...durations)),
        // Total blocking time: the part of each long task past 50 ms, the time input would have waited.
        blockingMs: Math.round(durations.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0)),
        slowFrames: frames.filter((frame) => frame.duration > 50).length,
        longestFrameMs: Math.round(Math.max(0, ...frames.map((frame) => frame.duration))),
        tasks: tasks.map((task) => ({ at: Math.round(task.start - from), ms: Math.round(task.duration) })),
      };
    },
    { from, to },
  );
}

async function run(browser, base, options, profilePath) {
  const [width, height] = options.size.split("x").map(Number);
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.addInitScript(instrument, options.seed);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: options.throttle });
  if (profilePath) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
  }
  await page.goto(base, { waitUntil: "load" });
  const loadEnd = await settle(page, 0, options.quiet);
  const result = { load: await window_(page, 0, loadEnd), screens: [] };
  for (const click of options.clicks) {
    const from = await page.evaluate(() => performance.now());
    await page.mouse.click(click.x, click.y);
    const end = await settle(page, from, options.quiet);
    result.screens.push({ label: click.label, ...(await window_(page, from, end)) });
  }
  if (profilePath) {
    const { profile } = await cdp.send("Profiler.stop");
    await mkdir(path.dirname(profilePath), { recursive: true });
    await writeFile(profilePath, JSON.stringify(profile));
  }
  await context.close();
  return result;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function summarize(label, samples) {
  const keys = ["settledMs", "longTasks", "longestTaskMs", "blockingMs", "slowFrames", "longestFrameMs"];
  const row = Object.fromEntries(keys.map((key) => [key, median(samples.map((sample) => sample[key]))]));
  console.log(
    `${label.padEnd(22)} settled ${String(row.settledMs).padStart(6)} ms · ${String(row.longTasks).padStart(3)} long tasks · ` +
      `longest ${String(row.longestTaskMs).padStart(5)} ms · blocking ${String(row.blockingMs).padStart(6)} ms · ` +
      `${String(row.slowFrames).padStart(3)} frames over 50 ms (longest ${row.longestFrameMs} ms)`,
  );
  return row;
}

const options = parse(process.argv.slice(2));
const server = await serve(path.resolve(options.dist));
const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  // As the e2e config does on Windows: WebGL on the GPU, not SwiftShader on every core.
  args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : [],
});
const results = [];
try {
  for (let index = 0; index < options.runs; index += 1) {
    const last = index === options.runs - 1;
    results.push(await run(browser, base, options, last ? options.cpuprofile : null));
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`CPU ${options.throttle}x slower · ${options.size} · median of ${options.runs}`);
const summary = {
  load: summarize(
    "First load",
    results.map((result) => result.load),
  ),
  screens: [],
};
options.clicks.forEach((click, index) => {
  summary.screens.push({
    label: click.label,
    ...summarize(
      click.label,
      results.map((result) => result.screens[index]),
    ),
  });
});
if (options.json) {
  await mkdir(path.dirname(options.json), { recursive: true });
  await writeFile(options.json, JSON.stringify({ options, summary, results }, null, 2));
}
