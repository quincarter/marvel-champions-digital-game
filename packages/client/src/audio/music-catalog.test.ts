import { describe, expect, test } from "vitest";
import { POOL_PACKS, POOL_SCENARIOS } from "../content/pool.js";
import {
  MUSIC_CATALOG,
  battleTrackFor,
  interludeTrackFor,
  outcomeTrackFor,
  parseMusicCatalog,
  titleTrackFor,
} from "./music-catalog.js";

const mockCatalog = parseMusicCatalog({
  "../../music/title/main-title.mp3": "/m-title.mp3",
  "../../music/title/alt-title.ogg": "/m-title2.ogg",
  "../../music/gameplay/default-battle.mp3": "/default-b.mp3",
  "../../music/scenarios/rhino/battle.mp3": "/rhino-b.mp3",
  "../../music/scenarios/rhino/battle-2.mp3": "/rhino-b2.mp3",
  "../../music/scenarios/rhino/villain-wins.ogg": "/rhino-w.ogg",
  "../../music/scenarios/rhino/villain-wins-2.ogg": "/rhino-w2.ogg",
  "../../music/scenarios/rhino/villain-loses.mp3": "/rhino-l.mp3",
  "../../music/scenarios/rhino/typo.mp3": "/typo.mp3",
  "../../music/scenarios/rhino/nested/battle.mp3": "/nested.mp3",
  "../../music/campaigns/rohrs/battle.mp3": "/rohrs-b.mp3",
  "../../music/campaigns/rohrs/interlude.mp3": "/rohrs-int.mp3",
  "../../music/campaigns/rohrs/typo-slot.mp3": "/rohrs-typo.mp3",
  "../../music/packs/core/battle.mp3": "/core-b.mp3",
  "../../music/packs/core/bad-slot.mp3": "/core-bad.mp3",
  "../../music/outcomes/defeat.mp3": "/defeat.mp3",
  "../../music/outcomes/victory.mp3": "/victory.mp3",
  "../../music/outcomes/unknown.mp3": "/outcomes-unknown.mp3",
});

const first = (): number => 0;
const last = (): number => 0.999;

describe("parseMusicCatalog", () => {
  test("categorizes title and gameplay tracks", () => {
    expect(mockCatalog.title.map((t) => t.url)).toEqual(["/m-title2.ogg", "/m-title.mp3"]);
    expect(mockCatalog.gameplay.map((t) => t.url)).toEqual(["/default-b.mp3"]);
  });

  test("scenario tracks land in the slot their name says, variants included", () => {
    const rhino = mockCatalog.scenarios.get("rhino")!;
    expect(rhino.battle.map((t) => t.url)).toEqual(["/rhino-b2.mp3", "/rhino-b.mp3"]);
    expect(rhino["villain-wins"].map((t) => t.url)).toEqual(["/rhino-w2.ogg", "/rhino-w.ogg"]);
    expect(rhino["villain-loses"].map((t) => t.url)).toEqual(["/rhino-l.mp3"]);
  });

  test("campaign tracks land in battle and interlude", () => {
    const rohrs = mockCatalog.campaigns.get("rohrs")!;
    expect(rohrs.battle.map((t) => t.url)).toEqual(["/rohrs-b.mp3"]);
    expect(rohrs.interlude.map((t) => t.url)).toEqual(["/rohrs-int.mp3"]);
  });

  test("pack tracks land in battle", () => {
    const core = mockCatalog.packs.get("core")!;
    expect(core.battle.map((t) => t.url)).toEqual(["/core-b.mp3"]);
  });

  test("outcomes land in victory and defeat", () => {
    expect(mockCatalog.outcomes.defeat.map((t) => t.url)).toEqual(["/defeat.mp3"]);
    expect(mockCatalog.outcomes.victory.map((t) => t.url)).toEqual(["/victory.mp3"]);
  });

  test("audio keys are derived from the path under music/", () => {
    expect(mockCatalog.scenarios.get("rhino")!.battle[0]!.key).toBe("music:scenarios/rhino/battle-2.mp3");
  });

  test("unrecognized files are flagged", () => {
    expect(mockCatalog.unrecognized).toEqual([
      "campaigns/rohrs/typo-slot.mp3",
      "outcomes/unknown.mp3",
      "packs/core/bad-slot.mp3",
      "scenarios/rhino/nested/battle.mp3",
      "scenarios/rhino/typo.mp3",
    ]);
  });
});

