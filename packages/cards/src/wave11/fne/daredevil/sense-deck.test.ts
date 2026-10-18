import { FNE_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
import {
  applyCommand,
  createGame,
  separateDeckOf,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { playFromHand, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_DAREDEVIL_SENSE_DECK as REGISTRY, FNE_DAREDEVIL_SENSE_DECK_SKIPPED as SKIPPED } from "./sense-deck.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `fne/daredevil/sense-deck` (docs/phase7-wave11.md section 8.4 line 2): the five Sense upgrades from the
 * printed starter deck `fne-daredevil-justice` against Core's Rhino. Upgrades are staged onto their host by surgery
 * (a fresh instance of the card), so each card is exercised in isolation together with Daredevil's own Forced
 * Interrupt (the leaving upgrade goes to the bottom of the Sense deck, section 3.3). Sandman (01102) is the minion.
 */
const ACUTE = "60002.acute-tactility-interrupt";
const OLFACTION = "60003.enhanced-olfaction-interrupt";
const HEARING = "60004.heightened-hearing-interrupt";
const RADAR = "60005.radar-sense-response";
const TASTE = "60006.superior-taste-response";
const MINION = "m-sandman" as InstanceId;

function newGame(seed = 1): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}

const heroGame = (): GameState => withForm(newGame(), { heroForm: 0 });
const senseDeck = (s: GameState) => separateDeckOf(s, P1, "Sense").deck;
const handSize = (s: GameState) => s.players.find((p) => p.playerId === P1)!.hand.length;

/** Attaches a fresh copy of Sense card `code` to `host`, by surgery. */
function withUpgrade(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const id = `u-${code}-${host}` as InstanceId;
  const instance = {
    instanceId: id,
    cardId: code,
    ownerId: P1,
    controllerId: P1,
    home: { kind: "playArea", playerId: P1 },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: host,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  } as never;
  const added = { ...state, instances: { ...state.instances, [id]: instance } };
  return { state: patchInstance(added, host, { attachments: [...inst(added, host).attachments, id] }), id };
}

/** Takes every optional trigger offered; any other prompt gets the first legal answer. */
const accepting: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" ? s.pendingChoice.options.map((o) => o.optionId) : firstLegal(s);

function drive(
  state: GameState,
  command: Command,
  pick: Picker = accepting,
): { state: GameState; events: GameEvent[] } {
  const first = applyCommand(state, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(first.error.message);
  const events = [...first.events];
  let current = first.state;
  for (let guard = 0; current.pendingChoice && guard < 100; guard++) {
    const choice = current.pendingChoice;
    const next = applyCommand(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: pick(current) },
      WAVE11_DEPS,
    );
    if (!next.ok) throw new Error(next.error.message);
    events.push(...next.events);
    current = next.state;
  }
  return { state: current, events };
}

const attackCommand = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: target,
});
const thwartCommand = (s: GameState, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(s),
  schemeInstanceId: scheme,
});
const toSenseDeck = (events: readonly GameEvent[]) => events.filter((e) => e.type === "returnedToSeparateDeck");

/** A hero with a minion engaged that one hit defeats, wearing Sense card `code`. */
function nearDeadMinion(code: string) {
  const engaged = engageMinion(heroGame(), "01102", MINION);
  const worn = withUpgrade(engaged, code, MINION);
  return { ...worn, state: patchInstance(worn.state, MINION, { damage: 999 }) };
}

/** A hero facing a main scheme with `threat` on it, wearing Sense card `code`. */
function schemeGame(code: string, threat: number) {
  const base = heroGame();
  const scheme = base.mainScheme.instanceId;
  const worn = withUpgrade(base, code, scheme);
  return { ...worn, scheme, state: patchInstance(worn.state, scheme, { threat }) };
}

