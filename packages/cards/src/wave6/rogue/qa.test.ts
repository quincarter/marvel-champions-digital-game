import { cardId } from "@mc/content";
import {
  activeVillain,
  cardsInPlay,
  characterProfile,
  controllerOf,
  createGame,
  replay,
  sessionApply,
  startSession,
  traitsOf,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import {
  endTurn,
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
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { SHIELD, exodusGame, inPlay as exodusInPlay, reveal as revealExodus } from "../gambit/exodus/testing.js";
import { BONEBREAKER, PIERCE, reaversGame, reveal as revealReavers } from "./reavers/testing.js";
import { rogueGame } from "./rogue/support.js";

/**
 * Wave 6 rules QA, Rogue pack (`docs/phase7-wave6-qa-gambit-rogue.md`). Two parts.
 *
 * 1. Errata, FAQ entries and rulings that touch a card of the pack (Rogue, her nemesis set, the Reavers modular set).
 *    Already pinned exactly by a module test, so not copied here:
 *    - Erratum RRG 1.8 p. 69, Anna Marie (#1A), "Setup: Find your Touched upgrade and set it aside. Withdrawn ...": `rogue/
 *      identity.test.ts` "38001b.setup (Anna Marie)" and "38001b.withdrawn (Anna Marie)".
 *    - Erratum p. 69, Rogue (#1B) and Energy Transfer (#7), "Find Touched and attach it to ...": `rogue/identity.test.ts`
 *      "38001a.skin-contact" ("finds Touched wherever it is: in her hand, and already attached elsewhere") and `rogue/
 *      events.test.ts` "Energy Transfer (38007)" (set aside, hand, moving between hosts).
 *    - Erratum p. 69, Mystique's Manipulations (#26), "The defeating player searches ...": `rogue/obligation-nemesis.test.ts`
 *      "38026.when-defeated" (the first player is not the defeating one; a set-aside Misled is not found).
 *    - Erratum p. 69, Bonebreaker (#31), Forced Interrupt to Forced Response: `reavers/index.test.ts` "38031.bonebreaker-
 *      forced-response" (1 and 2 Reavers engaged).
 *    - Ruling Jan 17, 2026 (3) #1 and RRG "Prevent" (p. 35) for Bulletproof Belle with a plain attacker: `rogue/events.test.ts`
 *      "Bulletproof Belle (38008)". The Piercing half is below.
 *    - Superpower Adaptation's event goes back to its owner's discard pile (RRG "Ownership and Control", p. 31; Q29):
 *      `rogue/events.test.ts` "the card stays P2's: played by Rogue, it goes to P2's discard pile, not hers".
 *    - Touched on another player's hero is controlled by that player (RRG p. 31, owner decision 2026-10-03) and still
 *      grants Rogue stalwart: `rogue/identity.test.ts` "Hero in a 2-player game: Touched on P2's hero is controlled by P2".
 *    - Energy Transfer's damage is a cost, paid when a tough card prevents it (RRG "Cost" p. 14, "Prevent" p. 35): `rogue/
 *      events.test.ts` "the 2 damage is a cost: a tough card on the host stops it". The cannot-take-damage host is below.
 *    - Ruling Jan 17, 2026 (1) (Rogue ally copying Hope Summers) and erratum p. 69 Rogue (#12) are the Nightcrawler Hero
 *      Pack's Rogue ally, not a card of this pack. Ruling Dec 17, 2025 (4) #2 (Med Lab 38028): the engine's
 *      `tuck-ref-target.test.ts` and `rogue/support-upgrades-allies.test.ts` "Med Lab (38028)".
 *    New below: Bulletproof Belle against Piercing (ruling Jan 17, 2026 (3) #1), Not Today! with a tough status card (RRG
 *    p. 44, FAQ p. 56), Touched moving between hosts in one turn with Rogue's Jacket, Bulletproof Belle and the copied
 *    traits, Touched left on another player's hero across a round and moved by Skin Contact, Skin Contact finding
 *    Touched in the discard pile (RRG "Find" p. 19), Touched on Exodus behind a Psionic Shield, Energy Transfer onto a
 *    minion that cannot take damage (ruling Jan 26, 2026 (1)), Team-Up from the other hero, and Donald Pierce revealing
 *    Bonebreaker.
 * 2. Whole games with Rogue's precon: 2 players standard (with Gambit) and 1 hero expert, played by the greedy driver and
 *    replayed deep-equal, asserting Skin Contact and Touched's set-aside resolved; one more game with the Reavers set.
 */

const DEPS = WAVE6_DEPS;
const SKIN = "38001a.skin-contact";
const PHASE_RESPONSE = "38001a.rogue-forced-response";
const ENERGY_TRANSFER = "38007";
const BELLE = "38008";
const NOT_TODAY = "38016";
const BELLE_REF = "38008.bulletproof-belle-interrupt";
const NOT_TODAY_REF = "38016.not-today-interrupt";
const JACKET = "38004";
const SPIDER_WOMAN = "01011";
const MERCENARY = "01101"; // Hydra Mercenary: minion, 3 hp, guard, HYDRA
const SENYAKA = "32161"; // an ACOLYTE minion whose attacks gain piercing
const BEAUTY = "38020";
const GAMBIT_ALLY = "38003";
const SONIC_CONVERTER = "01118"; // 3 boost icons
const COG = "01188"; // Caught Off Guard, 1 boost icon
const ADVANCE = "01186";
const SECOND = [{ starterDeckId: "core-spider-man-justice" }];

const rogue = (extra: typeof SECOND = []): GameState =>
  withForm(rogueGame("rhino", { seed: 1, extraPlayers: extra }), { heroForm: 0 });
const me = (state: GameState): InstanceId => identityOf(state, P1);
const villainOf = (state: GameState): InstanceId => activeVillain(state)!.instanceId;
const touchedOf = (state: GameState): InstanceId => instancesOf(state, "38002")[0]!;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const stunned = (state: GameState, id: InstanceId): GameState =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, stunned: 1 } });
const withTough = (state: GameState, id: InstanceId): GameState =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 1 } });
const rogueTraits = (state: GameState): string[] => traitsOf(state, me(state), DEPS).map(String).sort();
const touchedHost = (state: GameState): InstanceId | null => inst(state, touchedOf(state)).attachedTo ?? null;

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

