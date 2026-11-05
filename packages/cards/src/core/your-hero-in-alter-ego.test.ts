import { activeEncounterDeck, cardsInPlay, type GameState } from "@mc/engine";
import { CORE_DEPS } from "./index.js";
import { coreScenario } from "./setup.js";
import {
  endTurn,
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  settle,
  stackEncounterDeck,
  startCoreGame,
  toHero,
  run,
} from "../testing/harness.js";
import { driveEventsPicking, playFromHand, stageNemesisCardForReveal } from "../testing/staging.js";

/**
 * "Your hero" on an encounter card does not reach an alter-ego: "While a player is in alter-ego form, card abilities
 * that interact with their hero do not interact with their identity" (RRG 1.8 "Form, Change Form", p. 21), and a
 * player cannot choose an option with no valid target (RRG 1.8 "Choose (Option)", p. 12).
 */
const ADVANCE = "01186"; // 0 boost icons, no boost ability: a neutral boost card
const start = (scenario: string, starterDeckId: string): GameState =>
  startCoreGame(coreScenario(scenario, { players: [{ starterDeckId }], seed: 11 }));
const optionLabels = (state: GameState): readonly string[] => state.pendingChoice?.options.map((o) => o.label) ?? [];
/** Settles every choice up to the one that offers `label` (other cards' choices, the villain's own, come first). */
const untilOffered = (state: GameState, label: string): GameState =>
  settle(state, firstLegal, (s) => optionLabels(s).includes(label), CORE_DEPS);

describe("Sweeping Swoop (01168): Stun your hero", () => {
  it("does not stun Peter Parker, who is in alter-ego form", () => {
    const staged = stageNemesisCardForReveal(start("rhino", "core-spider-man-justice"), "01168");
    const after = settle(run(staged, endTurn()), firstLegal, undefined, CORE_DEPS);
    // It was revealed (it is in the encounter discard pile), and stunned nobody.
    expect(activeEncounterDeck(after).discard.some((id) => inst(after, id).cardId === "01168")).toBe(true);
    expect(inst(after, identityOf(after)).statuses.stunned).toBe(0);
  });

  it("stuns Spider-Man in hero form", () => {
    const staged = stageNemesisCardForReveal(start("rhino", "core-spider-man-justice"), "01168");
    const after = settle(run(staged, toHero(), endTurn()), firstLegal, undefined, CORE_DEPS);
    expect(inst(after, identityOf(after)).statuses.stunned).toBe(1);
  });
});

describe("Under Attack (01151): place 2 threat here or deal 3 damage to your hero", () => {
  const revealed = (hero: boolean) => {
    const vsUltron = start("ultron", "core-spider-man-justice");
    const staged = stackEncounterDeck(vsUltron, ADVANCE, "01151");
    return untilOffered(run(staged, ...(hero ? [toHero()] : []), endTurn()), "Place 2 threat here");
  };

  it("an alter-ego player is not offered the damage, and places the 2 threat", () => {
    const asked = revealed(false);
    const damageBefore = inst(asked, identityOf(asked)).damage;
    // With one option left there may be nothing to ask; when asked, the damage is not among the options.
    expect(optionLabels(asked)).not.toContain("Deal 3 damage to your hero");
    const after = settle(asked, firstLegal, undefined, CORE_DEPS);
    const scheme = instancesOf(after, "01151").find((id) => cardsInPlay(after).includes(id))!;
    expect(inst(after, scheme).threat).toBeGreaterThanOrEqual(2);
    expect(inst(after, identityOf(after)).damage).toBe(damageBefore);
  });

  it("with two players, each is asked by their own form: a hero is offered both, an alter-ego only the threat", () => {
    const twoPlayers = startCoreGame(
      coreScenario("ultron", {
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
        seed: 11,
      }),
    );
    // P1 Spider-Man in hero form, P2 Jennifer Walters stays in alter-ego; one neutral boost per activation, then the
    // side scheme dealt to P1.
    const staged = stackEncounterDeck(twoPlayers, ADVANCE, ADVANCE, "01151");
    const offered: string[] = [];
    settle(
      run(staged, toHero(P1), endTurn(P1), endTurn(P2)),
      (s) => {
        const labels = optionLabels(s);
        if (labels.includes("Place 2 threat here")) offered.push(`${s.pendingChoice!.playerId}: ${labels.join(" / ")}`);
        return firstLegal(s);
      },
      undefined,
      CORE_DEPS,
    );
    expect(offered).toContain(`${P1}: Place 2 threat here / Deal 3 damage to your hero`);
    expect(offered.filter((line) => line.startsWith(`${P2}:`) && line.includes("Deal 3 damage"))).toEqual([]);
  });

  it("a hero is offered both options", () => {
    const asked = revealed(true);
    expect(optionLabels(asked)).toEqual(["Place 2 threat here", "Deal 3 damage to your hero"]);
  });
});

describe("Electric Whip Attack (01173): damage to your hero for each upgrade, or discard an upgrade", () => {
  /** Iron Man's Mark V Helmet in play, and Electric Whip Attack staged as the next card dealt to him. */
  const armedAndStaged = () => {
    const { state: armed } = playFromHand(CORE_DEPS, start("rhino", "core-iron-man-aggression"), "01037", 1);
    return { staged: stageNemesisCardForReveal(armed, "01173") };
  };

  it("Tony Stark, in alter-ego form, takes no damage and discards the upgrade", () => {
    const { staged } = armedAndStaged();
    const helmet = instancesOf(staged, "01037").find((id) => cardsInPlay(staged).includes(id))!;
    const damageBefore = inst(staged, identityOf(staged)).damage;
    const after = settle(run(staged, endTurn()), firstLegal, undefined, CORE_DEPS);
    expect(cardsInPlay(after)).not.toContain(helmet);
    expect(inst(after, identityOf(after)).damage).toBe(damageBefore);
  });

  it("Tony Stark with no upgrade has no option left: the card resolves with no prompt and no damage", () => {
    const staged = stageNemesisCardForReveal(start("rhino", "core-iron-man-aggression"), "01173");
    const upgrades = cardsInPlay(staged).filter((id) => staged.cardPool[inst(staged, id).cardId]?.type === "upgrade");
    expect(upgrades).toEqual([]);
    const damageBefore = inst(staged, identityOf(staged)).damage;
    // The end of the player phase asks its own discard choice, so only this kind of prompt would be the card's.
    const optionPrompts: (readonly string[])[] = [];
    const { state: after, events } = driveEventsPicking(
      CORE_DEPS,
      staged,
      (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseOption") optionPrompts.push(optionLabels(s));
        return firstLegal(s);
      },
      endTurn(),
    );
    expect(activeEncounterDeck(after).discard.some((id) => inst(after, id).cardId === "01173")).toBe(true);
    expect(optionPrompts).toEqual([]);
    // Neither option was taken either: one left alone would resolve with no prompt, as `onlyOption`.
    expect(events.filter((e) => e.type === "optionChosen")).toEqual([]);
    expect(after.pendingChoice).toBeFalsy();
    expect(inst(after, identityOf(after)).damage).toBe(damageBefore);
  });

  it("Iron Man in hero form is offered both", () => {
    const asked = untilOffered(
      run(armedAndStaged().staged, toHero(), endTurn()),
      "Choose and discard an upgrade you control",
    );
    expect(optionLabels(asked)).toEqual([
      "Take 1 damage for each upgrade you control",
      "Choose and discard an upgrade you control",
    ]);
  });
});
