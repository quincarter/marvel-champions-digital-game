import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  achievementDefOf,
  achievementPointsOf,
  achievementStatuses,
  basePointsOf,
  lifetimePointsOf,
  rankOf,
  type AchievementHistory,
  type AchievementSave,
} from "./achievements.js";
import { factsOf } from "./achievements.js";
import { MOD_ACHIEVEMENT_ROWS, packAchievementId } from "./mod-achievements.js";
import { UNLOCK_HEROES, progressOf } from "./unlocks.js";
import type { PackAchievement } from "@mc/content";

const spider = UNLOCK_HEROES.find((h) => h.name === "Spider-Man (Peter Parker)")!.identityCardId;

const ACHIEVEMENTS_OF_PACK: readonly PackAchievement[] = [
  { id: "suited-up", name: "Suited Up", description: "Finish a game.", when: { play: true, hero: "x.fan-x.01a" } },
  { id: "rising", name: "Rising", description: "Win.", when: { win: true, hero: "x.fan-x.01a" } },
  { id: "five", name: "Five Wins", description: "Win 5.", when: { gamesWon: 5 } },
  { id: "menace", name: "Menace Down", description: "Beat it.", when: { win: true, villain: "fan-x-menace" } },
  { id: "hard", name: "Hard", description: "Expert win.", when: { win: true, expert: true } },
  { id: "campaign", name: "Saga", description: "Win the campaign.", when: { campaignWon: "fan-x-saga" } },
];

/** The pack as a game embeds it (`SessionConfig.packs`). */
const fanX = {
  id: "fan-x",
  name: "Fan X",
  cards: [],
  decks: [{ id: "fan-x-precon", identityCardId: "x.fan-x.01a" }],
  scenarios: [{ id: "fan-x-menace" }],
  achievements: ACHIEVEMENTS_OF_PACK,
};
const fanY = { id: "fan-y", name: "Fan Y", cards: [], decks: [], scenarios: [] };

interface Opts {
  readonly players?: readonly object[];
  readonly scenarioId?: string;
  readonly packs?: readonly object[];
  readonly houseRules?: readonly string[];
  readonly difficulty?: string;
}
const save = (status: "won" | "lost", o: Opts = {}): AchievementSave => ({
  status,
  round: 5,
  config: {
    scenarioId: o.scenarioId ?? "rhino",
    difficulty: o.difficulty ?? "standard",
    players: o.players ?? [{ starterDeckId: "fan-x-precon" }],
    ...(o.packs ? { packs: o.packs } : { packs: [fanX] }),
    ...(o.houseRules ? { houseRules: o.houseRules } : {}),
  },
});
const baseGame = (status: "won" | "lost", o: Opts = {}): AchievementSave =>
  save(status, { players: [{ identityCardId: spider, deck: [] }], packs: [], ...o });

const hist = (saves: AchievementSave[], extra: Partial<AchievementHistory> = {}): AchievementHistory => ({
  saves,
  campaigns: [],
  ...extra,
});
const modEarned = (id: string, h: AchievementHistory): boolean =>
  achievementStatuses(h).find((s) => s.def.id === id)?.earned === true;
const installed = (...kinds: string[]): NonNullable<AchievementHistory["mods"]> => ({
  installed: Object.fromEntries(kinds.map((kind, i) => [`pack-${i}`, kind])),
});

