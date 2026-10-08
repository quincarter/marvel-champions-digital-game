/**
 * docs/phase7-wave8.md §3.59: "Search your deck and discard pile for an ally and an upgrade that can be attached to an
 * ally" (the corrected text, RRG 1.8 errata p. 69), as `TargetQuery.canAttachToCategory: "ally"`. Synthetic upgrades,
 * one per shape of "attach to" text, searched for with no ally in play.
 *
 * Sources: RRG 1.8 "Attach To" (p. 8), "Upgrade" (p. 46: an upgrade with no host text enters play by its controller's
 * identity), "Search" (p. 39). Owner decision §4.1 Q30 = A: eligibility comes from the upgrade's own attach text; no
 * ally host needs to be in play and the board state is not evaluated.
 */

import { trait, type AttachmentHost, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { hostAllowsCategory } from "./attachment-hosts.js";
import { explainQuery, selectTargets } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubAlly, stubAttachment, stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const TEAM = trait("TEAM");
const upgrade = (id: string, attachesTo?: AttachmentHost): UpgradeCard => ({
  ...stubUpgrade({ id, cost: 0 }),
  ...(attachesTo ? { attachesTo } : {}),
});

/** Hosts an ally can be, by the text alone. */
const YES: Readonly<Record<string, AttachmentHost>> = {
  "to-ally": { kind: "ally" },
  "to-team-ally": { kind: "qualified", category: "ally", trait: TEAM },
  "to-own-ally": { kind: "qualified", category: "ally", classification: "identitySpecific", controlledBy: "you" },
  "to-best-ally": { kind: "superlative", among: "ally", order: "highest", measure: "printedCost" },
  "to-character": { kind: "anyCharacter" },
  "to-friendly": { kind: "friendlyCharacter" },
  "to-team-character": { kind: "qualified", category: "character", trait: TEAM },
  "to-team-friendly": { kind: "qualified", category: "friendlyCharacter", trait: TEAM },
  "to-best-friendly": { kind: "superlative", among: "friendlyCharacter", order: "lowest", measure: "printedHp" },
  "to-either-ally": {
    kind: "anyOf",
    hosts: [
      { kind: "qualified", category: "ally", trait: TEAM },
      { kind: "qualified", category: "ally", trait: trait("CREW") },
    ],
  },
  "to-hero-or-ally": { kind: "anyOf", hosts: [{ kind: "hero" }, { kind: "ally" }] },
  "to-ally-else-hero": { kind: "ifAble", preferred: { kind: "ally" }, otherwise: { kind: "hero" } },
};
/** Hosts an ally cannot be, or that name a card rather than a kind of card. */
const NO: Readonly<Record<string, AttachmentHost>> = {
  "to-hero": { kind: "hero" },
  "to-identity": { kind: "yourIdentity" },
  "to-minion": { kind: "minion" },
  "to-enemy": { kind: "enemy" },
  "to-villain": { kind: "villain" },
  "to-team-minion": { kind: "qualified", category: "minion", trait: TEAM },
  "to-best-enemy": { kind: "superlative", among: "enemy", order: "highest", measure: "printedHp" },
  "to-scheme": { kind: "scheme" },
  "to-named": { kind: "namedCard", name: "recruit" },
  "to-hero-or-minion": { kind: "anyOf", hosts: [{ kind: "hero" }, { kind: "minion" }] },
};
const HOSTED = [...Object.entries(YES), ...Object.entries(NO)].map(([id, host]) => upgrade(id, host));
/** No "attach to" text: it attaches to its controller's identity. */
const PLAIN = upgrade("plain");
/** An encounter attachment that attaches to an ally: its text allows one too, though it is no upgrade. */
const SNARE = stubAttachment({ id: "snare", attachesTo: { kind: "ally" } });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 1, thw: 1, hp: 3 });

const UPGRADE_FOR_AN_ALLY: TargetQuery = { categories: ["upgrade"], canAttachToCategory: "ally" };
/** "Search your deck and discard pile for an upgrade that can be attached to an ally. Add it to your hand." */
const SEARCH = stubAbility("search.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseCards",
      slot: "found",
      from: { kind: "zone", zone: ["deck", "discard"], player: { kind: "controller" }, filter: UPGRADE_FOR_AN_ALLY },
      chooser: { kind: "controller" },
      min: 0,
      max: 1,
    } as never,
    {
      kind: "moveCards",
      cards: { kind: "ref", ref: { kind: "slot", slot: "found" } },
      to: "hand",
      into: { kind: "controller" },
    } as never,
  ],
});
const SEARCH_CARD = stubEvent({ id: "search", cost: 0, abilities: [SEARCH.ref] });
const deps = depsOf(SEARCH);
const CARDS = [...HOSTED, PLAIN, RECRUIT, SEARCH_CARD];

