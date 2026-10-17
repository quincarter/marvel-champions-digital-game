/**
 * Fix proof for `cosmo-type-list`: Cosmo's "name a card type" offers the player card types (ally, event, upgrade,
 * support, resource, player side scheme) for a player's deck and the encounter card types for the encounter deck,
 * environment included; the encounter types are offered for a player's deck only while an encounter card is in it
 * (a Mysterio-style villain shuffled one in). RRG 1.8 "Card Types", p. 12; errata p. 66; owner call in
 * the contributor's rules call (bluefireF5ran).
 */
import { cardId } from "@mc/content";
import { activeVillain, type GameState, type InstanceId } from "@mc/engine";
import { firstLegal, inst, P1, playerOf, settle, toHero, type Picker } from "../testing/harness.js";
import { playFromHand, runWave3, startWave3Game, WAVE3_DEPS } from "../wave3/testing.js";
import { wave3Scenario } from "../wave3/setup.js";
import { STAR_LORD_LEADERSHIP } from "../wave3/stld/testing.js";

const start = () => startWave3Game(wave3Scenario("rhino", { players: [STAR_LORD_LEADERSHIP], seed: 2026 }));

const PLAYER_TYPES = ["ally", "event", "upgrade", "support", "resource", "playerSideScheme"];
const ENCOUNTER_TYPES = ["minion", "sideScheme", "attachment", "treachery", "obligation", "environment"];

/** Moves the first encounter-deck copy of `code` to the top of P1's deck (a villain shuffling it in). */
function encounterCardIntoPlayerDeck(state: GameState, code: string): { state: GameState; id: InstanceId } {
  for (const [deckId, piles] of Object.entries(state.encounterDecks)) {
    const id = piles.deck.find((i) => state.instances[i]?.cardId === cardId(code));
    if (!id) continue;
    return {
      id,
      state: {
        ...state,
        encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id) } },
        players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [id, ...p.deck] } : p)),
      },
    };
  }
  throw new Error(`no ${code} in the encounter deck`);
}

/** Drives the interrupt: accepts Cosmo, picks `source`, then `named`; records the labels of every choice offered. */
function drive(source: string, named: string, offered: string[][]): Picker {
  return (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") {
      const hit = choice.options.find((o) => o.optionId.endsWith(":17020.cosmo-interrupt"));
      return hit ? [hit.optionId] : firstLegal(state);
    }
    if (choice.prompt.kind === "choosePlayer") return [P1];
    if (choice.prompt.kind === "chooseOption") {
      offered.push(choice.options.map((o) => o.label ?? ""));
      const hit = choice.options.find((o) => o.label === source || o.label === named);
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };
}

function attackWithCosmo(stacked: GameState, cosmo: InstanceId, picker: Picker): GameState {
  return settle(
    runWave3(stacked, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cosmo,
      targetInstanceId: activeVillain(stacked).instanceId,
    }),
    picker,
    undefined,
    WAVE3_DEPS,
  );
}

const withCosmo = () => playFromHand(runWave3(start(), toHero()), "17020", 2);

describe("Cosmo: the card types offered when naming a type", () => {
  it("a player's deck with no encounter card in it offers the player types, player side scheme included", () => {
    const { state, id } = withCosmo();
    const offered: string[][] = [];
    attackWithCosmo(state, id, drive("A player's deck", "ally", offered));
    expect(offered[1]).toEqual(PLAYER_TYPES);
  });

  it("the encounter deck offers the encounter types, environment included", () => {
    const { state, id } = withCosmo();
    const offered: string[][] = [];
    attackWithCosmo(state, id, drive("The encounter deck", "environment", offered));
    expect(offered[1]).toEqual(ENCOUNTER_TYPES);
  });

  it("a player's deck holding an encounter card also offers the encounter types, and naming one is honoured", () => {
    const { state, id } = withCosmo();
    // Hydra Mercenary (01101) is a minion shuffled into the player's deck.
    const moved = encounterCardIntoPlayerDeck(state, "01101");
    expect(playerOf(moved.state, P1).deck[0]).toBe(moved.id);
    const offered: string[][] = [];
    const after = attackWithCosmo(moved.state, id, drive("A player's deck", "minion", offered));
    expect(offered[1]).toEqual([...PLAYER_TYPES, ...ENCOUNTER_TYPES]);
    expect(inst(after, id).damage).toBe(0);
  });
});
