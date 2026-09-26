/**
 * docs/phase7-wave4.md §3.2: two main schemes in play at once, each belonging to a villain, one shared encounter deck,
 * and Focused Defense naming the active villain. Synthetic cards shaped like Tower Defense (`mts` 21092–21101): Under
 * Siege 1A "Setup: Reveal stage 2A and put it into play next to this stage so there are two main schemes and two villains
 * in play"; 1B "Proxima Midnight's Scheme."; The Armies of Thanos 2A "Put the Focused Defense attachment into play
 * attached to this stage", 2B "Corvus Glaive's Scheme."; Focused Defense, "The villain who matches the attached scheme is
 * the active villain. Forced Response: After the player phase ends, attach this card to the other main scheme."
 *
 * Sources: MC21 pp. 10–11 ("Two Main Schemes", "Two Villains", "The Active Villain"); errata, RRG 1.8 p. 67 ("When a
 * minion schemes, that threat is placed on the main scheme with the attachment 'Focused Defense' attached to it"); FAQ,
 * RRG 1.8 p. 62.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import { MAIN_SCHEME_CHOICE, resolveRef } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, HERO } from "./testing/scenario.js";
import { copiesOf, minionEngagedWith, P1, playFree } from "./testing/wave3.js";

const PROXIMA = stubVillain({ id: "proxima", name: "Proxima Midnight", stages: [{ hp: flat(30), atk: 0, sch: 2 }] });
const CORVUS = stubVillain({ id: "corvus", name: "Corvus Glaive", stages: [{ hp: flat(30), atk: 0, sch: 3 }] });

const self: TargetRef = { kind: "self" };
const FOCUSED_RULE = stubAbility("focused-defense.constant", {
  trigger: { kind: "constant", rules: [{ kind: "focusedMainScheme", scheme: { kind: "host" } }] },
  effects: [],
});
/** "Forced Response: After the player phase ends, attach this card to the other main scheme." */
const FOCUSED_MOVE = stubAbility("focused-defense.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "phaseEnding", eventIs: { phase: "player" } } },
  effects: [
    {
      kind: "attach",
      card: self,
      to: { kind: "each", query: { categories: ["mainScheme"], excluding: { kind: "host" } } },
    },
  ],
});
const FOCUSED = stubAttachment({
  id: "focused-defense",
  name: "Focused Defense",
  attachesTo: { kind: "mainScheme" },
  keywords: [{ name: "permanent" }],
  abilities: [FOCUSED_RULE.ref, FOCUSED_MOVE.ref],
});

const SETUP = stubAbility("under-siege.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "putMainSchemeStageIntoPlay", stageNumber: 2 }],
});
const ARMIES_REVEALED = stubAbility("armies.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "selectCards", slot: "focused", cards: { kind: "encounterSetAside", filter: { name: "Focused Defense" } } },
    { kind: "attach", card: { kind: "slot", slot: "focused" }, to: self },
  ],
});
const stage = (aSide: typeof SETUP) => ({
  startingThreat: flat(1),
  targetThreat: flat(50),
  acceleration: flat(1),
  aSideAbilities: [aSide.ref],
});
const TOWER_SCHEMES = (() => {
  const card = stubMainScheme({
    id: "tower-defense",
    stages: [stage(SETUP), stage(ARMIES_REVEALED)],
  });
  const [underSiege, armies] = card.stages;
  return {
    ...card,
    stages: [
      { ...underSiege!, villainOf: "Proxima Midnight" },
      { ...armies!, villainOf: "Corvus Glaive" },
    ] as const,
  };
})();

