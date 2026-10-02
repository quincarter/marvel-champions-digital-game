/**
 * docs/phase7-wave6.md §3.22 (verification, "exists"): Shadowcat's mass form as Vision's shape from wave 4 §3.1
 * (`additional-forms.test.ts`, `vision-kit.ts`). Synthetic cards: a double-sided "Solid" / "Phased" mass form upgrade
 * (Solid 32030a-style front, Phased back), an alter ego whose Setup puts it into play Solid side up, and a Permanently
 * Phased obligation-style upgrade (32055).
 *
 * Sources: RRG 1.8 "Form, Change Form" (p. 21: an additional-form change does not count against the once-per-turn
 * hero/alter-ego limit but does count as changing form for triggering effects); FAQ "Powerful Punch (#14)" (RRG 1.8
 * p. 63) is NOT covered here: it needs the real Powerful Punch card and Shadowcat's attack-labeled interrupt, which
 * belong in the scripting agent's card tests; RRG 1.8 "Defend, Defense" (p. 16) for "while
 * defending"; Shadowcat's printed text per docs/phase7-wave6.md §3.22.
 */

import { unerrataedText, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { evaluate } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubMainScheme, stubSupport, stubUpgrade, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK } from "./testing/scenario.js";
import { copiesOf, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import { flat } from "@mc/content";

const YOUR_IDENTITY: TargetQuery = { categories: ["identity"], controller: "you" };
const form = (kind: "mass"): { name: "form"; formType: string } => ({ name: "form", formType: kind });
const mass = [form("mass"), { name: "permanent" as const }];
const one = { kind: "const", value: 1 } as const;

const forced = (id: string, on: EventPattern, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(id, { trigger: { kind: "response", forced: true, on }, effects } satisfies AbilityDefinition);

// Phased (32031b): "While Shadowcat is defending, she cannot take damage." and "After you attack or defend in Phased
// mass form, flip this card." (the flip is a form change, so it is `changeAdditionalForm`, never a bare `flipCard`).
const PHASED_CONSTANT = stubAbility("phased.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "cannotTakeDamage",
        target: YOUR_IDENTITY,
        while: { kind: "attackInProgress", defender: YOUR_IDENTITY },
      },
    ],
  },
  effects: [],
});
const PHASED_FLIP = forced("phased.flip", { on: "defended", playerIs: "controller" }, [
  { kind: "changeAdditionalForm", player: { kind: "controller" }, formType: "mass", toName: "Solid" },
]);
const SOLID_HEARD = forced("solid.heard", { on: "formChanged", playerIs: "controller", selfIs: "target" }, [
  { kind: "addCounters", target: { kind: "self" }, counterType: "heard", amount: one },
]);
const SOLID: UpgradeCard = {
  ...stubUpgrade({ id: "solid", cost: 0, keywords: mass, abilities: [SOLID_HEARD.ref] }),
  name: "Solid",
  flipSide: {
    name: "Phased",
    traits: [],
    keywords: mass,
    text: unerrataedText("Mass form. Permanent."),
    abilities: [PHASED_CONSTANT.ref, PHASED_FLIP.ref],
  },
};

/** Kitty Pryde's Setup (the Vision precedent, `26001b.setup`): find the mass form upgrade in deck or hand. */
const KITTY_SETUP = stubAbility("kitty.setup", {
  trigger: { kind: "setup" },
  effects: [
    {
      kind: "selectCards",
      slot: "mass",
      cards: {
        kind: "zone",
        zone: ["deck", "hand"],
        player: { kind: "controller" },
        filter: { categories: ["upgrade"], name: "Solid" },
      },
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "mass" }, controller: { kind: "controller" } },
    { kind: "attach", card: { kind: "slot", slot: "mass" }, to: { kind: "each", query: YOUR_IDENTITY } },
  ],
});
const KITTY = stubIdentity({
  id: "kitty",
  hp: 12,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  alterEgoAbilities: [KITTY_SETUP.ref],
});

