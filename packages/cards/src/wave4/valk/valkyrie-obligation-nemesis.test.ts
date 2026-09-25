import { activeEncounterDeck, canAttack, type GameState, type InstanceId } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { revealFromEncounterDeck, withForm } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { valkyrieScenario } from "./support.js";

const valkyrieVsRhino = (seed = 1) => startWave4Game(valkyrieScenario("rhino", { seed }));

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "spendResources" || choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, 1).map((o) => o.optionId);
    }
    const hits = choice.options
      .filter((o) => wanted.some((w) => o.optionId === w || o.optionId.includes(w) || o.label.includes(w)))
      .map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Puts a copy of `code` directly into P1's play area (surgery), the way an obligation already resolved sits — no
 * reveal, no When Revealed. An obligation starts shuffled into the encounter deck (RRG 1.8 Appendix II), not in the
 * player's own deck. */
function inPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => state.instances[i]?.cardId === (code as never));
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((x) => x !== id) } },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
    },
  };
}

describe("Trouble in Otherworld (obligation, 25028)", () => {
  it("(25028.trouble-in-otherworld-constant): Valkyrie cannot attack the enemy with Death-Glow attached", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(1), toHero());
    const { state } = inPlay(hero, "25028");
    const identity = identityOf(state, P1);
    const villain = state.villains[0]!.instanceId;
    const glow = instancesOf(state, "25002")[0]!;
    const attached: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [glow]: { ...state.instances[glow]!, attachedTo: villain, faceup: true },
        [villain]: { ...state.instances[villain]!, attachments: [...state.instances[villain]!.attachments, glow] },
      },
    };
    expect(canAttack(attached, identity, villain, WAVE4_DEPS)).toBe(false);
    // She can still attack an enemy without Death-Glow attached.
    expect(canAttack(state, identity, villain, WAVE4_DEPS)).toBe(true);
  });

  it("(25028.trouble-in-otherworld-action): spending [energy][mental] removes it from the game", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(2), toHero());
    const alterEgo = withForm(hero, "alterEgo");
    const { state: staged, id } = inPlay(alterEgo, "25028");
    // Two wild-producing resource cards (Audacity, The Power of Aggression) cover the energy+mental requirement
    // regardless of what her opening hand actually drew.
    const given = moveToHand(staged, P1, "25021", "25022");
    const state = given.state;
    const settled = settle(
      runWith(WAVE4_DEPS, state, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: id,
        abilityId: "25028.trouble-in-otherworld-action" as never,
        payment: given.ids.map((fromHand) => ({ fromHand })),
      }),
      accepting(id),
      undefined,
      WAVE4_DEPS,
    );
    expect(settled.removedFromGame).toContain(id);
  });
});

describe("Valkyrie's nemesis set: Enchantress, Beguiled, Seduced", () => {
  it("Enchantress (25029.when-revealed): searches for Seduced and attaches it to your identity", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(4), toHero());
    const { state } = revealFromEncounterDeck(WAVE4_DEPS, hero, "25029", accepting("Seduced"), 1);
    const identity = identityOf(state, P1);
    expect(inst(state, identity).attachments.some((a) => state.instances[a]?.cardId === ("25032" as never))).toBe(true);
  });

  it("Beguiled (25031.beguiled-constant, 25031.beguiled-constant-2): treats the attached ally as an Enthralled minion, SCH = printed THW; When Revealed (25031.when-revealed) engages its controller", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(5), toHero());
    const { state: withAlly, id: ally } = playFromHand(hero, "25003", 2);
    const { state, id: beguiled } = revealFromEncounterDeck(WAVE4_DEPS, withAlly, "25031", firstLegal, 1);
    void beguiled;
    const treated = inst(state, ally).treatedAs;
    expect(treated?.kind).toBe("minion");
    expect(treated?.traits).toContain("ENTHRALLED");
    expect(inst(state, ally).engagedWith).toBe(P1);
  });

  it("Seduced (25032.seduced-constant, -action): attached to your identity, you cannot attack; spending resources discards it", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(6), toHero());
    const identity = identityOf(hero, P1);
    const seduced = instancesOf(hero, "25032")[0]!;
    const attached: GameState = {
      ...hero,
      instances: {
        ...hero.instances,
        [seduced]: { ...hero.instances[seduced]!, attachedTo: identity, faceup: true, controllerId: P1 },
        [identity]: { ...hero.instances[identity]!, attachments: [...hero.instances[identity]!.attachments, seduced] },
      },
    };
    const villain = attached.villains[0]!.instanceId;
    expect(canAttack(attached, identity, villain, WAVE4_DEPS)).toBe(false);
    const alterEgo = withForm(attached, "alterEgo");
    const given = moveToHand(alterEgo, P1, "25021", "25022");
    const state = settle(
      runWith(WAVE4_DEPS, given.state, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: seduced,
        abilityId: "25032.seduced-action" as never,
        payment: given.ids.map((fromHand) => ({ fromHand })),
      }),
      accepting(seduced),
      undefined,
      WAVE4_DEPS,
    );
    // Seduced is an encounter card: "discard" sends it to the encounter deck's own discard pile, not P1's hand
    // discard pile (RRG 1.8's "corresponding encounter deck" rule).
    expect(activeEncounterDeck(state).discard).toContain(seduced);
    expect(inst(state, seduced).attachedTo).toBeNull();
  });
});
