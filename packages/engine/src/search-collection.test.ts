/**
 * docs/phase7-wave7.md §3.81: `EffectSpec searchCollection { player, filter, bind }`. "Search your collection for 1
 * WEAPON upgrade from any aspect and attach it facedown here."
 *
 * RRG 1.8 "Search" (p. 39): the player "looks through all of their Marvel Champions cards outside of the current game
 * for the specified card. They become the owner of that card until the end of the game." §4.1 Q47 = A: the collection
 * is the game's card pool, with copy accounting (printed quantity less the copies the game already holds). Ruling,
 * December 17, 2025 - Ruling 4, answer 1: a card removed from the game "does not become a part of the collection".
 * Synthetic cards only; the engine never names a card.
 */
import { encounterSetId, flat, trait, type AnyCard, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { PendingChoice } from "./choices.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { collectionCandidates } from "./resolve/collection.js";
import type { CollectionSearchFilter, EffectSpec, PlayerRef, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMainScheme, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const you: PlayerRef = { kind: "controller" };
const thatPlayer: PlayerRef = { kind: "scoped" };
const mainScheme: TargetRef = { kind: "mainScheme" };
const found: TargetRef = { kind: "slot", slot: "found" };
const WEAPON = trait("WEAPON");

/** "1 WEAPON upgrade from any aspect": the card names its own aspects. */
const weaponUpgrade: CollectionSearchFilter = {
  categories: ["upgrade"],
  aspects: ["aggression", "justice", "leadership", "protection", "pool"],
  traits: [WEAPON],
};

const weapon = (id: string, extra: Partial<UpgradeCard>): UpgradeCard => ({
  ...stubUpgrade({ id, cost: 1, traits: [WEAPON] }),
  ...extra,
});
/** Two copies in its product; one copy of it is in each seat's deck. */
const BLADE = weapon("blade", { aspect: "aggression", quantityInSet: 2 });
/** One copy in its product, in nobody's deck. */
const AXE = weapon("axe", { aspect: "justice" });
/** Not "from any aspect": basic, identity-specific, and a campaign card with no classification. */
const CLUB = weapon("club", { aspect: "basic" });
const HEIRLOOM = weapon("heirloom", { aspect: "hero:hero" });
const RELIC = weapon("relic", { aspect: "none" });
/** A campaign card that also prints an aspect (RRG 1.8 "Campaign-Specific Card", p. 11): in no collection search. */
const TROPHY = weapon("trophy", {
  aspect: "aggression",
  specificTo: { kind: "campaign", encounterSetId: encounterSetId("spoils") },
});
/** An aspect upgrade that is no WEAPON, and a WEAPON that is no upgrade. */
const ARMOR: UpgradeCard = { ...stubUpgrade({ id: "armor", cost: 1 }), aspect: "aggression" };
const SQUIRE: AnyCard = {
  ...stubAlly({ id: "squire", cost: 1, atk: 1, thw: 1, hp: 1, traits: [WEAPON] }),
  aspect: "aggression",
};

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
const search = (player: PlayerRef): EffectSpec => ({
  kind: "searchCollection",
  player,
  filter: weaponUpgrade,
  bind: "found",
});
/** The printed sentence, with a "then" behind it to show whether the search counted as resolved. */
const ARM = action("arm", [
  search(you),
  { kind: "attach", card: found, to: { kind: "self" }, facedown: true },
  { kind: "placeThreat", target: mainScheme, amount: { kind: "var", name: "found.count" } },
  { kind: "then", effects: [{ kind: "placeThreat", target: mainScheme, amount: { kind: "const", value: 10 } }] },
]);
/** A search for a player the ref does not name: "that player" outside any "each player". */
const NOBODY = action("nobody", [
  search(thatPlayer),
  { kind: "placeThreat", target: mainScheme, amount: { kind: "const", value: 1 } },
]);
const ACTIONS = [ARM, NOBODY] as const;
const BUTTONS = ACTIONS.map((a) => stubSupport({ id: a.ref.id.split(".")[0]!, cost: 0, abilities: [a.ref] }));

const deps: EngineDeps = depsOf(...ACTIONS);
/** A main scheme no threat placed here completes. */
const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});

const game = (players: 1 | 2 = 1): GameState =>
  gameAtFirstTurn({
    cards: [BLADE, AXE, CLUB, HEIRLOOM, RELIC, TROPHY, ARMOR, SQUIRE, SCHEME, ...BUTTONS],
    deps,
    players,
    mainScheme: SCHEME,
    deck: [BLADE.id, ...BUTTONS.map((b) => b.id)],
  });

