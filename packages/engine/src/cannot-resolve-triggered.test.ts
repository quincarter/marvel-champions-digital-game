/**
 * docs/phase7-wave5.md §4.1 Q70: `RuleSpec cannotResolveTriggeredAbilities`, "You cannot resolve triggered abilities in
 * your hero's printed text box. (Triggered abilities are ones with bold timing triggers.)" (Induced Panic, `sm` 27153),
 * on a synthetic identity and a synthetic attachment.
 *
 * Sources: RRG 1.8 "Ability" (p. 4: a bold timing trigger makes an ability triggered), "Action" (p. 6: an action is a
 * triggered ability), "'Cannot'" (p. 11), "Forced" (p. 20).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterProfile, mustPlayer } from "./query.js";
import { candidatesFor } from "./resolve/triggers.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubIdentity, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, newGame, runWith, settle } from "./testing/scenario.js";
import type { TriggerEvent } from "./trigger-events.js";

const p1 = playerId("p1");
const def = (d: AbilityDefinition) => d;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const onTurnStarted = { on: "turnStarted" } as const;
const mark = (type: string) =>
  ({ kind: "addCounters", target: { kind: "self" }, counterType: type, amount: { kind: "const", value: 1 } }) as const;

// The hero face: a Response, a Forced Response, a Hero Action, a Hero Resource and a constant.
const heroResponse = stubAbility(
  "id.hero-response",
  def({ trigger: { kind: "response", forced: false, on: onTurnStarted }, effects: [mark("response")] }),
);
const heroForced = stubAbility(
  "id.hero-forced",
  def({ trigger: { kind: "response", forced: true, on: onTurnStarted }, effects: [mark("forced")] }),
);
const heroAction = stubAbility(
  "id.hero-action",
  def({ trigger: { kind: "action", form: "hero" }, effects: [mark("action")] }),
);
const heroResource = stubAbility(
  "id.hero-resource",
  def({ trigger: { kind: "resource", form: "hero" }, generates: 1, effects: [] }),
);
const heroConstant = stubAbility(
  "id.hero-constant",
  def({
    trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 1, target: { self: true } }] },
    effects: [],
  }),
);
// The alter-ego face: a Response on the same event.
const alterEgoResponse = stubAbility(
  "id.alter-ego-response",
  def({ trigger: { kind: "response", forced: false, on: onTurnStarted }, effects: [mark("alterEgo")] }),
);
const IDENTITY = stubIdentity({
  id: "panicky",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroAbilities: [heroResponse.ref, heroForced.ref, heroAction.ref, heroResource.ref, heroConstant.ref],
  alterEgoAbilities: [alterEgoResponse.ref],
});

const INDUCED_PANIC_RULE: RuleSpec = {
  kind: "cannotResolveTriggeredAbilities",
  on: { categories: ["identity"], hostOfSelf: true },
  identityFace: "hero",
};
const panicConstant = stubAbility(
  "panic.constant",
  def({ trigger: { kind: "constant", rules: [INDUCED_PANIC_RULE] }, effects: [] }),
);
const PANIC = stubAttachment({ id: "panic", attachesTo: { kind: "yourIdentity" }, abilities: [panicConstant.ref] });
// A 1-cost support to pay for with the Hero Resource.
const GADGET = stubSupport({ id: "gadget", cost: 1 });

const deps: EngineDeps = depsOf(
  heroResponse,
  heroForced,
  heroAction,
  heroResource,
  heroConstant,
  alterEgoResponse,
  panicConstant,
);

const identityOf = (state: GameState): InstanceId => mustPlayer(state, p1).identity.instanceId;

/** p1 in hero form (or alter-ego), with Induced Panic's stand-in attached to their identity when asked for. */
function board(opts: { readonly panic: boolean; readonly form?: "hero" | "alterEgo" }): GameState {
  const start = newGame({
    identity: IDENTITY,
    extraCards: [PANIC, GADGET],
    encounterDeck: copies(PANIC.id, 12),
    deck: [...DEFAULT_DECK, GADGET.id],
    deps,
  });
  let state =
    (opts.form ?? "hero") === "hero"
      ? settle(runWith(deps, start, { type: "changeForm", playerId: p1 }), undefined, deps)
      : start;
  if (!opts.panic) return state;
  // Test surgery: one copy out of the encounter deck, faceup, attached to p1's identity.
  const [deckId] = state.encounterDeckOrder;
  const piles = state.encounterDecks[deckId as string]!;
  const panic = piles.deck[0]!;
  const identity = identityOf(state);
  state = {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId as string]: { ...piles, deck: piles.deck.slice(1) } },
    instances: {
      ...state.instances,
      [panic]: { ...state.instances[panic]!, faceup: true, attachedTo: identity },
      [identity]: { ...state.instances[identity]!, attachments: [...state.instances[identity]!.attachments, panic] },
    },
  };
  return state;
}