/** Picks `wanted` (in order) at any prompt that offers a card among them; anything else as `firstLegal`. */
const choosing =
  (wanted: readonly InstanceId[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice && choice.prompt.kind !== "chooseTriggers" && choice.options.some((o) => o.ref.kind === "card")) {
      const hit = choice.options.find((o) => o.ref.kind === "card" && wanted.includes(o.ref.instanceId as InstanceId));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };

/** An encounter card turned into `code` and put into play engaged with P1 (surgery: no reveal). */
function engaged(state: GameState, code: string, player = P1): { state: GameState; id: InstanceId } {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const donor = state.encounterDecks[deckId]!.deck.find((i) => state.instances[i]!.cardId !== cardId(code))!;
  return engageMinion(patchInstance(state, donor, { cardId: cardId(code) }), code, player);
}
/** A Core ally of `player` by surgery (the first deck card turned into Spider-Woman, in the play area). */
function withAlly(state: GameState, player = P1): { state: GameState; id: InstanceId } {
  const id = playerOf(state, player).deck[0]!;
  const patched = patchInstance(state, id, { cardId: cardId(SPIDER_WOMAN), controllerId: player, faceup: true });
  return {
    id,
    state: {
      ...patched,
      players: patched.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}
/** Takes `code` out of Rogue's hand and attaches it to `host` by surgery (no play, no cost). */
function attach(state: GameState, code: string, host: InstanceId): GameState {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const removed: GameState = {
    ...given.state,
    players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host, faceup: true, controllerId: P1 });
  return patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] });
}
/** Skin Contact: Touched onto `host`. */
const skinContact = (state: GameState, host: InstanceId) =>
  drive(state, use(P1, me(state), SKIN), choosing([host])).state;
/** Energy Transfer (cost 2, paid with the first two other hand cards) onto `host`. */
function energyTransfer(state: GameState, host: InstanceId) {
  const given = moveToHand(state, P1, ENERGY_TRANSFER);
  const [id] = given.ids as [InstanceId];
  const command = play(P1, id, payWith(given.state, P1, 2, [id]), { costChoices: { host: [host] } });
  return drive(given.state, command);
}
/** Plays the rounds on until the next player phase has begun. */
function nextPlayerPhase(state: GameState): GameState {
  let current = state;
  for (const player of state.players) current = drive(current, endTurn(player.playerId)).state;
  return settle(current, firstLegal, (s) => s.step.phase === "player" && s.round > state.round, DEPS);
}

