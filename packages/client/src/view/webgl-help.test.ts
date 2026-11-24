import { describe, expect, test } from "vitest";
import { t } from "../i18n/translate.js";
import {
  browserFamilyOf,
  markRendererNoticeSeen,
  rendererNoticeDue,
  rendererNoticeSeen,
  webglHelpSteps,
  webglHelpText,
} from "./webgl-help.js";

// The Discord report's browser, as its failure panel read it.
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
const EDGE = `${CHROME} Edg/156.0.0.0`;
const OPERA = `${CHROME} OPR/121.0.0.0`;
const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15";
const FIREFOX_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/150.0 Mobile/15E148 Safari/605.1.15";

describe("the browser the steps are for", () => {
  test("names each family by its user agent", () => {
    expect(browserFamilyOf(FIREFOX)).toBe("firefox");
    expect(browserFamilyOf(CHROME)).toBe("chrome");
    expect(browserFamilyOf(EDGE)).toBe("edge");
    expect(browserFamilyOf(OPERA)).toBe("opera");
    expect(browserFamilyOf(SAFARI)).toBe("safari");
    expect(browserFamilyOf("test")).toBe("other");
  });

  test("every browser on iOS is Safari underneath", () => {
    expect(browserFamilyOf(FIREFOX_IOS)).toBe("safari");
  });
});

describe("the steps to turn WebGL back on", () => {
  test("Firefox: hardware acceleration, webgl.disabled, then the blocklist", () => {
    const steps = webglHelpSteps(FIREFOX);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain("hardware acceleration");
    expect(steps[1]).toContain("webgl.disabled");
    expect(steps[2]).toContain("webgl.force-enabled");
  });

  test("Chromium browsers each name their own GPU page", () => {
    expect(webglHelpSteps(CHROME)[1]).toContain("chrome://gpu");
    expect(webglHelpSteps(EDGE)[1]).toContain("edge://gpu");
    expect(webglHelpSteps(OPERA)[1]).toContain("opera://gpu");
  });

  test("numbered lines for a text block", () => {
    const lines = webglHelpText(FIREFOX).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.slice(0, 3))).toEqual(["1. ", "2. ", "3. "]);
  });

  test("Spanish fills in the GPU page too", () => {
    expect(t("webglHelp.chromium.gpuPage", { gpuPage: "edge://gpu" }, "es")).toContain("Abre edge://gpu");
  });
});

describe("the notice shows once on a device", () => {
  test("due only on the fallback, until it has been closed", () => {
    expect(rendererNoticeDue(true, false)).toBe(true);
    expect(rendererNoticeDue(true, true)).toBe(false);
    expect(rendererNoticeDue(false, false)).toBe(false);
  });

  test("closing it is remembered", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    expect(rendererNoticeSeen(storage)).toBe(false);
    markRendererNoticeSeen(storage);
    expect(rendererNoticeSeen(storage)).toBe(true);
  });

  test("storage that throws or is missing never stops the game", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(rendererNoticeSeen(broken)).toBe(false);
    expect(() => markRendererNoticeSeen(broken)).not.toThrow();
    expect(rendererNoticeSeen(null)).toBe(false);
  });
});