describe("built-in mod achievements", () => {
  it("are all worth no points and sit in the Mods family", () => {
    const mods = ACHIEVEMENTS.filter((a) => a.family === "mods");
    expect(mods.map((a) => a.id)).toEqual(MOD_ACHIEVEMENT_ROWS.map((r) => r.id));
    expect(mods.length).toBeGreaterThanOrEqual(10);
    for (const a of mods) {
      expect(a.points, a.id).toBe(0);
      expect(a.rewardPackId, a.id).toBeUndefined();
    }
  });

  it("count the mods ever installed", () => {
    expect(modEarned("mods-install-1", hist([]))).toBe(false);
    expect(modEarned("mods-install-1", hist([], { mods: installed("hero") }))).toBe(true);
    expect(modEarned("mods-install-5", hist([], { mods: installed("hero", "hero", "art", "art") }))).toBe(false);
    expect(modEarned("mods-install-5", hist([], { mods: installed("hero", "hero", "art", "art", "art") }))).toBe(true);
    expect(modEarned("mods-install-every-kind", hist([], { mods: installed("hero", "scenario") }))).toBe(false);
    expect(
      modEarned(
        "mods-install-every-kind",
        hist([], { mods: installed("hero", "scenario", "modular", "campaign", "art", "house-rule") }),
      ),
    ).toBe(true);
  });

  it("read a community hero from a custom game, won or lost", () => {
    expect(modEarned("mods-play-hero", hist([save("lost")]))).toBe(true);
    expect(modEarned("mods-win-hero", hist([save("lost")]))).toBe(false);
    expect(modEarned("mods-win-hero", hist([save("won")]))).toBe(true);
    // A base game with a base hero earns none of them.
    expect(modEarned("mods-play-hero", hist([baseGame("won")]))).toBe(false);
  });

  it("read a community scenario's villain, and a community hero against it", () => {
    const vsBase = save("won");
    const vsMod = save("won", { scenarioId: "fan-x-menace" });
    expect(modEarned("mods-win-villain", hist([vsBase]))).toBe(false);
    expect(modEarned("mods-win-villain", hist([vsMod]))).toBe(true);
    expect(modEarned("mods-win-hero-vs-villain", hist([vsBase]))).toBe(false);
    expect(modEarned("mods-win-hero-vs-villain", hist([vsMod]))).toBe(true);
    // A base hero beating a pack villain is a villain win only.
    const baseHeroVsMod = baseGame("won", { scenarioId: "fan-x-menace", packs: [fanX] });
    expect(modEarned("mods-win-villain", hist([baseHeroVsMod]))).toBe(true);
    expect(modEarned("mods-win-hero-vs-villain", hist([baseHeroVsMod]))).toBe(false);
  });

  it("read two community heroes in one game", () => {
    const two = save("lost", {
      players: [{ starterDeckId: "fan-x-precon" }, { identityCardId: "x.fan-y.01a", deck: [] }],
    });
    expect(modEarned("mods-two-heroes", hist([save("lost")]))).toBe(false);
    expect(modEarned("mods-two-heroes", hist([two]))).toBe(true);
  });

  it("read house rules, Lost Traits and Expert", () => {
    expect(modEarned("mods-house-rule", hist([baseGame("lost")]))).toBe(false);
    expect(modEarned("mods-house-rule", hist([baseGame("lost", { houseRules: ["some-rule"] })]))).toBe(true);
    expect(modEarned("mods-lost-traits-win", hist([baseGame("lost", { houseRules: ["lost-traits-bf"] })]))).toBe(false);
    expect(modEarned("mods-lost-traits-win", hist([baseGame("won", { houseRules: ["some-rule"] })]))).toBe(false);
    expect(modEarned("mods-lost-traits-win", hist([baseGame("won", { houseRules: ["lost-traits-bf"] })]))).toBe(true);
    expect(modEarned("mods-expert-win", hist([save("won")]))).toBe(false);
    expect(modEarned("mods-expert-win", hist([save("won", { difficulty: "expert" })]))).toBe(true);
    expect(modEarned("mods-expert-win", hist([baseGame("won", { difficulty: "expert" })]))).toBe(false);
  });

  it("count community wins and different community heroes that won", () => {
    const wins = Array.from({ length: 5 }, () => save("won"));
    expect(modEarned("mods-wins-5", hist(wins.slice(0, 4)))).toBe(false);
    expect(modEarned("mods-wins-5", hist(wins))).toBe(true);
    const three = ["a", "b", "c"].map((n) =>
      save("won", { players: [{ identityCardId: `x.fan-${n}.01a`, deck: [] }] }),
    );
    expect(modEarned("mods-heroes-3", hist(three.slice(0, 2)))).toBe(false);
    expect(modEarned("mods-heroes-3", hist(three))).toBe(true);
  });

  it("read a won community campaign only", () => {
    const run = (pack: unknown) => ({ status: "won", campaignId: "x", ...(pack ? { pack } : {}) });
    expect(modEarned("mods-win-campaign", hist([], { campaigns: [run(undefined)] }))).toBe(false);
    expect(modEarned("mods-win-campaign", hist([], { campaigns: [run({ id: "fan-x" })] }))).toBe(true);
  });

  it("ignore a Try-it lesson and a game still in progress", () => {
    const lesson = { ...save("won"), guided: { kind: "mechanic" } };
    const open = { ...save("won"), status: "active" };
    expect(modEarned("mods-win-hero", hist([lesson, open]))).toBe(false);
  });
});

describe("mods never touch base progression", () => {
  const custom = [save("won"), save("won", { scenarioId: "fan-x-menace" }), save("lost")];
  const modHistory = hist(custom, { mods: installed("hero", "scenario", "art", "art", "art") });

  it("leaves base stats alone: custom games add no win, scenario or hero to the base facts", () => {
    const facts = factsOf(modHistory);
    expect(facts.wins).toBe(0);
    expect(facts.losses).toBe(0);
    expect(facts.wonScenarios.size).toBe(0);
    expect(facts.playedHeroes.size).toBe(0);
    expect(progressOf(modHistory.saves, modHistory.campaigns)).toEqual(progressOf([], []));
  });

  it("earns mod achievements yet no points, so the rank and lifetime points do not move", () => {
    const statuses = achievementStatuses(modHistory);
    expect(statuses.filter((s) => s.def.family === "mods" && s.earned).length).toBeGreaterThan(5);
    expect(achievementPointsOf(modHistory)).toBe(achievementPointsOf(hist([])));
    expect(basePointsOf(modHistory)).toBe(basePointsOf(hist([])));
    expect(lifetimePointsOf(modHistory)).toBe(lifetimePointsOf(hist([])));
    expect(rankOf(lifetimePointsOf(modHistory)).rank).toBe(rankOf(lifetimePointsOf(hist([]))).rank);
  });

  it("does not let a base win lose or gain anything from mods being installed", () => {
    const base = hist([baseGame("won")]);
    const withMods = hist([baseGame("won")], { mods: installed("hero", "hero", "hero", "hero", "hero") });
    expect(lifetimePointsOf(withMods)).toBe(lifetimePointsOf(base));
  });
});

