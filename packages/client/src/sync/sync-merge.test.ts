import { describe, expect, test } from "vitest";
import { mergeUnlocks } from "./sync-merge.js";

const prefs = (over: Record<string, unknown>) =>
  JSON.stringify({ version: 2, unlockAll: false, heroIds: [], campaignIds: [], scenarioIds: [], charges: [], ...over });

describe("mergeUnlocks", () => {
  test("unions picks, keeps every charge at its larger value, and ORs the switches", () => {
    const merged = JSON.parse(
      mergeUnlocks(
        prefs({ heroIds: ["h2", "h1"], charges: [{ id: "hero:h1", points: 150 }], unlockAll: true }),
        prefs({
          heroIds: ["h1", "h3"],
          scenarioIds: ["s1"],
          charges: [
            { id: "hero:h1", points: 150 },
            { id: "scenario:s1", points: 100 },
          ],
          officialPrintAndPlay: true,
        }),
      ),
    );
    expect(merged).toEqual({
      version: 2,
      unlockAll: true,
      officialPrintAndPlay: true,
      heroIds: ["h1", "h2", "h3"],
      campaignIds: [],
      scenarioIds: ["s1"],
      charges: [
        { id: "hero:h1", points: 150 },
        { id: "scenario:s1", points: 100 },
      ],
    });
  });

  test("is symmetric for the data, and defaults ({}) lose nothing", () => {
    const a = prefs({ heroIds: ["h1"], charges: [{ id: "hero:h1", points: 150 }] });
    expect(JSON.parse(mergeUnlocks(a, "{}"))).toMatchObject({
      heroIds: ["h1"],
      charges: [{ id: "hero:h1", points: 150 }],
    });
    expect(JSON.parse(mergeUnlocks("{}", a))).toEqual(JSON.parse(mergeUnlocks(a, "{}")));
  });

  test("drops charges stored at another version, as loading does", () => {
    const old = JSON.stringify({ version: 1, charges: [{ id: "everything", points: 999 }] });
    expect(JSON.parse(mergeUnlocks(old, prefs({}))).charges).toEqual([]);
  });

  test("text that isn't an object loses to text that is", () => {
    const a = prefs({ heroIds: ["h1"] });
    expect(mergeUnlocks("garbage", a)).toBe(a);
    expect(mergeUnlocks(a, "garbage")).toBe(a);
    expect(mergeUnlocks("garbage", "junk")).toBe("garbage");
  });
});
