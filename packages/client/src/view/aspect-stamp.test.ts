import { describe, expect, test } from "vitest";
import { aspectStampOf, aspectStampsOf, contrastRatio, titleWithoutAspects } from "./aspect-stamp.js";

describe("aspectStampOf", () => {
  test("the owner's fixed inks: white on Aggression, black on Justice and 'Pool", () => {
    expect(aspectStampOf("aggression").ink).toBe(0xffffff);
    expect(aspectStampOf("justice").ink).toBe(0x14110d);
    expect(aspectStampOf("pool").ink).toBe(0x14110d);
  });

  test("every stamp's ink is readable on its fill, and no two aspects share a fill", () => {
    const stamps = aspectStampsOf(["aggression", "justice", "protection", "leadership", "pool", "basic"]);
    for (const stamp of stamps) expect(contrastRatio(stamp.fill, stamp.ink), stamp.aspect).toBeGreaterThanOrEqual(4.5);
    expect(new Set(stamps.map((stamp) => stamp.fill)).size).toBe(stamps.length);
  });
});

describe("titleWithoutAspects", () => {
  test("drops the parenthetical the stamp replaces, single or multi-aspect", () => {
    expect(titleWithoutAspects("Spider-Man (Justice)", ["justice"])).toBe("Spider-Man");
    expect(titleWithoutAspects("Spider-Woman (Aggression + Justice)", ["justice", "aggression"])).toBe("Spider-Woman");
    expect(titleWithoutAspects("Deadpool ('Pool)", ["pool"])).toBe("Deadpool");
  });
  test("leaves anything else alone", () => {
    expect(titleWithoutAspects("Spider-Man (v2)", ["justice"])).toBe("Spider-Man (v2)");
    expect(titleWithoutAspects("Spider-Man (Justice)", ["aggression"])).toBe("Spider-Man (Justice)");
    expect(titleWithoutAspects("Adam Warlock (Justice)", [])).toBe("Adam Warlock (Justice)");
  });
});
