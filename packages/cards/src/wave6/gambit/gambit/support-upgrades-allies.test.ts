import { cardId } from "@mc/content";
import {
  activeVillain,
  cardsInPlay,
  characterProfile,
  playCostOf,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { COLOSSUS_SUPPORT_UPGRADES_ALLIES } from "../../mut_gen/colossus/support-upgrades-allies.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { PHOENIX_PRECON_PLAYER_CARDS } from "../../phoenix/precon-player-cards.js";
import { SHADOWCAT_SUPPORT_UPGRADES_ALLIES } from "../../mut_gen/shadowcat/support-upgrades-allies.js";
import { GAMBIT_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { gambitGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const THIEF = "37001b.thief-extraordinaire";
const GUILD = "37003.the-thieves-guild-response";
const STAFF = "37004.gambits-staff-interrupt";
const ARMOR = "37005.gambits-guild-armor-response";
const MOLECULAR = "37010.molecular-acceleration-interrupt";
const BISHOP_RESPONSE = "37011.bishop-response";
const BISHOP_INTERRUPT = "37011.bishop-interrupt";
const DAZZLER = "37012.dazzler-response";
const OPERATIVE = "37013.operative-skill-interrupt";
const WAR_ROOM = "37030.war-room-response";
const TWO_ICONS = "01190"; // Shadow of the Past, 2 boost icons.
const NO_ICONS = "01186"; // Advance, 0 boost icons.
const ONE_ICON = "01188"; // Caught Off Guard, 1 boost icon.
const HAYMAKER = "01087"; // Aggression ATTACK event, cost 2.

const REFS = [
  "37002.rogue-constant",
  GUILD,
  STAFF,
  ARMOR,
  MOLECULAR,
  "37016.passion-for-justice-interrupt",
  "37017.professor-x-forced-response",
  "37018.x-mansion-action",
  DAZZLER,
  BISHOP_RESPONSE,
  BISHOP_INTERRUPT,
  OPERATIVE,
  WAR_ROOM,
];

const remy = (seed = 1): GameState => gambitGame("rhino", { seed });
const gambit = (seed = 1): GameState => withForm(gambitGame("rhino", { seed }), { heroForm: 0 });
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const withCharges = (state: GameState, count: number): GameState =>
  patchInstance(state, identityOf(state, P1), { counters: { charge: count } });
const charges = (state: GameState): number => inst(state, identityOf(state, P1)).counters.charge ?? 0;
const handSize = (state: GameState): number => playerOf(state, P1).hand.length;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/**
 * Moves a copy of `code` to the hand. A card the precon does not run (War Room) is made by relabeling the top deck card
 * (test-only surgery).
 */
function give(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, P1);
  const has = [...owner.hand, ...owner.deck, ...owner.discard].some((i) => state.instances[i]!.cardId === cardId(code));
  const base = has ? state : patchInstance(state, owner.deck[0]!, { cardId: cardId(code) });
  const given = moveToHand(base, P1, code);
  return { state: given.state, id: given.ids[0]! };
}

/** Tops the hand up to `n` cards from the deck, so a test can pay for what it plays. */
const fillHand = (state: GameState, n: number): GameState => ({
  ...state,
  players: state.players.map((p) => {
    if (p.playerId !== P1 || p.hand.length >= n) return p;
    const take = p.deck.slice(0, n - p.hand.length);
    return { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(take.length) };
  }),
});

/** Applies `command`, answering every choice with `pick`; checks the log replays to the same state. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (${session.state.pendingChoice.prompt.kind})`);
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const rejected = (state: GameState, command: Command): boolean => !sessionApply(startSession(state), command, DEPS).ok;

/** Accepts the optional trigger(s) whose id ends with one of `abilities`; other choices go to `fallback`. */
const accepting =
  (abilities: readonly string[], fallback: Picker = firstLegal): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const hits = choice.options
        .map((o) => o.optionId)
        .filter((id) => abilities.some((a) => id === a || id.endsWith(`:${a}`)));
      if (hits.length > 0) return hits.slice(0, choice.maxSelections);
    }
    return fallback(state);
  };
/** Picks the card option naming `id` in a target prompt; anything else as `fallback`. */
const targeting =
  (id: InstanceId, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === id);
    return hit ? [hit.optionId] : fallback(state);
  };
