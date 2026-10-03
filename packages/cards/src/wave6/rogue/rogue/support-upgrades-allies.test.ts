import { cardId } from "@mc/content";
import {
  characterProfile,
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
  instancesOf,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { DRS_PACK_CARDS } from "../../../wave1/drs/pack-cards.js";
import { WAVE6_DEPS } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { MUT_GEN_PRECON_PLAYER_CARDS } from "../../mut_gen/precon-player-cards.js";
import { ROGUE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";
import { rogueGame } from "./support.js";

const DEPS = WAVE6_DEPS;
const SKIN = "38001a.skin-contact";
const GAMBIT_INTERRUPT = "38003.gambit-interrupt";
const ICEMAN_RESPONSE = "38010.iceman-response";
const KARMA = "38011.karma-response";
const JUDOKA = "38014.judoka-skill-interrupt";
const UNFLAPPABLE = "38013.unflappable-response";
const MOIRA = "38018.moira-mactaggert-response";
const X_GENE = "38019.x-gene-resource";
const MERCENARY = "01101"; // Hydra Mercenary: non-ELITE minion, guard.
const NO_ICONS = "01186"; // Advance, 0 boost icons.
const TWO_ICONS = "01190"; // Shadow of the Past, 2 boost icons.
const SECOND = [{ starterDeckId: "core-spider-man-justice" }];
const MUTANT_SECOND = [{ starterDeckId: "gambit-justice" }];

const REFS = [
  "38003.gambit-constant",
  GAMBIT_INTERRUPT,
  "38004.rogues-jacket-constant",
  "38004.rogues-jacket-constant-2",
  "38010.iceman-constant",
  ICEMAN_RESPONSE,
  KARMA,
  UNFLAPPABLE,
  JUDOKA,
  "38017.defensive-energy-interrupt",
  MOIRA,
  X_GENE,
];

const rogue = (extra: typeof SECOND = []): GameState =>
  withForm(rogueGame("rhino", { seed: 1, extraPlayers: extra }), { heroForm: 0 });
const anna = (extra: typeof SECOND = []): GameState => rogueGame("rhino", { seed: 1, extraPlayers: extra });
const rogueId = (state: GameState): InstanceId => identityOf(state, P1);
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const touchedOf = (state: GameState): InstanceId => instancesOf(state, "38002")[0]!;
const handSize = (state: GameState, player = P1): number => playerOf(state, player).hand.length;
const counter = (state: GameState, id: InstanceId, type: string): number => inst(state, id).counters[type] ?? 0;

/** Applies `command`, answering every choice with `pick`; the log replays to the same state. */
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
/** Picks the card option naming `id` at any non-trigger prompt that offers it. */
const targeting =
  (id: InstanceId, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const hit =
      choice?.prompt.kind !== "chooseTriggers"
        ? choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === id)
        : undefined;
    return hit ? [hit.optionId] : fallback(state);
  };
const offers = (state: GameState, ability: string): boolean =>
  state.pendingChoice?.prompt.kind === "chooseTriggers" &&
  state.pendingChoice.options.some((o) => o.optionId === ability || o.optionId.endsWith(`:${ability}`));
/** Declares the identity as defender (or declines); every other prompt goes to `then`. */
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
const endTurnCommand: Command = { type: "endTurn", playerId: P1 };

/** Moves a copy of `code` to the hand (relabeling a deck card if the precon runs none). */
function give(state: GameState, code: string, player = P1): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const has = [...owner.hand, ...owner.deck, ...owner.discard].some((i) => state.instances[i]!.cardId === cardId(code));
  const base = has ? state : patchInstance(state, owner.deck[0]!, { cardId: cardId(code) });
  const given = moveToHand(base, player, code);
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
/** Plays `code` for real (paying `cost` with other hand cards). */
function playIt(state: GameState, code: string, cost: number, pick: Picker = firstLegal) {
  const given = give(fillHand(state, 8), code);
  const result = drive(given.state, play(P1, given.id, payWith(given.state, P1, cost, [given.id])), pick);
  return { state: result.state, id: given.id, events: result.events, before: given.state };
}
/** Skin Contact: Touched onto `host`. */
const touchOnto = (state: GameState, host: InstanceId): GameState =>
  drive(state, use(P1, rogueId(state), SKIN), targeting(host)).state;
/** P1 ends the turn without doing anything else; it is P2's turn. */
const p2sTurn = (state: GameState): GameState => drive(state, endTurnCommand).state;
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, DEPS)!;
/** Tops P2's hand up to 8 cards. */
const fillHand2 = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => {
    if (p.playerId !== P2 || p.hand.length >= 8) return p;
    const take = p.deck.slice(0, 8 - p.hand.length);
    return { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(take.length) };
  }),
});
const readied = (state: GameState, id: InstanceId): GameState => patchInstance(state, id, { exhausted: false });

