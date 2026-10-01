/**
 * docs/phase7-wave4.md §3.9: an ally treated as a minion. Synthetic cards shaped like Beguiled (`mts` 21178: "Treat
 * attached ally as an [Enthralled] minion with a blank text box. Attached minion's SCH is equal to its printed THW and
 * it does not take consequential damage. When Revealed: Attach to the ally with the highest cost without Beguiled
 * attached. Attached ally engages its controller.") and Manipulated Mind (`sm` 27171, "(except for traits)").
 *
 * Sources: the cards' own text; ruling, Dec 17, 2025 (1) #3 ("the ally does not leave play and the 'minion' does not
 * enter play; the character remains in play and retains all tokens and attachments. (The process is essentially a
 * status change.)"); RRG 1.8 "Blank" (p. 10).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterProfile, isMinion, locateCard, minionsEngagedWith, mustInstance } from "./query.js";
import { activeAbilityRefs, categoriesOf, controllerOf, traitsOf } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubAttachment, stubEvent, stubSupport } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const ENTHRALLED = trait("ENTHRALLED");
const ASGARD = trait("ASGARD");
const host: TargetRef = { kind: "host" };

const HEIMDALL_CONSTANT = stubAbility("heimdall.constant", {
  trigger: { kind: "constant", rules: [{ kind: "excludedFromAllyLimit", target: { self: true } }] },
  effects: [],
});
const HEIMDALL = {
  ...stubAlly({ id: "heimdall", cost: 4, atk: 2, thw: 3, hp: 5, traits: [ASGARD], abilities: [HEIMDALL_CONSTANT.ref] }),
  name: "Heimdall",
};

const beguiled = (id: string, keepPrintedTraits: boolean) => {
  const constant = stubAbility(`${id}.constant`, {
    trigger: {
      kind: "constant",
      rules: [{ kind: "treatHostAsMinion", traits: [ENTHRALLED], schFromThw: true, keepPrintedTraits }],
    },
    effects: [],
  });
  const revealed = stubAbility(`${id}.when-revealed`, {
    trigger: { kind: "whenRevealed" },
    effects: [{ kind: "engage", minion: host, player: { kind: "controllerOf", target: host } }],
  });
  const card = stubAttachment({
    id,
    name: id,
    attachesTo: { kind: "namedCard", name: "Heimdall" },
    abilities: [constant.ref, revealed.ref],
  });
  return { card, abilities: [constant, revealed] };
};
const BEGUILED = beguiled("beguiled", false);
const MANIPULATED = beguiled("manipulated-mind", true);

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const WOUND = event("wound", [
  { kind: "placeDamage", target: { kind: "named", name: "Heimdall" }, amount: { kind: "const", value: 1 } },
]);
const FREE = event("free", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["attachment"] } } },
]);
const EVENTS = [REVEAL, WOUND, FREE];
/** "After a minion engages a player": places a counter on the main scheme. */
const ENGAGE_WATCH = stubAbility("engage-watch.response", {
  trigger: { kind: "response", forced: true, on: { on: "minionEngaged" } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "each", query: { categories: ["mainScheme"] } },
      counterType: "engaged",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const WATCHER = stubSupport({ id: "engage-watcher", cost: 0, abilities: [ENGAGE_WATCH.ref] });
const deps: EngineDeps = depsOf(
  ENGAGE_WATCH,
  HEIMDALL_CONSTANT,
  ...BEGUILED.abilities,
  ...MANIPULATED.abilities,
  ...EVENTS.map((e) => e.ability),
);

function beguile(attachment = BEGUILED, watched = false): { state: GameState; heimdall: InstanceId; session: unknown } {
  const base = gameAtFirstTurn({
    cards: [HEIMDALL, BEGUILED.card, MANIPULATED.card, WATCHER, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [BEGUILED.card.id, MANIPULATED.card.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [HEIMDALL.id, WATCHER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const withWatcher = watched ? playerCardIntoPlay(base, WATCHER.id).state : base;
  const placed = playerCardIntoPlay(withWatcher, HEIMDALL.id);
  const wounded = playFree(placed.state, deps, WOUND.card.id).state;
  const { state, session } = playFree(onTopOfEncounterDeck(wounded, attachment.card.id), deps, REVEAL.card.id);
  return { state, heimdall: placed.id, session };
}
const turnAllies = (state: GameState, id: InstanceId): boolean => {
  const actions = legalActions(state, P1, deps);
  return actions.kind === "turn" && actions.legal.some((a) => JSON.stringify(a.action).includes(`"${id}"`));
};

describe("§3.9 an ally treated as a minion", () => {
  it("attached, the ally is an engaged minion with a blank text box, new traits, SCH = printed THW; nothing else changes", () => {
    const { state, heimdall, session } = beguile();
    expect(categoriesOf(state, heimdall)).toEqual(["minion", "enemy", "character"]);
    expect(isMinion(state, heimdall)).toBe(true);
    expect(minionsEngagedWith(state, P1)).toContain(heimdall);
    expect(controllerOf(state, heimdall)).toBeNull();
    expect(locateCard(state, heimdall)).toEqual({ kind: "playArea", playerId: P1 });
    expect(traitsOf(state, heimdall)).toEqual([ENTHRALLED]);
    expect(activeAbilityRefs(state, heimdall, deps)).toEqual([]);
    const profile = characterProfile(state, heimdall, deps)!;
    expect(profile.kind).toBe("minion");
    expect(profile.sch).toBe(3);
    expect(profile.atk).toBe(2);
    // "Retains all tokens and attachments."
    expect(mustInstance(state, heimdall).damage).toBe(1);
    expect(turnAllies(state, heimdall)).toBe(false);
    const log = (session as { log: Parameters<typeof replay>[0] }).log;
    const replayed = replay(log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual((session as { state: GameState }).state);
  });

  it("'a blank text box (except for traits)' keeps the printed traits beside the new one", () => {
    const { state, heimdall } = beguile(MANIPULATED);
    expect([...traitsOf(state, heimdall)].sort()).toEqual([ASGARD, ENTHRALLED].sort());
  });

  it("'Attached ally engages its controller' is an engagement: 'after a minion engages' hears it", () => {
    // Treating the ally as a minion engages no one (a status change, ruling Dec 17, 2025 (1) #3); the card's own
    // engage instruction does (RRG 1.8 "Engage", p. 18), and it is announced like any `engage` effect.
    const { state, heimdall } = beguile(BEGUILED, true);
    expect(minionsEngagedWith(state, P1)).toContain(heimdall);
    expect(mustInstance(state, state.mainScheme.instanceId).counters.engaged).toBe(1);
  });

  it("when the attachment goes, it is its controller's ally again, with its text and its damage", () => {
    const { state, heimdall } = beguile();
    const freed = playFree(state, deps, FREE.card.id).state;
    expect(categoriesOf(freed, heimdall)).toEqual(["ally", "character"]);
    expect(controllerOf(freed, heimdall)).toBe(P1);
    expect(mustInstance(freed, heimdall).engagedWith).toBeNull();
    expect(traitsOf(freed, heimdall)).toEqual([ASGARD]);
    expect(activeAbilityRefs(freed, heimdall, deps)).toHaveLength(1);
    expect(mustInstance(freed, heimdall).damage).toBe(1);
  });
});
