/**
 * docs/phase7-wave8.md §3.53: "Attach to an identity-specific ally you control." A classification named outright, as a
 * query (`TargetQuery.classification`) and as an attach host's qualifier (`HostQualifiers.classification`, read by the
 * host resolver every play, put into play and `canAttachTo` shares). Synthetic cards: a "badge" upgrade with that host
 * text, and allies of each classification.
 *
 * Sources: RRG 1.8 "Classifications" (p. 12), "Identity-Specific Card" (p. 23), "Attach To" (p. 8: "checked for
 * legality when the card would be attached"), "Ownership and Control" (p. 31), "Play" (p. 24 step 2: a card with no
 * valid host cannot be played).
 */

import type { UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { upgradeHostCandidates } from "./attachment-hosts.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { explainQuery, selectTargets } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubAlly, stubUpgrade } from "./testing/fixtures.js";
import { giveCard, HERO } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const ally = (id: string, aspect: string) => stubAlly({ id, cost: 0, atk: 1, thw: 1, hp: 3, aspect: aspect as never });
/** An ally of the first seat's own identity set, and one of another identity's set. */
const OWN = ally("own", `hero:${HERO.id}`);
const OTHERS = ally("others", "hero:someone-else");
const ASPECT = ally("aspect", "leadership");
const BASIC = ally("basic", "basic");
/** Identity-specific and aspect at once (`printedAspect`). */
const SPLIT = { ...ally("split", "hero:someone-else"), printedAspect: "justice" as const };
const ALLIES = [OWN, OTHERS, ASPECT, BASIC, SPLIT];

const hosted = (id: string, attachesTo: NonNullable<UpgradeCard["attachesTo"]>): UpgradeCard => ({
  ...stubUpgrade({ id, cost: 0 }),
  attachesTo,
});
/** "Attach to an identity-specific ally you control." */
const BADGE = hosted("badge", {
  kind: "qualified",
  category: "ally",
  classification: "identitySpecific",
  controlledBy: "you",
});
/** "Attach to a basic ally.", anyone's. */
const PIN = hosted("pin", { kind: "qualified", category: "ally", classification: "basic" });
/** "Attach to the aspect ally with the highest printed hit points." */
const RIBBON = hosted("ribbon", {
  kind: "superlative",
  among: "ally",
  measure: "printedHp",
  order: "highest",
  classification: "aspect",
});

const deps: EngineDeps = depsOf();
const CARDS = [...ALLIES, BADGE, PIN, RIBBON];

function start(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.map((card) => card.id), players });
}
/** Puts each named ally into `player`'s play area by surgery; returns the ids by name. */
function withAllies(state: GameState, names: readonly string[], player = P1) {
  const ids: Record<string, InstanceId> = {};
  let current = state;
  for (const name of names) {
    const placed = playerCardIntoPlay(current, name as never, player);
    current = placed.state;
    ids[name] = placed.id;
  }
  return { state: current, ids };
}
const play = (state: GameState, card: InstanceId, host: InstanceId | null) =>
  applyCommand(
    state,
    { type: "playCard", playerId: P1, cardInstanceId: card, payment: [], attachToInstanceId: host },
    deps,
  );
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
const names = (state: GameState, ids: readonly InstanceId[]) =>
  ids.map((id) => state.instances[id]!.cardId as string).sort();