/** Listens like Ready to Rumble / Perseverance: "after you change form". */
const ANY_CHANGE = forced("tracker.any", { on: "formChanged", playerIs: "controller" }, [
  { kind: "addCounters", target: { kind: "self" }, counterType: "anyChange", amount: one },
]);
const TRACKER = stubSupport({ id: "tracker", cost: 0, abilities: [ANY_CHANGE.ref] });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const massTarget = {
  kind: "each",
  query: { categories: ["upgrade"], controller: "you", printedForm: "mass" },
} as const;
// Solid and Phased's "Flip this card": the form change.
const FLIP_AS_FORM = action("flip-as-form", [
  { kind: "changeAdditionalForm", player: { kind: "controller" }, formType: "mass" },
]);
// The wrong script: a bare flip.
const FLIP_BARE = action("flip-bare", [{ kind: "flipCard", target: massTarget }]);
const TO_PHASED = action("to-phased", [
  { kind: "changeAdditionalForm", player: { kind: "controller" }, formType: "mass", toName: "Phased" },
]);
const LOCK = action("lock", [
  {
    kind: "applyRuleUntil",
    rule: { kind: "cannotChangeForm", player: { kind: "controller" }, formType: "mass" },
    until: "endOfRound",
  },
]);
const EVENTS = [FLIP_AS_FORM, FLIP_BARE, TO_PHASED, LOCK];

/** Permanently Phased (32055): rules only; the flip to Phased is `TO_PHASED`'s effect. */
const PERMANENTLY_PHASED_RULES = stubAbility("permanently-phased.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "cannotAttack", target: { categories: ["enemy"] }, attacker: YOUR_IDENTITY },
      { kind: "cannotDefend", target: YOUR_IDENTITY },
      { kind: "cannotChangeForm", player: { kind: "controller" }, formType: "mass" },
    ],
  },
  effects: [],
});
const PERMANENTLY_PHASED = stubUpgrade({
  id: "permanently-phased",
  cost: 0,
  abilities: [PERMANENTLY_PHASED_RULES.ref],
});

