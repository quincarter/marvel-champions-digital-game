import { describe, expect, it } from "vitest";
import { MUSIC_CATALOG } from "../audio/music-catalog.js";
import { SAGA_VOLUMES, storyFor } from "../campaign/story.js";
import { POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import {
  EXTRAS_ENTRIES,
  EXTRAS_TABS,
  Extras,
  NO_EXTRAS_PROGRESS,
  TRACK_TITLES,
  extrasNewsBetween,
  extrasProgressOf,
  musicEntriesOf,
  unlockHint,
  withEndedGame,
  type ExtrasEntry,
  type ExtrasProgress,
} from "./extras.js";
import { UNLOCK_HEROES } from "./unlocks.js";

const save = (status: string, scenarioId: string, players: readonly object[]) => ({
  status,
  config: { scenarioId, players },
});
const run = (campaignId: string, status: string, nextNodeId: string | null, resolved: Record<string, string> = {}) => ({
  campaignId,
  status,
  position: { nextNodeId, resolved },
});
const spiderMan = "01001a";
const spiderManPrecon = POOL_STARTER_DECKS.find((deck) => (deck.identityCardId as string) === spiderMan)!.id as string;
const entry = (id: string): ExtrasEntry =>
  Object.values(EXTRAS_ENTRIES)
    .flat()
    .find((candidate) => candidate.id === id)!;
const open = (progress: Partial<ExtrasProgress>) => new Extras({ ...NO_EXTRAS_PROGRESS, ...progress });

describe("extras progress", () => {
  it("counts a hero and a scenario once a game with them has ended, whatever the result", () => {
    const progress = extrasProgressOf(
      [
        save("won", "rhino", [{ starterDeckId: spiderManPrecon }]),
        save("lost", "klaw", [{ identityCardId: "01010a", deck: [] }]),
        save("abandoned", "ultron", [{ identityCardId: "01019a", deck: [] }]),
      ],
      [],
    );
    expect(progress.playedHeroIds).toEqual(["01001a", "01010a", "01019a"]);
    expect(progress.playedScenarioIds).toEqual(["klaw", "rhino", "ultron"]);
    expect(progress.wonScenarioIds).toEqual(["rhino"]);
    expect(progress.lostScenarioIds).toEqual(["klaw"]);
  });

  it("doesn't count a game still in progress, or one that can't be loaded", () => {
    const progress = extrasProgressOf(
      [
        save("active", "rhino", [{ starterDeckId: spiderManPrecon }]),
        save("incompatible", "klaw", [{ identityCardId: "01010a", deck: [] }]),
      ],
      [],
    );
    expect(progress).toEqual(NO_EXTRAS_PROGRESS);
  });

  it("reaches every issue a run has resolved and the one it is on", () => {
    const progress = extrasProgressOf(
      [],
      [run("trors", "active", "absorbing-man", { crossbones: "completed" }), run("gmw", "won", null)],
    );
    expect(progress.reachedIssues).toEqual(["trors/absorbing-man", "trors/crossbones"]);
    expect(progress.startedCampaignIds).toEqual(["gmw", "trors"]);
    expect(progress.wonCampaignIds).toEqual(["gmw"]);
  });
});

describe("what a game just opened", () => {
  it("counts the hero, the villain, the battle theme and the outcome's own pictures and theme", () => {
    const before = open({});
    const after = new Extras(
      withEndedGame(NO_EXTRAS_PROGRESS, { scenarioId: "rhino", result: "win", heroIds: [spiderMan] }),
    );
    expect(after.progress.wonScenarioIds).toEqual(["rhino"]);
    expect(after.progress.lostScenarioIds).toEqual([]);
    const news = extrasNewsBetween(before, after);
    // Spider-Man, Rhino, "Battle with a Rhino", "The Rhino Has Fallen", Victory Fanfare, the generic victory scene.
    expect(news).toBeGreaterThanOrEqual(5);
    expect(extrasNewsBetween(after, after)).toBe(0);
  });

  it("stores a concession as played, neither won nor lost", () => {
    const conceded = withEndedGame(NO_EXTRAS_PROGRESS, { scenarioId: "klaw", result: "conceded", heroIds: [] });
    expect(conceded).toMatchObject({ playedScenarioIds: ["klaw"], wonScenarioIds: [], lostScenarioIds: [] });
  });
});

describe("what opens what", () => {
  it("opens a hero's file by playing that hero, and nothing else", () => {
    const hero = entry(`hero:${spiderMan}`);
    expect(open({}).isOpen(hero.unlock)).toBe(false);
    expect(open({ playedHeroIds: ["01010a"] }).isOpen(hero.unlock)).toBe(false);
    expect(open({ playedHeroIds: [spiderMan] }).isOpen(hero.unlock)).toBe(true);
    expect(unlockHint(hero.unlock)).toBe("Finish a game as Spider-Man");
  });

  it("opens a villain's file by playing its scenario, and each outcome scene by that outcome", () => {
    const rhino = entry("villain:rhino");
    expect(open({}).isOpen(rhino.unlock)).toBe(false);
    const played = open({ playedScenarioIds: ["rhino"] });
    expect(played.isOpen(rhino.unlock)).toBe(true);
    const slides = rhino.content.kind === "gallery" ? rhino.content.slides : [];
    const wins = slides.filter((slide) => slide.unlock.kind === "scenarioWon");
    const losses = slides.filter((slide) => slide.unlock.kind === "scenarioLost");
    expect(played.openSlides(rhino.content)).toHaveLength(slides.length - wins.length - losses.length);
    const beaten = open({ playedScenarioIds: ["rhino"], wonScenarioIds: ["rhino"] });
    expect(beaten.openSlides(rhino.content)).toHaveLength(slides.length - losses.length);
  });

  it("opens a campaign issue once a run reaches it, and every issue once the campaign is won", () => {
    const first = entry("story:trors/crossbones");
    const second = entry("story:trors/absorbing-man");
    const started = open({ reachedIssues: ["trors/crossbones"] });
    expect(started.isOpen(first.unlock)).toBe(true);
    expect(started.isOpen(second.unlock)).toBe(false);
    expect(unlockHint(second.unlock)).toBe("Reach issue #2 of The Rise of Red Skull");
    expect(unlockHint(first.unlock)).toBe("Start The Rise of Red Skull");
    expect(open({ wonCampaignIds: ["trors"] }).isOpen(second.unlock)).toBe(true);
  });

  it("opens a track where it plays: battle by playing, victory by winning, defeat by losing", () => {
    const byPath = (path: string) =>
      EXTRAS_ENTRIES.music.find((e) => e.content.kind === "track" && e.content.track.key === `music:${path}`)!;
    const battle = byPath("scenarios/rhino/battle.mp3");
    const victory = byPath("scenarios/rhino/villain-loses.mp3");
    const defeat = byPath("scenarios/rhino/villain-wins.mp3");
    const played = open({ playedScenarioIds: ["rhino"], lostScenarioIds: ["rhino"] });
    expect(played.isOpen(battle.unlock)).toBe(true);
    expect(played.isOpen(victory.unlock)).toBe(false);
    expect(played.isOpen(defeat.unlock)).toBe(true);
    expect(open({}).isOpen(byPath("title/main-title.mp3").unlock)).toBe(true);
  });

  it("keeps every rulebook open from the start, read in the reader", () => {
    expect(EXTRAS_ENTRIES.books.length).toBeGreaterThan(0);
    for (const book of EXTRAS_ENTRIES.books) {
      expect(open({}).isOpen(book.unlock), book.id).toBe(true);
      expect(book.content.kind).toBe("book");
    }
  });

  it("opens everything while Unlock everything is on", () => {
    const all = new Extras(NO_EXTRAS_PROGRESS, { everything: true });
    for (const tab of EXTRAS_TABS) {
      expect(all.countOf(EXTRAS_ENTRIES[tab.id])).toEqual({
        open: EXTRAS_ENTRIES[tab.id].length,
        total: EXTRAS_ENTRIES[tab.id].length,
      });
    }
  });
});

describe("the catalog", () => {
  it("has a file for every hero and every scenario in the pool", () => {
    expect(EXTRAS_ENTRIES.heroes.map((e) => e.id)).toEqual(UNLOCK_HEROES.map((h) => `hero:${h.identityCardId}`));
    expect(EXTRAS_ENTRIES.villains.map((e) => e.id)).toEqual(POOL_SCENARIOS.map((s) => `villain:${s.id as string}`));
  });

  it("has every issue of every campaign story, in Saga order", () => {
    const expected = SAGA_VOLUMES.flatMap((volume) =>
      (storyFor(volume.campaignId)?.issues ?? []).map((issue) => `story:${volume.campaignId}/${issue.nodeId}`),
    );
    expect(EXTRAS_ENTRIES.stories.map((e) => e.id)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  it("lists one song once, even when it plays in two slots", () => {
    const titles = EXTRAS_ENTRIES.music.map((e) => e.title);
    expect(new Set(titles).size).toBe(titles.length);
    const watch = EXTRAS_ENTRIES.music.find((e) => e.title === "The Longest Watch Ends")!;
    expect(watch.unlock.kind).toBe("any");
    expect(open({ wonCampaignIds: ["gmw"] }).isOpen(watch.unlock)).toBe(true);
  });

  it("names every track the game plays, and names only tracks that exist", () => {
    const catalogPaths = [
      ...MUSIC_CATALOG.title,
      ...MUSIC_CATALOG.gameplay,
      ...[...MUSIC_CATALOG.scenarios.values()].flatMap((s) => [
        ...s.battle,
        ...s["villain-wins"],
        ...s["villain-loses"],
      ]),
      ...[...MUSIC_CATALOG.campaigns.values()].flatMap((c) => [...c.battle, ...c.interlude, ...c.finale]),
      ...[...MUSIC_CATALOG.packs.values()].flatMap((p) => [...p.battle, ...p["villain-wins"], ...p["villain-loses"]]),
      ...MUSIC_CATALOG.outcomes.victory,
      ...MUSIC_CATALOG.outcomes.defeat,
    ].map((track) => track.key.replace(/^music:/, ""));
    for (const path of catalogPaths) expect(TRACK_TITLES, path).toHaveProperty([path]);
    for (const path of Object.keys(TRACK_TITLES)) expect(catalogPaths, path).toContain(path);
    expect(musicEntriesOf(MUSIC_CATALOG).every((e) => !e.title.includes(" — "))).toBe(true);
  });

  it("gives every locked entry a hint that says how to open it", () => {
    for (const e of Object.values(EXTRAS_ENTRIES).flat()) {
      if (e.unlock.kind === "always") continue;
      expect(unlockHint(e.unlock), e.id).toMatch(/^(Finish|Beat|Lose|Win|Reach|Start|Complete)\b/);
    }
  });
});
