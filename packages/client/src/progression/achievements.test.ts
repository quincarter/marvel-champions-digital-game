import { describe, expect, it } from "vitest";
import { POOL_SCENARIOS } from "../content/pool.js";
import {
  ACHIEVEMENTS,
  MAX_LIFETIME_POINTS,
  NO_HISTORY,
  RANKS,
  UNTRACKED_ACHIEVEMENT_IDS,
  achievementPointsOf,
  achievementStatuses,
  basePointsOf,
  isAchievementEarned,
  lifetimePointsOf,
  rankOf,
  rankProgressOf,
  type AchievementHistory,
  type AchievementSave,
} from "./achievements.js";
import type { GameSummary } from "../engine/game-summary.js";
import { UNLOCK_HEROES } from "./unlocks.js";
import { HERO_QUOTES } from "./hero-quotes.js";

const heroId = (name: string): string => UNLOCK_HEROES.find((h) => h.name === name)!.identityCardId;
const deckOf = (name: string, aspects?: string[]) => ({
  identityCardId: heroId(name),
  deck: [],
  ...(aspects ? { aspects } : {}),
});

const game = (
  scenarioId: string,
  status: "won" | "lost",
  extra: Partial<Omit<AchievementSave, "config">> & {
    players?: readonly object[];
    difficulty?: string;
    modes?: { expert?: boolean; heroic?: number };
  } = {},
): AchievementSave => ({
  status,
  round: extra.round ?? 5,
  ...(extra.guided ? { guided: extra.guided } : {}),
  ...(extra.summary ? { summary: extra.summary } : {}),
  config: {
    scenarioId,
    difficulty: extra.difficulty ?? "standard",
    ...(extra.modes ? { modes: extra.modes } : {}),
    players: extra.players ?? [deckOf("Spider-Man (Peter Parker)")],
  },
});

const hist = (saves: AchievementSave[], campaigns: AchievementHistory["campaigns"] = []): AchievementHistory => ({
  saves,
  campaigns,
});
const earned = (id: string, h: AchievementHistory): boolean => isAchievementEarned(id, h);

describe("the achievement list", () => {
  it("has unique ids, names and descriptions on every entry", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.name, a.id).not.toBe("");
      expect(a.description, a.id).not.toBe("");
    }
  });

  it("gives the funny ones no points and a reward pack, and every other one points", () => {
    for (const a of ACHIEVEMENTS) {
      if (a.family === "funny") {
        expect(a.points, a.id).toBe(0);
        expect(a.rewardPackId, a.id).toBeTruthy();
      } else {
        expect(a.points, a.id).toBeGreaterThan(0);
        expect(a.rewardPackId, a.id).toBeUndefined();
      }
    }
  });

  it("defines the Drone and the team-up achievements, with the Drone id the earned item points at", () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toContain("ultron-drone");
    expect(ACHIEVEMENTS.find((a) => a.id === "worthy-of-a-second-date")?.name).toBe("Worthy of a Second Date?");
  });

  it("tracks every achievement now that the save row holds a game summary", () => {
    expect([...UNTRACKED_ACHIEVEMENT_IDS]).toEqual([]);
  });

  it("earns nothing from an empty history", () => {
    expect(achievementStatuses(NO_HISTORY).filter((s) => s.earned)).toEqual([]);
    expect(lifetimePointsOf(NO_HISTORY)).toBe(0);
  });
});