/** One of the action supports in `player`'s play area (put there once), and the command that uses it. */
function button(state: GameState, ability: StubAbility, player: PlayerId = P1) {
  const card = BUTTONS[ACTIONS.indexOf(ability as (typeof ACTIONS)[number])]!;
  const inPlay = mustPlayer(state, player).playArea.find((id) => mustInstance(state, id).cardId === card.id);
  const placed = inPlay ? { state, id: inPlay } : playerCardIntoPlay(state, card.id, player);
  const command: Command = {
    type: "useAbility",
    playerId: player,
    cardInstanceId: placed.id,
    abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  return { state: placed.state, command, host: placed.id };
}

/** Uses `ability`, answering the collection prompt with `pick` (a card id, or null to find nothing). */
function use(state: GameState, ability: StubAbility, pick: string | null, asked: PendingChoice[] = []) {
  const { state: ready, command, host } = button(state, ability);
  const run = driveSession(startSession(ready), deps, [command], (current) => {
    const choice = current.pendingChoice!;
    if (choice.prompt.kind !== "searchCollection") return defaultPick(current);
    asked.push(choice);
    return pick === null ? [] : [pick];
  });
  return { before: ready, run, state: run.session.state, host, asked };
}

/** A session stopped at the open collection prompt. */
function driveSessionUntilSearch(state: GameState, command: Command) {
  const result = sessionApply(startSession(state), command, deps);
  if (!result.ok) throw new Error(result.error.message);
  if (result.session.state.pendingChoice?.prompt.kind !== "searchCollection") throw new Error("no collection prompt");
  return result.session;
}

const threatOn = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const added = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "cardAddedFromCollection" }> => e.type === "cardAddedFromCollection",
  );
const ids = (cards: readonly AnyCard[]): readonly string[] => cards.map((card) => card.id);
const copies = (state: GameState, card: string): number =>
  Object.values(state.instances).filter((i) => i.cardId === card).length;

describe("searchCollection: what the collection holds (§4.1 Q47 = A)", () => {
  it("is the pool's cards that match the filter, in title order, while a copy is left outside the game", () => {
    const state = game();
    // blade: 2 printed, 1 in the deck. axe: 1 printed, 0 in the game. Five others fail the filter, and the campaign
    // card is in no collection whatever the filter says.
    expect(copies(state, BLADE.id)).toBe(1);
    expect(ids(collectionCandidates(state, weaponUpgrade))).toEqual(["axe", "blade"]);
  });

  it("reads each filter field on its own, and an empty list matches nothing", () => {
    const state = game();
    expect(ids(collectionCandidates(state, { categories: ["upgrade"], traits: [WEAPON] }))).toEqual([
      "axe",
      "blade",
      "club",
      "heirloom",
      "relic",
    ]);
    expect(ids(collectionCandidates(state, { categories: ["ally"], traits: [WEAPON] }))).toEqual(["squire"]);
    expect(ids(collectionCandidates(state, { categories: ["upgrade"], aspects: ["aggression"] }))).toEqual([
      "armor",
      "blade",
    ]);
    expect(collectionCandidates(state, { ...weaponUpgrade, aspects: [] })).toEqual([]);
    expect(ids(collectionCandidates(state, {}))).not.toContain("trophy");
  });

  it("counts every seat's deck copies: 2 printed and 2 in decks leaves none", () => {
    const state = game(2);
    expect(copies(state, BLADE.id)).toBe(2);
    expect(ids(collectionCandidates(state, weaponUpgrade))).toEqual(["axe"]);
  });

  it("does not depend on the order of the pool", () => {
    const state = game();
    const reversed = { ...state, cardPool: Object.fromEntries(Object.entries(state.cardPool).reverse()) };
    expect(ids(collectionCandidates(reversed, weaponUpgrade))).toEqual(["axe", "blade"]);
  });
});

