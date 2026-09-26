/**
 * docs/phase7-wave4.md §3.26: a friendly character attacks its own player. Synthetic cards shaped like Old Rivals
 * (`nebu` 22031, errata RRG 1.8 p. 67: "When Revealed: Gamora attacks you. If the Gamora hero or ally is in play, she
 * attacks you (resolve her ATK against you without exhausting her). If no attack was made this way, this card gains
 * surge.").
 *
 * Sources: the card's errata'd text; FAQ, RRG 1.8 p. 62 ("Gamora is considered to have attacked, so abilities triggered
 * by her attacking can be resolved"; "allies always take consequential damage after they attack"); RRG 1.8 "Stun"
 * (p. 41); ruling, Jun 25, 2026 (4) #1 (the first sentence is the Gamora minion, the second the hero or ally).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubTreachery } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const gamora: TargetRef = { kind: "each", query: { categories: ["hero", "ally"], name: "Gamora" } };
const RIVALS_REVEALED = stubAbility("rivals.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "friendlyCharacterAttacks", attacker: gamora, player: { kind: "controller" }, bind: "rival" },
    {
      kind: "if",
      condition: { kind: "not", of: { kind: "varAtLeast", name: "rival.made", amount: 1 } },
      then: [{ kind: "gainSurge" }],
    },
  ],
});
const RIVALS = stubTreachery({ id: "old-rivals", boostIcons: 0, abilities: [RIVALS_REVEALED.ref] });
const GAMORA = {
  ...stubAlly({ id: "gamora", cost: 3, atk: 3, thw: 1, hp: 5, consequentialAttack: 1 }),
  name: "Gamora",
};

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const STUN_GAMORA = event("stun-gamora", [{ kind: "giveStatus", target: gamora, status: "stunned" }]);
const deps: EngineDeps = depsOf(RIVALS_REVEALED, REVEAL.ability, STUN_GAMORA.ability);

function start(withGamora: boolean): { state: GameState; gamora: InstanceId | null } {
  const base = gameAtFirstTurn({
    cards: [RIVALS, GAMORA, REVEAL.card, STUN_GAMORA.card],
    deps,
    encounter: [RIVALS.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [GAMORA.id, REVEAL.card.id, STUN_GAMORA.card.id, REVEAL.card.id],
  });
  if (!withGamora) return { state: onTopOfEncounterDeck(base, RIVALS.id), gamora: null };
  const placed = playerCardIntoPlay(base, GAMORA.id);
  return { state: onTopOfEncounterDeck(placed.state, RIVALS.id), gamora: placed.id };
}
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;
const surged = (events: readonly { readonly type: string }[]): boolean =>
  events.some((e) => e.type === "surgeTriggered");

describe("§3.26 a friendly character attacks its own player", () => {
  it("the ally's ATK is dealt to you as her attack, she is not exhausted, takes consequential damage, and no surge", () => {
    const { state, gamora } = start(true);
    const { state: after, events, session } = playFree(state, deps, REVEAL.card.id);
    expect(identityDamage(after)).toBe(3);
    expect(mustInstance(after, gamora!).exhausted).toBe(false);
    expect(mustInstance(after, gamora!).damage).toBe(1);
    expect(events).toContainEqual(expect.objectContaining({ sourceInstanceId: gamora, amount: 3 }));
    expect(surged(events)).toBe(false);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("with no Gamora in play, no attack is made and the card gains surge", () => {
    const { events, state } = playFree(start(false).state, deps, REVEAL.card.id);
    expect(identityDamage(state)).toBe(0);
    expect(surged(events)).toBe(true);
  });

  it("a stunned Gamora discards the stun instead; no attack is made, so the card surges", () => {
    const { state, gamora } = start(true);
    const stunned = playFree(state, deps, STUN_GAMORA.card.id).state;
    const { state: after, events } = playFree(stunned, deps, REVEAL.card.id);
    expect(mustInstance(after, gamora!).statuses.stunned).toBe(0);
    expect(identityDamage(after)).toBe(0);
    expect(surged(events)).toBe(true);
  });
});