describe("errata and rulings", () => {
  describe("Ruling Jan 17, 2026 (3) #1: Piercing removes the tough status card Bulletproof Belle gives (prevent = damage taken)", () => {
    // "Effects that 'prevent damage' prevent damage taken, not dealt. If Rogue plays Bulletproof Belle and gains a Tough
    // status card, an attack with Piercing that still deals damage to her will remove that Tough status card." Senyaka
    // (32161) is a minion whose attacks gain piercing; Touched sits on him; the villain is stunned.
    function belleAgainst(code: string) {
      const base = engaged(rogue(), code);
      const touched = skinContact(base.state, base.id);
      const given = moveToHand(stunned(touched, villainOf(touched)), P1, BELLE);
      let offered = 0;
      const pick: Picker = (s) => {
        const open = s.pendingChoice;
        if (!open) return [];
        if (open.prompt.kind === "payForCard") return [open.options[0]!.optionId];
        const mine = open.options.filter((o) => o.optionId.includes(BELLE_REF));
        if (mine.length > 0) {
          offered++;
          return [mine[0]!.optionId];
        }
        return firstLegal(s);
      };
      const run = drive(given.state, endTurn(P1), pick);
      expect(run.events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === base.id)).toBe(true);
      expect(offered).toBe(1);
      // The villain phase goes on to deal an encounter card (here a treachery can take the tough card too): only what
      // happened up to that card is the attack's.
      const dealt = run.events.findIndex((e) => e.type === "encounterCardRevealed");
      return { ...run, own: dealt < 0 ? run.events : run.events.slice(0, dealt), minion: base.id };
    }

    it("Senyaka's piercing attack deals damage that Belle prevents: Rogue takes none", () => {
      const { own, state, minion } = belleAgainst(SENYAKA);
      const attack = ofType(own, "attackResolved").find((e) => e.enemyInstanceId === minion)!;
      expect(attack.damageDealt).toBeGreaterThan(0);
      expect(
        ofType(own, "damagePrevented").filter((e) => e.targetInstanceId === me(state) && e.reason === "effect"),
      ).toHaveLength(1);
      // Read from the attack's own events: with the tough card pierced, the encounter card dealt afterwards can damage
      // Rogue, so the final state is not the attack's alone.
      expect(ofType(own, "damageDealt").filter((e) => e.targetInstanceId === me(state))).toEqual([]);
    });

    // The engine pierces before any prevention (`pierceForDamage` in `resolve/event.ts`): the damage is dealt though
    // Belle keeps it from being taken, so the tough card Belle gave goes.
    it("Senyaka's piercing attack discards the tough card Belle just gave (ruling: prevent is damage taken)", () => {
      const { own, state } = belleAgainst(SENYAKA);
      const given = ofType(own, "statusGiven").filter((e) => e.instanceId === me(state) && e.status === "tough");
      const removed = ofType(own, "statusRemoved").filter((e) => e.instanceId === me(state) && e.status === "tough");
      expect(given).toHaveLength(1);
      expect(removed).toHaveLength(1);
      expect(inst(state, me(state)).statuses.tough ?? 0).toBe(0);
    });

    it("control: a minion without piercing leaves the tough card on Rogue", () => {
      const { own, state } = belleAgainst(MERCENARY);
      expect(ofType(own, "statusGiven").filter((e) => e.instanceId === me(state) && e.status === "tough")).toHaveLength(
        1,
      );
      expect(ofType(own, "statusRemoved").filter((e) => e.instanceId === me(state) && e.status === "tough")).toEqual(
        [],
      );
    });
  });

  describe("RRG 'Tough' (p. 44) and FAQ p. 56: a tough status card prevents damage fully, so Rogue 'took no damage'", () => {
    // Not Today! (38016): "+2 DEF ... If you take no damage from that attack, remove 2 threat from a scheme." RRG p. 44:
    // "As a tough status card prevents damage fully, the character who had the tough status card is not considered to
    // have taken damage"; FAQ p. 56: a hero keeps the card only when DEF reduces the damage dealt to zero.
    function defendedAttack(boost: string, withNotToday: boolean) {
      const start = rogue();
      const deckId = Object.keys(start.encounterDecks)[0]!;
      // The deck holds no 3-icon card: the top card is turned into one (surgery).
      const top = start.encounterDecks[deckId]!.deck[0]!;
      const boosted = patchInstance(start, top, { cardId: cardId(boost) });
      const base = withTough(stackEncounterDeck(boosted, boost), me(start));
      const threat = patchInstance(base, base.mainScheme.instanceId, { threat: 3 });
      const given = moveToHand(threat, P1, NOT_TODAY);
      const pick: Picker = (s) => {
        const open = s.pendingChoice;
        if (!open) return [];
        if (open.prompt.kind === "payForCard") return [open.options[0]!.optionId];
        const hero = open.options.find((o) => o.optionId === me(s));
        if (hero && open.prompt.kind === "declareDefender") return [hero.optionId];
        const mine = open.options.filter((o) => o.optionId.includes(NOT_TODAY_REF));
        if (mine.length > 0 && withNotToday) return [mine[0]!.optionId];
        return firstLegal(s);
      };
      const run = drive(given.state, endTurn(P1), pick);
      // Only what happened before the villain phase deals its encounter card (a treachery may hit Rogue too).
      const dealt = run.events.findIndex((e) => e.type === "encounterCardRevealed");
      const own = dealt < 0 ? run.events : run.events.slice(0, dealt);
      return {
        dealt: ofType(own, "damageDealt").filter((e) => e.targetInstanceId === me(run.state)),
        absorbed: ofType(own, "damagePrevented").filter((e) => e.reason === "tough"),
        discarded: ofType(own, "statusRemoved").filter((e) => e.instanceId === me(run.state) && e.status === "tough"),
        removed: ofType(own, "threatRemoved").reduce((n, e) => n + e.amount, 0),
      };
    }

    it("DEF + 2 reduces the attack to 0: the tough card stays and 2 threat comes off", () => {
      const r = defendedAttack(COG, true);
      expect(r.dealt).toEqual([]);
      expect(r.discarded).toEqual([]);
      expect(r.removed).toBe(2);
    });

    it("DEF + 2 is not enough (3 icons): the tough card absorbs the rest and is discarded, still 'no damage taken': 2 threat comes off", () => {
      const r = defendedAttack(SONIC_CONVERTER, true);
      expect(r.discarded).toHaveLength(1);
      expect(r.absorbed.length).toBeGreaterThan(0);
      expect(r.removed).toBe(2);
    });

    it("control: Not Today! not played, the tough card absorbs the 1 damage and no threat comes off", () => {
      const r = defendedAttack(COG, false);
      expect(r.discarded).toHaveLength(1);
      expect(r.absorbed.length).toBeGreaterThan(0);
      expect(r.removed).toBe(0);
    });
  });

  describe("RRG 'Team-Up' (p. 43): Beauty and the Thief (38020) with Gambit as the other player's hero", () => {
    const duo = (secondForm: "hero" | "alterEgo") => {
      const base = rogue([{ starterDeckId: "gambit-justice" }]);
      return secondForm === "hero" ? withForm(base, { heroForm: 0 }, P2) : base;
    };
    const cast = (state: GameState) => {
      const given = moveToHand(state, P1, BEAUTY);
      const [id] = given.ids as [InstanceId];
      return { state: given.state, command: play(P1, id, payWith(given.state, P1, 2, [id])) };
    };

    it("Gambit in hero form satisfies 'Gambit': playable without the Gambit ally", () => {
      const { state, command } = cast(duo("hero"));
      expect(instancesOf(state, GAMBIT_ALLY).some((i) => cardsInPlay(state).includes(i))).toBe(false);
      const run = drive(state, command, choosing([villainOf(state)]));
      expect(inst(run.state, villainOf(run.state)).damage).toBe(4);
    });

    it("control: Gambit's player in alter-ego form (Remy LeBeau) and no ally: refused", () => {
      const { state, command } = cast(duo("alterEgo"));
      expect(rejected(state, command)).toBe(true);
    });
  });

  describe("RRG 'Find' (p. 19): Skin Contact finds Touched in the discard pile", () => {
    it("Touched in Rogue's discard pile (its host left play) is found and attached", () => {
      const base = rogue();
      const touched = touchedOf(base);
      const inDiscard: GameState = {
        ...base,
        players: base.players.map((p) =>
          p.playerId === P1
            ? { ...p, setAside: p.setAside.filter((i) => i !== touched), discard: [...p.discard, touched] }
            : p,
        ),
      };
      const minion = engaged(inDiscard, MERCENARY);
      const state = skinContact(minion.state, minion.id);
      expect(touchedHost(state)).toBe(minion.id);
      expect(playerOf(state, P1).discard).not.toContain(touched);
    });
  });

  describe("Ruling Jan 26, 2026 (1): a cost with damage and another effect is valid on a target that cannot take damage", () => {
    // Cybernetic Enhancements (38035): "Attached minion cannot take damage." Energy Transfer's cost is "attach Touched
    // ... and deal 2 damage to that character" (erratum p. 69), so damage is not its only effect on the host, and
    // dealing damage as a cost is paid even when prevented (RRG "Prevent", p. 35).
    it("Energy Transfer onto a Wade Cole with Cybernetic Enhancements: Touched attaches, the 2 damage is prevented, Rogue heals 2", () => {
      const { state: wadeState } = revealReavers(
        reaversGame({ players: [{ starterDeckId: "rogue-protection" }] }),
        "38032",
        ADVANCE,
        ADVANCE,
      );
      const [wade] = Object.values(wadeState.instances).filter(
        (i) => i.cardId === cardId("38032") && cardsInPlay(wadeState).includes(i.instanceId),
      );
      const hurt = patchInstance(withForm(wadeState, { heroForm: 0 }), me(wadeState), { damage: 3, exhausted: false });
      expect(inst(hurt, wade!.instanceId).attachments.length).toBeGreaterThan(0);
      const run = energyTransfer(hurt, wade!.instanceId);
      expect(touchedHost(run.state)).toBe(wade!.instanceId);
      expect(inst(run.state, wade!.instanceId).damage).toBe(0);
      expect(ofType(run.events, "damagePrevented").some((e) => e.targetInstanceId === wade!.instanceId)).toBe(true);
      expect(inst(run.state, me(run.state)).damage).toBe(1);
    });
  });

  describe("Reavers: Donald Pierce reveals Bonebreaker (Teamwork, Forced Responses)", () => {
    // Pierce's Forced Response reveals the topmost REAVER from the discard pile; Bonebreaker (erratum p. 69: a Forced
    // Response) then counts Pierce and himself, 2 indirect damage, and his teamwork (RRG p. 43) attacks once.
    it("Bonebreaker deals 2 indirect damage (Pierce is engaged) and his teamwork activates once", () => {
      // Alter-ego form: the teamwork activation is a scheme, so only the indirect damage reaches the identity.
      const base = reaversGame({ players: [{ starterDeckId: "rogue-protection" }] });
      const deckId = Object.keys(base.encounterDecks)[0]!;
      const pile = base.encounterDecks[deckId]!;
      const bone = pile.deck.find((i) => base.instances[i]!.cardId === cardId(BONEBREAKER))!;
      const staged: GameState = {
        ...base,
        encounterDecks: {
          ...base.encounterDecks,
          [deckId]: { deck: pile.deck.filter((i) => i !== bone), discard: [bone, ...pile.discard] },
        },
      };
      const run = revealReavers(staged, PIERCE, ADVANCE, ADVANCE);
      const control = revealReavers(staged, "01187", ADVANCE, ADVANCE);
      const ids = resolvedIds(run.events);
      expect(ids).toContain("38029.donald-pierce-forced-response");
      expect(ids).toContain("38031.bonebreaker-forced-response");
      expect(cardsInPlay(run.state)).toContain(bone);
      expect(inst(run.state, bone).engagedWith).toBe(P1);
      expect(inst(run.state, me(run.state)).damage - inst(control.state, me(control.state)).damage).toBe(2);
      expect(
        run.events.filter((e) => e.type === "keywordResolved" && (e as { keyword?: string }).keyword === "teamwork"),
      ).toHaveLength(1);
    });
  });
});