describe("searchCollection: the choice and the card it creates", () => {
  it("offers card definitions, at most one, none allowed", () => {
    const { asked } = use(game(), ARM, "blade");
    expect(asked).toHaveLength(1);
    const [choice] = asked;
    expect(choice!.playerId).toBe(P1);
    expect(choice!.prompt).toEqual({ kind: "searchCollection", slot: "found" });
    expect([choice!.minSelections, choice!.maxSelections]).toEqual([0, 1]);
    expect(choice!.options).toEqual([
      { optionId: "axe", label: "axe", ref: { kind: "cardDefinition", cardId: "axe" } },
      { optionId: "blade", label: "blade", ref: { kind: "cardDefinition", cardId: "blade" } },
    ]);
  });

  it("creates one instance under the next instance id, owned and controlled by the searcher", () => {
    const { before, run, state, host } = use(game(), ARM, "blade");
    const id = `i${before.nextInstanceSeq}` as InstanceId;
    expect(state.nextInstanceSeq).toBe(before.nextInstanceSeq + 1);
    expect(Object.keys(state.instances)).toHaveLength(Object.keys(before.instances).length + 1);
    expect(added(run.events)).toEqual([
      { type: "cardAddedFromCollection", cardId: "blade", instanceId: id, ownerId: P1 },
    ]);
    const card = mustInstance(state, id);
    expect([card.cardId, card.ownerId, card.controllerId, card.home]).toEqual(["blade", P1, P1, { kind: "player" }]);
    // "Attach it facedown here": bound as the slot, so the next effect moved it out of the set-aside area.
    expect([card.attachedTo, card.faceup]).toEqual([host, false]);
    expect(mustInstance(state, host).attachments).toEqual([id]);
    expect(mustPlayer(state, P1).setAside).not.toContain(id);
    // `found.count` = 1, and the text before "then" resolved: 1 + 10.
    expect(threatOn(state) - threatOn(before)).toBe(11);
  });

  it("a fetched copy is counted: blade 2 - 1 - 1 = 0 left, then axe 1 - 1 = 0 left", () => {
    const first = use(game(), ARM, "blade");
    expect(copies(first.state, BLADE.id)).toBe(2);
    expect(ids(collectionCandidates(first.state, weaponUpgrade))).toEqual(["axe"]);
    const second = use(first.state, ARM, "axe");
    expect(second.asked[0]!.options.map((o) => o.optionId)).toEqual(["axe"]);
    expect(collectionCandidates(second.state, weaponUpgrade)).toEqual([]);
  });

  it("a copy removed from the game does not return to the collection (ruling, December 17, 2025 - Ruling 4)", () => {
    const { state, host } = use(game(), ARM, "axe");
    const [id] = mustInstance(state, host).attachments;
    const removed: GameState = {
      ...state,
      removedFromGame: [...state.removedFromGame, id!],
      instances: {
        ...state.instances,
        [host]: { ...mustInstance(state, host), attachments: [] },
        [id!]: { ...mustInstance(state, id!), attachedTo: null },
      },
    };
    expect(ids(collectionCandidates(removed, weaponUpgrade))).toEqual(["blade"]);
  });

  it("finding nothing by choice creates no card and the rest resolves", () => {
    const { before, run, state, host, asked } = use(game(), ARM, null);
    expect(asked).toHaveLength(1);
    expect(added(run.events)).toEqual([]);
    expect(state.nextInstanceSeq).toBe(before.nextInstanceSeq);
    expect(state.instances).toHaveProperty(host);
    expect(Object.keys(state.instances)).toHaveLength(Object.keys(before.instances).length);
    expect(mustInstance(state, host).attachments).toEqual([]);
    // `found.count` = 0, and the "then" still resolves: 0 + 10.
    expect(threatOn(state) - threatOn(before)).toBe(10);
  });

  it("with no card left nobody is asked, nothing is created and a later 'then' does not resolve", () => {
    const emptied = use(use(game(), ARM, "blade").state, ARM, "axe").state;
    const { before, run, state, asked } = use(emptied, ARM, "blade");
    expect(asked).toEqual([]);
    expect(added(run.events)).toEqual([]);
    expect(state.nextInstanceSeq).toBe(before.nextInstanceSeq);
    expect(run.events.filter((e) => e.type === "preThenUnresolved")).toEqual([
      { type: "preThenUnresolved", cause: "searchFoundNothing" },
    ]);
    expect(threatOn(state) - threatOn(before)).toBe(0);
  });

  it("a search for no player asks nobody and finds nothing, without failing the text before a 'then'", () => {
    const { before, run, state, asked } = use(game(), NOBODY, "blade");
    expect(asked).toEqual([]);
    expect(added(run.events)).toEqual([]);
    expect(run.events.some((e) => e.type === "preThenUnresolved")).toBe(false);
    expect(threatOn(state) - threatOn(before)).toBe(1);
  });

  it("a card that is not offered is refused as an answer", () => {
    const { state: ready, command } = button(game(), ARM);
    const open = driveSessionUntilSearch(ready, command);
    const choice = open.state.pendingChoice!;
    const refused = sessionApply(
      open,
      { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: ["club"] },
      deps,
    );
    expect(refused.ok).toBe(false);
    const both = sessionApply(
      open,
      { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: ["axe", "blade"] },
      deps,
    );
    expect(both.ok).toBe(false);
  });
});

describe("searchCollection: determinism", () => {
  it("a replayed log creates the same cards under the same ids, and the state is plain data", () => {
    const first = use(game(), ARM, "blade");
    const { state: ready, command } = button(first.state, ARM);
    const run = driveSession(first.run.session, deps, [command], (current) =>
      current.pendingChoice!.prompt.kind === "searchCollection" ? ["axe"] : defaultPick(current),
    );
    expect(ready).toEqual(first.state);
    expect(added(run.events).map((e) => [e.cardId, e.instanceId])).toEqual([
      ["axe", `i${first.state.nextInstanceSeq}`],
    ]);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
    expect(JSON.parse(JSON.stringify(run.session.state))).toEqual(run.session.state);
  });
});