describe("battleTrackFor priority", () => {
  test("scenario track wins first over campaign, pack, and gameplay", () => {
    const track = battleTrackFor(mockCatalog, { scenarioId: "rhino", campaignId: "rohrs", packCode: "core" }, first);
    expect(track?.url).toBe("/rhino-b2.mp3");
  });

  test("campaign track wins when scenario has no battle track", () => {
    const track = battleTrackFor(mockCatalog, { scenarioId: "klaw", campaignId: "rohrs", packCode: "core" }, first);
    expect(track?.url).toBe("/rohrs-b.mp3");
  });

  test("pack track wins when scenario and campaign have no battle track", () => {
    const track = battleTrackFor(mockCatalog, { scenarioId: "klaw", packCode: "core" }, first);
    expect(track?.url).toBe("/core-b.mp3");
  });

  test("gameplay track falls back when scenario, campaign, and pack have no track", () => {
    const track = battleTrackFor(mockCatalog, { scenarioId: "klaw", packCode: "twc" }, first);
    expect(track?.url).toBe("/default-b.mp3");
  });

  test("returns null when no tracks exist in the chain", () => {
    const emptyCatalog = parseMusicCatalog({});
    expect(battleTrackFor(emptyCatalog, { scenarioId: "rhino" }, first)).toBeNull();
  });
});

describe("outcomeTrackFor", () => {
  test("win plays scenario's villain-loses, with victory fallback", () => {
    expect(outcomeTrackFor(mockCatalog, "rhino", "win", first)?.url).toBe("/rhino-l.mp3");
    expect(outcomeTrackFor(mockCatalog, "klaw", "win", first)?.url).toBe("/victory.mp3");
  });

  test("loss plays scenario's villain-wins, with defeat fallback", () => {
    expect(outcomeTrackFor(mockCatalog, "rhino", "loss", first)?.url).toBe("/rhino-w2.ogg");
    expect(outcomeTrackFor(mockCatalog, "klaw", "loss", first)?.url).toBe("/defeat.mp3");
  });

  test("concession plays scenario's villain-wins when available, with defeat fallback", () => {
    expect(outcomeTrackFor(mockCatalog, "rhino", "conceded", first)?.url).toBe("/rhino-w2.ogg");
    expect(outcomeTrackFor(mockCatalog, "klaw", "conceded", first)?.url).toBe("/defeat.mp3");
  });
});

describe("titleTrackFor & interludeTrackFor", () => {
  test("title track avoids the previous track when alternatives exist", () => {
    const track1 = titleTrackFor(mockCatalog, null, first);
    expect(track1?.url).toBe("/m-title2.ogg");

    const track2 = titleTrackFor(mockCatalog, track1?.key ?? null, first);
    expect(track2?.url).toBe("/m-title.mp3");
  });

  test("interlude track retrieves campaign interlude", () => {
    expect(interludeTrackFor(mockCatalog, "rohrs", first)?.url).toBe("/rohrs-int.mp3");
    expect(interludeTrackFor(mockCatalog, "unknown", first)).toBeNull();
  });
});

describe("the real music/ folder", () => {
  test("contains title and gameplay tracks", () => {
    expect(MUSIC_CATALOG.title.length).toBeGreaterThan(0);
    expect(MUSIC_CATALOG.gameplay.length).toBeGreaterThan(0);
  });

  test("every file fits a valid slot", () => {
    expect(MUSIC_CATALOG.unrecognized).toEqual([]);
  });

  test("every scenario folder is named for a real scenario id", () => {
    const ids = new Set(POOL_SCENARIOS.map((s) => s.id as string));
    expect([...MUSIC_CATALOG.scenarios.keys()].filter((id) => !ids.has(id))).toEqual([]);
  });

  test("every pack folder is named for a real pack code", () => {
    const codes = new Set(POOL_PACKS.map((p) => p.code as string));
    expect([...MUSIC_CATALOG.packs.keys()].filter((code) => !codes.has(code))).toEqual([]);
  });
});
