/**
 * docs/phase7-wave2.md §12: "After you spend this card" / "When you spend this card" — the `resourcesSpent` trigger
 * event. Synthetic cards; the names in the titles only say which printed text each shape was built for.
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24) steps 5–6; "Cost" (p. 13); "Cost Arrow Icon" (p. 14): "Responses to
 * the text preceding the cost arrow icon resolve before the text following the icon resolves"; "Resource Card"
 * (p. 37): "Some resource cards have card text that is active while using the card to generate resources"; "Response"
 * (p. 38). Ruling, Feb 28, 2026 (1): "Any abilities triggered by paying a cost resolve immediately before the effect
 * following the arrow resolves."
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubResource,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: p1 };
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const hand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});

/** "Hero Response: After you spend this card, draw 1 card." (Pym Particles 12006's shape.) */
const drawOnSpend = (id: string) =>
  stubAbility(
    `${id}.response`,
    def({
      trigger: {
        kind: "response",
        forced: false,
        form: "hero",
        on: { on: "resourcesSpent", selfIs: "source", playerIs: "controller" },
      },
      effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
    }),
  );
const PARTICLES_ABILITY = drawOnSpend("particles");
const PARTICLES = stubResource({ id: "particles", icons: 1, abilities: [PARTICLES_ABILITY.ref] });
const TWIN_ABILITY = drawOnSpend("twin");
const TWIN = stubResource({ id: "twin", icons: 1, abilities: [TWIN_ABILITY.ref] });

/** "Interrupt: When you spend this card to play an ally, …" — narrowed by the card being paid for. */
const ALLY_ONLY_ABILITY = stubAbility(
  "allyonly.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      on: {
        on: "resourcesSpent",
        selfIs: "source",
        playerIs: "controller",
        targetIs: { categories: ["ally"] },
        eventIs: { purpose: "playCard" },
      },
    },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);
const ALLY_ONLY = stubResource({ id: "allyonly", icons: 1, abilities: [ALLY_ONLY_ABILITY.ref] });

const FRIEND = stubAlly({ id: "friend", cost: 2, atk: 1, thw: 1, hp: 3 });
/** "Action: Spend 1 resource → draw 1 card." An in-play card with a resource cost on an ability. */
const GADGET_ABILITY = stubAbility(
  "gadget.action",
  def({
    trigger: { kind: "action" },
    cost: { resources: 1 },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);
const GADGET = stubSupport({ id: "gadget", cost: 0, abilities: [GADGET_ABILITY.ref] });

/** "Hero Interrupt: When you spend this card to play an [Attack] event, that event deals 1 additional damage." (Aggressive Energy 35020's shape.) */
const BOOST_ABILITY = stubAbility(
  "boost.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      form: "hero",
      on: {
        on: "resourcesSpent",
        selfIs: "source",
        playerIs: "controller",
        targetIs: { categories: ["event"] },
        eventIs: { purpose: "playCard" },
      },
    },
    effects: [{ kind: "modifyCardEffect", card: { kind: "eventTarget" }, damage: { kind: "const", value: 1 } }],
  }),
);
const BOOST = stubResource({ id: "boost", icons: 1, abilities: [BOOST_ABILITY.ref] });
/** "Hero Action (attack): deal 2 damage to the villain." */
const STRIKE_ABILITY = stubAbility(
  "strike.action",
  def({
    trigger: { kind: "action", form: "hero" },
    label: ["attack"],
    effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
  }),
);
const STRIKE = stubEvent({ id: "strike", cost: 1, abilities: [STRIKE_ABILITY.ref] });

const ALL: readonly StubAbility[] = [
  PARTICLES_ABILITY,
  TWIN_ABILITY,
  ALLY_ONLY_ABILITY,
  GADGET_ABILITY,
  BOOST_ABILITY,
  STRIKE_ABILITY,
];

function setup(): { deps: EngineDeps; state: GameState } {
  const deps = depsOf(...ALL);
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 0 }] }),
    mainScheme: SCHEME,
    extraCards: [BLANK, PARTICLES, TWIN, ALLY_ONLY, FRIEND, GADGET, BOOST, STRIKE],
    deck: [
      ...[PARTICLES, TWIN, ALLY_ONLY, FRIEND, GADGET, BOOST, STRIKE].flatMap((card) => copies(card.id)),
      ...copies(RESOURCE.id, 12),
    ],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  return { deps, state };
}

/** Accepts every optional trigger offered; everything else as `defaultPick`. */
const acceptTriggers = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};

const spendWindows = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "windowOpened" }> =>
      e.type === "windowOpened" && e.event.kind === "resourcesSpent",
  );
const indexOf = (events: readonly GameEvent[], test: (e: GameEvent) => boolean) => events.findIndex(test);
const drawn = (events: readonly GameEvent[]) => events.filter((e) => e.type === "cardDrawn").length;