describe("Rogue's supports, upgrades, allies and resources (38003, 38004, 38010-38014, 38017-38019)", () => {
  it("registers exactly the ability refs the card data names for them, all valid", () => {
    expect(Object.keys(ROGUE_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    for (const definition of Object.values(ROGUE_SUPPORT_UPGRADES_ALLIES)) {
      expect(validateDefinition(definition)).toEqual([]);
    }
  });

  describe("reprints (38013, 38017)", () => {
    it("are the original scripts of Unflappable 09020 and Defensive Energy 32018", () => {
      expect(ROGUE_SUPPORT_UPGRADES_ALLIES[UNFLAPPABLE]).toBe(DRS_PACK_CARDS["09020.unflappable-response"]);
      expect(ROGUE_SUPPORT_UPGRADES_ALLIES["38017.defensive-energy-interrupt"]).toBe(
        MUT_GEN_PRECON_PLAYER_CARDS["32018.defensive-energy-interrupt"],
      );
    });
  });

  describe("Gambit (38003)", () => {
    it("enters play with 3 charge counters", () => {
      const { state, id } = playIt(rogue(), "38003", 3);
      expect(playerOf(state, P1).playArea).toContain(id);
      expect(counter(state, id, "charge")).toBe(3);
    });

    it("when he attacks, removes 1 counter to deal 1 damage to an enemy of your choice (not only the one attacked)", () => {
      const played = playIt(rogue(), "38003", 3);
      const minion = engageMinion(readied(played.state, played.id), MERCENARY, P1);
      const attack: Command = {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: played.id,
        targetInstanceId: minion.id,
      };
      const villain = villainOf(minion.state);
      const { state } = drive(minion.state, attack, accepting([GAMBIT_INTERRUPT], targeting(villain)));
      expect(counter(state, played.id, "charge")).toBe(2);
      expect(inst(state, villain).damage).toBe(1);
      // The attack itself: his ATK 2 on the minion.
      expect(inst(state, minion.id).damage).toBe(2);
    });

    it("may target the enemy he attacks: 1 extra damage on top of his ATK", () => {
      const played = playIt(rogue(), "38003", 3);
      const ready = readied(played.state, played.id);
      const attack: Command = {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: played.id,
        targetInstanceId: villainOf(ready),
      };
      const { state } = drive(ready, attack, accepting([GAMBIT_INTERRUPT], targeting(villainOf(ready))));
      expect(inst(state, villainOf(state)).damage).toBe(3);
      expect(counter(state, played.id, "charge")).toBe(2);
    });

    it("pays and deals nothing when declined; is not offered with no counters left", () => {
      const played = playIt(rogue(), "38003", 3);
      const ready = readied(played.state, played.id);
      const attack = (s: GameState): Command => ({
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: played.id,
        targetInstanceId: villainOf(s),
      });
      const declined = drive(ready, attack(ready));
      expect(counter(declined.state, played.id, "charge")).toBe(3);
      expect(inst(declined.state, villainOf(ready)).damage).toBe(2);
      const empty = patchInstance(ready, played.id, { counters: { charge: 0 } });
      drive(empty, attack(empty), (s) => {
        expect(offers(s, GAMBIT_INTERRUPT)).toBe(false);
        return firstLegal(s);
      });
    });

    it("is Gambit's own attack only: another ally attacking does not offer it", () => {
      const played = playIt(rogue(), "38003", 3);
      const other = playIt(readied(played.state, played.id), "38012", 2);
      const attack: Command = {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: other.id,
        targetInstanceId: villainOf(other.state),
      };
      drive(readied(other.state, other.id), attack, (s) => {
        expect(offers(s, GAMBIT_INTERRUPT)).toBe(false);
        return firstLegal(s);
      });
    });
  });

  describe("Rogue's Jacket (38004)", () => {
    const withJacket = (state: GameState) => playIt(state, "38004", 1);
    const stats = (state: GameState) => {
      const p = profile(state, rogueId(state));
      return { thw: p.thw, atk: p.atk };
    };
    const ally = (state: GameState) => playIt(state, "38010", 3);

    it("attaches to Rogue and changes nothing while Touched is set aside", () => {
      const base = rogue();
      const jacket = withJacket(base);
      expect(inst(jacket.state, jacket.id).attachedTo).toBe(rogueId(base));
      expect(stats(jacket.state)).toEqual(stats(base));
    });

    it("Touched on a friendly ally: +1 THW and no ATK", () => {
      const base = rogue();
      const jacket = withJacket(base);
      const iceman = ally(jacket.state);
      const touched = touchOnto(iceman.state, iceman.id);
      const without = touchOnto(ally(base).state, iceman.id);
      expect(stats(touched).thw).toBe(stats(without).thw + 1);
      expect(stats(touched).atk).toBe(stats(without).atk);
    });

    it("Touched on a friendly hero (another player's identity): +1 THW", () => {
      const base = rogue(SECOND);
      const jacket = withJacket(base);
      const touched = touchOnto(jacket.state, identityOf(base, P2));
      const without = touchOnto(base, identityOf(base, P2));
      expect(stats(touched).thw).toBe(stats(without).thw + 1);
      expect(stats(touched).atk).toBe(stats(without).atk);
    });

    it("Touched on an enemy (the villain, then a minion): +1 ATK and no THW", () => {
      const base = rogue();
      const jacket = withJacket(base);
      const onVillain = touchOnto(jacket.state, villainOf(base));
      const plainVillain = touchOnto(base, villainOf(base));
      expect(stats(onVillain).atk).toBe(stats(plainVillain).atk + 1);
      expect(stats(onVillain).thw).toBe(stats(plainVillain).thw);
      const minion = engageMinion(jacket.state, MERCENARY, P1);
      const onMinion = touchOnto(minion.state, minion.id);
      const plainMinion = touchOnto(engageMinion(base, MERCENARY, P1).state, minion.id);
      expect(stats(onMinion).atk).toBe(stats(plainMinion).atk + 1);
      expect(stats(onMinion).thw).toBe(stats(plainMinion).thw);
    });

    it("the bonus ends when Touched leaves the host", () => {
      const base = rogue();
      const jacket = withJacket(base);
      const host = villainOf(base);
      const onVillain = touchOnto(jacket.state, host);
      const t = touchedOf(onVillain);
      const gone = patchInstance(patchInstance(onVillain, host, { attachments: [] }), t, { attachedTo: null });
      expect(stats(gone).atk).toBe(stats(jacket.state).atk);
    });
  });

  describe("Iceman (38010)", () => {
    const iceman = () => playIt(rogue(), "38010", 3);
    const villainPhase = (state: GameState, pick: Picker) =>
      drive(stackEncounterDeck(state, NO_ICONS, MERCENARY), endTurnCommand, defending(false, pick));

    it("enters play with 3 freeze counters", () => {
      const played = iceman();
      expect(counter(played.state, played.id, "freeze")).toBe(3);
    });

    it("after a minion enters play, removes 1 freeze counter to stun that minion", () => {
      const played = iceman();
      const { state } = villainPhase(played.state, accepting([ICEMAN_RESPONSE]));
      expect(counter(state, played.id, "freeze")).toBe(2);
      const minions = Object.values(state.instances).filter(
        (i) => i.cardId === cardId(MERCENARY) && i.engagedWith === P1,
      );
      expect(minions).toHaveLength(1);
      expect(minions[0]!.statuses.stunned ?? 0).toBe(1);
    });

    it("pays nothing and stuns nothing when declined; is not offered with no counters left", () => {
      const played = iceman();
      const declined = villainPhase(played.state, firstLegal);
      expect(counter(declined.state, played.id, "freeze")).toBe(3);
      const minion = Object.values(declined.state.instances).find(
        (i) => i.cardId === cardId(MERCENARY) && i.engagedWith === P1,
      );
      expect(minion).toBeDefined();
      expect(minion!.statuses.stunned ?? 0).toBe(0);
      const empty = patchInstance(played.state, played.id, { counters: { freeze: 0 } });
      villainPhase(empty, (s) => {
        expect(offers(s, ICEMAN_RESPONSE)).toBe(false);
        return firstLegal(s);
      });
    });

    it("does not answer a card that is not a minion entering play", () => {
      const played = iceman();
      // Advance (a treachery-free scheme card) on top: nothing enters as a minion.
      drive(
        stackEncounterDeck(played.state, NO_ICONS, NO_ICONS),
        endTurnCommand,
        defending(false, (s) => {
          expect(offers(s, ICEMAN_RESPONSE)).toBe(false);
          return firstLegal(s);
        }),
      );
    });
  });

  describe("Karma (38011)", () => {
    const SANDMAN = "01102"; // an ELITE minion
    /** Karma is played with `minions` engaged; `pick` answers the trigger and target prompts. */
    const karmaGame = (minions: readonly string[], pick: (ids: InstanceId[]) => Picker) => {
      let state = rogue();
      const ids: InstanceId[] = [];
      for (const code of minions) {
        const engaged = engageMinion(state, code, P1);
        state = engaged.state;
        ids.push(engaged.id);
      }
      return { ids, ...playIt(state, "38011", 4, pick(ids)) };
    };

    it("after you play her from your hand, takes control of a non-ELITE minion as a CONTROLLED ally", () => {
      const run = karmaGame([MERCENARY], ([minion]) => accepting([KARMA], targeting(minion!)));
      const minion = inst(run.state, run.ids[0]!);
      expect(minion.treatedAs).toMatchObject({ kind: "ally", consequential: 2, thwFromSch: true, source: run.id });
      expect(minion.treatedAs?.kind === "ally" && minion.treatedAs.traits.map(String)).toEqual(["CONTROLLED"]);
      expect(minion.controllerId).toBe(P1);
      expect(minion.engagedWith).toBeNull();
    });

    it("its THW is its printed SCH (Shocker: 1) and it takes 2 consequential damage after it thwarts", () => {
      const SHOCKER = "01103"; // Shocker: SCH 1, ATK 2, 3 HP
      const run = karmaGame([SHOCKER], ([minion]) => accepting([KARMA], targeting(minion!)));
      const shocker = run.ids[0]!;
      expect(profile(run.state, shocker).thw).toBe(1);
      const scheme = run.state.mainScheme.instanceId;
      const loaded = patchInstance(readied(run.state, shocker), scheme, { threat: 6 });
      const { state } = drive(loaded, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: shocker,
        schemeInstanceId: scheme,
      });
      expect(inst(state, scheme).threat).toBe(5);
      expect(inst(state, shocker).damage).toBe(2);
    });

    it("takes 2 consequential damage after it attacks, using its printed ATK", () => {
      const SHOCKER = "01103";
      const run = karmaGame([SHOCKER], ([minion]) => accepting([KARMA], targeting(minion!)));
      const shocker = run.ids[0]!;
      const { state } = drive(readied(run.state, shocker), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: shocker,
        targetInstanceId: villainOf(run.state),
      });
      expect(inst(state, villainOf(state)).damage).toBe(2);
      expect(inst(state, shocker).damage).toBe(2);
    });

    it("never offers an ELITE minion; with only an ELITE minion in play the response takes nothing", () => {
      const offered: string[][] = [];
      const run = karmaGame([MERCENARY, SANDMAN], ([minion]) =>
        accepting([KARMA], (s) => {
          const choice = s.pendingChoice;
          if (choice && choice.prompt.kind !== "chooseTriggers") {
            offered.push(choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId as string] : [])));
          }
          return targeting(minion!)(s);
        }),
      );
      expect(offered.flat()).toContain(run.ids[0]);
      expect(offered.flat()).not.toContain(run.ids[1]);
      expect(inst(run.state, run.ids[1]!).treatedAs ?? null).toBeNull();
      const onlyElite = karmaGame([SANDMAN], () => accepting([KARMA]));
      expect(inst(onlyElite.state, onlyElite.ids[0]!).treatedAs ?? null).toBeNull();
      expect(inst(onlyElite.state, onlyElite.ids[0]!).engagedWith).toBe(P1);
    });

    it("declining takes nothing", () => {
      const run = karmaGame([MERCENARY], () => firstLegal);
      expect(inst(run.state, run.ids[0]!).treatedAs ?? null).toBeNull();
      expect(inst(run.state, run.ids[0]!).engagedWith).toBe(P1);
    });
  });

  describe("Judoka Skill (38014)", () => {
    const judoka = () => playIt(rogue(), "38014", 2);
    const hit = (state: GameState, pick: Picker) =>
      drive(stackEncounterDeck(state, TWO_ICONS), endTurnCommand, defending(true, pick));
    const damageTaken = (state: GameState) => inst(state, rogueId(state)).damage;

    it("has uses (3 judo counters) and attaches to Rogue", () => {
      const played = judoka();
      expect(counter(played.state, played.id, "judo")).toBe(3);
    });

    it("when you defend against an enemy attack, removes 1 judo counter: that enemy gets -2 ATK for that attack", () => {
      const played = judoka();
      const plain = hit(played.state, firstLegal);
      const judo = hit(played.state, accepting([JUDOKA]));
      expect(damageTaken(plain.state)).toBeGreaterThanOrEqual(2);
      expect(damageTaken(judo.state)).toBe(damageTaken(plain.state) - 2);
      expect(counter(judo.state, played.id, "judo")).toBe(2);
      expect(counter(plain.state, played.id, "judo")).toBe(3);
    });

    it("the -2 ATK lasts for that attack only: the villain's ATK is back to normal afterwards", () => {
      const played = judoka();
      const judo = hit(played.state, accepting([JUDOKA]));
      const plain = hit(played.state, firstLegal);
      expect(profile(judo.state, villainOf(judo.state)).atk).toBe(profile(plain.state, villainOf(plain.state)).atk);
    });

    it("is not offered when you do not defend, or with no judo counters left", () => {
      const played = judoka();
      drive(
        stackEncounterDeck(played.state, TWO_ICONS),
        endTurnCommand,
        defending(false, (s) => {
          expect(offers(s, JUDOKA)).toBe(false);
          return firstLegal(s);
        }),
      );
      const empty = patchInstance(played.state, played.id, { counters: { judo: 0 } });
      hit(empty, (s) => {
        expect(offers(s, JUDOKA)).toBe(false);
        return firstLegal(s);
      });
    });

    it("Max 1 per player: a second copy cannot be played", () => {
      const played = judoka();
      const second = give(fillHand(played.state, 8), "38014");
      expect(rejected(second.state, play(P1, second.id, payWith(second.state, P1, 2, [second.id])))).toBe(true);
    });
  });

  describe("Unflappable (38013)", () => {
    it("after you defend and take no damage, exhausts to draw 1 card (Max 1 per player, any player's control)", () => {
      const played = playIt(rogue(), "38013", 1);
      const staged = stackEncounterDeck(played.state, NO_ICONS);
      const before = handSize(staged);
      const { state } = drive(staged, endTurnCommand, defending(true, accepting([UNFLAPPABLE])));
      expect(inst(state, rogueId(state)).damage).toBe(0);
      expect(inst(state, played.id).exhausted).toBe(true);
      // The end-of-turn draw and the villain phase's encounter card are the same with or without it; compare.
      const plain = drive(staged, endTurnCommand, defending(true, firstLegal));
      expect(handSize(state)).toBe(handSize(plain.state) + 1);
      expect(before).toBeGreaterThan(0);
      const second = give(fillHand(played.state, 8), "38013");
      expect(rejected(second.state, play(P1, second.id, payWith(second.state, P1, 1, [second.id])))).toBe(true);
    });
  });

  describe("Moira MacTaggert (38018)", () => {
    const moira = (extra: typeof SECOND = []) => playIt(anna(extra), "38018", 2);

    it("after a MUTANT alter-ego changes into hero form, exhausts to draw 1 card for that hero's controller", () => {
      const played = moira();
      const before = handSize(played.state);
      const { state } = drive(played.state, { type: "changeForm", playerId: P1 }, accepting([MOIRA]));
      expect(inst(state, played.id).exhausted).toBe(true);
      expect(handSize(state)).toBe(before + 1);
    });

    it("costs nothing and draws nothing when declined", () => {
      const played = moira();
      const { state } = drive(played.state, { type: "changeForm", playerId: P1 });
      expect(inst(state, played.id).exhausted).toBe(false);
      expect(handSize(state)).toBe(handSize(played.state));
    });

    it("not for a change into alter-ego form", () => {
      const played = moira();
      const hero = withForm(played.state, { heroForm: 0 });
      drive(hero, { type: "changeForm", playerId: P1 }, (s) => {
        expect(offers(s, MOIRA)).toBe(false);
        return firstLegal(s);
      });
    });

    it("not for a non-MUTANT alter-ego (Peter Parker)", () => {
      const played = moira(SECOND);
      drive(p2sTurn(played.state), { type: "changeForm", playerId: P2 }, (s) => {
        expect(offers(s, MOIRA)).toBe(false);
        return firstLegal(s);
      });
    });

    it("for another player's MUTANT alter-ego, that hero's controller draws, not Moira's", () => {
      const played = moira(MUTANT_SECOND);
      const turn = p2sTurn(played.state);
      const { state } = drive(turn, { type: "changeForm", playerId: P2 }, accepting([MOIRA]));
      expect(inst(state, played.id).exhausted).toBe(true);
      expect(handSize(state, P2)).toBe(handSize(turn, P2) + 1);
      expect(handSize(state, P1)).toBe(handSize(turn, P1));
    });

    it("is exhausted: not offered a second time that round", () => {
      const played = moira(MUTANT_SECOND);
      const first = drive(played.state, { type: "changeForm", playerId: P1 }, accepting([MOIRA])).state;
      drive(p2sTurn(first), { type: "changeForm", playerId: P2 }, (s) => {
        expect(offers(s, MOIRA)).toBe(false);
        return firstLegal(s);
      });
    });

    it("Play only if your identity has the MUTANT trait: a Spider-Man player cannot play her", () => {
      const asP2 = (extra: typeof SECOND) => {
        const turn = p2sTurn(anna(extra));
        const given = give(fillHand2(turn), "38018", P2);
        const hand = playerOf(given.state, P2)
          .hand.filter((i) => i !== given.id)
          .slice(0, 2);
        return { state: given.state, command: play(P2, given.id, hand) };
      };
      const spider = asP2(SECOND);
      expect(rejected(spider.state, spider.command)).toBe(true);
      // The same play by a MUTANT (Remy LeBeau) is accepted.
      const remy = asP2(MUTANT_SECOND);
      expect(rejected(remy.state, remy.command)).toBe(false);
    });
  });

  describe("X-Gene (38019)", () => {
    const GOIN_ROGUE = "38005"; // an identity-specific event, cost 2
    const HAYMAKER = "01087"; // an Aggression event, cost 2 (not identity-specific)
    const xgene = () => playIt(anna(), "38019", 1);

    it("Play only if your identity has the MUTANT trait; Max 1 per player", () => {
      const asP2 = (extra: typeof SECOND) => {
        const given = give(fillHand2(p2sTurn(anna(extra))), "38019", P2);
        const hand = playerOf(given.state, P2)
          .hand.filter((i) => i !== given.id)
          .slice(0, 1);
        return rejected(given.state, play(P2, given.id, hand));
      };
      expect(asP2(SECOND)).toBe(true);
      expect(asP2(MUTANT_SECOND)).toBe(false);
      const played = xgene();
      const second = give(fillHand(played.state, 8), "38019");
      expect(rejected(second.state, play(P1, second.id, payWith(second.state, P1, 1, [second.id])))).toBe(true);
    });

    it("exhausts to generate a [wild] resource for an identity-specific event: 1 card pays for the cost-2 Goin' Rogue", () => {
      const played = xgene();
      const given = give(fillHand(withForm(played.state, { heroForm: 0 }), 8), GOIN_ROGUE);
      const paying = payWith(given.state, P1, 1, [given.id]);
      const { state } = drive(
        given.state,
        play(P1, given.id, paying, { abilities: [resourceAbility(played.id, X_GENE)] }),
      );
      expect(inst(state, played.id).exhausted).toBe(true);
      expect(playerOf(state, P1).discard).toContain(given.id);
      expect(playerOf(state, P1).discard).toContain(paying[0]);
      expect(handSize(state)).toBe(handSize(given.state) - 2);
    });

    it("generates nothing for an event outside the player's identity set: Haymaker (cost 2) is not paid by it", () => {
      const played = xgene();
      const given = give(fillHand(withForm(played.state, { heroForm: 0 }), 8), HAYMAKER);
      const one = payWith(given.state, P1, 1, [given.id]);
      const two = payWith(given.state, P1, 2, [given.id]);
      expect(rejected(given.state, play(P1, given.id, one, { abilities: [resourceAbility(played.id, X_GENE)] }))).toBe(
        true,
      );
      expect(rejected(given.state, play(P1, given.id, two))).toBe(false);
    });
  });

  describe("Armor (38012) and the resources (38021-38023)", () => {
    it("Armor: Play only if your identity has the X-MEN trait: Rogue can play her, a Spider-Man player cannot", () => {
      const ok = playIt(rogue(), "38012", 2);
      expect(playerOf(ok.state, P1).playArea).toContain(ok.id);
      const asP2 = (extra: typeof SECOND) => {
        const given = give(
          fillHand2(p2sTurn(withForm(rogueGame("rhino", { seed: 1, extraPlayers: extra }), { heroForm: 0 }))),
          "38012",
          P2,
        );
        const hand = playerOf(given.state, P2)
          .hand.filter((i) => i !== given.id)
          .slice(0, 2);
        return rejected(given.state, play(P2, given.id, hand));
      };
      expect(asP2(SECOND)).toBe(true);
    });

    it("Armor has Toughness: it enters play with a tough status card", () => {
      const ok = playIt(rogue(), "38012", 2);
      expect(inst(ok.state, ok.id).statuses.tough ?? 0).toBe(1);
    });
  });
});