describe("reading the save history", () => {
  it("counts battles won in tiers with progress", () => {
    const five = hist(Array.from({ length: 5 }, () => game("rhino", "won")));
    expect(earned("wins-1", five)).toBe(true);
    expect(earned("wins-5", five)).toBe(true);
    expect(earned("wins-10", five)).toBe(false);
    const ten = achievementStatuses(five).find((s) => s.def.id === "wins-10")!;
    expect(ten.progress).toEqual({ current: 5, target: 10 });
  });

  it("ignores lessons, losses and abandoned games as wins", () => {
    const h = hist([
      game("rhino", "lost"),
      game("rhino", "won", { guided: { kind: "aspect" } }),
      { ...game("rhino", "won"), status: "abandoned" },
    ]);
    expect(earned("wins-1", h)).toBe(false);
  });

  it("earns a villain achievement for a win, and the Drone for beating Ultron", () => {
    expect(earned("beat-rhino", hist([game("rhino", "won")]))).toBe(true);
    expect(earned("beat-rhino", hist([game("rhino", "lost")]))).toBe(false);
    expect(earned("ultron-drone", hist([game("rhino", "won")]))).toBe(false);
    expect(earned("ultron-drone", hist([game("ultron", "won")]))).toBe(true);
    expect(isAchievementEarned("no-such-id", hist([game("ultron", "won")]))).toBe(false);
  });

  it("earns a box's villains only when every one is beaten", () => {
    const core = POOL_SCENARIOS.filter((s) => (s.packCode as string) === "core").map((s) => s.id as string);
    expect(core.length).toBeGreaterThan(1);
    const some = hist(core.slice(1).map((id) => game(id, "won")));
    expect(earned("box-villains-core", some)).toBe(false);
    expect(earned("box-villains-core", hist(core.map((id) => game(id, "won"))))).toBe(true);
  });

  it("reads heroes and aspects from the winning seats", () => {
    const h = hist([game("rhino", "won", { players: [deckOf("Spider-Man (Peter Parker)", ["justice"])] })]);
    expect(earned(`hero-${heroId("Spider-Man (Peter Parker)")}`, h)).toBe(true);
    expect(earned(`hero-${heroId("Iron Man")}`, h)).toBe(false);
    expect(earned("aspect-justice", h)).toBe(true);
    expect(earned("aspect-aggression", h)).toBe(false);
  });

  it("reads Expert, Heroic, round, and table-size feats from the row", () => {
    expect(earned("first-expert", hist([game("rhino", "won", { difficulty: "expert" })]))).toBe(true);
    expect(earned("first-expert", hist([game("rhino", "won")]))).toBe(false);
    expect(earned("first-heroic", hist([game("rhino", "won", { modes: { heroic: 1 } })]))).toBe(true);
    expect(earned("feat-fast-win", hist([game("rhino", "won", { round: 2 })]))).toBe(true);
    expect(earned("feat-fast-win", hist([game("rhino", "won", { round: 3 })]))).toBe(false);
    const four = Array.from({ length: 4 }, () => deckOf("Spider-Man (Peter Parker)"));
    expect(earned("feat-four-players", hist([game("rhino", "won", { players: four })]))).toBe(true);
  });

  it("names each hero's played achievement for their line, and earns it for any finished game as them", () => {
    for (const h of UNLOCK_HEROES) expect(HERO_QUOTES[h.name], `a line for ${h.name}`).toBeTruthy();
    const thor = ACHIEVEMENTS.find((a) => a.id === `played-${heroId("Thor")}`)!;
    expect(thor.name).toBe('"Another!"');
    expect(earned(`played-${heroId("Thor")}`, hist([game("rhino", "lost", { players: [deckOf("Thor")] })]))).toBe(true);
    expect(earned(`played-${heroId("Thor")}`, hist([game("rhino", "won", { players: [deckOf("Hulk")] })]))).toBe(false);
  });

  it("earns Sometimes You Gotta Run Before You Can Walk for turning on Unlock everything", () => {
    expect(earned("unlock-everything", hist([]))).toBe(false);
    expect(earned("unlock-everything", { ...hist([]), unlockedEverything: true })).toBe(true);
  });

  it("earns Studying Like Doctor Strange once every How to Play row is done, with a progress bar", () => {
    const at = (done: number): AchievementHistory => ({ ...hist([]), howToPlay: { done, total: 9 } });
    expect(earned("feat-how-to-play", at(8))).toBe(false);
    expect(earned("feat-how-to-play", at(9))).toBe(true);
    expect(earned("feat-how-to-play", hist([]))).toBe(false);
    const status = achievementStatuses(at(4)).find((st) => st.def.id === "feat-how-to-play")!;
    expect(status.progress).toEqual({ current: 4, target: 9 });
  });

  it("earns the team-up story only for Thor and She-Hulk seated together in a won game", () => {
    const together = game("rhino", "won", { players: [deckOf("Thor"), deckOf("She-Hulk")] });
    expect(earned("worthy-of-a-second-date", hist([together]))).toBe(true);
    const apart = [
      game("rhino", "won", { players: [deckOf("Thor")] }),
      game("rhino", "won", { players: [deckOf("She-Hulk")] }),
    ];
    expect(earned("worthy-of-a-second-date", hist(apart))).toBe(false);
    expect(earned("worthy-of-a-second-date", hist([{ ...together, status: "lost" }]))).toBe(false);
  });

  it("counts losses, and a round 1 loss, toward the funny ones", () => {
    const tenLosses = hist(Array.from({ length: 10 }, () => game("rhino", "lost", { round: 1 })));
    expect(earned("losses-10", tenLosses)).toBe(true);
    expect(earned("losses-50", tenLosses)).toBe(false);
    expect(earned("round-one-loss", tenLosses)).toBe(true);
    expect(earned("round-one-loss", hist([game("rhino", "lost", { round: 4 })]))).toBe(false);
  });

  it("reads campaigns and Expert campaigns from the campaign rows", () => {
    const h = hist(
      [],
      [
        { status: "won", campaignId: "trors", modes: { campaign: { expertCampaign: true } } },
        { status: "lost", campaignId: "gmw" },
      ],
    );
    expect(earned("campaign-trors", h)).toBe(true);
    expect(earned("campaign-expert-trors", h)).toBe(true);
    expect(earned("campaign-gmw", h)).toBe(false);
  });
});

