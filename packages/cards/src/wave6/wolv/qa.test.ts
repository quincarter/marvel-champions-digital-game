import { cardId } from "@mc/content";
import {
  activeVillain,
  cardsInPlay,
  characterProfile,
  createGame,
  replay,
  sessionApply,
  startSession,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  endTurn,
  type Picker,
} from "../../testing/harness.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand,
  revealFromEncounterDeck,
  stackSetAside,
  withForm,
} from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { wolverineGame } from "./wolverine/support.js";

/**
 * Wave 6 rules QA, Wolverine pack (`docs/phase7-wave6-qa-wolverine-storm.md`). Two parts.
 *
 * 1. Rulings and errata that touch a card of the pack (Wolverine, his nemesis set and the Lady Deathstrike modular set).
 *    Already pinned exactly by a module test, so not copied here:
 *    - Erratum RRG 1.8 p. 68, Logan (#1A): "Setup: Put Wolverine's Claws into play": `wolverine/identity.test.ts`
 *      "35001b.logan-constant (Snikt! Setup)" (three tests: into play from set aside, attached, not drawn or shuffled).
 *    - Erratum RRG 1.8 p. 68, Berserker Barrage (#8), "you may take 2 damage to repeat this ability": `wolverine/
 *      events.test.ts` "Berserker Barrage (35008)" (decline, accept with a fresh target, repeat that defeats nothing).
 *    - Ruling Jul 9, 2026 (3) #4 (Aggressive Energy does not add to the damage Wolverine takes): `wolverine/events.test.ts`
 *      "Berserker Barrage (35008) with Aggressive Energy (35020)" and the same through `sessionApply` in `wolverine/
 *      e2e.test.ts`.
 *    - Ruling Jun 2, 2026 (1), Jubilee stacks per trigger: `wolverine/support-upgrades-allies.test.ts` "each trigger
 *      stacks". The other halves of that ruling (a flip of form, a different instance or version of Jubilee or Wolverine)
 *      are below.
 *    - Ruling Mar 19, 2026 (2) is Storm's pack (The Shadow King). No other erratum or FAQ entry names a card of this pack.
 *    New below: Jubilee's three remaining clauses, FAQ "Dance of Death (#4)" (p. 59) for Slice and Dice, RRG "Permanent"
 *    (p. 32) against Caught Off Guard for the Claws, RRG FAQ "Unflappable" (p. 60) against Omega Red's interrupt and
 *    Berserker Frenzy, and four card-against-card interactions (Carbonadium Synthesizer against Berserker Barrage's
 *    repeat, Death Factor against Healing Factor, Hack 'n' Slash against Berserker Frenzy).
 * 2. Whole games with Wolverine's precon: 2 players standard (with Storm) and 1 hero expert, played by the greedy
 *    driver and replayed deep-equal, one asserting Healing Factor and Berserker Barrage, one with the Lady Deathstrike
 *    modular set, and one per shape whose first turn is staged to use Wolverine's Claws (the driver never uses it).
 */

const DEPS = WAVE6_DEPS;
const ADVANCE = "01186";
const CLAWS_ABILITY = "35002.wolverines-claws-action";
const heroGame = (options: Parameters<typeof wolverineGame>[1] = {}): GameState =>
  withForm(wolverineGame("rhino", { seed: 1, ...options }), { heroForm: 0 });
const me = (state: GameState): InstanceId => identityOf(state, P1);
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, DEPS)!;
const stunVillain = (state: GameState): GameState =>
  patchInstance(state, villainOf(state), { statuses: { ...inst(state, villainOf(state)).statuses, stunned: 1 } });
const targeting =
  (id: InstanceId, rest: Picker = firstLegal): Picker =>
  (s) =>
    s.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : rest(s);
const offeredHas = (state: GameState, text: string): boolean =>
  state.pendingChoice?.options.some((o) => `${o.optionId} ${o.label}`.includes(text)) ?? false;
const basicAttack = (attacker: InstanceId, target: InstanceId) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }) as never;
const dealt = (before: GameState, after: GameState, id: InstanceId) => inst(after, id).damage - inst(before, id).damage;