const turnStarted: TriggerEvent = { kind: "turnStarted", playerId: p1 };
const offered = (state: GameState, forced: boolean): readonly string[] =>
  candidatesFor(state, deps, turnStarted, "response", forced).map((c) => String(c.abilityId));
const useAction: Command = {
  type: "useAbility",
  playerId: p1,
  cardInstanceId: "" as InstanceId,
  abilityId: heroAction.ref.id,
  payment: [],
};
const legalAbilityIds = (state: GameState): readonly string[] => {
  const actions = legalActions(state, p1, deps);
  return actions.kind === "turn"
    ? actions.legal.flatMap((a) => (a.action.kind === "useAbility" ? [String(a.action.abilityId)] : []))
    : [];
};

describe("§4.1 Q70 cannotResolveTriggeredAbilities (Induced Panic)", () => {
  it("stops the hero face's Response and Forced Response: neither is offered nor initiated", () => {
    const free = board({ panic: false });
    expect(offered(free, false)).toContain(String(heroResponse.ref.id));
    expect(offered(free, true)).toContain(String(heroForced.ref.id));

    const panicked = board({ panic: true });
    expect(offered(panicked, false)).not.toContain(String(heroResponse.ref.id));
    // RRG 1.8 "'Cannot'" (p. 11) is absolute: a forced ability that cannot be resolved is skipped.
    expect(offered(panicked, true)).not.toContain(String(heroForced.ref.id));
  });

  it("stops the hero face's Hero Action (an action is a triggered ability, RRG 1.8 p. 6)", () => {
    const free = board({ panic: false });
    const command = { ...useAction, cardInstanceId: identityOf(free) };
    expect(legalAbilityIds(free)).toContain(String(heroAction.ref.id));
    expect(applyCommand(free, command, deps).ok).toBe(true);

    const panicked = board({ panic: true });
    expect(legalAbilityIds(panicked)).not.toContain(String(heroAction.ref.id));
    const result = applyCommand(panicked, { ...command, cardInstanceId: identityOf(panicked) }, deps);
    expect(result.ok).toBe(false);
  });

  it("stops the hero face's Hero Resource from paying", () => {
    const pay = (state: GameState) => {
      const given = giveCard(state, p1, GADGET.id);
      return applyCommand(
        given.state,
        {
          type: "playCard",
          playerId: p1,
          cardInstanceId: given.id,
          payment: [{ ability: { instanceId: identityOf(given.state), abilityId: heroResource.ref.id } }],
          attachToInstanceId: null,
        },
        deps,
      ).ok;
    };
    expect(pay(board({ panic: false }))).toBe(true);
    expect(pay(board({ panic: true }))).toBe(false);
  });

  it("leaves the hero face's constant alone", () => {
    const atk = (state: GameState) => characterProfile(state, identityOf(state), deps)?.atk;
    expect(atk(board({ panic: true }))).toBe(atk(board({ panic: false })));
    expect(atk(board({ panic: true }))).toBe(3);
  });

  it("leaves the alter-ego face's triggered abilities alone", () => {
    const panicked = board({ panic: true, form: "alterEgo" });
    expect(mustPlayer(panicked, p1).identity.form).toBe("alterEgo");
    expect(offered(panicked, false)).toContain(String(alterEgoResponse.ref.id));
  });
});