describe("points and rank", () => {
  it("adds achievement points to champion points for the lifetime total", () => {
    const h = hist([game("rhino", "won")]);
    const base = basePointsOf(h);
    expect(base).toBe(100);
    const bonus = achievementPointsOf(h);
    expect(bonus).toBeGreaterThan(0);
    expect(lifetimePointsOf(h)).toBe(base + bonus);
  });

  it("gives the funny achievements no points", () => {
    const h = hist(Array.from({ length: 10 }, () => game("rhino", "lost", { round: 1 })));
    expect(achievementStatuses(h).some((s) => s.earned && s.def.id === "losses-10")).toBe(true);
    // Only the hero played for those games (a game played as a hero counts, win or lose) and Solo Act score.
    const funny = achievementStatuses(h).filter((s) => s.earned && s.def.family === "funny");
    expect(funny.length).toBeGreaterThan(0);
    expect(funny.every((s) => s.def.points === 0)).toBe(true);
    expect(achievementPointsOf(h)).toBe(10 + 25);
  });

  it("has nine ranks whose thresholds rise and whose last needs every point there is", () => {
    expect(RANKS).toHaveLength(9);
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i]!.threshold).toBeGreaterThan(RANKS[i - 1]!.threshold);
    expect(RANKS[8]!.threshold).toBe(MAX_LIFETIME_POINTS);
    expect(RANKS[8]!.title).toBe("Ultimate Champion");
  });

  it("ranks by lifetime points, reaching rank 2 with the first win", () => {
    expect(rankOf(0).rank).toBe(1);
    expect(rankOf(99).rank).toBe(1);
    expect(rankOf(100).rank).toBe(2);
    expect(rankOf(MAX_LIFETIME_POINTS - 1).rank).toBe(8);
    expect(rankOf(MAX_LIFETIME_POINTS).rank).toBe(9);
    expect(rankOf(MAX_LIFETIME_POINTS * 10).rank).toBe(9);
  });

  it("reports progress to the next rank, and none at the top", () => {
    const mid = rankProgressOf(150);
    expect(mid.rank.rank).toBe(2);
    expect(mid.next?.rank).toBe(3);
    expect(mid.into).toBe(50);
    expect(mid.fraction).toBeGreaterThan(0);
    expect(mid.fraction).toBeLessThan(1);
    const top = rankProgressOf(MAX_LIFETIME_POINTS);
    expect(top.next).toBeNull();
    expect(top.fraction).toBe(1);
  });
});