describe("§3.53 `HostQualifiers.classification`: the attach host resolver", () => {
  it("an identity-specific ally and an aspect ally in play: only the identity-specific one is a host", () => {
    const { state, ids } = withAllies(start(), ["own", "aspect", "basic"]);
    const badge = giveCard(state, P1, BADGE.id);
    expect(upgradeHostCandidates(badge.state, deps, badge.id, P1)).toEqual([ids.own]);
    // The play itself is refused on the aspect ally and accepted on the identity-specific one.
    expect(play(badge.state, badge.id, ids.aspect!).ok).toBe(false);
    expect(play(badge.state, badge.id, ids.basic!).ok).toBe(false);
    const played = play(badge.state, badge.id, ids.own!);
    expect(played.ok).toBe(true);
    if (played.ok) expect(played.state.instances[badge.id]!.attachedTo).toBe(ids.own);
  });

  it("with only an aspect ally in play there is no valid host and the card cannot be played", () => {
    const { state, ids } = withAllies(start(), ["aspect"]);
    const badge = giveCard(state, P1, BADGE.id);
    expect(upgradeHostCandidates(badge.state, deps, badge.id, P1)).toEqual([]);
    expect(play(badge.state, badge.id, ids.aspect!).ok).toBe(false);
    expect(play(badge.state, badge.id, null).ok).toBe(false);
  });

  it("identity-specific is any identity's set: another identity's ally under this player's control is a host", () => {
    const { state, ids } = withAllies(start(), ["others", "split"]);
    const badge = giveCard(state, P1, BADGE.id);
    expect(upgradeHostCandidates(badge.state, deps, badge.id, P1)).toEqual([ids.others, ids.split]);
    expect(play(badge.state, badge.id, ids.others!).ok).toBe(true);
  });

  it("'you control' still binds: another player's identity-specific ally, and one no player controls, are refused", () => {
    const theirs = withAllies(start(2), ["own"], P2);
    const mine = withAllies(theirs.state, ["own"], P1);
    const badge = giveCard(mine.state, P1, BADGE.id);
    expect(upgradeHostCandidates(badge.state, deps, badge.id, P1)).toEqual([mine.ids.own]);
    expect(play(badge.state, badge.id, theirs.ids.own!).ok).toBe(false);
    // The ally loses its controller (an ally at a mission, a captive): not "an ally you control".
    const loose: GameState = {
      ...badge.state,
      instances: {
        ...badge.state.instances,
        [mine.ids.own!]: { ...badge.state.instances[mine.ids.own!]!, controllerId: null },
      },
    };
    expect(upgradeHostCandidates(loose, deps, badge.id, P1)).toEqual([]);
  });

  it("the classification alone, with no 'you control': any player's basic ally", () => {
    const theirs = withAllies(start(2), ["basic", "aspect"], P2);
    const pin = giveCard(theirs.state, P1, PIN.id);
    expect(upgradeHostCandidates(pin.state, deps, pin.id, P1)).toEqual([theirs.ids.basic]);
  });

  it("a superlative host is narrowed by the classification before it is ranked", () => {
    // Every ally has 3 printed hit points; only the aspect ones are ranked ("split" prints an aspect too).
    const { state, ids } = withAllies(start(), ["own", "aspect", "basic", "split"]);
    const ribbon = giveCard(state, P1, RIBBON.id);
    expect(upgradeHostCandidates(ribbon.state, deps, ribbon.id, P1)).toEqual([ids.aspect, ids.split]);
  });

  it("`canAttachTo` asks the same resolver: the upgrade in hand matches only against a host of the classification", () => {
    const { state, ids } = withAllies(start(), ["own", "aspect"]);
    const badge = giveCard(state, P1, BADGE.id);
    const to = (name: string) => ({ canAttachTo: { kind: "each", query: { name } } as const });
    expect(ids.own).toBeDefined();
    expect(explainQuery(badge.state, badge.id, to("own"), context)).toBeNull();
    expect(explainQuery(badge.state, badge.id, to("aspect"), context)).toBe("cannotAttachTo");
  });
});

describe("§3.53 `TargetQuery.classification`", () => {
  it("selects the allies in play of each classification; an identity-specific card printing an aspect is in both", () => {
    const { state } = withAllies(start(), ["own", "others", "aspect", "basic", "split"]);
    const of = (classification: "identitySpecific" | "aspect" | "basic") =>
      names(state, selectTargets(state, { categories: ["ally"], classification }, context));
    expect(of("identitySpecific")).toEqual(["others", "own", "split"]);
    expect(of("aspect")).toEqual(["aspect", "split"]);
    expect(of("basic")).toEqual(["basic"]);
  });

  it("an identity card is identity-specific; an encounter card has none of the three (`wrongClassification`)", () => {
    const state = start();
    const identity = state.players[0]!.identity.instanceId;
    expect(explainQuery(state, identity, { classification: "identitySpecific" }, context)).toBeNull();
    expect(explainQuery(state, identity, { classification: "basic" }, context)).toBe("wrongClassification");
    for (const classification of ["identitySpecific", "aspect", "basic"] as const)
      expect(explainQuery(state, state.activeVillainId, { classification }, context)).toBe("wrongClassification");
  });

  it("reads card data, so a card out of play (in the deck or the hand) matches too", () => {
    const state = start();
    const player = state.players[0]!;
    const outOfPlay = [...player.deck, ...player.hand].find((id) => (state.instances[id]!.cardId as string) === "own")!;
    expect(explainQuery(state, outOfPlay, { classification: "identitySpecific" }, context)).toBeNull();
    expect(explainQuery(state, outOfPlay, { classification: "aspect" }, context)).toBe("wrongClassification");
  });
});