const GRUNT = stubMinion({ id: "grunt", atk: 0, sch: 1, hp: 5, boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const mainSchemeEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Remove 2 threat from the main scheme" on a player card: its controller chooses which (MC21 p. 10). */
const REMOVE = mainSchemeEvent("remove-2", [
  { kind: "removeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } },
]);
const MINION_SCHEMES = mainSchemeEvent("minion-schemes", [
  { kind: "enemyScheme", enemies: { kind: "each", query: { categories: ["minion"] } } },
]);

const deps: EngineDeps = depsOf(
  FOCUSED_RULE,
  FOCUSED_MOVE,
  SETUP,
  ARMIES_REVEALED,
  REMOVE.ability,
  MINION_SCHEMES.ability,
);

function start(): GameState {
  const result = createGame(
    {
      seed: 11,
      cards: [
        ...DEFAULT_CARDS,
        PROXIMA,
        CORVUS,
        TOWER_SCHEMES,
        FOCUSED,
        GRUNT,
        FILLER,
        REMOVE.card,
        MINION_SCHEMES.card,
      ],
      villainCardId: PROXIMA.id,
      villains: [
        { villainCardId: PROXIMA.id, encounterDeck: [] },
        { villainCardId: CORVUS.id, encounterDeck: [] },
      ],
      sharedEncounterDeck: true,
      encounterDeck: [...copiesOf(FILLER.id, 20), GRUNT.id],
      setAside: [FOCUSED.id],
      mainSchemeCardId: TOWER_SCHEMES.id,
      includeIdentitySets: false,
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, ...copiesOf(REMOVE.card.id, 2), ...copiesOf(MINION_SCHEMES.card.id, 2)],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const scheme = (state: GameState, villain: "Proxima Midnight" | "Corvus Glaive"): InstanceId => {
  const index = villain === "Proxima Midnight" ? 0 : 1;
  const all = [state.mainScheme, ...(state.extraMainSchemes ?? [])];
  const found = all.find((s) => s.stageIndex === index);
  if (!found) throw new Error(`no scheme for ${villain}`);
  return found.instanceId;
};
const threat = (state: GameState, villain: "Proxima Midnight" | "Corvus Glaive"): number =>
  mustInstance(state, scheme(state, villain)).threat;
const activeName = (state: GameState): string | undefined =>
  state.cardPool[mustInstance(state, state.activeVillainId).cardId]?.name;
const focusedOn = (state: GameState): InstanceId | null => {
  const id = Object.values(state.instances).find((i) => i.cardId === FOCUSED.id);
  return id?.attachedTo ?? null;
};

/** Ends P1's turn and drives the villain phase until the next player phase. */
function endRound(state: GameState): { state: GameState; session: GameSession } {
  let session = startSession(state);
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  apply({ type: "endTurn", playerId: P1 });
  for (let guard = 0; session.state.pendingChoice && guard < 50; guard++) {
    const choice = session.state.pendingChoice;
    apply({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: defaultPick(session.state),
    });
  }
  return { state: session.state, session };
}

describe("§3.2 two main schemes, each belonging to a villain", () => {
  it("setup puts the second stage into play beside the first, and Focused Defense makes its villain active", () => {
    const state = start();
    expect(state.extraMainSchemes).toHaveLength(1);
    expect(state.encounterDeckOrder).toHaveLength(1);
    expect(focusedOn(state)).toBe(scheme(state, "Corvus Glaive"));
    expect(activeName(state)).toBe("Corvus Glaive");
    expect(threat(state, "Proxima Midnight")).toBe(1);
    expect(threat(state, "Corvus Glaive")).toBe(1);
  });

  it("at the player phase's end Focused Defense moves; step one threatens both schemes; the active villain schemes on its own", () => {
    const before = start();
    const { state: after, session } = endRound(before);
    expect(focusedOn(after)).toBe(scheme(after, "Proxima Midnight"));
    expect(activeName(after)).toBe("Proxima Midnight");
    // Each scheme gained its acceleration (1); Proxima (SCH 2) schemed onto her own scheme only.
    expect(threat(after, "Proxima Midnight")).toBe(1 + 1 + 2);
    expect(threat(after, "Corvus Glaive")).toBe(1 + 1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a minion schemes onto the scheme with Focused Defense (errata, RRG 1.8 p. 67)", () => {
    const engaged = minionEngagedWith(start(), GRUNT.id).state;
    const after = playFree(engaged, deps, MINION_SCHEMES.card.id).state;
    expect(threat(after, "Corvus Glaive")).toBe(2);
    expect(threat(after, "Proxima Midnight")).toBe(1);
  });

  it("a player card's 'the main scheme' asks its controller which one", () => {
    const { state: after, events } = playFree(start(), deps, REMOVE.card.id, P1);
    const asked = events.find((event) => event.type === "targetChosen" && event.slot === MAIN_SCHEME_CHOICE);
    expect(asked).toBeDefined();
    // Exactly one scheme, the chosen one, loses the threat.
    const removed = [threat(after, "Proxima Midnight"), threat(after, "Corvus Glaive")].filter((t) => t === 0);
    expect(removed).toHaveLength(1);
  });

  it("an encounter card's 'the main scheme' is both; a player card's constant reading is Focused Defense's", () => {
    const state = start();
    const encounter = resolveRef(
      state,
      { kind: "mainScheme" },
      {
        selfInstanceId: state.activeVillainId,
        controllerId: null,
        event: null,
        bindings: {},
        deps,
      },
    );
    expect([...encounter].sort()).toEqual([scheme(state, "Proxima Midnight"), scheme(state, "Corvus Glaive")].sort());
    const identity = state.players[0]!.identity.instanceId;
    const player = resolveRef(
      state,
      { kind: "mainScheme" },
      {
        selfInstanceId: identity,
        controllerId: P1,
        event: null,
        bindings: {},
        deps,
      },
    );
    expect(player).toEqual([scheme(state, "Corvus Glaive")]);
  });
});
