import { createGame, type GameState, type InstanceId, type TriggerEvent } from "@mc/engine";
import { CORE_DEPS } from "../index.js";
import { coreScenario } from "../setup.js";
import {
  answer,
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  type Picker,
  run,
  settle,
  stackEncounterDeck,
  startCoreGame,
} from "../../testing/harness.js";

const I_OBJECT = "01019b.i-object";

const klawConfig = () =>
  coreScenario("klaw", { difficulty: "standard", players: [{ starterDeckId: "core-she-hulk-aggression" }], seed: 5 });

interface Offer {
  readonly event: TriggerEvent;
  readonly abilityIds: readonly string[];
}

/** Every trigger offer the game makes while `firstLegal` (which declines every optional trigger) answers it. */
function recordingOffers(offers: Offer[]): Picker {
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      offers.push({
        event: choice.prompt.event,
        abilityIds: choice.options.flatMap((option) => (option.ref.kind === "ability" ? [option.ref.abilityId] : [])),
      });
    }
    return firstLegal(state);
  };
}

const offersOfIObject = (offers: readonly Offer[]) => offers.filter((offer) => offer.abilityIds.includes(I_OBJECT));

describe("Klaw with She-Hulk: no player card ability resolves during game setup", () => {
  // RRG 1.8 "Ability" (p. 4): "Player card abilities cannot resolve during game setup, unless prefaced by a 'Setup'
  // timing trigger." FAQ "Jennifer Walters (#19B)" (RRG 1.8 Appendix IV): threat placed during setup does not trigger
  // her ability, and a side scheme entering play with its threat does not either. Defense Network is revealed in setup
  // step 12 by Underground Distribution 1A, enters with 2 threat and its When Revealed places 1 more.
  it("never offers I Object! from game setup through the mulligan, and setup completes", () => {
    const created = createGame(klawConfig(), CORE_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const offers: Offer[] = [];
    const pick = recordingOffers(offers);
    let state: GameState = created.state;
    let reachedMulligan = false;
    for (let guard = 0; state.step.phase === "setup" && state.pendingChoice; guard++) {
      if (guard > 200) throw new Error("setup did not settle");
      if (state.step.kind === "mulligan") reachedMulligan = true;
      state = answer(state, pick(state));
    }
    expect(offersOfIObject(offers)).toEqual([]);
    expect(offers).toEqual([]);
    expect(reachedMulligan).toBe(true);
    expect(state.step.phase).toBe("player");
    // Starting threat 2 and the When Revealed's 1 per hero, none of it prevented.
    const network = instancesOf(state, "01125")[0] as InstanceId;
    expect(inst(state, network).threat).toBe(3);
  });
});

describe("Klaw with She-Hulk in play: I Object! answers threat placed, not threat a side scheme enters with", () => {
  it("offers I Object! on placed threat, but not on Illegal Arms Factory's starting threat as it enters play", () => {
    // Jennifer Walters (alter-ego) ends her turn: the villain phase places threat on the main scheme, Klaw schemes,
    // then she is dealt Illegal Arms Factory (the boost card first, for Klaw's scheme).
    const stacked = stackEncounterDeck(startCoreGame(klawConfig()), "01186", "01126");
    const factory = instancesOf(stacked, "01126")[0] as InstanceId;
    const offers: Offer[] = [];
    const after = settle(run(stacked, endTurn()), recordingOffers(offers));

    const placedOn = (scheme: InstanceId) =>
      offersOfIObject(offers).filter(
        (offer) => offer.event.kind === "placeThreat" && offer.event.schemeInstanceId === scheme,
      );
    // Threat placed on the main scheme in villain phase step one is a placement.
    expect(placedOn(stacked.mainScheme.instanceId).length).toBeGreaterThan(0);
    // FAQ "Jennifer Walters (#19B)": "Side schemes enter play with threat already on them, meaning threat is not
    // 'placed' at this point." Only the When Revealed's additional 1 per hero threat is offered.
    expect(placedOn(factory).map((offer) => offer.event.kind === "placeThreat" && offer.event.amount)).toEqual([1]);
    // Everything declined: starting threat 3 plus 1.
    expect(inst(after, factory).threat).toBe(4);
  });
});
