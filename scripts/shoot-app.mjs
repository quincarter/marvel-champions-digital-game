#!/usr/bin/env node
/**
 * Screenshot the running client at a real viewport size, optionally after a
 * few actions, optionally as a burst of frames — the visual-QA loop for the
 * screens and the motion pass, against the design canvases
 * (docs/design-reference.md) and at a real frame rate (the in-app browser
 * pane throttles to ~1 fps, so it cannot show a tween mid-flight).
 *
 * Needs the dev server up on http://localhost:5173 (`mise dev` / `pnpm dev`).
 * Uses the dev-only `?screen=` jumps in `packages/client/src/scenes/boot.ts`.
 *
 * Usage:
 *   node scripts/shoot-app.mjs --screen inspect --size desktop --out artifacts/qa/inspect-desktop.png
 *   node scripts/shoot-app.mjs --url "http://localhost:5173/?screen=board" --size 1024x768 --key Escape --out x.png
 *   node scripts/shoot-app.mjs --screen inspect --size desktop --key Escape --frames 8 --interval 40 --out artifacts/qa/close.png
 *     → close-00.png … close-07.png, 40 ms apart, starting right after the key press
 *
 * Options:
 *   --screen <name>        `?screen=<name>` on localhost:5173 (inspect, board, pause, rules, settings, decks, …)
 *   --url <url>            A full URL instead of --screen
 *   --size <preset|WxH>    phone (390x844) · tablet (1024x768) · tablet-portrait (768x1024) · desktop (1440x980) · WxH
 *   --wait <ms>            After load, before actions (default 5000 — the board, its art and fonts)
 *   --click <x,y>          Left-click, then wait 300 ms. Repeatable, in order with the other actions.
 *   --rightclick <x,y>     Right-click (opens Inspect on a card), then wait 300 ms.
 *   --hold <x,y>           Press for 600 ms then release (the touch "hold to inspect"), then wait 300 ms.
 *   --key <Key>            Press a key (Escape, Enter, Tab, ArrowRight, i, …), then wait 300 ms.
 *   --settle <ms>          Wait this long after the last action before capturing (default 700; use 0 with --frames)
 *   --frames <n>           Capture n frames instead of one (default 1)
 *   --interval <ms>        Milliseconds between frames (default 50)
 *   --reduced              Emulate prefers-reduced-motion: reduce
 *   --out <path>           Output PNG (default artifacts/qa/shot.png). With --frames, -NN is appended.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SIZES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 1024, height: 768 },
  "tablet-portrait": { width: 768, height: 1024 },
  desktop: { width: 1440, height: 980 },
};

function parse(argv) {
  const options = {
    size: "desktop",
    wait: 5000,
    settle: 700,
    frames: 1,
    interval: 50,
    reduced: false,
    out: "artifacts/qa/shot.png",
    actions: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--reduced") {
      options.reduced = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    index += 1;
    switch (key) {
      case "screen":
        options.url = `http://localhost:5173/?screen=${value}`;
        break;
      case "url":
        options.url = value;
        break;
      case "size":
        options.size = value;
        break;
      case "wait":
      case "settle":
      case "frames":
      case "interval":
        options[key] = Number(value);
        break;
      case "out":
        options.out = value;
        break;
      case "click":
      case "rightclick":
      case "hold":
      case "key":
        options.actions.push({ kind: key, value });
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.url) throw new Error("Pass --screen <name> or --url <url>");
  return options;
}

function sizeOf(spec) {
  if (SIZES[spec]) return SIZES[spec];
  const match = /^(\d+)x(\d+)$/.exec(spec);
  if (!match) throw new Error(`Unknown size: ${spec}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

const point = (value) => {
  const [x, y] = value.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Bad point: ${value}`);
  return { x, y };
};

async function main() {
  const options = parse(process.argv.slice(2));
  const viewport = sizeOf(options.size);
  await mkdir(path.dirname(options.out), { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: options.reduced ? "reduce" : "no-preference",
    hasTouch: viewport.width < 768,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(options.url, { waitUntil: "load" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(options.wait);

  for (const [index, action] of options.actions.entries()) {
    if (action.kind === "click") {
      const { x, y } = point(action.value);
      await page.mouse.click(x, y);
    } else if (action.kind === "rightclick") {
      const { x, y } = point(action.value);
      await page.mouse.click(x, y, { button: "right" });
    } else if (action.kind === "hold") {
      const { x, y } = point(action.value);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();
    } else if (action.kind === "key") {
      await page.keyboard.press(action.value);
    }
    // Let each action land before the next; a burst starts right after the last one.
    if (options.frames <= 1 || index < options.actions.length - 1) await page.waitForTimeout(300);
  }

  if (options.frames <= 1) {
    await page.waitForTimeout(options.settle);
    await page.screenshot({ path: options.out });
    console.log(options.out);
  } else {
    const parsed = path.parse(options.out);
    for (let frame = 0; frame < options.frames; frame += 1) {
      const file = path.join(parsed.dir, `${parsed.name}-${String(frame).padStart(2, "0")}${parsed.ext}`);
      await page.screenshot({ path: file });
      console.log(file);
      await page.waitForTimeout(options.interval);
    }
  }

  await browser.close();
  if (errors.length > 0) {
    console.error(`\n${errors.length} console/page error(s):`);
    for (const error of errors) console.error(`  ${error}`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
