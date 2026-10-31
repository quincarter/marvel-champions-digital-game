#!/usr/bin/env node
/**
 * Screenshot a release report for its pull request and cut the section images the GitHub release carries. The dev
 * server must be up on http://localhost:5173. `.claude/skills/release-announcement/SKILL.md` says when to run each.
 *
 *   node scripts/shoot-release-report.mjs v0.41.0 sizes [out]
 *     → report-<size>.png at se, pixel, tablet-portrait, tablet and desktop, and history-<size>.png, the report inside
 *       the release history, and the same with -es for the Spanish report, in [out] (default
 *       artifacts/qa/<version>-report). It prints each size's sideways overflow,
 *       broken images and images whose width and height attributes are wrong, and fails if it finds any.
 *   node scripts/shoot-release-report.mjs v0.41.0 sections
 *     → v0-41-0-release-NN-<slug>.jpg in docs/screenshots/releases/<version>/: the top of the page down to the number
 *       tiles, then one per band, with Thank you on its own.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SIZES = {
  se: [375, 667],
  pixel: [412, 924],
  "tablet-portrait": [768, 1024],
  tablet: [1024, 768],
  desktop: [1440, 980],
};
const HOST = "http://localhost:5173";
/** The sections' page width: at a scale of 2 each image is about 2848 px wide. */
const SECTION_WIDTH = 1424;
/** Dark ground kept around a section so the images read as one page. */
const SECTION_PAD = 24;

const [version, mode, outArg] = process.argv.slice(2);
if (!/^v\d+\.\d+\.\d+$/.test(version ?? "") || !["sizes", "sections"].includes(mode)) {
  console.error("Usage: node scripts/shoot-release-report.mjs vX.Y.Z sizes|sections [out]");
  process.exit(1);
}
const reportOf = (language) => `${HOST}/releases/${version}/index${language === "es" ? ".es" : ""}.html`;
const browser = await chromium.launch();

async function openPage(url, width, height, deviceScaleFactor) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  return { context, page };
}

/** Load every lazy image in `root`, the document or the history page's shadow root. */
const settle = (page) =>
  page.evaluate(async () => {
    const roots = [
      document,
      ...[...document.querySelectorAll("*")].flatMap((e) => (e.shadowRoot ? [e.shadowRoot] : [])),
    ];
    const images = roots.flatMap((root) => [...root.querySelectorAll("img")]);
    images.forEach((image) => (image.loading = "eager"));
    await document.fonts.ready;
    await Promise.all(images.map((image) => image.decode().catch(() => {})));
    return images.length;
  });

async function shootLanguage(out, language) {
  const report = reportOf(language);
  const tag = language === "es" ? "-es" : "";
  await mkdir(out, { recursive: true });
  let failed = false;
  for (const [name, [width, height]] of Object.entries(SIZES)) {
    const { context, page } = await openPage(report, width, height, 1);
    await settle(page);
    const problems = await page.evaluate(() => {
      const root = document.documentElement;
      const images = [...document.images];
      return {
        overflow: root.scrollWidth - root.clientWidth,
        broken: images.filter((i) => !i.naturalWidth).map((i) => i.src),
        misSized: images
          .filter((i) => i.naturalWidth)
          .filter((i) => +i.getAttribute("width") !== i.naturalWidth || +i.getAttribute("height") !== i.naturalHeight)
          .map((i) => i.src),
      };
    });
    failed ||= problems.overflow > 0 || problems.broken.length > 0 || problems.misSized.length > 0;
    console.log(name, JSON.stringify(problems));
    await page.screenshot({ path: path.join(out, `report-${name}${tag}.png`), fullPage: true });

    // The history page needs `.changes/<version>.md`, so before the release this finds no report to show.
    await page.goto(`${HOST}/releases/index.html?lang=${language}#${version}`, { waitUntil: "load" });
    const mounted = await page
      .waitForFunction(
        () => [...document.querySelectorAll("*")].some((e) => e.shadowRoot?.querySelector(".wrap")),
        null,
        {
          timeout: 5000,
        },
      )
      .then(
        () => true,
        () => false,
      );
    if (mounted) {
      await settle(page);
      await page.screenshot({ path: path.join(out, `history-${name}${tag}.png`) });
    }
    console.log(name, mounted ? "report mounted in the history" : "no report in the history");
    await context.close();
  }
  return failed;
}

async function shootSizes(out) {
  const [english, spanish] = [await shootLanguage(out, "en"), await shootLanguage(out, "es")];
  return english || spanish;
}

async function cutSections(out) {
  const { page } = await openPage(reportOf("en"), SECTION_WIDTH, 980, 2);
  await settle(page);
  // Those links lead back to the history, and the images are for GitHub.
  await page.addStyleTag({ content: "[data-history-link]{display:none !important}" });
  const sections = await page.evaluate((pad) => {
    const groups = [{ title: "the numbers", elements: [] }];
    for (const element of document.querySelector(".wrap").children) {
      if (element.matches("footer")) continue;
      if (element.matches(".band")) {
        groups.push({ title: element.querySelector("h2").textContent, elements: [element] });
      } else if (element.matches(".thanks")) {
        groups.push({ title: "thank you", elements: [element] }, { title: "", elements: [] });
      } else groups.at(-1).elements.push(element);
    }
    return groups
      .filter((group) => group.elements.length > 0)
      .map((group, index) => {
        const rects = group.elements.map((element) => element.getBoundingClientRect());
        const top = index === 0 ? 0 : Math.min(...rects.map((rect) => rect.top)) + scrollY - pad;
        const bottom = Math.max(...rects.map((rect) => rect.bottom)) + scrollY + pad;
        return { title: group.title, top, height: bottom - top };
      });
  }, SECTION_PAD);
  const prefix = version.replaceAll(".", "-");
  for (const [index, { title, top, height }] of sections.entries()) {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const file = `${prefix}-release-${String(index + 1).padStart(2, "0")}-${slug}.jpg`;
    await page.screenshot({
      path: path.join(out, file),
      fullPage: true,
      type: "jpeg",
      quality: 82,
      clip: { x: 0, y: top, width: SECTION_WIDTH, height },
    });
    console.log(file);
  }
}

const failed =
  mode === "sizes"
    ? await shootSizes(outArg ?? path.join("artifacts", "qa", `${version}-report`))
    : await cutSections(outArg ?? path.join("docs", "screenshots", "releases", version));
await browser.close();
if (failed) process.exit(1);