describe("§12 'After you spend this card' (the resourcesSpent event)", () => {
  it("offers the spent card's own response and resolves it before the paid-for card enters play (RRG p. 14, p. 24)", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "particles", "res", "friend");
    const [particles, res, friend] = given.ids as [InstanceId, InstanceId, InstanceId];
    const { state: after, events } = runCommandsPicking(given.state, deps, acceptTriggers, toHero, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: friend,
      payment: hand(particles, res),
      attachToInstanceId: null,
    });

    // Offered from the discard pile, controlled by the spender (RRG 1.8 "Resource Card", p. 37).
    const [window] = spendWindows(events);
    expect(window?.timing).toBe("response");
    expect(window?.candidates.map((c) => c.instanceId)).toEqual([particles]);
    expect(mustPlayer(after, p1).discard).toContain(particles);
    expect(mustPlayer(after, p1).playArea).toContain(friend);

    // Step 5 (pay, then its responses) before step 6 (the card commences being played).
    const draw = indexOf(events, (e) => e.type === "cardDrawn");
    const entered = indexOf(
      events,
      (e) => e.type === "cardMoved" && e.instanceId === friend && e.to.kind === "playArea",
    );
    expect(draw).toBeGreaterThanOrEqual(0);
    expect(draw).toBeLessThan(entered);

    // The event names every spent card, the payer, and the card being paid for.
    expect(window?.event).toMatchObject({
      kind: "resourcesSpent",
      cardInstanceIds: [particles, res],
      playerId: p1,
      forPlayerId: p1,
      payingForInstanceId: friend,
      purpose: "playCard",
    });
  });

  it("is a 'Hero Response': not offered in alter-ego form, and a payment nothing reacts to pushes no event", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "particles", "res", "friend");
    const [particles, res, friend] = given.ids as [InstanceId, InstanceId, InstanceId];
    const play: Command = {
      type: "playCard",
      playerId: p1,
      cardInstanceId: friend,
      payment: hand(particles, res),
      attachToInstanceId: null,
    };
    // Alter-ego form: the form gate (RRG 1.8 "Ability", p. 5) drops the only listener, so nothing is announced at all.
    const { events } = runCommandsPicking(given.state, deps, acceptTriggers, play);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "resourcesSpent")).toBe(false);
    expect(drawn(events)).toBe(0);
  });

  it("puts several spent cards' responses in one window, so their controller orders them (RRG 1.8 'Response', p. 38)", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "particles", "twin", "friend");
    const [particles, twin, friend] = given.ids as [InstanceId, InstanceId, InstanceId];
    const { events } = runCommandsPicking(given.state, deps, acceptTriggers, toHero, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: friend,
      payment: hand(particles, twin),
      attachToInstanceId: null,
    });
    const windows = spendWindows(events);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.candidates.map((c) => c.instanceId).sort()).toEqual([particles, twin].sort());
    expect(drawn(events)).toBe(2);
  });

  it("'When you spend this card to play an ally' matches the played card, not an ability's source (targetIs + purpose)", () => {
    const { deps, state } = setup();
    // Paying for an ally: the interrupt is offered.
    const forAlly = giveCards(state, p1, "allyonly", "res", "friend");
    const [allyOnly, res, friend] = forAlly.ids as [InstanceId, InstanceId, InstanceId];
    const played = runCommandsPicking(forAlly.state, deps, acceptTriggers, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: friend,
      payment: hand(allyOnly, res),
      attachToInstanceId: null,
    });
    expect(spendWindows(played.events).map((w) => w.timing)).toEqual(["interrupt"]);

    // Paying an in-play support's ability cost: not an ally being played, so nothing is offered.
    const withGadget = giveCards(state, p1, "gadget", "allyonly");
    const [gadget, allyOnly2] = withGadget.ids as [InstanceId, InstanceId];
    const inPlay = runCommandsPicking(withGadget.state, deps, acceptTriggers, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: gadget,
      payment: [],
      attachToInstanceId: null,
    });
    const used = runCommandsPicking(inPlay.state, deps, acceptTriggers, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: gadget,
      abilityId: GADGET_ABILITY.ref.id,
      payment: hand(allyOnly2),
    });
    expect(spendWindows(used.events)).toEqual([]);
    expect(mustPlayer(used.state, p1).discard).toContain(allyOnly2);
  });

  it("paying an ability's resource cost: the spend response resolves before the ability's effect (ruling Feb 28, 2026 (1))", () => {
    const { deps, state } = setup();
    const given = giveCards(state, p1, "gadget", "particles");
    const [gadget, particles] = given.ids as [InstanceId, InstanceId];
    const inPlay = runCommandsPicking(given.state, deps, acceptTriggers, toHero, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: gadget,
      payment: [],
      attachToInstanceId: null,
    });
    const { events } = runCommandsPicking(inPlay.state, deps, acceptTriggers, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: gadget,
      abilityId: GADGET_ABILITY.ref.id,
      payment: hand(particles),
    });
    const [window] = spendWindows(events);
    expect(window?.event).toMatchObject({ purpose: "ability", payingForInstanceId: gadget });
    const responded = indexOf(events, (e) => e.type === "abilityResolved" && e.abilityId === PARTICLES_ABILITY.ref.id);
    const action = indexOf(events, (e) => e.type === "abilityResolved" && e.abilityId === GADGET_ABILITY.ref.id);
    expect(responded).toBeGreaterThanOrEqual(0);
    expect(responded).toBeLessThan(action);
    expect(drawn(events)).toBe(2);
  });

  it("'…to play an [Attack] event, that event deals 1 additional damage' composes with `modifyCardEffect` on `eventTarget`", () => {
    const { deps, state } = setup();
    const villainDamage = (after: GameState) => mustInstance(after, after.villains[0]?.instanceId as InstanceId).damage;
    const fire = (payWith: string) => {
      const given = giveCards(state, p1, payWith, "strike");
      const [paid, strike] = given.ids as [InstanceId, InstanceId];
      return runCommandsPicking(given.state, deps, acceptTriggers, toHero, {
        type: "playCard",
        playerId: p1,
        cardInstanceId: strike,
        payment: hand(paid),
        attachToInstanceId: null,
      }).state;
    };
    // The interrupt runs before the event commences being played, so the bonus is on the card when its damage is dealt.
    expect(villainDamage(fire("boost"))).toBe(3);
    expect(villainDamage(fire("res"))).toBe(2);
  });
});
