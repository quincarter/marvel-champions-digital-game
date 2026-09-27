/**
 * Guided mode on the Board: a walk through one round (RRG 1.8 "Round Overview", p. 3), one coach step at a time.
 *
 * Every step reads the live `BoardModel`, so the numbers and names in it are the table's own ("Rhino has 14 hit
 * points"), never an example. What a step claims about the rules is a plain-English paraphrase of the RRG entry
 * it names; it describes the game, it never decides anything.
 *
 * The walk: in round 1's player phase, the villain, the main scheme, your identity, your hand, your basic powers,
 * your play area and ending your turn; then the villain phase once it starts (or once it's over, if the villain-
 * phase walkthrough covered it); then a wrap-up in round 2. A step is done when the player presses Next. A step
 * whose moment has passed (the hero-phase steps, once the villain phase starts) is simply skipped.
 */
import type { BoardModel } from "../board-model.js";

/** Which part of the table a step is about, resolved to a rectangle by the Board (`BoardLayout.zones`). */
export type BoardAnchor = "threat" | "enemies" | "me" | "hand" | "actionBar" | "playArea" | "chrome";

export interface GuideStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly anchor: BoardAnchor | null;
}

export interface GuideStepAt {
  readonly step: GuideStep;
  /** 1-based position among the steps that apply right now, for "Step 2 of 7". */
  readonly index: number;
  readonly total: number;
  /** The step before this one, if the player wants to read it again. */
  readonly previousId: string | null;
}

const HERO_PHASE_IDS = ["villain", "scheme", "identity", "hand", "powers", "playArea", "endTurn"] as const;

function heroPhaseSteps(model: BoardModel): GuideStep[] {
  const villain = model.villain;
  const scheme = model.mainScheme;
  const hp = villain.hp ? `${villain.hp.current} hit points` : "its hit points";
  const threat = scheme.target !== null ? `${scheme.threat} of ${scheme.target} threat` : `${scheme.threat} threat`;
  const inHeroForm = model.myForm === "hero";
  return [
    {
      id: "villain",
      title: `This is ${villain.name}`,
      body:
        `${villain.name} has ${hp} in this stage. Damage it to 0 and the next stage takes over; ` +
        `defeat its final stage and you win. It attacks you in the villain phase while you're a hero.`,
      anchor: "enemies",
    },
    {
      id: "scheme",
      title: "The main scheme",
      body:
        `${scheme.name} is at ${threat}. Threat goes on it every villain phase and whenever the villain schemes. ` +
        `If it reaches its target, the villain wins, so thwart to take threat off it.`,
      anchor: "threat",
    },
    {
      id: "identity",
      title: inHeroForm ? `You're ${model.me.name}` : `You're ${model.me.name}, in alter-ego form`,
      body: inHeroForm
        ? "In hero form you can attack and thwart, and the villain attacks you. Once each turn you may flip to " +
          "your alter-ego, who can recover hit points while the villain schemes instead of attacking."
        : "As your alter-ego you can recover hit points but can't attack or thwart, and the villain schemes " +
          "instead of attacking you. Once each turn you may flip to hero form to fight.",
      anchor: "me",
    },
    {
      id: "hand",
      title: "Your hand",
      body:
        "The number in a card's corner is its cost. Pay it by discarding other cards from your hand: each gives " +
        "the resources printed on it. Tap a card to play it; press and hold (or right-click) to read it.",
      anchor: "hand",
    },
    {
      id: "powers",
      title: inHeroForm ? "Attack and thwart" : "Recover",
      body:
        (inHeroForm
          ? "Your hero's Attack deals damage equal to ATK; Thwart removes threat equal to THW. "
          : "Recover heals hit points equal to your REC. ") +
        "Each one exhausts your identity, so you get one a round. Keep it ready if you'd rather defend when the " +
        "villain attacks.",
      anchor: "actionBar",
    },
    {
      id: "playArea",
      title: "Allies, upgrades and supports",
      body:
        "Cards you play stay in front of you. An ally can attack or thwart by exhausting, and may take damage " +
        "for it. Upgrades and supports give you new abilities to use.",
      anchor: "playArea",
    },
    {
      id: "endTurn",
      title: "Ending your turn",
      body:
        `When you're done, End turn. At the end of the player phase you may discard cards you don't want, ` +
        `then draw up to your hand size (${model.handLimit}) and ready everything you exhausted.`,
      anchor: "actionBar",
    },
  ];
}

const VILLAIN_STEP: GuideStep = {
  id: "villainPhase",
  title: "The villain phase",
  body:
    "Threat goes on the main scheme. Then the villain activates against each player: it attacks a hero, or " +
    "schemes against an alter-ego, and each minion engaged with that player does the same. Each player is dealt " +
    "an encounter card and reveals it. Then the first player token passes and a new round starts.",
  anchor: "threat",
};

const WRAP_STEP: GuideStep = {
  id: "wrap",
  title: "That's a round",
  body:
    "Rounds repeat until the villain's final stage falls or its scheme completes. Watch threat as well as hit " +
    "points. Tap ? on the top bar whenever you want the table explained. Guided mode walks round 1 of each game " +
    "while it's on; switch it off in Settings.",
  anchor: "chrome",
};

/** The steps that apply to the table as it is now, in order. Empty once the walk has nothing left to say. */
export function roundGuideSteps(model: BoardModel): readonly GuideStep[] {
  if (model.phase === "setup" || model.phase === "gameOver") return [];
  if (model.phase === "player" && model.round <= 1) return [...heroPhaseSteps(model), VILLAIN_STEP, WRAP_STEP];
  return [VILLAIN_STEP, WRAP_STEP];
}

/**
 * The step to show now, or null when there's nothing left or the moment for the rest has passed. The wrap-up only
 * comes after the villain phase step, and only once a new round's player phase has begun; the villain phase step
 * only once that phase has started.
 */
export function currentRoundGuideStep(model: BoardModel, done: ReadonlySet<string>): GuideStepAt | null {
  const steps = roundGuideSteps(model);
  const shown = steps.filter((step) => {
    if (step.id === VILLAIN_STEP.id) return model.phase === "villain" || model.round > 1;
    if (step.id === WRAP_STEP.id) return model.phase === "player" && model.round > 1;
    return true;
  });
  const at = shown.findIndex((step) => !done.has(step.id));
  if (at < 0) return null;
  const step = shown[at]!;
  // Before the villain phase, count the whole walk (villain phase and wrap-up included) so "Step 3 of 9" is honest.
  const total = model.phase === "player" && model.round <= 1 ? steps.length : shown.length;
  return { step, index: at + 1, total, previousId: at > 0 ? shown[at - 1]!.id : null };
}

/** True for the hero-phase steps: the ones Back can reopen while it's still round 1's player phase. */
export function isHeroPhaseStep(id: string): boolean {
  return (HERO_PHASE_IDS as readonly string[]).includes(id);
}
