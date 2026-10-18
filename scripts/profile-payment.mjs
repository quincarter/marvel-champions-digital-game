#!/usr/bin/env node
/**
 * Measures how much the main thread blocks while a player pays for a card (issue #258), with the CPU slowed down to
 * stand in for an older tablet. It opens a game saved part-way, opens the pay step for one hand card, taps the sources
 * one at a time and presses Pay, and for each step reports the long tasks (over 50 ms), the main thread's total task
 * time, and how long until Pay is ready for the picks so far.
 *
 * The game comes from an issue report's replay (`== Replay (setup and commands) ==`): `--make-save` plays every
 * command but the last through a dev server and writes the saved-games rows it stored. Each measured checkout then
 * starts from those rows on a fresh profile, so checkouts are compared on the same position. Each runs on its own dev
 * server: the board hooks the steps are found through exist only in dev (`import.meta.env.DEV`).
 *
 *   node scripts/profile-payment.mjs --make-save --replay replay.json --save artifacts/perf/pay-save.json
 *   node scripts/profile-payment.mjs --save artifacts/perf/pay-save.json --card i19 --pick i21 --pick i26  *     --build main=../main/packages/client --build branch=packages/client --runs 5
 *
 * Options:
 *   --make-save          Write the save instead of measuring (needs --replay; starts `vite` in --client)
 *   --replay <path>      An issue report's replay JSON ({ config, commands })
 *   --client <dir>       The client package the dev server runs in (default packages/client)
 *   --save <path>        The saved-games rows to write or read
 *   --build <name=dir>   A client package to measure. Repeatable; runs are interleaved across them.
 *   --card <id>          The hand card to pay for
 *   --pick <id>          A source to tap, in order. Repeatable.
 *   --throttle <n>       Chrome CPU slowdown factor (default 6)
 *   --size <WxH>         Viewport (default 1280x800)
 *   --runs <n>           Runs per build, medians reported (default 5)
 *   --json <path>        Write every sample as JSON
 *   --shots <dir>        Screenshot the pay step (picked, and a card's hover) on each build's last run
 *   --cpuprofile <dir>   Also write a CPU profile of each build's last run, from opening the pay step on
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function parse(argv) {
  const options = {
    makeSave: false,
    replay: null,
    client: "packages/client",
    save: null,
    builds: [],
    card: null,
    picks: [],
    throttle: 6,
    size: "1280x800",
    runs: 5,
    json: null,
    cpuprofile: null,
    shots: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--make-save") {
      options.makeSave = true;
      continue;
    }
    const value = argv[index + 1];
    index += 1;
    switch (arg) {
      case "--replay":
        options.replay = value;
        break;
      case "--client":
        options.client = value;
        break;
      case "--save":
        options.save = value;
        break;
      case "--build": {
        const [name, dir] = value.split("=");
        options.builds.push({ name, dir });
        break;
      }
      case "--card":
        options.card = value;
        break;
      case "--pick":
        options.picks.push(value);
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
      case "--json":
        options.json = value;
        break;
      case "--shots":
        options.shots = value;
        break;
      case "--cpuprofile":
        options.cpuprofile = value;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

const launch = () =>
  chromium.launch({
    channel: "chrome",
    headless: true,
    // As the e2e config does on Windows: WebGL on the GPU, not SwiftShader on every core.
    args: process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : [],
  });

/** Plays the replay's commands but the last through the dev server, and writes the saved-games rows. */
async function makeSave(options) {
  const replay = JSON.parse(await readFile(options.replay, "utf8"));
  const server = await devServer(options.client, 5391);
  const browser = await launch();
  try {
    const page = await browser.newPage();
    page.on("console", (message) => console.log(`[page] ${message.text()}`));
    page.on("pageerror", (error) => console.log(`[page error] ${error.message}`));
    await page.goto(server.base, { waitUntil: "load" });
    await page.waitForFunction(() => "__mcGame" in window, null, { timeout: 120_000 });
    console.log("app up, replaying");
    const rows = await page.evaluate(
      async ({ config, commands }) => {
        const { appSession } = await import("/src/session.ts");
        const { store } = appSession();
        await store.start(config);
        if (store.state.status !== "playing") throw new Error(`start failed: ${store.state.error}`);
        for (const [index, entry] of commands.entries()) {
          if (!(await store.dispatch(entry.command))) throw new Error(`command ${index + 1}: ${store.state.error}`);
          if (index % 10 === 0) console.log(`replayed ${index + 1}`);
        }
        // Let the worker's writes land, then read every row back.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open("mc-saves");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const all = (name) =>
          new Promise((resolve, reject) => {
            const request = db.transaction(name).objectStore(name).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        return {
          version: db.version,
          games: await all("games"),
          baselines: await all("baselines"),
          commands: await all("commands"),
        };
      },
      { config: replay.config, commands: replay.commands.slice(0, -1) },
    );
    await mkdir(path.dirname(options.save), { recursive: true });
    await writeFile(options.save, JSON.stringify(rows));
    console.log(`Saved ${rows.commands.length} commands to ${options.save}`);
  } finally {
    await browser.close();
    server.stop();
  }
}

/**
 * Starts the client's dev server and waits for it to answer. The dev server, not a build: the board hooks the steps are
 * found through exist only there (`import.meta.env.DEV`), and a production build has none.
 */
async function devServer(client, port) {
  const vite = spawn(`pnpm exec vite --port ${port} --strictPort`, { cwd: client, shell: true, stdio: "ignore" });
  const base = `http://localhost:${port}/`;
  for (let tries = 0; ; tries += 1) {
    try {
      if ((await fetch(base)).ok) break;
    } catch (cause) {
      if (tries > 120) throw cause;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const stop = () => {
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(vite.pid), "/t", "/f"], { stdio: "ignore" });
    else vite.kill();
  };
  return { base, stop };
}

/**
 * Runs in the page before its scripts: records long tasks, finds text on the Phaser scenes, and timestamps the
 * engine worker's payment-judging messages (only the worker-judging build sends any).
 */
function instrument() {
  const record = { longTasks: [], judged: [] };
  window.__perf = record;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) record.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }).observe({ type: "longtask", buffered: true });
  const sent = new Map();
  const Base = window.Worker;
  window.Worker = class extends Base {
    constructor(...args) {
      super(...args);
      this.addEventListener("message", (event) => {
        const at = sent.get(event.data?.id);
        if (at !== undefined && event.data?.kind === "paymentJudged") {
          record.judged.push({ sent: at, received: performance.now() });
        }
      });
    }
    postMessage(message, ...rest) {
      if (message?.kind === "judgePayment") sent.set(message.id, performance.now());
      return super.postMessage(message, ...rest);
    }
  };
  window.__findText = (substr) => {
    const game = window.__mcGame;
    if (!game) return [];
    const found = [];
    for (const scene of game.scene.scenes.filter((s) => s.sys.isActive())) {
      const walk = (object) => {
        if (!object) return;
        if (typeof object.text === "string" && object.text.toLowerCase().includes(substr.toLowerCase())) {
          const bounds = object.getBounds();
          found.push({ text: object.text, x: bounds.centerX, y: bounds.centerY });
        }
        for (const child of object.list ?? []) walk(child);
      };
      for (const child of scene.children.list) walk(child);
    }
    return found;
  };
}