describe("pack-defined achievements", () => {
  const loaded = { id: "fan-x", name: "Fan X", achievements: ACHIEVEMENTS_OF_PACK, installed: true };
  const id = (local: string) => packAchievementId("fan-x", local);
  const withPack = (saves: AchievementSave[], extra: Partial<AchievementHistory> = {}) =>
    hist(saves, { mods: { installed: {}, packs: [loaded] }, ...extra });
  const statusOf = (h: AchievementHistory, local: string) => achievementStatuses(h).find((s) => s.def.id === id(local));

  it("lists every achievement of an installed pack, locked, in the Mods family with 0 points and the pack's name", () => {
    const statuses = achievementStatuses(withPack([])).filter((s) => s.def.pack);
    expect(statuses.map((s) => s.def.id)).toEqual(ACHIEVEMENTS_OF_PACK.map((a) => id(a.id)));
    for (const s of statuses) {
      expect(s.earned).toBe(false);
      expect(s.def).toMatchObject({ family: "mods", points: 0, pack: { id: "fan-x", name: "Fan X" } });
    }
  });

  it("evaluates play, win, hero, villain and expert filters from games carrying the pack", () => {
    expect(statusOf(withPack([save("lost")]), "suited-up")?.earned).toBe(true);
    expect(statusOf(withPack([save("lost")]), "rising")?.earned).toBe(false);
    expect(statusOf(withPack([save("won")]), "rising")?.earned).toBe(true);
    expect(statusOf(withPack([save("won")]), "menace")?.earned).toBe(false);
    expect(statusOf(withPack([save("won", { scenarioId: "fan-x-menace" })]), "menace")?.earned).toBe(true);
    expect(statusOf(withPack([save("won")]), "hard")?.earned).toBe(false);
    expect(statusOf(withPack([save("won", { difficulty: "expert" })]), "hard")?.earned).toBe(true);
  });

  it("never counts a game that does not carry the pack, even with its hero id", () => {
    const other = save("won", { players: [{ identityCardId: "x.fan-x.01a", deck: [] }], packs: [fanY] });
    expect(statusOf(withPack([other]), "rising")?.earned).toBe(false);
    expect(statusOf(withPack([baseGame("won")]), "five")?.earned).toBe(false);
  });

  it("counts toward gamesWon with a progress bar, and reads a won pack campaign", () => {
    const wins = Array.from({ length: 3 }, () => save("won"));
    const five = statusOf(withPack(wins), "five");
    expect(five?.earned).toBe(false);
    expect(five?.progress).toEqual({ current: 3, target: 5 });
    expect(statusOf(withPack([...wins, save("won"), save("won")]), "five")?.earned).toBe(true);
    const saga = { status: "won", campaignId: "fan-x-saga", pack: { id: "fan-x" } };
    expect(statusOf(withPack([], { campaigns: [saga] }), "campaign")?.earned).toBe(true);
    expect(statusOf(withPack([], { campaigns: [{ ...saga, pack: undefined }] }), "campaign")?.earned).toBe(false);
  });

  it("keeps an earned achievement after the pack is uninstalled, under its pack name, and hides unearned ones", () => {
    const h = hist([save("won")], { mods: { installed: {}, packs: [] } });
    const kept = achievementStatuses(h).filter((s) => s.def.pack);
    // Earned from a win with the hero: play and win, nothing the pack's other conditions need.
    expect(kept.map((s) => s.def.id).sort()).toEqual([id("rising"), id("suited-up")].sort());
    expect(kept.every((s) => s.earned && s.def.pack?.name === "Fan X")).toBe(true);
  });

  it("worth no points: earning every one changes neither lifetime points nor rank", () => {
    const many = Array.from({ length: 5 }, () => save("won", { difficulty: "expert" }));
    const all = withPack([...many, save("won", { scenarioId: "fan-x-menace" })]);
    expect(achievementStatuses(all).filter((s) => s.def.pack && s.earned).length).toBeGreaterThan(3);
    expect(lifetimePointsOf(all)).toBe(lifetimePointsOf(hist([])));
  });

  it("finds a pack achievement's definition by id for the toast, and none for an unknown id", () => {
    const h = withPack([]);
    expect(achievementDefOf(id("rising"), h)).toMatchObject({ name: "Rising", points: 0 });
    expect(achievementDefOf("pack:fan-x/nope", h)).toBeUndefined();
    expect(achievementDefOf("mods-install-1", h)?.family).toBe("mods");
  });
});
