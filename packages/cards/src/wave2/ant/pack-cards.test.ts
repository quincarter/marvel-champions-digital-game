import type { GameState, InstanceId } from "@mc/engine";
import { cardsInPlay } from "@mc/engine";
import {
  firstLegal,
  inst,
  moveToHand,
  P1,
  payWith,
  putOnTopOfDeck,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEvents, withForm } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { ANT_PACK_CARDS } from "./pack-cards.js";

// Real wave 2 content: the Ant-Man (Leadership) precon against Rhino, standard, solo. Scott Lang starts in alter-ego.
const antManVsRhino = () =>
  startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "ant-leadership" }], seed: 2026 }));

const TINY = { heroForm: 0 } as const;

describe("Ant-Man pack cards", () => {
  // docs/phase7-wave2.md §18.3: `overpaid.total` is readable from Ant-Man's own later `cardEntersPlay` interrupt.
  // He costs 0, so a single paid card is entirely overpaid; Genius (12022, 2 [mental] icons — `producesIcons`,
  // since a "resource"-type card's own printed resource is what it *produces*) and Energy+Strength together (2+2)
  // exercise both the plain scaling and the printed 4-counter cap with real commands.
  it("Ant-Man (ally): Interrupt places 1 pym counter for each resource overpaid for his cost", () => {
    const given = moveToHand(antManVsRhino(), P1, "12011", "12022");
    const [antMan, genius] = given.ids as [InstanceId, InstanceId];
    const after = settle(runWave2(given.state, play(P1, antMan, [genius])), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(after, antMan).counters.pym).toBe(2);
  });

  it("Ant-Man (ally): the pym counter placed this way is capped at 4, even for a larger overpayment", () => {
    const given = moveToHand(antManVsRhino(), P1, "12011", "12021", "12022", "12023");
    const [antMan, energy, genius, strength] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    // 2 [energy] + 2 [mental] + 2 [physical] = 6 overpaid for a cost-0 ally; the printed cap is 4.
    const after = settle(
      runWave2(given.state, play(P1, antMan, [energy, genius, strength])),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(after, antMan).counters.pym).toBe(4);
  });

  // docs/phase7-wave2.md §20.1: `TargetQuery.sharesTraitWith`, read live off the current hero form (AVENGER, TINY
  // for Tiny-form Ant-Man). Wasp (12002, cost 3, AVENGER — Team-Building Exercise's own printed example, a generic
  // basic-aspect card any hero can run) shares AVENGER with him, so her reduced cost (2) is paid from hand, not 3.
  it("Team-Building Exercise: Hero Action, exhausting itself, plays a card sharing a trait with your hero at -1 cost", () => {
    const hero = withForm(antManVsRhino(), TINY);
    const given = moveToHand(hero, P1, "12024", "12002"); // Team-Building Exercise (cost 2) + Wasp (cost 3, AVENGER)
    const [exercise, wasp] = given.ids as [InstanceId, InstanceId];
    const playedExercise = settle(
      runWave2(given.state, play(P1, exercise, payWith(given.state, P1, 2, [exercise, wasp]))),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(cardsInPlay(playedExercise)).toContain(exercise);
    const handBefore = playerOf(playedExercise, P1).hand.length;
    // `executePlayFromHand` (`resolve/effects-frame.ts`) resolves in up to three prompts: pick the card (Wasp, the
    // only candidate sharing a trait with Tiny-form Ant-Man), then pay her reduced cost via a `spendResources`
    // prompt — `firstLegal` alone declines the first (Wasp isn't the *fewest* legal selection, "none" is) and would
    // pay nothing at the second (`minSelections: 0`, the same auto-top-up-with-nothing-to-draw-from shape §5's own
    // `payForAbility` lesson describes, here under a different prompt kind).
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseCards") {
        const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === wasp);
        if (option) return [option.optionId];
      }
      if (choice.prompt.kind === "spendResources") {
        const req = choice.prompt.requirement;
        const needed =
          (req.generic ?? 0) + (req.physical ?? 0) + (req.mental ?? 0) + (req.energy ?? 0) + (req.wild ?? 0);
        return choice.options.slice(0, needed).map((o) => o.optionId);
      }
      return firstLegal(state);
    };
    const after = settle(
      runWave2(playedExercise, use(P1, exercise, "12024.team-building-exercise-action", [])),
      pick,
      undefined,
      WAVE2_DEPS,
    );
    expect(cardsInPlay(after)).toContain(wasp);
    // Wasp leaves hand (-1); her own reduced cost (3 - 1 = 2) is paid from 2 more hand cards (-2). Net -3.
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 3);
  });

  // Muster Courage (12032, Protection) prints no printedResources of its own aspect in Ant-Man's own single-aspect
  // Leadership precon (docs/phase7-wave2.md §2.1), so it's never in his starter deck to move into hand for a real
  // playthrough the way the pack's own Leadership cards above are — the same modest "is defined" bar `wsp`/`qsv`/
  // `scw`'s own `pack-cards.test.ts` files record for their own off-aspect cards.
  it("Muster Courage: scripted", () => {
    expect(ANT_PACK_CARDS["12032.muster-courage-action"]).toBeDefined();
  });
});

// RRG 1.8 "'Then'" (p. 44), docs/then-sweep.md: "discard … until you discard an Avenger ally, then add that ally to
// your hand". With no Avenger ally anywhere in the deck the discard finds nothing, so the "add" never resolves.
describe("Call for Aid (12015): 'then add that ally' waits on the discard finding one", () => {
  const isAvengerAlly = (state: GameState, id: InstanceId) =>
    ["12002", "12011", "12012", "12013", "12014"].includes(String(state.instances[id]?.cardId));
  const withoutAvengerAllies = (state: GameState): GameState => ({
    ...state,
    players: state.players.map((p) => ({
      ...p,
      deck: p.deck.filter((id) => !isAvengerAlly(state, id)),
      hand: p.hand.filter((id) => !isAvengerAlly(state, id)),
      discard: p.discard.filter((id) => !isAvengerAlly(state, id)),
    })),
  });
  const cast = (state: GameState) => {
    const given = moveToHand(withForm(state, { heroForm: 0 }), P1, "12015");
    const [callForAid] = given.ids as [InstanceId];
    return driveEvents(WAVE2_DEPS, given.state, play(P1, callForAid, []));
  };

  it("with no Avenger ally in the deck, the discard finds nothing and the 'then' is skipped", () => {
    const { state, events } = cast(withoutAvengerAllies(antManVsRhino()));
    expect(events).toContainEqual({ type: "preThenUnresolved", cause: "discardUntilFoundNothing" });
    expect(events).toContainEqual({ type: "thenSkipped" });
    expect(playerOf(state, P1).hand.some((id) => isAvengerAlly(state, id))).toBe(false);
  });

  it("with Wasp on top of the deck, she is discarded and then added to your hand", () => {
    const top = putOnTopOfDeck(antManVsRhino(), P1, "12002");
    const [wasp] = top.ids as [InstanceId];
    const { state, events } = cast(top.state);
    expect(events.some((e) => e.type === "thenSkipped")).toBe(false);
    expect(playerOf(state, P1).hand).toContain(wasp);
  });
});
