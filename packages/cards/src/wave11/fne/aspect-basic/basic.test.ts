import { FNE_STARTER_DECKS, PLAYABLE_CARDS, cardId } from "@mc/content";
import { applyCommand, createGame, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { buildCrossHeroDeck } from "../../../testing/cross-hero.js";
import {
  P1,
  firstLegal,
  identityOf,
  P2,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE10_ABILITIES } from "../../../wave10/index.js";
import { WAVE11_DEPS as DEPS } from "../../index.js";
import { FNE_ASPECT_BASIC_BASIC as REGISTRY, FNE_ASPECT_BASIC_BASIC_SKIPPED as SKIPPED } from "./basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `fne/aspect-basic/basic` (docs/phase7-wave11.md section 8.4 line 12), 60029 to 60031 and 60055 to 60059.
 * Every card is played from the deck of a Core hero (Spider-Man, the Justice precon, with the card added to his deck;
 * definition of done 4b) against Core's Rhino, so a script that assumes Daredevil fails.
 */
const STICK = "60029";
const CONTINGENCY = "60030";
const DANCE = "60031";
const SEE_NO_EVIL = "60055";
const ELEKTRA = "60007"; // a Martial Artist ally, ATK 2
const LEGAL_TROUBLE = "60026"; // an upgrade for a minion or side scheme
const STEALTH_TRAINING = "60028"; // an upgrade that does not attach to a minion or side scheme
const SHOCKER = "01103"; // Core minion: 3 hit points
const BREAKIN = "01107"; // Core side scheme
const SANDMAN = "01102"; // Core minion
const MINION = "m-minion" as InstanceId;

const REFS = [
  "60029.stick-interrupt",
  "60030.contingency-planning-constant",
  "60030.contingency-planning-action",
  "60031.dance-with-the-devil-action",
  "60055.see-no-evil-hear-no-evil-constant",
  "60056.when-defeated",
];

function coreGame(code: string): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...config, players: [buildCrossHeroDeck(PLAYABLE_CARDS, "core-spider-man-justice", code)] },
    DEPS,
  );
  if (!created.ok) throw new Error(`${code}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return withForm(opened, { heroForm: 0 });
}

const KEY_CODES = [STICK, CONTINGENCY];
/** Surgery: turns fresh deck cards of P1's (one per code, never a card under test) into copies of `codes`. */
function withDeckCopies(state: GameState, ...codes: readonly string[]): GameState {
  let current = state;
  for (const code of codes) {
    const id = playerOf(current, P1).deck.find(
      (i) => !KEY_CODES.includes(inst(current, i).cardId as string) && inst(current, i).cardId !== cardId(code),
    )!;
    current = patchInstance(current, id, { cardId: cardId(code) as never });
  }
  return current;
}
/** Copies of `codes` made from the deck and moved to the hand. */
const toHand = (state: GameState, ...codes: readonly string[]) =>
  moveToHand(withDeckCopies(state, ...codes), P1, ...codes);

/**
 * A game seating the FNE starter decks as they are printed (Daredevil's Justice deck holds Stick, Dance with the Devil,
 * Elektra and Stealth Training; Echo's Protection deck holds Daredevil's ally 60039 and See No Evil, Hear No Evil), in
 * hero form. Only Daredevil or Echo may include the Team-Up cards (deck validation), so those are played from their own
 * decks rather than a Core hero's.
 */
function fneGame(...deckIds: readonly string[]): GameState {
  const config = coreScenario("rhino", {
    players: deckIds.map(() => ({ starterDeckId: "core-spider-man-justice" })),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame({ ...config, players: deckIds.map(seatOf) }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return deckIds.reduce((state, _id, i) => withForm(state, { heroForm: 0 }, i === 0 ? P1 : P2), opened);
}
function seatOf(deckId: string) {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === deckId)!;
  return {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
}
const DAREDEVIL_DECK = "fne-daredevil-justice";
const ECHO_DECK = "fne-echo-protection";

const basicThwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});

const handOf = (s: GameState): InstanceId[] => [...playerOf(s, P1).hand];
const drive = (s: GameState, command: Command, pick: Picker = firstLegal): GameState =>
  settle(runWith(DEPS, s, command), pick, undefined, DEPS);
const rejected = (s: GameState, command: Command): boolean => !applyCommand(s, command, DEPS).ok;
const basicAttack = (attacker: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/** Takes the option whose id ends with one of `wanted` (a card id, or the index of a `chooseOne` option), else the first legal answer. */
const choosing =
  (...wanted: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
    const hits = choice.options.filter((o) => wanted.some((w) => o.optionId.endsWith(w)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections).map((o) => o.optionId) : firstLegal(s);
  };

describe("wave 11 fne/aspect-basic/basic", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("scripts every ref, so nothing is skipped", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });

  it("60056.when-defeated aliases the reprint to its original's script, and the printed text is the original's", () => {
    const text = (code: string): string => {
      const card = PLAYABLE_CARDS.find((c) => (c.id as string) === code) as unknown as { text?: { current: string } };
      return (card.text?.current ?? "").replace(/\s+/g, " ").trim();
    };
    expect(REGISTRY["60056.when-defeated"]).toBe(WAVE10_ABILITIES["40059.when-defeated"]);
    expect(text("60056")).not.toBe("");
    expect(text("60056")).toBe(text("40059"));
  });

  describe("60029.stick-interrupt", () => {
    const setup = () => {
      const stick = stagedInPlay(engageMinion(coreGame(STICK), SANDMAN, MINION), STICK);
      const elektra = stagedInPlay(withDeckCopies(stick.state, ELEKTRA), ELEKTRA);
      return { state: elektra.state, stick: stick.id, elektra: elektra.id };
    };

    it("exhausts Stick for +1 to a Martial Artist's basic attack", () => {
      const s = setup();
      const after = drive(s.state, basicAttack(s.elektra, MINION), choosing("0"));
      expect(inst(after, s.stick).exhausted).toBe(true);
      expect(inst(after, MINION).damage).toBe(3);
    });

    it("takes -1 and readies Stick in the other option", () => {
      const s = setup();
      const exhausted = patchInstance(s.state, s.stick, { exhausted: true });
      const after = drive(exhausted, basicAttack(s.elektra, MINION), choosing("1"));
      expect(inst(after, s.stick).exhausted).toBe(false);
      expect(inst(after, MINION).damage).toBe(1);
    });

    it("does not offer the exhaust option while Stick is exhausted", () => {
      const s = setup();
      const exhausted = patchInstance(s.state, s.stick, { exhausted: true });
      const after = drive(exhausted, basicAttack(s.elektra, MINION), choosing("0"));
      expect(inst(after, MINION).damage).toBe(1);
    });

    it("does not trigger for a character without the Martial Artist trait", () => {
      const s = setup();
      const spider = playerOf(s.state, P1).identity.instanceId as InstanceId;
      const after = drive(s.state, basicAttack(spider, MINION), choosing("0"));
      expect(inst(after, s.stick).exhausted).toBe(false);
    });
  });

  describe("60030 Contingency Planning", () => {
    it("60030.contingency-planning-action: tucks an upgrade for a minion or side scheme from hand, at most 1", () => {
      const staged = stagedInPlay(coreGame(CONTINGENCY), CONTINGENCY);
      const given = toHand(staged.state, LEGAL_TROUBLE, LEGAL_TROUBLE);
      const [first, second] = given.ids as [InstanceId, InstanceId];
      const after = drive(given.state, use(P1, staged.id, "60030.contingency-planning-action"), choosing(first));
      expect(inst(after, staged.id).tucked).toEqual([first]);
      expect(handOf(after)).toContain(second);
      const again = drive(after, use(P1, staged.id, "60030.contingency-planning-action"), choosing(second));
      expect(inst(again, staged.id).tucked).toEqual([first]);
      expect(handOf(again)).toContain(second);
    });

    it("offers only upgrades that can attach to a minion or side scheme", () => {
      const staged = stagedInPlay(coreGame(CONTINGENCY), CONTINGENCY);
      const given = toHand(staged.state, STEALTH_TRAINING);
      const noOthers = {
        ...given.state,
        players: given.state.players.map((p) => ({ ...p, hand: p.hand.filter((i) => given.ids.includes(i)) })),
      } as GameState;
      expect(rejected(noOthers, use(P1, staged.id, "60030.contingency-planning-action"))).toBe(true);
    });

    it("60030.contingency-planning-constant: the tucked upgrade is played as if from hand", () => {
      const staged = stagedInPlay(engageMinion(coreGame(CONTINGENCY), SANDMAN, MINION), CONTINGENCY);
      const given = toHand(staged.state, LEGAL_TROUBLE);
      const tucked = drive(given.state, use(P1, staged.id, "60030.contingency-planning-action"), choosing());
      const id = inst(tucked, staged.id).tucked[0]!;
      const pay = handOf(tucked).slice(0, 2);
      const played = drive(tucked, play(P1, id, pay, { attachToInstanceId: MINION }), choosing());
      expect(inst(played, MINION).attachments).toContain(id);
      expect(inst(played, staged.id).tucked).toEqual([]);
    });
  });

  describe("60029.stick-interrupt, thwarting and other players", () => {
    // The second option (-1, ready Stick) at the choice; Stealth Training's stun goes to the minion.
    const THWART_PICK: Picker = (s) => (s.pendingChoice?.prompt.kind === "chooseOption" ? ["1"] : choosing(MINION)(s));

    /** Daredevil (THW 2, Martial Artist) with Stealth Training; a side scheme at 1 threat and a Shocker. */
    function sideSchemeGame(withStick: boolean) {
      let state = fneGame(DAREDEVIL_DECK);
      if (withStick) state = stagedInPlay(state, STICK).state;
      const training = stagedInPlay(state, STEALTH_TRAINING, { attach: true });
      const scheme = encounterCardInVillainArea(training.state, BREAKIN, 1);
      return { state: engageMinion(scheme.state, SHOCKER, MINION), scheme: scheme.id };
    }

    it("Stick's -1 makes a THW 2 Martial Artist exactly defeat a 1-threat side scheme (Stealth Training responds)", () => {
      const g = sideSchemeGame(true);
      const after = drive(g.state, basicThwart(identityOf(g.state), g.scheme), THWART_PICK);
      expect(inst(after, MINION).statuses.stunned).toBe(1);
    });

    it("without Stick the same thwart has 1 excess threat, so it is not exact and nothing is stunned", () => {
      const g = sideSchemeGame(false);
      const after = drive(g.state, basicThwart(identityOf(g.state), g.scheme), choosing(MINION));
      expect(inst(after, MINION).statuses.stunned).toBe(0);
    });

    it("applies to another player's Martial Artist (friendly, not only your own)", () => {
      const config = coreScenario("rhino", {
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }],
        seed: 1,
        difficulty: "standard",
        modularSetIds: [],
        cardPool: PLAYABLE_CARDS,
      } as never);
      const created = createGame(
        {
          ...config,
          players: [buildCrossHeroDeck(PLAYABLE_CARDS, "core-spider-man-justice", STICK), seatOf(DAREDEVIL_DECK)],
        },
        DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
      const staged = stagedInPlay(
        engageMinion(withForm(withForm(opened, { heroForm: 0 }), { heroForm: 0 }, P2), SANDMAN, MINION, P2),
        STICK,
      );
      // It is P2's turn: Daredevil, another player's Martial Artist, uses a basic power.
      const p2Turn = {
        ...staged.state,
        step: { ...staged.state.step, activePlayerId: P2, remainingPlayerIds: [] },
      } as GameState;
      const daredevil = identityOf(p2Turn, P2);
      const after = drive(p2Turn, basicAttack(daredevil, MINION, P2), choosing("0"));
      expect(inst(after, staged.id).exhausted).toBe(true);
      expect(inst(after, MINION).damage).toBe(3);
    });
  });

  describe("60031.dance-with-the-devil-action", () => {
    it("is played through with Elektra in play (Team-Up), attached to the villain, then discarded for 3 damage", () => {
      const withElektra = stagedInPlay(fneGame(DAREDEVIL_DECK), ELEKTRA).state;
      const given = moveToHand(withElektra, P1, DANCE);
      const dance = given.ids[0]!;
      const villain = given.state.activeVillainId!;
      const played = drive(given.state, play(P1, dance, [], { attachToInstanceId: villain }), choosing());
      expect(inst(played, villain).attachments).toContain(dance);
      const after = drive(played, use(P1, dance, "60031.dance-with-the-devil-action"), choosing());
      expect(inst(after, villain).damage).toBe(3);
      expect(playerOf(after, P1).discard).toContain(dance);
    });

    it("cannot be played without Elektra in play (Team-Up needs Daredevil and Elektra)", () => {
      const given = moveToHand(fneGame(DAREDEVIL_DECK), P1, DANCE);
      const villain = given.state.activeVillainId!;
      expect(rejected(given.state, play(P1, given.ids[0]!, [], { attachToInstanceId: villain }))).toBe(true);
    });
  });

  describe("60055.see-no-evil-hear-no-evil-constant", () => {
    /** Echo's deck with Daredevil's ally 60039 (the deck's own copy) in play: Team-Up satisfied. */
    const withDaredevilAlly = (): GameState => stagedInPlay(fneGame(ECHO_DECK), "60039").state;
    const inHand = (state: GameState): GameState => moveToHand(state, P1, SEE_NO_EVIL).state;
    const playIt = (state: GameState): Command => {
      const id = handOf(state).find((i) => inst(state, i).cardId === SEE_NO_EVIL)!;
      return play(
        P1,
        id,
        handOf(state)
          .filter((i) => i !== id)
          .slice(0, 2),
      );
    };
    const threatened = (state: GameState): GameState =>
      patchInstance(state, state.mainScheme.instanceId, { threat: 9 });

    it("deals 3 damage to an enemy twice (the same option twice)", () => {
      const start = inHand(withDaredevilAlly());
      const villain = start.activeVillainId!;
      const after = drive(start, playIt(start), choosing("0#1", "0#2", villain));
      expect(inst(after, villain).damage).toBe(6);
    });

    it("mixes the options: 3 damage to an enemy and 3 threat removed from a scheme", () => {
      const start = threatened(inHand(withDaredevilAlly()));
      const villain = start.activeVillainId!;
      const after = drive(start, playIt(start), choosing("0#1", "1#2", villain));
      expect(inst(after, villain).damage).toBe(3);
      expect(inst(after, after.mainScheme.instanceId).threat).toBe(6);
    });

    it("removes 3 threat from a scheme, twice", () => {
      const start = threatened(inHand(withDaredevilAlly()));
      const after = drive(start, playIt(start), choosing("1#1", "1#2"));
      expect(inst(after, after.mainScheme.instanceId).threat).toBe(3);
    });

    it("is refused when Echo has no Daredevil in play (RRG p. 43 Team-Up)", () => {
      const start = inHand(fneGame(ECHO_DECK));
      expect(rejected(start, playIt(start))).toBe(true);
    });

    it("is allowed in a two-player game with Daredevil as the other player's identity and no ally", () => {
      const start = inHand(fneGame(ECHO_DECK, DAREDEVIL_DECK));
      const villain = start.activeVillainId!;
      const after = drive(start, playIt(start), choosing("0#1", "0#2", villain));
      expect(inst(after, villain).damage).toBe(6);
    });
  });
});