async function waitFor(page, fn, arg, label, timeout = 120_000) {
  try {
    return await (await page.waitForFunction(fn, arg, { timeout, polling: 100 })).jsonValue();
  } catch (cause) {
    await page.screenshot({ path: path.join(os.tmpdir(), "profile-payment-failure.png") }).catch(() => {});
    throw new Error(`timed out waiting for ${label}: ${cause.message}`);
  }
}

/** Main-thread work and long tasks between two `performance.now()` marks, and the CDP task time spent. */
async function windowOf(page, from, to) {
  return page.evaluate(
    ({ from, to }) => {
      const tasks = window.__perf.longTasks.filter((task) => task.start >= from && task.start <= to);
      const durations = tasks.map((task) => task.duration);
      return {
        longTasks: tasks.length,
        longestTaskMs: Math.round(Math.max(0, ...durations)),
        blockingMs: Math.round(durations.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0)),
      };
    },
    { from, to },
  );
}

const taskSeconds = async (cdp) =>
  (await cdp.send("Performance.getMetrics")).metrics.find((metric) => metric.name === "TaskDuration").value;

/** One measured pass on one build: resume the save, open the pay step, tap each pick, press Pay. */
async function run(browser, base, save, options, profilePath = null, shotPrefix = null) {
  const [width, height] = options.size.split("x").map(Number);
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.addInitScript(instrument);
  // Seed the saved game on this origin before the app opens its database.
  // A plain script on the dev server's origin (it would answer any page path with the app itself).
  await page.goto(`${base}@vite/client`, { waitUntil: "load" });
  await page.evaluate(async (rows) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("mc-saves", rows.version);
      request.onupgradeneeded = () => {
        const created = request.result;
        created.createObjectStore("games", { keyPath: "id" });
        created.createObjectStore("baselines", { keyPath: "gameId" });
        created.createObjectStore("commands", { keyPath: ["gameId", "seq"] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction(["games", "baselines", "commands"], "readwrite");
    for (const row of rows.games) transaction.objectStore("games").put(row);
    for (const row of rows.baselines) transaction.objectStore("baselines").put(row);
    for (const row of rows.commands) transaction.objectStore("commands").put(row);
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, save);
  await page.goto(base, { waitUntil: "load" });
  const cont = await waitFor(page, () => window.__findText?.("Continue")?.[0] ?? null, null, "Continue on Title");
  await page.mouse.click(cont.x, cont.y);
  const card = await waitFor(
    page,
    (id) => window.__mcBoardDebug?.focusRect(`card:${id}`) ?? null,
    options.card,
    "the card to pay for",
  );
  await page.waitForTimeout(3000);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: options.throttle });
  if (profilePath) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
  }

  const steps = [];
  const step = async (label, press, ready) => {
    const before = await taskSeconds(cdp);
    const from = await page.evaluate(() => performance.now());
    await press();
    const readyAt = await waitFor(page, ready.fn, ready.arg, ready.label);
    // Let the step's own redraws and replies finish before the next press.
    await page.waitForTimeout(1500);
    const to = await page.evaluate(() => performance.now());
    const judged = await page.evaluate(
      ({ from, to }) => window.__perf.judged.filter((entry) => entry.sent >= from && entry.sent <= to),
      { from, to },
    );
    steps.push({
      label,
      readyMs: Math.round(readyAt - from),
      mainThreadMs: Math.round(((await taskSeconds(cdp)) - before) * 1000),
      judgeRoundTripMs: judged.length ? Math.round(Math.max(...judged.map((j) => j.received - j.sent))) : null,
      ...(await windowOf(page, from, to)),
    });
  };
  const center = (rect) => [rect.x + rect.width / 2, rect.y + rect.height / 2];

  // The board drawing frames with nothing pressed: what every step below costs anyway.
  await step("Nothing pressed", () => Promise.resolve(), { fn: () => performance.now(), label: "now" });

  await step("Open the pay step", () => page.mouse.click(...center(card)), {
    fn: () => (window.__mcBoardDebug?.paymentView() ? performance.now() : null),
    label: "the pay step",
  });
  for (const [index, pick] of options.picks.entries()) {
    const rect = await waitFor(page, (id) => window.__mcBoardDebug.focusRect(`card:${id}`), pick, `pick ${pick}`);
    const last = index === options.picks.length - 1;
    await step(`Tap source ${index + 1}`, () => page.mouse.click(...center(rect)), {
      fn: ({ id, last }) => {
        const view = window.__mcBoardDebug.paymentView();
        if (!view || !view.sources.some((source) => source.instanceId === id && source.spent)) return null;
        // The last pick is ready once the engine accepts the payment; earlier ones once it has judged them.
        if (view.judging) return null;
        return !last || view.command ? performance.now() : null;
      },
      arg: { id: pick, last },
      label: `the verdict after pick ${pick}`,
    });
  }
  const pay = await waitFor(page, () => window.__mcBoardDebug.focusRect("payment:pay"), null, "the Pay button");
  if (shotPrefix) {
    await mkdir(path.dirname(shotPrefix), { recursive: true });
    await page.screenshot({ path: `${shotPrefix}-picked.png` });
    const last = await page.evaluate((id) => window.__mcBoardDebug.focusRect(`card:${id}`), options.picks.at(-1));
    await page.mouse.move(...center(last));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${shotPrefix}-hover.png` });
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500);
  }
  const closed = () =>
    window.__mcBoardDebug.paymentView() === null || window.__findText("confirm payment").length > 0
      ? performance.now()
      : null;
  await step("Press Pay", () => page.mouse.click(...center(pay)), { fn: closed, label: "the pay step to close" });
  // The guide's "Hold on" check can stop the payment to ask; confirming it is the player's next press.
  const confirm = await page.evaluate(() => window.__findText("confirm payment")[0] ?? null);
  if (confirm) {
    await step("Confirm payment", () => page.mouse.click(confirm.x, confirm.y), {
      fn: () => (window.__mcBoardDebug.paymentView() === null ? performance.now() : null),
      label: "the payment to go through",
    });
  }
  if (profilePath) {
    const { profile } = await cdp.send("Profiler.stop");
    await mkdir(path.dirname(profilePath), { recursive: true });
    await writeFile(profilePath, JSON.stringify(profile));
  }
  await context.close();
  return steps;
}

function median(values) {
  const present = values.filter((value) => value !== null);
  if (present.length === 0) return null;
  const sorted = [...present].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const options = parse(process.argv.slice(2));
if (options.makeSave) {
  await makeSave(options);
} else {
  const save = JSON.parse(await readFile(options.save, "utf8"));
  const servers = [];
  for (const [index, build] of options.builds.entries()) servers.push(await devServer(build.dir, 5392 + index));
  const browser = await launch();
  const samples = Object.fromEntries(options.builds.map((build) => [build.name, []]));
  try {
    // One pass each first, not counted: the dev server transforms every module on its first load.
    for (const server of servers) await run(browser, server.base, save, options);
    for (let index = 0; index < options.runs; index += 1) {
      // Alternate the order each round, so neither build always runs on a warmer machine.
      const order = index % 2 === 0 ? options.builds : [...options.builds].reverse();
      for (const build of order) {
        const server = servers[options.builds.indexOf(build)];
        const profile =
          options.cpuprofile && index === options.runs - 1
            ? path.join(options.cpuprofile, `${build.name}.cpuprofile`)
            : null;
        const shots = options.shots && index === options.runs - 1 ? path.join(options.shots, build.name) : null;
        samples[build.name].push(await run(browser, server.base, save, options, profile, shots));
        process.stdout.write(".");
      }
    }
  } finally {
    await browser.close();
    for (const server of servers) server.stop();
  }
  console.log(`\nCPU ${options.throttle}x slower · ${options.size} · median of ${options.runs}`);
  const keys = ["readyMs", "mainThreadMs", "longTasks", "longestTaskMs", "blockingMs", "judgeRoundTripMs"];
  const summary = {};
  for (const build of options.builds) {
    const runs = samples[build.name];
    summary[build.name] = runs[0].map((first, stepIndex) => ({
      label: first.label,
      ...Object.fromEntries(keys.map((key) => [key, median(runs.map((steps) => steps[stepIndex][key]))])),
    }));
    console.log(`\n${build.name}`);
    for (const row of summary[build.name]) {
      console.log(
        `  ${row.label.padEnd(18)} ready ${String(row.readyMs).padStart(5)} ms · main thread ${String(row.mainThreadMs).padStart(5)} ms · ` +
          `longest task ${String(row.longestTaskMs).padStart(5)} ms · blocking ${String(row.blockingMs).padStart(5)} ms` +
          (row.judgeRoundTripMs !== null ? ` · worker verdict ${row.judgeRoundTripMs} ms` : ""),
      );
    }
  }
  if (options.json) {
    await mkdir(path.dirname(options.json), { recursive: true });
    await writeFile(options.json, JSON.stringify({ options, summary, samples }, null, 2));
  }
}