/** `code` taken from the first Wolverine-deck card and put into play ready under P1 (surgery), as a card of another version. */
function allyBySurgery(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).deck[0]!;
  return {
    id,
    state: {
      ...patchInstance(state, id, { cardId: cardId(code), faceup: true, exhausted: false, controllerId: P1 }),
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}

/** Takes the card out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attach(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const { state: staged, ids } = moveToHand(state, P1, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}

describe("rulings", () => {
  describe("Ruling Jun 2, 2026 (1): Jubilee's +2 ATK is keyed on the chosen enemy, not on card instances", () => {
    // "Does it apply to new instances of Jubilee, flipping form, or Cameo Jubilee + ally Wolverine?" The ruling: it
    // targets the chosen enemy, not specific card instances, "functioning identically with Cameo / ally versions".
    const aimingJubilee =
      (enemy: InstanceId): Picker =>
      (state) => {
        const choice = state.pendingChoice;
        if (!choice) return [];
        if (choice.options.some((o) => o.optionId === enemy)) return [enemy];
        const take = choice.options.find((o) => o.optionId.includes("35003.jubilee-response"));
        return take ? [take.optionId] : firstLegal(state);
      };
    const cheered = (base: GameState) => {
      const villain = villainOf(base);
      return { ...playFromHand(DEPS, base, "35003", 2, aimingJubilee(villain)), villain };
    };
    const attack = (state: GameState, attacker: InstanceId, target: InstanceId): GameState =>
      settle(runWith(DEPS, state, basicAttack(attacker, target)), () => [], undefined, DEPS);

    it("flipping form: Jubilee played as Logan, then Wolverine flips to hero form and his basic attack still gets +2", () => {
      const { state: cheeredAsLogan, villain } = cheered(wolverineGame("rhino", { seed: 1 }));
      expect(playerOf(cheeredAsLogan, P1).identity.form).toBe("alterEgo");
      const flipped = settle(runWith(DEPS, cheeredAsLogan, toHero(P1)), firstLegal, undefined, DEPS);
      expect(playerOf(flipped, P1).identity.form).toBe("hero");
      const atk = profile(flipped, me(flipped)).atk;
      expect(dealt(flipped, attack(flipped, me(flipped), villain), villain)).toBe(atk + 2);
    });

    it("a new instance of Jubilee (the Mutant Genesis ally, another card titled Jubilee) entering later gets +2 too", () => {
      const { state, villain } = cheered(heroGame());
      const { state: withOther, id: other } = allyBySurgery(state, "32088b");
      expect(state.cardPool[cardId("32088b")]).toBeDefined();
      const atk = profile(withOther, other).atk;
      expect(dealt(withOther, attack(withOther, other, villain), villain)).toBe(atk + 2);
    });

    it("an ally version of Wolverine (Mutant Genesis 32041) in play gets +2 as well, and a basic attack elsewhere does not", () => {
      const { state, villain } = cheered(heroGame());
      const { state: withOther, id: other } = allyBySurgery(state, "32041");
      const atk = profile(withOther, other).atk;
      expect(dealt(withOther, attack(withOther, other, villain), villain)).toBe(atk + 2);
      // A guard minion would block the villain, so the minion is added only for the second attack.
      // Whiplash (more hit points than the hit) so the attack never defeats it.
      const engaged = engageMinion(withOther, "01101", P1);
      const minion = engaged.id;
      const foe = patchInstance(engaged.state, minion, { cardId: cardId("01172") });
      expect(dealt(foe, attack(foe, other, minion), minion)).toBe(atk);
    });
  });

  describe("FAQ 'Dance of Death (#4)' (RRG 1.8 p. 59): each damage-dealing effect is its own attack; a stun cancels only the first", () => {
    // Slice and Dice (35009) is the same shape (two separate attacks, each choosing its enemy; scripted with
    // `allowUnlabeledAttack` citing this entry). `wolverine/events.test.ts` pins the two attacks; the stun is new.
    const cast = (state: GameState): GameState => {
      const given = moveToHand(state, P1, "35009");
      const id = given.ids[0]!;
      return settle(
        runWith(DEPS, given.state, play(P1, id, payWith(given.state, P1, 3, [id]))),
        firstLegal,
        undefined,
        DEPS,
      );
    };

    it("a stunned Wolverine's first attack is prevented and the second resolves: the villain takes 3, not 6", () => {
      const base = heroGame();
      const stunned = patchInstance(base, me(base), { statuses: { ...inst(base, me(base)).statuses, stunned: 1 } });
      const after = cast(stunned);
      expect(dealt(base, after, villainOf(base))).toBe(3);
      expect(inst(after, me(after)).statuses.stunned ?? 0).toBe(0);
    });

    it("control: not stunned, both attacks land", () => {
      const base = heroGame();
      expect(dealt(base, cast(base), villainOf(base))).toBe(6);
    });
  });

  describe("RRG 1.8 'Permanent' (p. 32): Wolverine's Claws is not discarded by a card of another set", () => {
    // Caught Off Guard (01188, Core): "When Revealed: Discard an upgrade or support you control. If no cards were
    // discarded this way, this card gains surge." The RRG: a permanent card "is not a valid target for card effects that
    // would cause the permanent card to leave play ... that effect instead targets the non-permanent card that fits".
    const quietReveal = (state: GameState) => {
      const villain = villainOf(state);
      const stalled = patchInstance(state, villain, {
        statuses: { ...inst(state, villain).statuses, stunned: 1, confused: 1 },
      });
      return driveEventsPicking(DEPS, stackEncounterDeck(stalled, "01188", ADVANCE), firstLegal, endTurn(P1));
    };

    it("with the Claws as the only upgrade, nothing is discarded and Caught Off Guard gains surge", () => {
      const base = heroGame();
      const claws = instancesOf(base, "35002")[0]!;
      expect(inst(base, claws).attachedTo).toBe(me(base));
      const { state, events } = quietReveal(base);
      expect(inst(state, claws).attachedTo).toBe(me(state));
      expect(cardsInPlay(state)).toContain(claws);
      expect(playerOf(state, P1).discard).not.toContain(claws);
      expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
    });

    it("with another upgrade attached, that one is discarded instead and there is no surge", () => {
      const base = heroGame();
      const claws = instancesOf(base, "35002")[0]!;
      const { state: armed, id: skeleton } = attach(base, "35004", me(base));
      const { state, events } = quietReveal(armed);
      expect(cardsInPlay(state)).toContain(claws);
      expect(cardsInPlay(state)).not.toContain(skeleton);
      expect(playerOf(state, P1).discard).toContain(skeleton);
      expect(events.some((e) => e.type === "surgeTriggered")).toBe(false);
    });
  });

  describe("FAQ 'Unflappable' (RRG 1.8 p. 60): damage from another ability during an attack is not damage from the attack", () => {
    // Omega Red's Forced Interrupt (35028) deals 1 damage to each character you control "when he attacks you". The FAQ
    // separates a Boost ability's damage from the attacking enemy's damage during the same attack; Berserker Frenzy
    // (35005) answers "damage from an enemy attack", so a defended attack plus the interrupt's 1 damage must not draw.
    const board = () => {
      const { state: red } = revealFromEncounterDeck(DEPS, stunVillain(heroGame()), "35028", firstLegal, 0);
      const { state: armed } = attach(red, "35005", me(red));
      const { state: allied, id: jubilee } = playFromHand(DEPS, armed, "35003", 2);
      // The reveal above already used the stun on Rhino (his attack was cancelled that round): stun him again.
      return { state: stackEncounterDeck(stunVillain(allied), ADVANCE, ADVANCE), jubilee };
    };
    const villainPhase = (start: GameState, defender: InstanceId | null) => {
      let offered = false;
      const pick: Picker = (s) => {
        if (offeredHas(s, "35005.berserker-frenzy-response")) {
          offered = true;
          return s.pendingChoice!.options.filter((o) => o.optionId.includes("berserker-frenzy")).map((o) => o.optionId);
        }
        if (s.pendingChoice?.prompt.kind === "declareDefender") return [defender ?? "decline"];
        return firstLegal(s);
      };
      const out = driveEventsPicking(DEPS, start, pick, endTurn(P1));
      return { ...out, offered };
    };

    it("the ally defends: Wolverine took 1 from the interrupt and nothing from the attack, so Frenzy is not offered", () => {
      const { state, jubilee } = board();
      const { state: after, offered, events } = villainPhase(state, jubilee);
      expect(
        events.some(
          (e) => e.type === "abilityResolved" && e.abilityId === ("35028.omega-red-forced-interrupt" as never),
        ),
      ).toBe(true);
      expect(inst(after, me(after)).damage).toBe(1);
      expect(offered).toBe(false);
    });

    it("control: undefended, the attack's own damage lands and Frenzy is offered", () => {
      const { state } = board();
      const { state: after, offered } = villainPhase(state, null);
      expect(inst(after, me(after)).damage).toBeGreaterThan(1);
      expect(offered).toBe(true);
    });
  });
});

describe("interactions between cards of the pack", () => {
  describe("Berserker Barrage (erratum p. 68, 'if this attack defeats an enemy') against an Omega Red the Carbonadium Synthesizer keeps alive", () => {
    const strike = (withScheme: boolean) => {
      const { state: red, id } = revealFromEncounterDeck(DEPS, stunVillain(heroGame()), "35028", firstLegal, 0);
      let state = patchInstance(red, id, { damage: 7 });
      if (withScheme) state = encounterCardInVillainArea(stackSetAside(state, "35029"), "35029", 1).state;
      const given = moveToHand(state, P1, "35008");
      const barrage = given.ids[0]!;
      let repeatOffered = false;
      const pick: Picker = (s) => {
        if (offeredHas(s, "Take 2 damage")) {
          repeatOffered = true;
          return [s.pendingChoice!.options.find((o) => o.label.includes("Do not repeat"))!.optionId];
        }
        return targeting(id)(s);
      };
      const after = settle(
        runWith(DEPS, given.state, play(P1, barrage, payWith(given.state, P1, 2, [barrage]))),
        pick,
        undefined,
        DEPS,
      );
      return { after, id, repeatOffered };
    };

    it("with the side scheme in play: Omega Red is not defeated and no repeat is offered", () => {
      const { after, id, repeatOffered } = strike(true);
      expect(cardsInPlay(after)).toContain(id);
      expect(repeatOffered).toBe(false);
    });

    it("control: without it the same attack defeats him and the repeat is offered", () => {
      const { after, id, repeatOffered } = strike(false);
      expect(cardsInPlay(after)).not.toContain(id);
      expect(repeatOffered).toBe(true);
    });
  });

  it("Healing Factor (35001a) is not a basic recovery: Death Factor's interrupt (Q20, basic recovery only) is not offered for it", () => {
    // Hero form: Rhino attacks (the stun is spent by the reveal turn), so no boost card is consumed (fillers 0).
    const { state: attached, id: factor } = revealFromEncounterDeck(
      DEPS,
      stunVillain(heroGame()),
      "35030",
      firstLegal,
      0,
    );
    const hurt = patchInstance(stunVillain(attached), me(attached), { damage: 5, exhausted: false });
    let interruptOffered = false;
    const pick: Picker = (s) => {
      if (offeredHas(s, "death-factor-interrupt")) interruptOffered = true;
      if (offeredHas(s, "35001a.wolverine-constant")) {
        return s.pendingChoice!.options.filter((o) => o.optionId.includes("35001a")).map((o) => o.optionId);
      }
      return firstLegal(s);
    };
    const quiet = stackEncounterDeck(hurt, ADVANCE);
    const { state: after } = driveEventsPicking(DEPS, quiet, pick, endTurn(P1));
    // Death Factor's Forced Response takes 1 at the end of the turn (5 + 1), Healing Factor heals 2 at the next player phase.
    expect(inst(after, me(after)).damage).toBe(4);
    expect(interruptOffered).toBe(false);
    expect(cardsInPlay(after)).toContain(factor);
  });

  it("Hack 'n' Slash (35037) revealed in hero form takes damage that is not from an enemy attack: Berserker Frenzy is not offered", () => {
    const base = heroGame({ modularSetIds: ["deathstrike"] });
    const { state: armed } = attach(base, "35005", me(base));
    const stalled = patchInstance(armed, villainOf(armed), {
      statuses: { ...inst(armed, villainOf(armed)).statuses, stunned: 1, confused: 1 },
    });
    let offered = false;
    const pick: Picker = (s) => {
      if (offeredHas(s, "35005.berserker-frenzy-response")) offered = true;
      return firstLegal(s);
    };
    const { state, events } = driveEventsPicking(DEPS, stackEncounterDeck(stalled, "35037"), pick, endTurn(P1));
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === ("35037.when-revealed" as never))).toBe(
      true,
    );
    expect(inst(state, me(state)).damage).toBeGreaterThan(0);
    expect(offered).toBe(false);
  });
});

// Whole games ---------------------------------------------------------------------------------------------------

const WITH_STORM = [{ starterDeckId: "wolverine-aggression" }, { starterDeckId: "storm-leadership" }] as const;
const SOLO = [{ starterDeckId: "wolverine-aggression" }] as const;
const VARIANTS: readonly { label: string; options: Omit<Wave6ScenarioOptions, "seed"> }[] = [
  { label: "2 players, standard (with Storm)", options: { players: WITH_STORM } },
  { label: "1 hero, expert", options: { players: SOLO, difficulty: "expert" } },
];
const resolvedIds = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));

/** First seed of 1..60 whose game (played from setup, no surgery) reaches an outcome and whose events satisfy `wanted`. */
const findGame = (
  options: Omit<Wave6ScenarioOptions, "seed">,
  wanted: (events: readonly GameEvent[]) => boolean,
): { result: DriverResult; events: readonly GameEvent[] } => {
  for (let seed = 1; seed <= 60; seed++) {
    const created = createGame(wave6Scenario("rhino", { ...options, seed }), DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, DEPS);
    if (!result.outcome) continue;
    const played = replay(result.session.log, DEPS);
    if (!played.ok) throw new Error("replay failed");
    expect(played.state).toEqual(result.session.state);
    if (wanted(played.events)) return { result, events: played.events };
  }
  throw new Error("no seed of 1..60 ended as wanted");
};

describe.each(VARIANTS)("Wolverine vs Rhino ($label)", ({ options }) => {
  it("Healing Factor heals and Berserker Barrage is played, no surgery", () => {
    const { result, events } = findGame(options, (evs) => {
      const ids = resolvedIds(evs);
      return ids.includes("35001a.wolverine-constant") && ids.includes("35008.berserker-barrage-action");
    });
    expect(result.outcome).not.toBeNull();
    expect(events.some((e) => e.type === "damageHealed")).toBe(true);
  }, 900_000);

  it("the Claws play Lunging Strike on the first turn (staged: the driver never uses the Claws), then the driver plays on", () => {
    // Surgery: Lunging Strike into hand. The Claws are used through `sessionApply` (so the log replays), then the
    // greedy driver takes over from that state. Two logs, each replayed deep-equal.
    for (let seed = 1; seed <= 20; seed++) {
      const base = heroGame({
        seed,
        ...(options.players.length > 1 ? { extraPlayers: [options.players[1]!] } : {}),
        ...(options.difficulty ? { difficulty: options.difficulty } : {}),
      });
      const given = moveToHand(base, P1, "35010");
      const strike = given.ids[0]!;
      const claws = instancesOf(given.state, "35002")[0]!;
      const started = sessionApply(
        startSession(given.state),
        use(P1, claws, CLAWS_ABILITY, [], { event: [strike] }),
        DEPS,
      );
      if (!started.ok) throw new Error(started.error.message);
      let session: GameSession = started.session;
      for (let guard = 0; session.state.pendingChoice && !session.state.outcome && guard < 50; guard++) {
        const choice = session.state.pendingChoice;
        const next = sessionApply(
          session,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: firstLegal(session.state),
          },
          DEPS,
        );
        if (!next.ok) throw new Error(next.error.message);
        session = next.session;
      }
      const prefix = replay(session.log, DEPS);
      if (!prefix.ok) throw new Error("prefix replay failed");
      expect(prefix.state).toEqual(session.state);
      expect(resolvedIds(prefix.events)).toContain(CLAWS_ABILITY);
      expect(inst(session.state, claws).exhausted).toBe(true);
      expect(playerOf(session.state, P1).discard).toContain(strike);
      const result = playToOutcome(session.state, DEPS);
      if (!result.outcome) continue;
      const rest = replay(result.session.log, DEPS);
      if (!rest.ok) throw new Error("replay failed");
      expect(rest.state).toEqual(result.session.state);
      return;
    }
    throw new Error("no seed of 1..20 reached an outcome");
  }, 900_000);

  it("with the Lady Deathstrike modular set, a card of the set is dealt and the game replays deep-equal", () => {
    const { result, events } = findGame({ ...options, modularSetIds: ["deathstrike"] }, (evs) =>
      resolvedIds(evs).some((id) => /^3503[4-7]\./.test(id)),
    );
    expect(result.outcome).not.toBeNull();
    expect(events.length).toBeGreaterThan(0);
  }, 900_000);
});