describe("achievements read from the game summary", () => {
  const summary = (over: Partial<GameSummary> = {}): GameSummary => ({
    lossReason: null,
    heroesDefeated: 0,
    winners: [],
    alliesPlayed: 1,
    ...over,
  });
  const lost = (over: Partial<GameSummary>): AchievementSave =>
    game("rhino", "lost", { summary: summary({ lossReason: "playersDefeated", ...over }) });

  it("counts heroes defeated across games, and ignores a save with no summary", () => {
    const rows = [...Array.from({ length: 5 }, () => lost({ heroesDefeated: 5 })), game("rhino", "lost")];
    const h = hist(rows);
    expect(earned("defeated-25", h)).toBe(true);
    expect(earned("defeated-100", h)).toBe(false);
    const bar = achievementStatuses(h).find((s) => s.def.id === "defeated-100")!;
    expect(bar.progress).toEqual({ current: 25, target: 100 });
    expect(earned("defeated-25", hist([game("rhino", "lost")]))).toBe(false);
  });

  it("earns I Love You 3000 only when Iron Man lands the last blow on Thanos", () => {
    const iron = heroId("Iron Man");
    const win = (scenarioId: string, by: string) =>
      game(scenarioId, "won", { players: [deckOf("Iron Man")], summary: summary({ finalBlowBy: by }) });
    expect(earned("iron-man-thanos", hist([win("thanos", iron)]))).toBe(true);
    expect(earned("iron-man-thanos", hist([win("thanos", heroId("Thor"))]))).toBe(false);
    expect(earned("iron-man-thanos", hist([win("rhino", iron)]))).toBe(false);
  });

  it("earns the deck building ones from the noted deck feats", () => {
    const decks = { built: true, edited: false, playedBuilt: true };
    const h: AchievementHistory = { ...hist([]), decks };
    expect(earned("deck-built", h)).toBe(true);
    expect(earned("deck-played-built", h)).toBe(true);
    expect(earned("deck-edited", h)).toBe(false);
    expect(earned("deck-edited", { ...h, decks: { ...decks, edited: true } })).toBe(true);
    expect(earned("deck-built", hist([]))).toBe(false);
  });

  it("earns a seats-filled one for a finished game, won or lost, with that many seats", () => {
    const two = [deckOf("Iron Man"), deckOf("Thor")];
    const four = [...two, deckOf("Hulk"), deckOf("She-Hulk")];
    const h = hist([game("rhino", "lost", { players: two }), game("rhino", "won", { players: four })]);
    expect(earned("seats-2", h)).toBe(true);
    expect(earned("seats-4", h)).toBe(true);
    expect(earned("seats-1", h)).toBe(false);
    expect(earned("seats-3", h)).toBe(false);
    const playing: AchievementSave = { ...game("rhino", "won", { players: two }), status: "playing" };
    expect(earned("seats-2", hist([playing]))).toBe(false);
  });

  it("earns Better Together once a finished game recorded a Team-Up card played", () => {
    expect(earned("teamup-first-card", hist([lost({ teamUpsPlayed: 1 })]))).toBe(true);
    expect(earned("teamup-first-card", hist([lost({ teamUpsPlayed: 0 }), game("rhino", "won")]))).toBe(false);
  });

  it("counts only the losses to the main scheme completing", () => {
    const scheme = Array.from({ length: 9 }, () => lost({ lossReason: "schemeCompleted" }));
    expect(earned("scheme-losses-10", hist([...scheme, lost({ lossReason: "playersDefeated" })]))).toBe(false);
    expect(earned("scheme-losses-10", hist([...scheme, lost({ lossReason: "schemeCompleted" })]))).toBe(true);
  });

  it("earns the one-hit-point feats from a winning hero at 1 hit point in hero form", () => {
    const spidey = heroId("Spider-Man (Peter Parker)");
    const win = (hitPoints: number | null, inHeroForm = true, id = spidey) =>
      hist([game("rhino", "won", { summary: summary({ winners: [{ identityCardId: id, hitPoints, inHeroForm }] }) })]);
    expect(earned("feat-one-hit-point", win(1))).toBe(true);
    expect(earned("feat-one-hit-point", win(2))).toBe(false);
    expect(earned("feat-one-hit-point", win(1, false))).toBe(false);
    expect(earned("feat-one-hit-point", win(null))).toBe(false);
    expect(earned("hulk-one-hit-point", win(1))).toBe(false);
    expect(earned("hulk-one-hit-point", win(1, true, heroId("Hulk")))).toBe(true);
  });

  it("earns I Work Alone only from a won game whose summary shows no ally played", () => {
    expect(earned("feat-no-allies", hist([game("rhino", "won", { summary: summary({ alliesPlayed: 0 }) })]))).toBe(
      true,
    );
    expect(earned("feat-no-allies", hist([game("rhino", "won", { summary: summary({ alliesPlayed: 2 }) })]))).toBe(
      false,
    );
    expect(earned("feat-no-allies", hist([game("rhino", "won")]))).toBe(false);
    expect(earned("feat-no-allies", hist([game("rhino", "lost", { summary: summary({ alliesPlayed: 0 }) })]))).toBe(
      false,
    );
  });
});
