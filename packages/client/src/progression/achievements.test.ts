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
import { UNLOCK_HEROES } from "./unlocks.js";

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

  it("marks exactly the ones needing new data as untracked, and they never report progress", () => {
    expect([...UNTRACKED_ACHIEVEMENT_IDS].sort()).toEqual(
      [
        "defeated-100",
        "defeated-25",
        "feat-no-allies",
        "feat-one-hit-point",
        "hulk-one-hit-point",
        "scheme-losses-10",
      ].sort(),
    );
    const every = achievementStatuses(hist([game("rhino", "won")]));
    for (const s of every.filter((s) => !s.def.tracked)) {
      expect(s.earned, s.def.id).toBe(false);
      expect(s.progress, s.def.id).toBeNull();
    }
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
    expect(achievementPointsOf(h)).toBe(0);
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
