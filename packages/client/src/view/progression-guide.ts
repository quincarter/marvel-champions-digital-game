/**
 * "How it works" in Settings ▸ Unlocks: the player-facing explanation of progression and champion points.
 *
 * These are this app's own features, not Marvel Champions rules, and the guide opens by saying so: nothing here
 * changes how a game plays, and the rules engine never sees any of it. Built from the same `POINTS` and
 * `UNLOCK_WAVES` the progression itself runs on, so the numbers on screen can't drift from the code. The repo copy,
 * docs/progression.md, is checked against the same values by `progression-guide.test.ts`.
 */
import { POINTS, UNLOCK_WAVES, villainLabelOf, UNLOCK_HEROES } from "../progression/unlocks.js";

export interface GuideSection {
  readonly heading: string;
  /** Plain paragraphs, drawn before the bullets. */
  readonly paragraphs: readonly string[];
  readonly bullets: readonly string[];
}

const heroName = (id: string): string => UNLOCK_HEROES.find((h) => h.identityCardId === id)?.name ?? id;

/** One line per wave: what opens it and how its heroes arrive. */
export function waveGuideLines(): string[] {
  return UNLOCK_WAVES.map((wave) => {
    if (wave.gate === null) return `${wave.name}: always open, every hero and every villain.`;
    const cast =
      wave.starterHeroIds !== "all" && wave.starterHeroIds.length > 0
        ? ` ${wave.starterHeroIds.map(heroName).join(" and ")} join at once.`
        : "";
    const rewards = wave.heroRewards
      .map((r) => `${heroName(r.identityCardId)} for ${villainLabelOf(r.scenarioId)}`)
      .join("; ");
    const opens = `${wave.gate.hint.charAt(0).toLowerCase()}${wave.gate.hint.slice(1)}`;
    return `${wave.name}: ${opens}.${cast}${rewards ? ` Then, a villain each: ${rewards}.` : ""}`;
  });
}

export function progressionGuideOf(): readonly GuideSection[] {
  return [
    {
      heading: "Part of this app, not the card game",
      paragraphs: [
        "Unlocks and champion points are features of this digital edition. They aren't in Marvel Champions' rules " +
          "and never change how a game plays: every scenario and hero plays exactly as printed, whether you earned " +
          "it or switched it on.",
      ],
      bullets: [],
    },
    {
      heading: "What's always open",
      paragraphs: [],
      bullets: [
        "The Core Set: all five heroes and all three villains, from the first launch.",
        "Your own decks: a deck you import from MarvelCDB or build in the deck builder plays whatever hero it's " +
          "for. The locks are on the preconstructed decks only.",
      ],
    },
    {
      heading: "How waves and heroes unlock",
      paragraphs: [
        "Win a game to open more. A win counts at any difficulty, in a campaign or on its own. Each wave opens its " +
          "scenarios and its campaign; its heroes' precons follow one villain at a time.",
      ],
      bullets: waveGuideLines(),
    },
    {
      heading: "Earning champion points",
      paragraphs: ["Only firsts count, so replaying a villain you've beaten earns nothing more."],
      bullets: [
        `${POINTS.firstWin} for your first win against each scenario.`,
        `${POINTS.firstExpertWin} more for your first Expert win against it.`,
        `${POINTS.campaign} for completing a campaign.`,
        `${POINTS.expertCampaign} more for completing it on Expert.`,
      ],
    },
    {
      heading: "Unlocking by hand",
      paragraphs: [
        "Don't want to play through? Unlock something right where you find it locked: a precon in Seats, a " +
          "scenario in Scenario select, a campaign on the Saga shelf. Or switch it on here. It costs points " +
          "you've earned instead of wins, and it asks first.",
      ],
      bullets: [
        `A hero's precon: ${POINTS.unlockHero} points.`,
        `A campaign: ${POINTS.unlockCampaign} points. Its cast comes with it.`,
        `A scenario, on its own: ${POINTS.unlockScenario} points.`,
        "You can only spend points you've earned, so your total never goes below zero.",
        "Anything you've already earned by playing is free.",
        "Points are never refunded. Switching something off and on again doesn't charge twice.",
      ],
    },
    {
      heading: "Unlock everything: points off",
      paragraphs: [
        "Rather not bother with progression at all? Unlock everything in Settings ▸ Unlocks opens every wave, " +
          "hero, scenario and campaign for free, and switches champion points off while it's on. Switch it off " +
          "to go back to earning and spending them; what you've earned stays earned.",
      ],
      bullets: [],
    },
    {
      heading: "Where it's kept",
      paragraphs: [],
      bullets: [
        "What you've earned comes from your saved games and campaigns on this device.",
        "What you've switched on, and what it cost, is saved on this device too. Clearing the app's saved data resets it.",
      ],
    },
  ];
}