describe("interactions between cards of the pack", () => {
  describe("one turn: Skin Contact onto an ally, Energy Transfer onto a minion, then Bulletproof Belle in the villain phase", () => {
    // Touched moves from the ally to the minion (RRG 'Find', p. 19; one card, not a copy). Every Touched line and the
    // copied traits are live only while it sits on that host (owner decision Q28), so nothing of the ally is kept.
    it("the Jacket bonus, the copied traits and Belle's window follow Touched from host to host", () => {
      const base0 = engaged(rogue(), MERCENARY);
      const ally = withAlly(base0.state);
      const jacketed = attach(ally.state, JACKET, me(ally.state));
      const base = patchInstance(stunned(jacketed, villainOf(jacketed)), me(jacketed), { damage: 3 });
      const powers = (s: GameState) => {
        const p = characterProfile(s, me(s), DEPS)!;
        return { thw: p.thw, atk: p.atk };
      };
      const printed = powers(base);
      const printedTraits = rogueTraits(base);

      // 1. Skin Contact onto the ally: Jacket gives +1 THW, Rogue gains the ally's traits (and AERIAL from Touched).
      const onAlly = skinContact(base, ally.id);
      expect(touchedHost(onAlly)).toBe(ally.id);
      const allyTraits = traitsOf(onAlly, ally.id, DEPS).map(String);
      for (const t of allyTraits) expect(rogueTraits(onAlly)).toContain(t);
      expect(rogueTraits(onAlly)).toContain("AERIAL");
      expect(powers(onAlly)).toEqual({ thw: printed.thw + 1, atk: printed.atk });

      // 2. Energy Transfer onto the minion (same round: Skin Contact's limit is its own): Touched moves.
      const moved = energyTransfer(onAlly, base0.id);
      expect(instancesOf(moved.state, "38002")).toHaveLength(1);
      expect(touchedHost(moved.state)).toBe(base0.id);
      expect(inst(moved.state, ally.id).attachments).not.toContain(touchedOf(moved.state));
      expect(rogueTraits(moved.state)).toContain("HYDRA");
      expect(rogueTraits(moved.state)).not.toContain("AERIAL");
      const minionTraits = traitsOf(moved.state, base0.id, DEPS).map(String);
      for (const t of allyTraits.filter((t) => !printedTraits.includes(t) && !minionTraits.includes(t)))
        expect(rogueTraits(moved.state)).not.toContain(t);
      expect(powers(moved.state)).toEqual({ thw: printed.thw, atk: printed.atk + 1 });
      expect(inst(moved.state, base0.id).damage).toBe(2);
      expect(inst(moved.state, me(moved.state)).damage).toBe(1);

      // 3. Belle in the villain phase: Touched is on the minion, so only the minion's attack offers it (the villain is stunned).
      const given = moveToHand(moved.state, P1, BELLE);
      let offered = 0;
      const pick: Picker = (s) => {
        const open = s.pendingChoice;
        if (!open) return [];
        if (open.prompt.kind === "payForCard") return [open.options[0]!.optionId];
        if (open.options.some((o) => o.optionId.includes(BELLE_REF))) offered++;
        return firstLegal(s);
      };
      const villainPhase = drive(given.state, endTurn(P1), pick);
      const attacks = ofType(villainPhase.events, "attackResolved");
      expect(attacks.some((e) => e.enemyInstanceId === base0.id)).toBe(true);
      expect(offered).toBe(1);
    });
  });

  describe("RRG 'Ownership and Control' (p. 31): Touched left on another player's hero, then moved by Skin Contact", () => {
    // Rogue is put in alter-ego form by surgery (Withdrawn would set Touched aside) so the next player phase's Forced
    // Response, printed on her hero face, does not find it: Touched stays on P2's hero, under P2's control, through the
    // round change. A second Skin Contact in the new round finds it there and moves it.
    it("Skin Contact finds Touched on P2's hero (controlled by P2) in the next round and attaches it to a minion", () => {
      const base = withForm(rogue(SECOND), { heroForm: 0 }, P2);
      const second = identityOf(base, P2);
      const onSecond = skinContact(base, second);
      expect(touchedHost(onSecond)).toBe(second);
      expect(controllerOf(onSecond, touchedOf(onSecond))).toBe(P2);
      const asleep = withForm(onSecond, "alterEgo");
      // The first player token passed to P2: P2 ends their turn, then it is Rogue's.
      const nextRound = nextPlayerPhase(asleep);
      expect(nextRound.round).toBe(onSecond.round + 1);
      const next = drive(nextRound, endTurn(P2)).state;
      expect(touchedHost(next)).toBe(second);
      expect(controllerOf(next, touchedOf(next))).toBe(P2);
      // Round 2: Rogue is a hero again (surgery); the once-per-round limit has reset.
      const minion = engaged(withForm(next, { heroForm: 0 }), MERCENARY);
      const again = skinContact(minion.state, minion.id);
      expect(instancesOf(again, "38002")).toHaveLength(1);
      expect(touchedHost(again)).toBe(minion.id);
      expect(inst(again, second).attachments).not.toContain(touchedOf(again));
      expect(rogueTraits(again)).toContain("HYDRA");
    });
  });

  describe("Touched on Exodus behind a Psionic Shield (Exodus modular set, erratum RRG p. 68)", () => {
    // The Shield replaces Exodus leaving play, so Touched (attached to him) is not discarded with him by the first
    // defeat; once the Shield is gone the next defeat sends Touched to Rogue's discard pile (RRG 'Leaves Play', p. 27).
    it("the first defeat leaves Touched on Exodus; the second sends it to Rogue's discard pile", () => {
      const { state: revealed } = revealExodus(
        exodusGame({ players: [{ starterDeckId: "rogue-protection" }] }),
        "37032",
      );
      const [exodus] = exodusInPlay(revealed, "37032");
      const hero = withForm(revealed, { heroForm: 0 });
      const touched = skinContact(hero, exodus!);
      expect(touchedHost(touched)).toBe(exodus);
      const strike = (state: GameState): GameState => {
        const near = patchInstance(patchInstance(state, exodus!, { damage: 999 }), me(state), { exhausted: false });
        return drive(near, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: me(near),
          targetInstanceId: exodus!,
        }).state;
      };
      const once = strike(touched);
      expect(cardsInPlay(once)).toContain(exodus);
      expect(inst(once, exodus!).attachments.filter((a) => once.instances[a]!.cardId === cardId(SHIELD))).toEqual([]);
      expect(touchedHost(once)).toBe(exodus);
      const twice = strike(once);
      expect(cardsInPlay(twice)).not.toContain(exodus);
      expect(touchedHost(twice)).toBeNull();
      expect(playerOf(twice, P1).discard).toContain(touchedOf(twice));
    });
  });
});

