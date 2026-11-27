/**
 * "How it works" in Settings ▸ Unlocks: the player-facing explanation of progression and champion points.
 *
 * These are this app's own features, not Marvel Champions rules, and the guide opens by saying so: nothing here
 * changes how a game plays, and the rules engine never sees any of it. Built from the same `POINTS` and
 * `UNLOCK_WAVES` the progression itself runs on, so the numbers on screen can't drift from the code. The repo copy,
 * docs/progression.md, is checked against the same values by `progression-guide.test.ts`.
 */
import { artLanguageNow } from "../art/art-source.js";
import { listAnd, t } from "../i18n/translate.js";
import { POINTS, UNLOCK_WAVES, gateHintOf, localName, villainLabelOf, UNLOCK_HEROES } from "../progression/unlocks.js";

export interface GuideSection {
  readonly heading: string;
  /** Plain paragraphs, drawn before the bullets. */
  readonly paragraphs: readonly string[];
  readonly bullets: readonly string[];
}

const heroName = (id: string): string => UNLOCK_HEROES.find((h) => h.identityCardId === id)?.name ?? id;

/** One line per wave: what opens it and how its heroes arrive. */
export function waveGuideLines(): string[] {
  const lang = artLanguageNow();
  return UNLOCK_WAVES.map((wave) => {
    const name = localName(wave.name, lang);
    if (wave.gate === null) return t("guide.wave.always", { name });
    const cast =
      wave.starterHeroIds !== "all" && wave.starterHeroIds.length > 0
        ? ` ${t("guide.wave.cast", { heroes: listAnd(wave.starterHeroIds.map(heroName), lang) })}`
        : "";
    const rewards = wave.heroRewards
      .map((r) => t("guide.wave.reward", { hero: heroName(r.identityCardId), villain: villainLabelOf(r.scenarioId) }))
      .join("; ");
    const hint = gateHintOf(wave.gate, lang);
    const opens = `${hint.charAt(0).toLowerCase()}${hint.slice(1)}`;
    return `${t("guide.wave.opens", { name, opens })}${cast}${rewards ? ` ${t("guide.wave.rewards", { rewards })}` : ""}`;
  });
}

export function progressionGuideOf(): readonly GuideSection[] {
  return [
    {
      heading: t("guide.h.part"),
      paragraphs: [t("guide.p.part")],
      bullets: [],
    },
    {
      heading: t("guide.h.open"),
      paragraphs: [],
      bullets: [t("guide.b.core"), t("guide.b.own"), t("guide.b.community")],
    },
    {
      heading: t("guide.h.waves"),
      paragraphs: [t("guide.p.waves")],
      bullets: waveGuideLines(),
    },
    {
      heading: t("guide.h.points"),
      paragraphs: [t("guide.p.points")],
      bullets: [
        t("guide.b.firstWin", { points: POINTS.firstWin }),
        t("guide.b.firstExpert", { points: POINTS.firstExpertWin }),
        t("guide.b.campaign", { points: POINTS.campaign }),
        t("guide.b.expertCampaign", { points: POINTS.expertCampaign }),
      ],
    },
    {
      heading: t("guide.h.friends"),
      paragraphs: [t("guide.p.friends")],
      bullets: [
        t("guide.b.friends", { two: POINTS.friendsWin[2], three: POINTS.friendsWin[3], four: POINTS.friendsWin[4] }),
      ],
    },
    {
      heading: t("guide.h.hand"),
      paragraphs: [t("guide.p.hand")],
      bullets: [
        t("guide.b.unlockHero", { points: POINTS.unlockHero }),
        t("guide.b.unlockCampaign", { points: POINTS.unlockCampaign }),
        t("guide.b.unlockScenario", { points: POINTS.unlockScenario }),
        t("guide.b.spend"),
        t("guide.b.free"),
        t("guide.b.refund"),
      ],
    },
    {
      heading: t("guide.h.all"),
      paragraphs: [t("guide.p.all")],
      bullets: [],
    },
    {
      heading: t("guide.h.pnp"),
      paragraphs: [t("guide.p.pnp")],
      bullets: [],
    },
    {
      heading: t("guide.h.kept"),
      paragraphs: [],
      bullets: [t("guide.b.keptEarned"), t("guide.b.keptSwitched")],
    },
  ];
}
