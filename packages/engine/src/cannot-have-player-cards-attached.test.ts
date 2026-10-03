/**
 * `RuleSpec cannotHaveAttachments` by the attaching card's origin (docs/phase7-wave4.md §3.8, wave 6 §3.75). Robert
 * Kelly (`mut_gen` 32066): "He … cannot have player cards attached"; Find the Senator (32065a): "Robert Kelly … cannot
 * have upgrades attached"; Odin (`mts` 21139b): "cannot have encounter cards attached". RRG 1.8 "Player Card" (p. 33):
 * a player card is one from a player's deck, so the origin is read from the card's owner, the upgrade from its type.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { canHaveAttached } from "./rules.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubAttachment, stubEvent, stubUpgrade } from "./testing/fixtures.js";
import { gameAtFirstTurn, playerCardIntoPlay } from "./testing/wave3.js";

type Origin = Extract<RuleSpec, { kind: "cannotHaveAttachments" }>["from"];
const rule = (id: string, from: Origin) =>
  stubAbility(`${id}.constant`, {
    trigger: {
      kind: "constant",
      rules: [{ kind: "cannotHaveAttachments", target: { self: true }, ...(from ? { from } : {}) }],
    },
    effects: [],
  });
const RULES = {
  any: rule("any", undefined),
  encounter: rule("encounter", "encounter"),
  upgrade: rule("upgrade", "upgrade"),
  playerCard: rule("player-card", "playerCard"),
} as const;
const HOSTS = Object.fromEntries(
  Object.entries(RULES).map(([key, stub]) => [
    key,
    stubAlly({ id: `host-${key}`, cost: 0, atk: 1, thw: 1, hp: 3, abilities: [stub.ref] }),
  ]),
) as Record<keyof typeof RULES, ReturnType<typeof stubAlly>>;
const UPGRADE = stubUpgrade({ id: "gadget", cost: 0 });
/** A player's event that a card ability attaches (Rogue's Touched, a facedown event). */
const EVENT = stubEvent({ id: "trick", cost: 0 });
const SHACKLE = stubAttachment({ id: "shackle", name: "Shackle", attachesTo: { kind: "ally" } });
const deps: EngineDeps = depsOf(...Object.values(RULES));

function start() {
  let state: GameState = gameAtFirstTurn({
    cards: [...Object.values(HOSTS), UPGRADE, EVENT, SHACKLE],
    deps,
    deck: [...Object.values(HOSTS).map((card) => card.id), UPGRADE.id, EVENT.id],
    encounter: [SHACKLE.id, SHACKLE.id, SHACKLE.id],
  });
  const hosts = {} as Record<keyof typeof RULES, InstanceId>;
  for (const key of Object.keys(HOSTS) as (keyof typeof RULES)[]) {
    const put = playerCardIntoPlay(state, HOSTS[key].id);
    state = put.state;
    hosts[key] = put.id;
  }
  const of = (cardId: string): InstanceId =>
    Object.values(state.instances).find((instance) => instance.cardId === cardId)!.instanceId;
  return { state, hosts, upgrade: of(UPGRADE.id), event: of(EVENT.id), shackle: of(SHACKLE.id) };
}

describe("cannotHaveAttachments: which cards a host refuses, by `from`", () => {
  const s = start();
  const allowed = (host: keyof typeof RULES) => ({
    upgrade: canHaveAttached(s.state, deps, s.hosts[host], s.upgrade),
    event: canHaveAttached(s.state, deps, s.hosts[host], s.event),
    encounter: canHaveAttached(s.state, deps, s.hosts[host], s.shackle),
  });

  it("'cannot have player cards attached' (Robert Kelly 32066): refuses any card a player owns, takes an encounter card", () => {
    expect(allowed("playerCard")).toEqual({ upgrade: false, event: false, encounter: true });
  });

  it("'cannot have upgrades attached' (Find the Senator 32065a): refuses a player upgrade only", () => {
    expect(allowed("upgrade")).toEqual({ upgrade: false, event: true, encounter: true });
  });

  it("'cannot have encounter cards attached' (Odin 21139b): refuses an encounter card only", () => {
    expect(allowed("encounter")).toEqual({ upgrade: true, event: true, encounter: false });
  });

  it("'cannot have cards attached' (Odin 21139a): refuses every card", () => {
    expect(allowed("any")).toEqual({ upgrade: false, event: false, encounter: false });
  });
});