describe("wave 11 fne/daredevil/sense-deck", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("scripts all five Sense upgrades, so nothing is skipped", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([ACUTE, OLFACTION, HEARING, RADAR, TASTE].sort());
    expect(SKIPPED).toEqual({});
  });

  for (const [ref, code] of [
    [ACUTE, "60002"],
    [OLFACTION, "60003"],
  ] as const) {
    describe(ref, () => {
      it("fires when you defeat the attached enemy: the card is discarded to the Sense deck's bottom", () => {
        const { state, id } = nearDeadMinion(code);
        const start = senseDeck(state);
        const { state: after, events } = drive(state, attackCommand(state, MINION));
        expect(after.players.find((p) => p.playerId === P1)!.playArea).not.toContain(MINION);
        // Paid as a cost although it is replaced: not in the discard pile, at the deck's bottom.
        expect(toSenseDeck(events)).toMatchObject([{ instanceId: id, name: "Sense" }]);
        expect(toSenseDeck(events)).toHaveLength(1);
        expect(senseDeck(after)).toEqual([...start, id]);
        expect(after.players.find((p) => p.playerId === P1)!.discard).not.toContain(id);
      });

      it("does not fire when the attached enemy is merely damaged", () => {
        const { state, id } = nearDeadMinion(code);
        const hurt = patchInstance(state, MINION, { damage: 0 });
        const { state: after, events } = drive(hurt, attackCommand(hurt, MINION));
        expect(inst(after, MINION).attachments).toContain(id);
        expect(toSenseDeck(events)).toEqual([]);
      });

      it("fires when you remove the last threat from the attached scheme, and not for a partial removal", () => {
        const done = schemeGame(code, 2);
        const { state, events } = drive(done.state, thwartCommand(done.state, done.scheme));
        expect(mainThreat(state)).toBe(0);
        expect(toSenseDeck(events)).toMatchObject([{ instanceId: done.id }]);

        const partial = schemeGame(code, 3);
        const next = drive(partial.state, thwartCommand(partial.state, partial.scheme));
        expect(mainThreat(next.state)).toBe(1);
        expect(inst(next.state, partial.scheme).attachments).toContain(partial.id);
        expect(toSenseDeck(next.events)).toEqual([]);
      });

      it("is optional: declined, the enemy is defeated and the upgrade leaves with it to the Sense deck anyway", () => {
        const { state, id } = nearDeadMinion(code);
        const { state: after } = drive(state, attackCommand(state, MINION), firstLegal);
        expect(inst(after, id).attachedTo).toBeNull();
        expect(senseDeck(after).at(-1)).toBe(id);
      });
    });
  }

  describe(ACUTE, () => {
    it("readies the identity that exhausted to attack", () => {
      const { state } = nearDeadMinion("60002");
      const { state: accepted } = drive(state, attackCommand(state, MINION));
      expect(inst(accepted, identityOf(accepted)).exhausted).toBe(false);
      const { state: declined } = drive(state, attackCommand(state, MINION), firstLegal);
      expect(inst(declined, identityOf(declined)).exhausted).toBe(true);
    });

    it("the last-threat interrupt fires on the main scheme too (nothing is defeated): thwarting readies the identity", () => {
      const { state, scheme } = schemeGame("60002", 2);
      const { state: after } = drive(state, thwartCommand(state, scheme));
      expect(inst(after, identityOf(after)).exhausted).toBe(false);
    });
  });

  describe(OLFACTION, () => {
    it("reduces the cost of the next card played this phase by 2: Raising Hell (cost 2) is free", () => {
      const { state } = nearDeadMinion("60003");
      const { state: after } = drive(state, attackCommand(state, MINION));
      const reduced = playFromHand(WAVE11_DEPS, after, "60011", 0);
      // The event came into the hand and left it; nothing was spent.
      expect(handSize(reduced.state)).toBe(handSize(after));
      const declined = drive(state, attackCommand(state, MINION), firstLegal).state;
      const full = playFromHand(WAVE11_DEPS, declined, "60011", 2);
      expect(handSize(full.state)).toBe(handSize(declined) - 2);
    });
  });

  describe(HEARING, () => {
    const identityDamage = (withCard: boolean): { damage: number; events: GameEvent[]; id?: InstanceId } => {
      const base = heroGame();
      const worn = withCard ? withUpgrade(base, "60004", base.activeVillainId!) : { state: base, id: undefined };
      const { state, events } = drive(worn.state, { type: "endTurn", playerId: P1 });
      return { damage: inst(state, identityOf(state)).damage, events, ...(worn.id ? { id: worn.id } : {}) };
    };

    it("gives the attached enemy -3 ATK for that attack, and the card goes to the Sense deck's bottom", () => {
      const control = identityDamage(false);
      expect(control.damage).toBeGreaterThan(0);
      const treated = identityDamage(true);
      expect(treated.damage).toBe(Math.max(0, control.damage - 3));
      expect(toSenseDeck(treated.events)).toMatchObject([{ instanceId: treated.id }]);
    });
  });

  describe(`${HEARING} against another player`, () => {
    it("when the host attacks the other player, Daredevil becomes the defender and target (defense label) with -3 ATK", () => {
      const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;
      const config = coreScenario("rhino", {
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }],
        seed: 1,
        difficulty: "standard",
        modularSetIds: [],
        cardPool: PLAYABLE_CARDS,
      } as never);
      const seat = {
        identityCardId: deck.identityCardId,
        aspects: deck.aspects,
        deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
      };
      const created = createGame({ ...config, players: [seat, config.players[1]!] }, WAVE11_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const base = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
      const hero = withForm(withForm(base, { heroForm: 0 }), { heroForm: 0 }, P2);
      const worn = withUpgrade(engageMinion(hero, "01102", MINION, P2), "60004", MINION);
      const first = drive(worn.state, { type: "endTurn", playerId: P1 }, firstLegal);
      const { state, events } = drive(first.state, { type: "endTurn", playerId: P2 }, accepting);
      const resolved = events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === MINION);
      // The defense label makes Daredevil the target: the minion's attack lands on him, not on Spider-Man.
      expect(resolved).toMatchObject([{ targetInstanceId: identityOf(state), baseAtk: 0 }]);
      expect(toSenseDeck(events)).toMatchObject([{ instanceId: worn.id }]);
    });
  });

  describe(RADAR, () => {
    it("after you attack the attached enemy, deals 3 damage to it and goes to the Sense deck's bottom", () => {
      const base = heroGame();
      const { state, id } = withUpgrade(base, "60005", base.activeVillainId!);
      const { state: after, events } = drive(state, attackCommand(state, base.activeVillainId!));
      // Daredevil's ATK 2, then Radar Sense's 3.
      expect(inst(after, base.activeVillainId!).damage).toBe(5);
      expect(toSenseDeck(events)).toMatchObject([{ instanceId: id, name: "Sense" }]);
      expect(senseDeck(after).at(-1)).toBe(id);
    });

    it("is not heard when another enemy is attacked", () => {
      const engaged = engageMinion(heroGame(), "01102", MINION);
      const { state, id } = withUpgrade(engaged, "60005", MINION);
      const { state: after } = drive(state, attackCommand(state, engaged.activeVillainId!));
      expect(inst(after, MINION).damage).toBe(0);
      expect(inst(after, MINION).attachments).toContain(id);
    });
  });

  describe(TASTE, () => {
    it("after you thwart the attached scheme, removes 2 more threat and goes to the Sense deck's bottom", () => {
      const { state, scheme, id } = schemeGame("60006", 9);
      const { state: after, events } = drive(state, thwartCommand(state, scheme));
      // Daredevil's THW 2, then Superior Taste's 2.
      expect(mainThreat(after)).toBe(5);
      expect(toSenseDeck(events)).toMatchObject([{ instanceId: id, name: "Sense" }]);
      expect(senseDeck(after).at(-1)).toBe(id);
    });

    it("may be declined, leaving the upgrade in play", () => {
      const { state, scheme, id } = schemeGame("60006", 9);
      const { state: after } = drive(state, thwartCommand(state, scheme), firstLegal);
      expect(mainThreat(after)).toBe(7);
      expect(inst(after, scheme).attachments).toContain(id);
    });
  });

  /** Counts the optional-trigger prompts it passes. */
  const counting = (): { pick: Picker; prompts: () => number } => {
    let n = 0;
    return {
      pick: (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTriggers") n++;
        return accepting(s);
      },
      prompts: () => n,
    };
  };

  describe("only the controller's identity or an extension of it triggers a Sense upgrade (RRG You, Your p. 49)", () => {
    it("an ally's (Elektra) defeat of the host does not offer Acute Tactility", () => {
      const { state, id } = nearDeadMinion("60002");
      const elektra = stagedInPlay(state, "60007");
      const c = counting();
      const { state: after } = drive(
        elektra.state,
        { type: "basicAttack", playerId: P1, attackerInstanceId: elektra.id, targetInstanceId: MINION },
        c.pick,
      );
      expect(after.players.find((p) => p.playerId === P1)!.playArea).not.toContain(MINION);
      expect(c.prompts()).toBe(0);
      expect(inst(after, id).attachedTo).toBeNull();
    });

    it("a support's (Foggy Nelson) removal of the last threat does not offer it", () => {
      const base = withForm(newGame(), "alterEgo");
      const scheme = base.mainScheme.instanceId;
      const worn = withUpgrade(base, "60002", scheme);
      const foggy = stagedInPlay(patchInstance(worn.state, scheme, { threat: 2 }), "60013");
      const c = counting();
      const { state: after } = drive(foggy.state, use(P1, foggy.id, "60013.foggy-nelson-action"), c.pick);
      expect(mainThreat(after)).toBe(0);
      expect(c.prompts()).toBe(0);
    });

    it("an event's defeat (Raising Hell) does offer it, and the discard is paid", () => {
      const engaged = engageMinion(heroGame(), "01102", MINION);
      const worn = withUpgrade(engaged, "60002", MINION);
      const hurt = patchInstance(worn.state, MINION, { damage: 2 });
      const c = counting();
      const played = playFromHand(WAVE11_DEPS, hurt, "60011", 2, (s) => c.pick(s));
      expect(played.state.players.find((p) => p.playerId === P1)!.playArea).not.toContain(MINION);
      expect(c.prompts()).toBeGreaterThan(0);
      expect(senseDeck(played.state).at(-1)).toBe(worn.id);
    });

    const twoPlayers = (): GameState => {
      const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;
      const config = coreScenario("rhino", {
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }],
        seed: 1,
        difficulty: "standard",
        modularSetIds: [],
        cardPool: PLAYABLE_CARDS,
      } as never);
      const seat = {
        identityCardId: deck.identityCardId,
        aspects: deck.aspects,
        deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
      };
      const created = createGame({ ...config, players: [seat, config.players[1]!] }, WAVE11_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    };

    it("another player's identity defeating the host does not offer it to its controller", () => {
      const base = withForm(withForm(twoPlayers(), { heroForm: 0 }), { heroForm: 0 }, P2);
      const worn = withUpgrade(engageMinion(base, "01102", MINION), "60002", MINION);
      const damaged = patchInstance(worn.state, MINION, { damage: 999 });
      // P1 passes the turn; P2 (Spider-Man) then defeats the host.
      const near = drive(damaged, { type: "endTurn", playerId: P1 }, firstLegal).state;
      const c = counting();
      const { state: after } = drive(
        near,
        { type: "basicAttack", playerId: P2, attackerInstanceId: identityOf(near, P2), targetInstanceId: MINION },
        c.pick,
      );
      expect(c.prompts()).toBe(0);
      expect(inst(after, worn.id).attachedTo).toBeNull();
    });
  });

  describe("Focus the Senses (60012) with the Sense upgrades (August 3 R1, August 13 R2, January 11 R1)", () => {
    /** Focus the Senses in play (a player side scheme sits in the villain area) with `threat` on it. */
    function withFocus(state: GameState, threat: number): { state: GameState; id: InstanceId } {
      const given = moveToHand(state, P1, "60012");
      const id = given.ids[0]!;
      const placed: GameState = {
        ...given.state,
        players: given.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p,
        ),
        villainArea: [...given.state.villainArea, id],
      };
      return { id, state: patchInstance(placed, id, { controllerId: P1, faceup: true, threat }) };
    }

    interface Seen {
      deckBottom?: InstanceId | undefined;
      ready?: boolean;
    }
    /** Takes triggers; at the first other prompt (When Defeated) notes the table, then takes `wanted` cards. */
    const watching =
      (wanted: readonly InstanceId[], seen: Seen): Picker =>
      (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
        if (seen.ready === undefined) {
          seen.ready = !inst(s, identityOf(s)).exhausted;
          seen.deckBottom = senseDeck(s).at(-1);
        }
        const found = choice.options.filter(
          (o) => o.ref.kind === "card" && wanted.includes(o.ref.instanceId as InstanceId),
        );
        return found.length > 0 ? found.slice(0, choice.maxSelections).map((o) => o.optionId) : firstLegal(s);
      };

    it("Acute Tactility on Focus: the interrupt resolves first (to the deck bottom, Daredevil readies), then When Defeated may put the same card back", () => {
      const focus = withFocus(heroGame(), 2);
      const worn = withUpgrade(focus.state, "60002", focus.id);
      const seen: Seen = {};
      const { state: after } = drive(worn.state, thwartCommand(worn.state, focus.id), watching([worn.id], seen));
      expect(seen).toEqual({ ready: true, deckBottom: worn.id });
      expect(after.villainArea).not.toContain(focus.id);
      expect(senseDeck(after)).not.toContain(worn.id);
      expect(inst(after, worn.id).attachedTo).not.toBeNull();
      expect(inst(after, identityOf(after)).exhausted).toBe(false);
    });

    it("Enhanced Olfaction on Focus: same timing, and the next card this phase costs 2 less", () => {
      const focus = withFocus(heroGame(), 2);
      const worn = withUpgrade(focus.state, "60003", focus.id);
      const seen: Seen = {};
      const { state: after } = drive(worn.state, thwartCommand(worn.state, focus.id), watching([], seen));
      expect(seen.deckBottom).toBe(worn.id);
      const reduced = playFromHand(WAVE11_DEPS, after, "60011", 0);
      expect(handSize(reduced.state)).toBe(handSize(after));
    });

    it("an upgrade moved onto Focus by its When Defeated gets no interrupt for this defeat and goes to the bottom with Focus (August 13 R2)", () => {
      const onMinion = withUpgrade(engageMinion(heroGame(), "01102", MINION), "60002", MINION);
      const focus = withFocus(onMinion.state, 2);
      const picker = watching([onMinion.id, focus.id], {});
      const { state: after } = drive(focus.state, thwartCommand(focus.state, focus.id), picker);
      // Acute Tactility did not ready Daredevil: the thwart exhausted him.
      expect(inst(after, identityOf(after)).exhausted).toBe(true);
      expect(inst(after, onMinion.id).attachedTo).toBeNull();
      expect(senseDeck(after).at(-1)).toBe(onMinion.id);
    });

    it("Superior Taste's (thwart) is let through by Focus the Senses's constant", () => {
      const focus = withFocus(heroGame(), 9);
      const worn = withUpgrade(focus.state, "60006", focus.id);
      const { state: after } = drive(worn.state, thwartCommand(worn.state, focus.id));
      expect(inst(after, focus.id).threat).toBe(5);
      expect(senseDeck(after).at(-1)).toBe(worn.id);
    });
  });
});