const offers = (state: GameState, ability: string): boolean =>
  state.pendingChoice?.prompt.kind === "chooseTriggers" &&
  state.pendingChoice.options.some((o) => o.optionId === ability || o.optionId.endsWith(`:${ability}`));

/** Plays `code` from hand (paying `cost` with other hand cards) and returns its instance. */
function playIt(state: GameState, code: string, cost: number, pick: Picker = firstLegal) {
  const given = give(fillHand(state, 8), code);
  const result = drive(given.state, play(P1, given.id, payWith(given.state, P1, cost, [given.id])), pick);
  return { state: result.state, id: given.id, events: result.events };
}
/** Takes the card out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attach(state: GameState, code: string, host: InstanceId, counters: Record<string, number> = {}) {
  const given = give(state, code);
  const removed: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== given.id) } : p,
    ),
  };
  const attached = patchInstance(removed, given.id, { attachedTo: host, counters });
  return {
    state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, given.id] }),
    id: given.id,
  };
}
/** Puts a support into play by surgery, ready. */
function support(state: GameState, code: string) {
  const given = give(state, code);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => i !== given.id), playArea: [...p.playArea, given.id] }
          : p,
      ),
    },
  };
}
const mainScheme = (state: GameState): InstanceId => state.mainScheme.instanceId;
const threatOf = (state: GameState, id: InstanceId): number => inst(state, id).threat;
const withThreat = (state: GameState, id: InstanceId, threat: number): GameState =>
  patchInstance(state, id, { threat });

