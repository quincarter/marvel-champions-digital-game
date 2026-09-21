#!/usr/bin/env node

import { chromium } from "playwright";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const defaults = {
  input: "Marvel Champions game screens",
  output: "artifacts/design-screenshots",
  width: 1600,
  height: 1200,
  browser: "chrome",
};

function usage() {
  console.log(`Usage: pnpm capture:screens [options]

Render every HTML board in a directory as a full-page PNG.

Options:
  --input <directory>    HTML source directory (default: ${defaults.input})
  --output <directory>   Screenshot directory (default: ${defaults.output})
  --width <pixels>       Browser viewport width (default: ${defaults.width})
  --height <pixels>      Browser viewport height (default: ${defaults.height})
  --browser <channel>    Playwright browser channel (default: ${defaults.browser})
  --help                 Show this help

Examples:
  pnpm capture:screens
  pnpm capture:screens -- --width 390 --height 844 --output artifacts/phone-captures
`);
}

function parseArgs(args) {
  const options = { ...defaults };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    // pnpm forwards the conventional argument separator to the script.
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    const key = arg.slice(2);
    if (!["input", "output", "width", "height", "browser"].includes(key) || !arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    options[key] = value;
    index += 1;
  }

  options.width = Number(options.width);
  options.height = Number(options.height);
  if (
    !Number.isInteger(options.width) ||
    options.width < 1 ||
    !Number.isInteger(options.height) ||
    options.height < 1
  ) {
    throw new Error("--width and --height must be positive whole numbers.");
  }

  return options;
}

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findHtmlFiles(entryPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      files.push(entryPath);
    }
  }

  return files;
}

function screenshotName(relativeFile) {
  return (
    relativeFile
      .replace(/\.html$/i, "")
      .replace(/[\\/]/g, "--")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() + ".png"
  );
}

function outputDirectoryName(relativeFile) {
  return screenshotName(relativeFile).replace(/\.png$/i, "");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const inputDirectory = path.resolve(projectRoot, options.input);
  const outputDirectory = path.resolve(projectRoot, options.output);
  if (!existsSync(inputDirectory)) {
    throw new Error(`Input directory does not exist: ${inputDirectory}`);
  }

  const files = await findHtmlFiles(inputDirectory);
  if (files.length === 0) {
    throw new Error(`No HTML files found in: ${inputDirectory}`);
  }

  await mkdir(outputDirectory, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch({ channel: options.browser });
  } catch (error) {
    throw new Error(
      `Could not launch the ${options.browser} browser channel. Install Google Chrome or run ` +
        "`pnpm exec playwright install chromium`, then retry.\n\n" +
        error.message,
    );
  }

  const manifest = [];
  try {
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1,
    });

    for (const file of files) {
      const relativeFile = path.relative(inputDirectory, file);
      const outputFile = path.join(outputDirectory, screenshotName(relativeFile));
      console.log(`Capturing ${relativeFile}`);

      await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded" });
      await page.evaluate(async () => {
        await document.fonts?.ready;
        await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
      });
      await page.screenshot({ path: outputFile, fullPage: true });

      const capture = {
        source: relativeFile,
        screenshot: path.relative(projectRoot, outputFile),
        screens: [],
      };
      manifest.push(capture);

      const screenLocator = page.locator("[data-screen-label], div[id]");
      const screens = await screenLocator.evaluateAll((elements) =>
        elements
          .map((element, index) => ({
            index,
            label: element.getAttribute("data-screen-label") ?? element.id,
            isScreen: element.hasAttribute("data-screen-label") || /^s\d{2}$/.test(element.id),
          }))
          .filter((screen) => screen.isScreen),
      );

      if (screens.length > 0) {
        const individualDirectory = path.join(outputDirectory, "individual", outputDirectoryName(relativeFile));
        await mkdir(individualDirectory, { recursive: true });

        for (let index = 0; index < screens.length; index += 1) {
          const screen = screens[index];
          const screenFile = path.join(
            individualDirectory,
            `${String(index + 1).padStart(2, "0")}-${screenshotName(screen.label)}`,
          );
          await screenLocator.nth(screen.index).screenshot({ path: screenFile });
          capture.screens.push({
            label: screen.label,
            screenshot: path.relative(projectRoot, screenFile),
          });
        }
      }
    }
  } finally {
    await browser?.close();
  }

  const manifestFile = path.join(outputDirectory, "manifest.json");
  await writeFile(
    manifestFile,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        viewport: { width: options.width, height: options.height },
        captures: manifest,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Captured ${manifest.length} HTML file(s) in ${path.relative(projectRoot, outputDirectory)}`);
}

main().catch((error) => {
  console.error(`Screenshot capture failed: ${error.message}`);
  process.exitCode = 1;
});