const BRUISER = stubVillain({ id: "bruiser", stages: [{ hp: flat(30), atk: 5, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "kitty-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const deps: EngineDeps = depsOf(
  PHASED_CONSTANT,
  PHASED_FLIP,
  SOLID_HEARD,
  KITTY_SETUP,
  ANY_CHANGE,
  PERMANENTLY_PHASED_RULES,
  ...EVENTS.map((e) => e.ability),
);

function start(): GameState {
  const result = createGame(
    {
      seed: 11,
      cards: [
        ...DEFAULT_CARDS,
        KITTY,
        SOLID,
        TRACKER,
        PERMANENTLY_PHASED,
        BRUISER,
        SCHEME,
        ...EVENTS.map((e) => e.card),
      ],
      villainCardId: BRUISER.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [],
      includeIdentitySets: false,
      players: [
        {
          identityCardId: KITTY.id,
          deck: [
            ...DEFAULT_DECK,
            SOLID.id,
            TRACKER.id,
            PERMANENTLY_PHASED.id,
            ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
          ],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const massId = (state: GameState): InstanceId =>
  (Object.keys(state.instances) as InstanceId[]).find((id) => state.instances[id]?.cardId === SOLID.id)!;
const context = (state: GameState) => ({
  selfInstanceId: mustPlayer(state, P1).identity.instanceId,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});
const inForm = (state: GameState, name: string): boolean => {
  const predicate: Predicate = { kind: "inAdditionalForm", player: { kind: "controller" }, formType: "mass", name };
  return evaluate(state, predicate, context(state));
};
const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;
const trackerId = (state: GameState): InstanceId =>
  mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === TRACKER.id)!;

describe("§3.22 Kitty Pryde's Setup (the Vision precedent)", () => {
  it("puts the mass form upgrade into play, Solid side faceup, attached to her identity", () => {
    const state = start();
    const id = massId(state);
    expect(mustInstance(state, id).flipped).toBe(false);
    expect(mustInstance(state, id).attachedTo).toBe(mustPlayer(state, P1).identity.instanceId);
    expect(inForm(state, "Solid")).toBe(true);
    expect(inForm(state, "Phased")).toBe(false);
  });
});

describe("§3.22 'Flip this card' is a form change (RRG 1.8 'Form, Change Form', p. 21)", () => {
  it("changeAdditionalForm('mass') flips Solid to Phased, counts as changing form, and spends no once-per-round flip", () => {
    const { state, id, tracker } = (() => {
      const base = playerCardIntoPlay(start(), TRACKER.id).state;
      return { state: base, id: massId(base), tracker: trackerId(base) };
    })();
    const after = playFree(state, deps, FLIP_AS_FORM.card.id).state;
    expect(mustInstance(after, id).flipped).toBe(true);
    expect(inForm(after, "Phased")).toBe(true);
    expect(counter(after, tracker, "anyChange")).toBe(1);
    expect(mustPlayer(after, P1).identity.changedFormThisRound).toBe(false);
    // And back again: Phased flips to Solid, hearing "after you change to this form" on Solid.
    const back = playFree(after, deps, FLIP_AS_FORM.card.id).state;
    expect(inForm(back, "Solid")).toBe(true);
    expect(counter(back, tracker, "anyChange")).toBe(2);
    expect(counter(back, id, "heard")).toBe(1);
  });

  it("a bare flipCard does NOT count as a form change, which is why the spec forbids it for Ready to Rumble / Perseverance", () => {
    const base = playerCardIntoPlay(start(), TRACKER.id).state;
    const after = playFree(base, deps, FLIP_BARE.card.id).state;
    expect(inForm(after, "Phased")).toBe(true);
    expect(counter(after, trackerId(after), "anyChange")).toBe(0);
  });

  it("'cannot change mass form' blocks the flip", () => {
    const locked = playFree(start(), deps, LOCK.card.id).state;
    const after = playFree(locked, deps, FLIP_AS_FORM.card.id).state;
    expect(inForm(after, "Solid")).toBe(true);
  });

  it("replays deep-equal", () => {
    const { session } = playFree(start(), deps, FLIP_AS_FORM.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

/** Flips Kitty to hero form, then ends the turn; the villain's attack is defended by the identity when it may be. */
function villainAttack(state: GameState) {
  const identityId = mustPlayer(state, P1).identity.instanceId;
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") {
      return choice.options.some((o) => o.optionId === identityId) ? [identityId] : ["decline"];
    }
    return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
  };
  const flipped = driveSession(startSession(state), deps, [{ type: "changeForm", playerId: P1 }], pick).session.state;
  const step = flipped.step;
  if (step.kind !== "turn") throw new Error(`expected a turn, got ${step.kind}`);
  return driveSession(startSession(flipped), deps, [{ type: "endTurn", playerId: step.activePlayerId }], pick);
}
const damageTaken = (state: GameState): number => mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;

describe("§3.22 Phased: 'While Shadowcat is defending, she cannot take damage'", () => {
  it("Solid defending takes 3 damage: ATK 5 less her DEF 2 (control)", () => {
    const { session } = villainAttack(start());
    expect(damageTaken(session.state)).toBe(3);
  });

  it("Phased defending takes none, and 'after you defend in Phased mass form' flips the card back to Solid", () => {
    const phased = playFree(start(), deps, TO_PHASED.card.id).state;
    expect(inForm(phased, "Phased")).toBe(true);
    const { session } = villainAttack(phased);
    expect(damageTaken(session.state)).toBe(0);
    expect(inForm(session.state, "Solid")).toBe(true);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.22 Permanently Phased (32055)", () => {
  it("'Flip your mass form upgrade to Phased' names the face: Solid becomes Phased, Phased stays Phased and triggers nothing", () => {
    const base = playerCardIntoPlay(start(), TRACKER.id).state;
    const once = playFree(base, deps, TO_PHASED.card.id).state;
    expect(inForm(once, "Phased")).toBe(true);
    expect(counter(once, trackerId(once), "anyChange")).toBe(1);
    const twice = playFree(once, deps, TO_PHASED.card.id).state;
    expect(inForm(twice, "Phased")).toBe(true);
    expect(counter(twice, trackerId(twice), "anyChange")).toBe(1);
  });

  it("'You cannot attack, defend or change mass form': no defense, and the mass form change is blocked", () => {
    const grounded = playerCardIntoPlay(playFree(start(), deps, TO_PHASED.card.id).state, PERMANENTLY_PHASED.id).state;
    const { session } = villainAttack(grounded);
    // She cannot defend, so the attack is undefended; Phased's no-damage clause only covers defending (§3.22).
    expect(damageTaken(session.state)).toBe(5);
    expect(inForm(session.state, "Phased")).toBe(true);
    const tried = playFree(grounded, deps, FLIP_AS_FORM.card.id).state;
    expect(inForm(tried, "Phased")).toBe(true);
  });
});