describe("Gambit's supports, upgrades, allies and resources (37002-37005, 37010-37013, 37016-37018, 37030)", () => {
  it("registers exactly the refs the card data names for them, all valid", () => {
    expect(Object.keys(GAMBIT_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(GAMBIT_SUPPORT_UPGRADES_ALLIES)) {
      expect(validateDefinition(definition)).toEqual([]);
    }
  });

  describe("reprints (37016, 37017, 37018)", () => {
    it("are the original scripts of 34020, 32019 and 32049", () => {
      expect(GAMBIT_SUPPORT_UPGRADES_ALLIES["37016.passion-for-justice-interrupt"]).toBe(
        PHOENIX_PRECON_PLAYER_CARDS["34020.passion-for-justice-interrupt"],
      );
      expect(GAMBIT_SUPPORT_UPGRADES_ALLIES["37017.professor-x-forced-response"]).toBe(
        COLOSSUS_SUPPORT_UPGRADES_ALLIES["32019.professor-x-forced-response"],
      );
      expect(GAMBIT_SUPPORT_UPGRADES_ALLIES["37018.x-mansion-action"]).toBe(
        SHADOWCAT_SUPPORT_UPGRADES_ALLIES["32049.x-mansion-action"],
      );
    });
  });

  describe("Rogue (37002)", () => {
    const costWith = (count: number, form: "hero" | "alterEgo" = "hero"): number => {
      const base = withCharges(form === "hero" ? gambit() : remy(), count);
      const given = give(base, "37002");
      return playCostOf(given.state, P1, given.id, DEPS)!.current;
    };

    it("costs 4, and 1 less for each charge counter on your identity", () => {
      expect([0, 1, 2, 3, 4].map((n) => costWith(n))).toEqual([4, 3, 2, 1, 0]);
    });

    it("never costs less than 0", () => {
      expect(costWith(5)).toBe(0);
      expect(costWith(9)).toBe(0);
    });

    it("reads the identity in alter-ego form too, and reduces only Rogue", () => {
      expect(costWith(2, "alterEgo")).toBe(2);
      const base = withCharges(gambit(), 3);
      const dazzler = give(base, "37012");
      expect(playCostOf(dazzler.state, P1, dazzler.id, DEPS)!.current).toBe(4);
      const bishop = give(base, "37011");
      expect(playCostOf(bishop.state, P1, bishop.id, DEPS)!.current).toBe(3);
    });

    it("is really played for the reduced cost: 2 charge counters, 2 cards", () => {
      const base = fillHand(withCharges(gambit(), 2), 8);
      const given = give(base, "37002");
      const before = handSize(given.state);
      const { state } = drive(given.state, play(P1, given.id, payWith(given.state, P1, 2, [given.id])));
      expect(playerOf(state, P1).playArea).toContain(given.id);
      expect(handSize(state)).toBe(before - 3);
      expect(rejected(given.state, play(P1, given.id, payWith(given.state, P1, 1, [given.id])))).toBe(true);
    });

    it("changes as counters arrive or leave", () => {
      const given = give(withCharges(gambit(), 1), "37002");
      expect(playCostOf(given.state, P1, given.id, DEPS)!.current).toBe(3);
      const more = withCharges(given.state, 3);
      expect(playCostOf(more, P1, given.id, DEPS)!.current).toBe(1);
    });
  });

  describe("The Thieves Guild (37003)", () => {
    /** Remy with The Thieves Guild in play, the main scheme at `threat`, `top` on the encounter deck. */
    const guildGame = (threat: number, ...top: string[]) => {
      const base = support(remy(), "37003");
      const staged = withThreat(stackEncounterDeck(base.state, ...top), mainScheme(base.state), threat);
      return { state: staged, guild: base.id };
    };
    const thief = (state: GameState, pick: Picker) => drive(state, use(P1, identityOf(state), THIEF), pick);
    const discarding =
      (code: string, then: Picker): Picker =>
      (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseCards") {
          const hit = choice.options.find(
            (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === cardId(code),
          );
          if (hit) return [hit.optionId];
        }
        return then(state);
      };

    it("after Thief Extraordinaire resolves, exhausts to remove 1 more threat from a scheme", () => {
      const { state: start, guild } = guildGame(6, TWO_ICONS, ONE_ICON);
      const { state } = thief(start, discarding(TWO_ICONS, accepting([GUILD])));
      expect(threatOf(state, mainScheme(state))).toBe(3);
      expect(inst(state, guild).exhausted).toBe(true);
      expect(handSize(state)).toBe(handSize(start));
    });

    it("is not offered before Thief Extraordinaire resolves, and the player may decline it", () => {
      const { state: start, guild } = guildGame(6, TWO_ICONS, ONE_ICON);
      const { state } = thief(start, discarding(TWO_ICONS, firstLegal));
      expect(threatOf(state, mainScheme(state))).toBe(4);
      expect(inst(state, guild).exhausted).toBe(false);
    });

    it("draws 1 card when it removes the last threat from the scheme", () => {
      const { state: start } = guildGame(3, TWO_ICONS, ONE_ICON);
      const { state } = thief(start, discarding(TWO_ICONS, accepting([GUILD])));
      expect(threatOf(state, mainScheme(state))).toBe(0);
      expect(handSize(state)).toBe(handSize(start) + 1);
    });

    it("draws nothing when threat remains on the scheme", () => {
      const { state: start } = guildGame(4, TWO_ICONS, ONE_ICON);
      const { state } = thief(start, discarding(TWO_ICONS, accepting([GUILD])));
      expect(threatOf(state, mainScheme(state))).toBe(1);
      expect(handSize(state)).toBe(handSize(start));
    });

    it("draws for a side scheme whose last threat it removes, and removes it from the scheme the player picks", () => {
      const { state: base } = guildGame(6, ONE_ICON, TWO_ICONS);
      const side = encounterCardInVillainArea(base, "01108", 2);
      // Thief Extraordinaire (1 icon) takes 1 of the side scheme's 2 threat; the Guild takes the last.
      const { state, events } = thief(side.state, discarding(ONE_ICON, accepting([GUILD], targeting(side.id))));
      expect(threatOf(state, mainScheme(state))).toBe(6);
      expect(ofType(events, "schemeDefeated")).toHaveLength(1);
      expect(ofType(events, "schemeDefeated").length).toBeGreaterThanOrEqual(1);
      expect(handSize(state)).toBe(handSize(side.state) + 1);
    });

    it("only hears Thief Extraordinaire: another resolved alter-ego ability does not offer it", () => {
      const { state: start } = guildGame(6, TWO_ICONS);
      const mansion = support(start, "37018");
      const hurt = patchInstance(mansion.state, identityOf(mansion.state), { damage: 2 });
      const result = drive(hurt, use(P1, mansion.id, "37018.x-mansion-action"), (state) => {
        expect(offers(state, GUILD)).toBe(false);
        return firstLegal(state);
      });
      expect(threatOf(result.state, mainScheme(result.state))).toBe(6);
      expect(inst(result.state, identityOf(result.state)).damage).toBe(1);
    });

    it("is not offered again while it is exhausted", () => {
      const { state: start, guild } = guildGame(8, TWO_ICONS, ONE_ICON, NO_ICONS);
      const { state } = thief(start, discarding(TWO_ICONS, accepting([GUILD])));
      expect(inst(state, guild).exhausted).toBe(true);
      const again = patchInstance(state, identityOf(state), { exhausted: false });
      const { state: after } = thief(
        again,
        discarding(ONE_ICON, (s) => {
          expect(offers(s, GUILD)).toBe(false);
          return firstLegal(s);
        }),
      );
      expect(threatOf(after, mainScheme(after))).toBe(threatOf(again, mainScheme(again)) - 1);
    });
  });

  describe("villain attacks (Gambit's Staff 37004, Gambit's Guild Armor 37005, Bishop 37011)", () => {
    const endTurnCommand: Command = { type: "endTurn", playerId: P1 };
    /** A picker that declares the identity the defender when asked (or declines), and answers the rest with `then`. */
    const defending =
      (declare: boolean, then: Picker): Picker =>
      (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "declareDefender") {
          const own = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === identityOf(state, P1));
          return declare && own ? [own.optionId] : ["decline"];
        }
        return then(state);
      };
    /** Gambit (hero form) with the boost card on top of the encounter deck. */
    const attacked = (boost: string) => stackEncounterDeck(gambit(), boost);
    const attached = (code = "37004") => attach(attacked(NO_ICONS), code, identityOf(gambit(), P1));

    it("Gambit's Staff: when an enemy attacks, exhausts to deal 1 damage to that enemy", () => {
      const { state: armed, id: staff } = attach(attacked(NO_ICONS), "37004", identityOf(gambit(), P1));
      const rhino = villainOf(armed);
      const { state, events } = drive(armed, endTurnCommand, defending(false, accepting([STAFF])));
      expect(inst(state, staff).exhausted).toBe(true);
      expect(inst(state, rhino).damage).toBe(1);
      expect(ofType(events, "damageDealt").filter((e) => e.targetInstanceId === rhino)).toHaveLength(1);
    });

    it("Gambit's Staff: pays nothing when declined; once exhausted it is not offered for the next attack", () => {
      const { state: armed, id: staff } = attached();
      const declined = drive(armed, endTurnCommand, defending(false, firstLegal));
      expect(inst(declined.state, staff).exhausted).toBe(false);
      expect(inst(declined.state, villainOf(armed)).damage).toBe(0);
      // The villain's attack then a minion's: the Staff answers the first, so it is exhausted for the second.
      const minion = engageMinion(armed, "01101");
      let offeredCount = 0;
      const { state } = drive(
        minion.state,
        endTurnCommand,
        defending(false, (s) => {
          if (offers(s, STAFF)) offeredCount += 1;
          return accepting([STAFF])(s);
        }),
      );
      expect(offeredCount).toBe(1);
      expect(inst(state, staff).exhausted).toBe(true);
      expect(inst(state, villainOf(armed)).damage).toBe(1);
      expect(inst(state, minion.id).damage).toBe(0);
    });

    it("Gambit's Staff: also answers a minion's attack, damaging that minion and not the villain", () => {
      const base = attached();
      const { state: armed, id: staff } = base;
      const minion = engageMinion(armed, "01101");
      let offered = 0;
      const pick: Picker = (state) => {
        if (offers(state, STAFF)) {
          offered += 1;
          // The villain attacks first; answer only the minion's attack.
          return offered === 2 ? accepting([STAFF])(state) : firstLegal(state);
        }
        return firstLegal(state);
      };
      const { state } = drive(minion.state, endTurnCommand, defending(false, pick));
      expect(offered).toBe(2);
      expect(inst(state, staff).exhausted).toBe(true);
      expect(inst(state, minion.id).damage).toBe(1);
      expect(inst(state, villainOf(armed)).damage).toBe(0);
    });

    it("Gambit's Staff: is a Hero Interrupt, so it is not offered in alter-ego form", () => {
      const alter = stackEncounterDeck(remy(), NO_ICONS);
      const { state: armed } = attach(alter, "37004", identityOf(alter, P1));
      drive(
        armed,
        endTurnCommand,
        defending(false, (s) => {
          expect(offers(s, STAFF)).toBe(false);
          return firstLegal(s);
        }),
      );
    });

    it("Gambit's Guild Armor: after Gambit defends and takes no damage, exhausts to ready him", () => {
      // Rhino ATK 2 (+0 boost) against Gambit's DEF 3: no damage.
      const { state: armed, id: armor } = attach(attacked(NO_ICONS), "37005", identityOf(gambit(), P1));
      const { state, events } = drive(armed, endTurnCommand, defending(true, accepting([ARMOR])));
      expect(inst(state, armor).exhausted).toBe(true);
      expect(inst(state, identityOf(state, P1)).exhausted).toBe(false);
      expect(inst(state, identityOf(state, P1)).damage).toBe(0);
      expect(
        ofType(events, "cardExhausted").filter((e) => e.instanceId === identityOf(state, P1)).length,
      ).toBeGreaterThan(0);
    });

    it("Gambit's Guild Armor: not offered when he took damage, or when he did not defend", () => {
      const hit = attach(attacked(TWO_ICONS), "37005", identityOf(gambit(), P1));
      const damaged = drive(
        hit.state,
        endTurnCommand,
        defending(true, (s) => {
          expect(offers(s, ARMOR)).toBe(false);
          return firstLegal(s);
        }),
      );
      expect(inst(damaged.state, identityOf(damaged.state, P1)).damage).toBeGreaterThan(0);
      expect(inst(damaged.state, hit.id).exhausted).toBe(false);
      const none = attach(attacked(NO_ICONS), "37005", identityOf(gambit(), P1));
      drive(
        none.state,
        endTurnCommand,
        defending(false, (s) => {
          expect(offers(s, ARMOR)).toBe(false);
          return firstLegal(s);
        }),
      );
    });

    it("Gambit's Guild Armor: does not respond to an ally's defense", () => {
      const base = attached("37005");
      const ally = playIt(base.state, "37012", 4);
      const readied = patchInstance(ally.state, ally.id, { exhausted: false });
      let sawArmor = false;
      const pick: Picker = (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "declareDefender") {
          const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === ally.id);
          return hit ? [hit.optionId] : ["decline"];
        }
        if (offers(state, ARMOR)) sawArmor = true;
        return firstLegal(state);
      };
      drive(stackEncounterDeck(readied, NO_ICONS), endTurnCommand, pick);
      expect(sawArmor).toBe(false);
    });

    it("Bishop: after an enemy attacks you, a charge-free energy counter is placed on him", () => {
      const bishop = playIt(attacked(NO_ICONS), "37011", 3);
      const staged = stackEncounterDeck(bishop.state, NO_ICONS);
      expect(inst(staged, bishop.id).counters.energy ?? 0).toBe(0);
      const { state } = drive(staged, endTurnCommand, defending(false, accepting([BISHOP_RESPONSE])));
      expect(inst(state, bishop.id).counters.energy).toBe(1);
    });

    it("Bishop: the villain's attack and a minion's attack each add one, and declining adds none", () => {
      const bishop = playIt(attacked(NO_ICONS), "37011", 3);
      const minion = engageMinion(stackEncounterDeck(bishop.state, NO_ICONS), "01101");
      const { state } = drive(minion.state, endTurnCommand, defending(false, accepting([BISHOP_RESPONSE])));
      expect(inst(state, bishop.id).counters.energy).toBe(2);
      const declined = drive(stackEncounterDeck(bishop.state, NO_ICONS), endTurnCommand, defending(false, firstLegal));
      expect(inst(declined.state, bishop.id).counters.energy ?? 0).toBe(0);
    });

    it("Bishop: an attack on your ally still counts (the player is attacked)", () => {
      const bishop = playIt(attacked(NO_ICONS), "37011", 3);
      const ally = playIt(bishop.state, "37012", 4);
      const readied = patchInstance(ally.state, ally.id, { exhausted: false });
      const pick: Picker = (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "declareDefender") {
          const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === ally.id);
          return hit ? [hit.optionId] : ["decline"];
        }
        return accepting([BISHOP_RESPONSE])(state);
      };
      const { state } = drive(stackEncounterDeck(readied, NO_ICONS), endTurnCommand, pick);
      expect(inst(state, bishop.id).counters.energy).toBe(1);
    });
  });

  describe("Bishop's interrupt (37011): remove each energy counter → +2 ATK for each, to a maximum of +6", () => {
    /** Gambit with Bishop (ATK 0) in play holding `energy` counters. */
    const bishopWith = (energy: number) => {
      const bishop = playIt(gambit(), "37011", 3);
      const state = patchInstance(bishop.state, bishop.id, { counters: energy > 0 ? { energy } : {} });
      return { state, id: bishop.id };
    };
    const attackVillain = (state: GameState, attacker: InstanceId): Command => ({
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: villainOf(state),
    });
    const damageToVillain = (state: GameState, events: readonly GameEvent[]) =>
      ofType(events, "damageDealt")
        .filter((e) => e.targetInstanceId === villainOf(state))
        .reduce((sum, e) => sum + e.amount, 0);

    it("2 counters: both are removed, and he attacks for +4 ATK", () => {
      const b = bishopWith(2);
      const { state, events } = drive(b.state, attackVillain(b.state, b.id), accepting([BISHOP_INTERRUPT]));
      expect(inst(state, b.id).counters.energy ?? 0).toBe(0);
      expect(damageToVillain(state, events)).toBe(4);
    });

    it("4 counters: every one is removed (no choice), and the bonus stops at +6 ATK", () => {
      const b = bishopWith(4);
      const { state, events } = drive(b.state, attackVillain(b.state, b.id), accepting([BISHOP_INTERRUPT]));
      expect(inst(state, b.id).counters.energy ?? 0).toBe(0);
      expect(damageToVillain(state, events)).toBe(6);
    });

    it("declined: the counters stay and he attacks with his printed 0 ATK", () => {
      const b = bishopWith(2);
      let offered = false;
      const pick: Picker = (state) => {
        if (offers(state, BISHOP_INTERRUPT)) offered = true;
        return firstLegal(state);
      };
      const { state, events } = drive(b.state, attackVillain(b.state, b.id), pick);
      expect(offered).toBe(true);
      expect(inst(state, b.id).counters.energy).toBe(2);
      expect(damageToVillain(state, events)).toBe(0);
    });

    it("near miss: with no energy counters the interrupt is not offered (nothing to remove)", () => {
      const b = bishopWith(0);
      let offered = false;
      const pick: Picker = (state) => {
        if (offers(state, BISHOP_INTERRUPT)) offered = true;
        return accepting([BISHOP_INTERRUPT])(state);
      };
      const { events, state } = drive(b.state, attackVillain(b.state, b.id), pick);
      expect(offered).toBe(false);
      expect(damageToVillain(state, events)).toBe(0);
    });
  });

  describe("Molecular Acceleration (37010)", () => {
    /** Plays Haymaker (cost 2) from hand paying with the given hand cards, accepting the Molecular interrupts. */
    const spendMolecular = (state: GameState, count: number, accept = true) => {
      let current = state;
      const given = moveToHand(current, P1, ...Array.from({ length: count }, () => "37010"));
      current = given.state;
      const molecular = [...given.ids];
      const target = give(current, HAYMAKER);
      const command = play(P1, target.id, molecular);
      return drive(target.state, command, accept ? accepting([MOLECULAR]) : firstLegal);
    };

    it("generates 1 [energy] and 1 [physical]: one copy alone pays for a cost-2 card", () => {
      const { state } = spendMolecular(gambit(), 1, false);
      expect(playerOf(state, P1).discard.map((i) => inst(state, i).cardId)).toContain(cardId("37010"));
      expect(playerOf(state, P1).discard.map((i) => inst(state, i).cardId)).toContain(cardId(HAYMAKER));
    });

    it("when spent, places 1 charge counter on Gambit; spending two places two", () => {
      expect(charges(spendMolecular(gambit(), 1).state)).toBe(1);
      expect(charges(spendMolecular(gambit(), 2).state)).toBe(2);
      expect(charges(spendMolecular(withCharges(gambit(), 2), 1).state)).toBe(3);
    });

    it("places none when the player declines the interrupt", () => {
      expect(charges(spendMolecular(gambit(), 1, false).state)).toBe(0);
    });

    it("is a Hero Interrupt: spending it in alter-ego form places nothing", () => {
      const base = remy();
      const molecular = give(base, "37010");
      const guild = give(molecular.state, "37003");
      const { state } = drive(
        guild.state,
        play(P1, guild.id, [molecular.id]),
        accepting([MOLECULAR], (s) => {
          expect(offers(s, MOLECULAR)).toBe(false);
          return firstLegal(s);
        }),
      );
      expect(charges(state)).toBe(0);
      expect(playerOf(state, P1).playArea).toContain(guild.id);
    });
  });

  describe("Dazzler (37012)", () => {
    it("after she enters play, confuses the enemy the player picks (the villain)", () => {
      const base = gambit();
      const villain = villainOf(base);
      const { state } = playIt(base, "37012", 4, accepting([DAZZLER], targeting(villain)));
      expect(inst(state, villain).statuses.confused).toBe(1);
    });

    it("can confuse a minion instead, and only that one", () => {
      const minion = engageMinion(gambit(), "01101");
      const villain = villainOf(minion.state);
      const { state } = playIt(minion.state, "37012", 4, accepting([DAZZLER], targeting(minion.id)));
      expect(inst(state, minion.id).statuses.confused).toBe(1);
      expect(inst(state, villain).statuses.confused ?? 0).toBe(0);
    });

    it("confuses nobody when the player declines the response", () => {
      const base = gambit();
      const { state } = playIt(base, "37012", 4);
      expect(inst(state, villainOf(state)).statuses.confused ?? 0).toBe(0);
    });
  });

  describe("Operative Skill (37013)", () => {
    const heroWithSkill = (threat = 10) => {
      const base = withThreat(gambit(), mainScheme(gambit()), threat);
      const played = give(fillHand(base, 8), "37013");
      const identity = identityOf(played.state, P1);
      const { state } = drive(
        played.state,
        play(P1, played.id, payWith(played.state, P1, 2, [played.id]), { attachToInstanceId: identity }),
      );
      return { state, id: played.id };
    };
    const thwartCommand = (state: GameState, thwarter = identityOf(state, P1)): Command => ({
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: thwarter,
      schemeInstanceId: mainScheme(state),
    });
    const operativeCounters = (state: GameState, id: InstanceId) => inst(state, id).counters.operative ?? 0;

    it("enters play with 3 operative counters", () => {
      const { state, id } = heroWithSkill();
      expect(operativeCounters(state, id)).toBe(3);
      expect(inst(state, id).attachedTo).toBe(identityOf(state, P1));
    });

    it("when you thwart, removes 1 counter: that thwart removes exactly 1 additional threat", () => {
      const { state: armed, id } = heroWithSkill();
      const thw = characterProfile(armed, identityOf(armed, P1), DEPS)!.thw;
      const { state, events } = drive(armed, thwartCommand(armed), accepting([OPERATIVE]));
      expect(threatOf(state, mainScheme(state))).toBe(10 - thw - 1);
      expect(operativeCounters(state, id)).toBe(2);
      expect(ofType(events, "threatRemoved")).toHaveLength(1);
      expect(ofType(events, "threatRemoved")[0]!.amount).toBe(thw + 1);
    });

    it("costs nothing and adds nothing when declined", () => {
      const { state: armed, id } = heroWithSkill();
      const thw = characterProfile(armed, identityOf(armed, P1), DEPS)!.thw;
      const { state } = drive(armed, thwartCommand(armed));
      expect(threatOf(state, mainScheme(state))).toBe(10 - thw);
      expect(operativeCounters(state, id)).toBe(3);
    });

    it("is used up after 3 counters, then no longer offered", () => {
      const { state: armed, id } = heroWithSkill(20);
      let current = armed;
      for (let i = 0; i < 3; i++) {
        current = patchInstance(current, identityOf(current, P1), { exhausted: false });
        current = drive(current, thwartCommand(current), accepting([OPERATIVE])).state;
      }
      expect(operativeCounters(current, id)).toBe(0);
      const last = patchInstance(current, identityOf(current, P1), { exhausted: false });
      drive(
        last,
        thwartCommand(last),
        accepting([OPERATIVE], (s) => {
          expect(offers(s, OPERATIVE)).toBe(false);
          return firstLegal(s);
        }),
      );
    });

    it("hears Gambit's own thwart only: an ally's thwart does not offer it", () => {
      const { state: armed } = heroWithSkill();
      const ally = playIt(armed, "37012", 4);
      let sawIt = false;
      const { state } = drive(ally.state, thwartCommand(ally.state, ally.id), (s) => {
        if (offers(s, OPERATIVE)) sawIt = true;
        return firstLegal(s);
      });
      expect(sawIt).toBe(false);
      const allyThw = characterProfile(ally.state, ally.id, DEPS)!.thw;
      expect(threatOf(state, mainScheme(state))).toBe(10 - allyThw);
    });

    it("also adds to a '(thwart)' ability: Remy's Thief Extraordinaire", () => {
      const base = withThreat(remy(), mainScheme(remy()), 10);
      const stacked = stackEncounterDeck(base, TWO_ICONS, NO_ICONS);
      const played = give(fillHand(stacked, 8), "37013");
      const identity = identityOf(played.state, P1);
      const skill = drive(
        played.state,
        play(P1, played.id, payWith(played.state, P1, 2, [played.id]), { attachToInstanceId: identity }),
      ).state;
      const discarding: Picker = (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseCards") {
          const hit = choice.options.find(
            (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === cardId(TWO_ICONS),
          );
          if (hit) return [hit.optionId];
        }
        return accepting([OPERATIVE])(state);
      };
      const { state } = drive(skill, use(P1, identity, THIEF), discarding);
      expect(threatOf(state, mainScheme(state))).toBe(10 - 2 - 1);
      expect(operativeCounters(state, played.id)).toBe(2);
    });

    it("Max 1 per player: a second copy cannot be played while one is in play", () => {
      const { state } = heroWithSkill();
      const second = give(fillHand(state, 8), "37013");
      const identity = identityOf(second.state, P1);
      expect(
        rejected(
          second.state,
          play(P1, second.id, payWith(second.state, P1, 2, [second.id]), { attachToInstanceId: identity }),
        ),
      ).toBe(true);
    });
  });

  describe("War Room (37030)", () => {
    /** Gambit, War Room in play, an engaged Hydra Mercenary (3 HP) with `damage`, and Dazzler (2 ATK) in play. */
    const warRoomGame = (damage: number) => {
      const room = support(gambit(), "37030");
      const minion = engageMinion(room.state, "01101");
      const hurt = patchInstance(minion.state, minion.id, { damage });
      const ally = playIt(hurt, "37012", 4);
      return { state: ally.state, room: room.id, minion: minion.id, ally: ally.id };
    };
    const attackCommand = (attacker: InstanceId, target: InstanceId): Command => ({
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: attacker,
      targetInstanceId: target,
    });

    it("after an ally attacks and defeats a minion, exhausts to remove 1 threat from a scheme", () => {
      const g = warRoomGame(1);
      const staged = withThreat(g.state, mainScheme(g.state), 5);
      const { state } = drive(staged, attackCommand(g.ally, g.minion), accepting([WAR_ROOM]));
      expect(inst(state, g.room).exhausted).toBe(true);
      expect(threatOf(state, mainScheme(state))).toBe(4);
      expect(cardsInPlay(state)).not.toContain(g.minion);
    });

    it("removes the threat from the scheme the player picks, a side scheme too", () => {
      const g = warRoomGame(1);
      const side = encounterCardInVillainArea(withThreat(g.state, mainScheme(g.state), 5), "01108", 4);
      const { state } = drive(side.state, attackCommand(g.ally, g.minion), accepting([WAR_ROOM], targeting(side.id)));
      expect(threatOf(state, side.id)).toBe(3);
      expect(threatOf(state, mainScheme(state))).toBe(5);
    });

    it("is not offered when the ally does not defeat the minion", () => {
      const g = warRoomGame(0);
      let sawIt = false;
      const { state } = drive(g.state, attackCommand(g.ally, g.minion), (s) => {
        if (offers(s, WAR_ROOM)) sawIt = true;
        return firstLegal(s);
      });
      expect(sawIt).toBe(false);
      expect(inst(state, g.room).exhausted).toBe(false);
    });

    it("is not offered when the hero's own attack defeats the minion", () => {
      const g = warRoomGame(2);
      let sawIt = false;
      drive(g.state, attackCommand(identityOf(g.state, P1), g.minion), (s) => {
        if (offers(s, WAR_ROOM)) sawIt = true;
        return firstLegal(s);
      });
      expect(sawIt).toBe(false);
    });

    it("is not offered when the ally attacks the villain (no minion engaged)", () => {
      const room = support(gambit(), "37030");
      const ally = playIt(room.state, "37012", 4);
      let sawIt = false;
      const { state } = drive(ally.state, attackCommand(ally.id, villainOf(ally.state)), (s) => {
        if (offers(s, WAR_ROOM)) sawIt = true;
        return firstLegal(s);
      });
      expect(sawIt).toBe(false);
      expect(inst(state, villainOf(state)).damage).toBe(2);
      expect(inst(state, room.id).exhausted).toBe(false);
    });

    it("is not offered while exhausted", () => {
      const g = warRoomGame(1);
      const tired = patchInstance(g.state, g.room, { exhausted: true });
      drive(tired, attackCommand(g.ally, g.minion), (s) => {
        expect(offers(s, WAR_ROOM)).toBe(false);
        return firstLegal(s);
      });
    });
  });
});