// Whole games ---------------------------------------------------------------------------------------------------

const WITH_GAMBIT = [{ starterDeckId: "rogue-protection" }, { starterDeckId: "gambit-justice" }] as const;
const SOLO = [{ starterDeckId: "rogue-protection" }] as const;
const VARIANTS: readonly { label: string; options: Omit<Wave6ScenarioOptions, "seed"> }[] = [
  { label: "2 players, standard (with Gambit)", options: { players: WITH_GAMBIT } },
  { label: "1 hero, expert", options: { players: SOLO, difficulty: "expert" } },
];
const resolvedIds = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));

/** First seed of 1..60 whose game (played from setup, no surgery) reaches an outcome and whose events satisfy `wanted`. */
const findGame = (
  options: Omit<Wave6ScenarioOptions, "seed">,
  wanted: (events: readonly GameEvent[]) => boolean,
): { result: DriverResult; events: readonly GameEvent[]; seed: number } => {
  for (let seed = 1; seed <= 60; seed++) {
    const created = createGame(wave6Scenario("rhino", { ...options, seed }), DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, DEPS);
    if (!result.outcome) continue;
    const played = replay(result.session.log, DEPS);
    if (!played.ok) throw new Error("replay failed");
    expect(played.state).toEqual(result.session.state);
    if (wanted(played.events)) return { result, events: played.events, seed };
  }
  throw new Error("no seed of 1..60 ended as wanted");
};

describe.each(VARIANTS)("Rogue vs Rhino ($label)", ({ options }) => {
  it("Skin Contact attaches Touched and Rogue's player phase response sets it aside again, no surgery", () => {
    const { result, events } = findGame(options, (evs) => {
      const ids = resolvedIds(evs);
      return ids.includes(SKIN) && ids.includes(PHASE_RESPONSE);
    });
    expect(result.outcome).not.toBeNull();
    expect(events.length).toBeGreaterThan(0);
  }, 900_000);
});

describe("Rogue vs Rhino with the Reavers modular set (2 players, with Gambit)", () => {
  it("a card of the set is dealt and played, and the game replays deep-equal", () => {
    const { result } = findGame({ players: WITH_GAMBIT, modularSetIds: ["reavers"] }, (evs) =>
      resolvedIds(evs).some((id) => /^3802[9]\.|^3803[0-5]\./.test(id)),
    );
    expect(result.outcome).not.toBeNull();
  }, 900_000);
});