function start(): GameState {
  return gameAtFirstTurn({
    cards: [...CARDS, SNARE],
    deps,
    deck: CARDS.map((card) => card.id),
    encounter: [SNARE.id],
  });
}
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
const idOf = (state: GameState, name: string) =>
  Object.values(state.instances).find((instance) => (instance.cardId as string) === name)!.instanceId;

describe("§3.59 `hostAllowsCategory`: the printed host text alone", () => {
  it.each(Object.entries(YES))("%s allows an ally", (_id, host) => {
    expect(hostAllowsCategory(host, "ally")).toBe(true);
  });
  it.each(Object.entries(NO))("%s does not", (_id, host) => {
    expect(hostAllowsCategory(host, "ally")).toBe(false);
  });
});

describe("§3.59 `TargetQuery.canAttachToCategory`", () => {
  it("Q30 = A: matches by the text with no ally in play, wherever the card is", () => {
    const state = start();
    expect(state.players[0]!.playArea.some((id) => state.instances[id]!.cardId === RECRUIT.id)).toBe(false);
    for (const name of Object.keys(YES))
      expect(explainQuery(state, idOf(state, name), UPGRADE_FOR_AN_ALLY, context)).toBeNull();
    for (const name of Object.keys(NO))
      expect(explainQuery(state, idOf(state, name), UPGRADE_FOR_AN_ALLY, context)).toBe("cannotAttachTo");
  });

  it("an upgrade with no 'attach to' text does not match: it goes by its controller's identity", () => {
    const state = start();
    expect(explainQuery(state, idOf(state, "plain"), UPGRADE_FOR_AN_ALLY, context)).toBe("cannotAttachTo");
    // Nor a card that is not an attaching card at all.
    expect(explainQuery(state, idOf(state, "recruit"), { canAttachToCategory: "ally" }, context)).toBe(
      "cannotAttachTo",
    );
  });

  it("the board is not evaluated: an ally in play that fails the qualifier changes nothing", () => {
    // The recruit has no TEAM trait and is not identity-specific, yet both upgrades still match by their text.
    const state = playerCardIntoPlay(start(), RECRUIT.id).state;
    for (const name of ["to-team-ally", "to-own-ally"])
      expect(explainQuery(state, idOf(state, name), UPGRADE_FOR_AN_ALLY, context)).toBeNull();
    // `canAttachTo`, the other question, reads the cards in play and says no for the same pair.
    const toRecruit: TargetQuery = { canAttachTo: { kind: "each", query: { name: "recruit" } } };
    for (const name of ["to-team-ally", "to-own-ally"])
      expect(explainQuery(state, idOf(state, name), toRecruit, context)).toBe("cannotAttachTo");
  });

  it("the field reads the host text of any card; the category narrows it to upgrades", () => {
    const state = start();
    const snare = idOf(state, "snare");
    expect(explainQuery(state, snare, { canAttachToCategory: "ally" }, context)).toBeNull();
    expect(explainQuery(state, snare, UPGRADE_FOR_AN_ALLY, context)).toBe("wrongCategory");
    expect(selectTargets(state, UPGRADE_FOR_AN_ALLY, context)).toEqual([]);
  });

  it("a search of the deck and discard pile offers exactly those upgrades", () => {
    const base = start();
    // Everything of the test's back into the deck, one matching upgrade into the discard pile.
    const mine = (id: string) => CARDS.some((card) => card.id === base.instances[id as never]!.cardId);
    const seat = base.players[0]!;
    const pile = [...seat.hand, ...seat.deck].filter(mine);
    const discarded = pile.find((id) => (base.instances[id]!.cardId as string) === "to-friendly")!;
    const staged: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((id) => !mine(id)),
              deck: [...pile.filter((id) => id !== discarded), ...p.deck.filter((id) => !mine(id))],
              discard: [...p.discard, discarded],
            }
          : p,
      ),
    };
    const search = giveCard(staged, P1, SEARCH_CARD.id);
    const result = runCommands(search.state, deps, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: search.id,
      payment: [],
      attachToInstanceId: null,
    });
    const asked = result.events.flatMap((e) =>
      e.type === "choiceRequested" && e.choice.prompt.kind === "chooseCards" ? [e.choice.options] : [],
    );
    expect(asked).toHaveLength(1);
    const offered = asked[0]!.map((o) => result.state.instances[o.optionId as never]!.cardId as string).sort();
    expect(offered).toEqual(Object.keys(YES).sort());
  });
});
