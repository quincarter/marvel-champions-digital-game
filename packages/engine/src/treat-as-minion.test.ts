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
import type { Command } from "./commands.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { hasKeyword } from "./keywords.js";
import {
  activeEncounterDeck,
  characterProfile,
  isMinion,
  locateCard,
  minionsEngagedWith,
  mustInstance,
  mustPlayer,
} from "./query.js";
import { activeAbilityRefs, categoriesOf, controllerOf, traitsOf } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubAttachment, stubEvent } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { runCommandsPicking } from "./testing/drive.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

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
const deps: EngineDeps = depsOf(
  HEIMDALL_CONSTANT,
  ...BEGUILED.abilities,
  ...MANIPULATED.abilities,
  ...EVENTS.map((e) => e.ability),
);

function beguile(attachment = BEGUILED): { state: GameState; heimdall: InstanceId; session: unknown } {
  const base = gameAtFirstTurn({
    cards: [HEIMDALL, BEGUILED.card, MANIPULATED.card, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [BEGUILED.card.id, MANIPULATED.card.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [HEIMDALL.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const placed = playerCardIntoPlay(base, HEIMDALL.id);
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

/**
 * Manipulated Mind (`sm` 27171): "Treat attached ally as a minion with a blank text box (except for traits). … When
 * Revealed: Attach to the ally you control with the lowest cost. Attached ally engages its controller. Otherwise, this
 * card gains surge." The host is `superlative` with `controlledBy: "you"`: the revealing player's allies only (RRG 1.8
 * "You, Your"), ties a first-player choice (RRG 1.8 "First Player", p. 19). A minion's keywords are in its (blank)
 * text box; defeated, a card goes to its owner's discard pile.
 */
describe("§3.9 Manipulated Mind: the ally you control with the lowest cost", () => {
  const SIF = { ...stubAlly({ id: "sif", cost: 4, atk: 3, thw: 1, hp: 4, keywords: [{ name: "guard" }] }), name: "Sif" };
  const PAGE = { ...stubAlly({ id: "page", cost: 1, atk: 1, thw: 1, hp: 2 }), name: "Page" };
  const MIND_CONSTANT = stubAbility("mind.constant", {
    trigger: {
      kind: "constant",
      rules: [{ kind: "treatHostAsMinion", traits: [], schFromThw: true, keepPrintedTraits: true }],
    },
    effects: [],
  });
  const MIND = stubAttachment({
    id: "mind",
    name: "Manipulated Mind",
    attachesTo: { kind: "superlative", among: "ally", order: "lowest", measure: "printedCost", controlledBy: "you" },
    abilities: [MIND_CONSTANT.ref],
  });
  const KILL = event("kill", [
    { kind: "placeDamage", target: { kind: "named", name: "Sif" }, amount: { kind: "const", value: 10 } },
  ]);
  const mindDeps: EngineDeps = depsOf(HEIMDALL_CONSTANT, MIND_CONSTANT, REVEAL.ability, KILL.ability);

  /** Two seats; P1 controls `p1Allies`, P2 controls Page (cost 1, cheaper than any of P1's); P1 reveals the card. */
  function reveal(p1Allies: readonly (typeof HEIMDALL)[], host?: "heimdall" | "sif") {
    let state = gameAtFirstTurn({
      cards: [HEIMDALL, SIF, PAGE, MIND, REVEAL.card, KILL.card],
      deps: mindDeps,
      players: 2,
      encounter: [MIND.id, ...copiesOf(TREACHERY.id, 10)],
      deck: [HEIMDALL.id, SIF.id, PAGE.id, REVEAL.card.id, KILL.card.id],
    });
    const ids: Record<string, InstanceId> = {};
    for (const ally of p1Allies) {
      const placed = playerCardIntoPlay(state, ally.id, P1);
      state = placed.state;
      ids[ally.id] = placed.id;
    }
    const page = playerCardIntoPlay(state, PAGE.id, P2);
    ids.page = page.id;
    const given = giveCard(onTopOfEncounterDeck(page.state, MIND.id), P1, REVEAL.card.id);
    // Every choice that offers an ally (the host choice), with who was asked; the host is `host` when offered.
    const hostChoices: { playerId: string; options: string[] }[] = [];
    const allies = Object.values(ids) as string[];
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice!;
      const options = choice.options.map((o) => o.optionId as string);
      if (!options.some((o) => allies.includes(o))) return defaultPick(s);
      hostChoices.push({ playerId: choice.playerId, options });
      const wanted = host ? ids[host] : undefined;
      return wanted && options.includes(wanted) ? [wanted] : defaultPick(s);
    };
    const play: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    };
    const revealed = runCommandsPicking(given.state, mindDeps, pick, play).state;
    const mind = Object.values(revealed.instances).find((i) => i.cardId === MIND.id)!.instanceId;
    return { state: revealed, ids, mind, hostChoices };
  }

  it("P2's cheaper ally is no host; P1's two cost-4 allies tie, so the first player chooses", () => {
    const { ids, hostChoices } = reveal([HEIMDALL, SIF], "sif");
    expect(hostChoices).toHaveLength(1);
    expect(hostChoices[0]!.playerId).toBe(P1);
    expect([...hostChoices[0]!.options].sort()).toEqual([ids.heimdall, ids.sif].sort());
  });

  it("the chosen ally is a minion, bare but for its printed traits, SCH = printed THW, its guard blanked", () => {
    const { state, ids, mind } = reveal([HEIMDALL, SIF], "sif");
    const sif = ids.sif!;
    expect(mustInstance(state, sif).attachments).toEqual([mind]);
    expect(categoriesOf(state, sif)).toEqual(["minion", "enemy", "character"]);
    expect(characterProfile(state, sif, mindDeps)!.sch).toBe(1);
    expect(characterProfile(state, sif, mindDeps)!.atk).toBe(3);
    expect(hasKeyword(state, sif, "guard", mindDeps)).toBe(false);
    expect(categoriesOf(state, ids.heimdall!)).toEqual(["ally", "character"]);
    expect(categoriesOf(state, ids.page!)).toEqual(["ally", "character"]);
  });

  it("negative: with no ally P1 controls it cannot attach (P2's ally is no host) and is discarded", () => {
    const { state, ids, mind, hostChoices } = reveal([]);
    expect(hostChoices).toEqual([]);
    expect(mustInstance(state, ids.page!).attachments).toEqual([]);
    expect(categoriesOf(state, ids.page!)).toEqual(["ally", "character"]);
    expect(activeEncounterDeck(state).discard).toContain(mind);
  });

  it("defeated as a minion, the ally goes to its owner's discard pile and the attachment to the encounter discard", () => {
    const { state, ids, mind } = reveal([HEIMDALL, SIF], "sif");
    const defeated = playFree(state, mindDeps, KILL.card.id).state;
    expect(mustPlayer(defeated, P1).discard).toContain(ids.sif);
    expect(mustInstance(defeated, ids.sif!).treatedAs ?? null).toBeNull();
    expect(mustInstance(defeated, ids.sif!).damage).toBe(0);
    expect(activeEncounterDeck(defeated).discard).toContain(mind);
  });
});
