import { CORE_CARDS, cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  SPIDER_MAN,
  codeOf,
  heroForm,
  heroThwarts,
  inDiscard,
  inPlayCard,
  piles,
  revealedCodes,
  tough,
  types,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS } from "../../testing.js";
import { SYNTHEZOID_MODULAR_MOON_KNIGHT, SYNTHEZOID_MODULAR_MOON_KNIGHT_SKIPPED } from "./moon-knight.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Moon Knight modular set (57065 Moon Knight, 57066 Crescent Dart x2, 57067 Fist of Khonshu, 57068 Khonshu's
 * Avatar), docs/phase7-synthezoid.md section 8.3, M6, M7, M9. Tested in Core's Rhino scenario with the set's cards
 * (and Teenage Superheroes, which re-resolves a minion's When Revealed) added to the encounter deck by hand. The
 * encounter discard pile is staged by surgery (newest first, as the engine keeps it): its topmost card is first.
 */
const MOON = "57065";
const DART = "57066";
const FIST = "57067";
const AVATAR = "57068";
const TEENAGE = "57058"; // resolves the When Revealed of each minion in play; gains surge when none resolved
const TOUGH = "01105"; // Core treachery: Rhino gets a tough status; with one already, this card gains surge
const SHOCKER = "01103"; // Core minion
const PLAIN = "01101"; // Core minion: Rhino's boost card, so no treachery lands in the discard pile first
const REFS = [
  "57065.when-revealed",
  "57066.crescent-dart-forced-interrupt",
  "57067.when-revealed",
  "57067.boost",
  "57068.when-defeated",
];
const deps = WAVE10_DEPS;

type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL;

function game(seats: readonly Seat[] = [SPIDER_MAN], extra: readonly string[] = []): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = WAVE10_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      (c.encounterSetIds.includes(encounterSetId("moon_knight_modular")) || (c.id as string) === TEENAGE),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame(
    { ...config, encounterDeck: [...config.encounterDeck, ...copies, ...extra.map((c) => cardId(c))] },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
  return heroForm(settled, ...seats.map((_, i) => [P1, P2][i]!));
}
/** Every player ends the turn; the villain phase runs on the stacked deck (top first: Rhino's boosts, then reveals). */
const villainPhase = (state: GameState, ...stack: readonly string[]) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...[...state.players]
      .sort((a, b) => Number(b.playerId === state.firstPlayerId) - Number(a.playerId === state.firstPlayerId))
      .map((p) => endTurn(p.playerId)),
  );
const villainOf = (s: GameState) => s.activeVillainId!;
const damageOn = (s: GameState, player: PlayerId = P1) => inst(s, identityOf(s, player)).damage;
/** Surgery: one copy of each code moved from the encounter deck to the discard pile, the first code on top. */
function withDiscard(state: GameState, ...codes: readonly string[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const used: InstanceId[] = [];
  for (const code of codes) {
    const id = pile.deck.find((i) => codeOf(state, i) === code && !used.includes(i));
    if (!id) throw new Error(`no ${code} in the encounter deck`);
    used.push(id);
  }
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => !used.includes(i)), discard: [...used, ...pile.discard] },
    },
  };
}
const exhaustedIdentity = (s: GameState, events: readonly GameEvent[], player: PlayerId = P1) =>
  types(events, "cardExhausted").filter((e) => e.instanceId === identityOf(s, player));
const toughen = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 1 } });
const attackedEvents = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked" ? [e.event] : [],
  );
const instanceOfCode = (s: GameState, code: string) =>
  Object.keys(s.instances).find((i) => codeOf(s, i as InstanceId) === code) as InstanceId;
const typeOfInstance = (s: GameState, id: InstanceId): string =>
  ([...CORE_CARDS, ...WAVE10_CARDS].find((c) => (c.id as string) === codeOf(s, id)) as unknown as { type: string })
    .type;

describe("registry", () => {
  it("registers the five refs, each valid, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_MODULAR_MOON_KNIGHT).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_MODULAR_MOON_KNIGHT))
      expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_MODULAR_MOON_KNIGHT_SKIPPED).toEqual({});
  });

  it("the card data names exactly these refs", () => {
    const refs = [MOON, DART, FIST, AVATAR].flatMap((code) =>
      abilityRefIds(WAVE10_CARDS.find((c) => (c.id as string) === code)!),
    );
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("Moon Knight's When Revealed carries the current text's once-per-phase limit (errata)", () => {
    expect(SYNTHEZOID_MODULAR_MOON_KNIGHT["57065.when-revealed"]!.limit).toEqual({ count: 1, period: "phase" });
    const card = WAVE10_CARDS.find((c) => (c.id as string) === MOON)! as unknown as {
      text: { current: string; printed: string };
    };
    expect(card.text.current).toContain("(Limit once per phase.)");
    expect(card.text.printed).not.toContain("Limit once per phase");
  });
});

describe("Moon Knight (57065) When Revealed", () => {
  it("resolves the When Revealed of the treachery in the discard pile; it stays there and is not revealed", () => {
    const run = villainPhase(withDiscard(game(), TOUGH), PLAIN, MOON, FILLER_A);
    expect(inPlayCard(run.state, MOON)).toBeDefined();
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([MOON]);
    expect(inDiscard(run.state, TOUGH)).toHaveLength(1);
    // Control: an empty discard pile resolves nothing.
    const control = villainPhase(game(), PLAIN, MOON, FILLER_A);
    expect(tough(control.state, villainOf(control.state))).toBe(0);
  });

  it("takes the topmost treachery: Fist of Khonshu on top deals 2 damage and leaves no tough status", () => {
    const control = villainPhase(game(), PLAIN, MOON, FILLER_A);
    const run = villainPhase(withDiscard(game(), FIST, TOUGH), PLAIN, MOON, FILLER_A);
    expect(damageOn(run.state)).toBe(damageOn(control.state) + 2);
    expect(tough(run.state, villainOf(run.state))).toBe(0);
  });

  it("takes the topmost treachery: Tough on top gives the tough status and the Fist deals nothing", () => {
    const control = villainPhase(game(), PLAIN, MOON, FILLER_A);
    const run = villainPhase(withDiscard(game(), TOUGH, FIST), PLAIN, MOON, FILLER_A);
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(damageOn(run.state)).toBe(damageOn(control.state));
  });

  it("skips a non-treachery above the treachery", () => {
    const run = villainPhase(withDiscard(game(), DART, SHOCKER, TOUGH), PLAIN, MOON, FILLER_A);
    expect(tough(run.state, villainOf(run.state))).toBe(1);
  });

  it("with no treachery in the discard pile it does nothing", () => {
    const control = villainPhase(game(), PLAIN, MOON, FILLER_A);
    const run = villainPhase(withDiscard(game(), DART, SHOCKER), PLAIN, MOON, FILLER_A);
    expect(inPlayCard(run.state, MOON)).toBeDefined();
    expect(tough(run.state, villainOf(run.state))).toBe(0);
    expect(damageOn(run.state)).toBe(damageOn(control.state));
    expect(revealedCodes(run.state, run.events)).toEqual([MOON]);
  });

  it("it is not a reveal: a borrowed 'this card gains surge' draws no extra card (control: a real reveal does)", () => {
    const base = game();
    const start = withDiscard(toughen(base, villainOf(base)), TOUGH);
    const run = villainPhase(start, PLAIN, MOON, FILLER_A, FILLER_B);
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([MOON]);
    const real = villainPhase(toughen(base, villainOf(base)), PLAIN, TOUGH, FILLER_A, FILLER_B);
    expect(revealedCodes(real.state, real.events)).toEqual([TOUGH, FILLER_A]);
  });
});

describe("Moon Knight (57065) limit once per phase", () => {
  const twoSeats = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
  const totalDamage = (s: GameState) => damageOn(s, P1) + damageOn(s, P2);

  it("Teenage Superheroes re-resolving Moon Knight in the same phase is limited out: not counted, so Teenage surges", () => {
    const run = villainPhase(withDiscard(game(twoSeats), FIST), PLAIN, PLAIN, MOON, TEENAGE, FILLER_A, FILLER_B);
    expect(revealedCodes(run.state, run.events)).toEqual([MOON, TEENAGE, FILLER_A]);
    // Control: the Fist resolved once only (Moon Knight's own reveal), 2 damage on top of Rhino's attacks.
    const control = villainPhase(game(twoSeats), PLAIN, PLAIN, FILLER_A, FILLER_B);
    expect(totalDamage(run.state)).toBe(totalDamage(control.state) + 2);
  });

  it("the next phase the limit is fresh: Teenage resolves Moon Knight again (Fist again) and does not surge", () => {
    const first = villainPhase(withDiscard(game(twoSeats), FIST), PLAIN, PLAIN, MOON, FILLER_A);
    expect(inPlayCard(first.state, MOON)).toBeDefined();
    // Two rounds of Rhino and Moon Knight would end the game: heal both identities first.
    const healed = first.state.players.reduce(
      (s, p) => patchInstance(s, identityOf(s, p.playerId), { damage: 0 }),
      first.state,
    );
    const run = villainPhase(healed, PLAIN, PLAIN, TEENAGE, FILLER_B);
    const control = villainPhase(healed, PLAIN, PLAIN, FILLER_A, FILLER_B);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE, FILLER_B]);
    expect(totalDamage(run.state)).toBe(totalDamage(control.state) + 2);
  });
});

describe("Fist of Khonshu (57067)", () => {
  it("WHEN REVEALED: exhausts your identity and deals it 2 damage", () => {
    const control = villainPhase(game(), PLAIN, FILLER_A);
    const run = villainPhase(game(), PLAIN, FIST);
    expect(exhaustedIdentity(run.state, run.events)).toHaveLength(1);
    expect(exhaustedIdentity(control.state, control.events)).toHaveLength(0);
    expect(damageOn(run.state)).toBe(damageOn(control.state) + 2);
  });

  it("WHEN REVEALED: an identity that is already exhausted still takes the 2 damage (two joined instructions)", () => {
    const start = game();
    const tired = patchInstance(start, identityOf(start), { exhausted: true });
    const control = villainPhase(tired, PLAIN, FILLER_A);
    const run = villainPhase(tired, PLAIN, FIST);
    expect(damageOn(run.state)).toBe(damageOn(control.state) + 2);
  });

  it("WHEN REVEALED: two players, only the revealing player's identity", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL]);
    const control = villainPhase(start, PLAIN, PLAIN, FILLER_A, FILLER_B);
    const run = villainPhase(start, PLAIN, PLAIN, FILLER_A, FIST);
    expect(damageOn(run.state, P2)).toBe(damageOn(control.state, P2) + 2);
    expect(damageOn(run.state, P1)).toBe(damageOn(control.state, P1));
    expect(exhaustedIdentity(run.state, run.events, P2)).toHaveLength(1);
    expect(exhaustedIdentity(run.state, run.events, P1)).toHaveLength(0);
  });

  it("BOOST: exhausts the defending player's identity", () => {
    const control = villainPhase(game(), PLAIN, FILLER_A);
    const run = villainPhase(game(), FIST, FILLER_A);
    expect(exhaustedIdentity(run.state, run.events)).toHaveLength(1);
    expect(exhaustedIdentity(control.state, control.events)).toHaveLength(0);
  });
});

describe("Crescent Dart (57066)", () => {
  /** Phase 1 reveals Moon Knight (to P1); the Dart is revealed in a later phase. */
  const withMoonKnight = () => villainPhase(game(), PLAIN, MOON, FILLER_A).state;

  it("ATTACH: attaches to Moon Knight when he is in play", () => {
    const run = villainPhase(withMoonKnight(), PLAIN, DART);
    expect(inst(run.state, instanceOfCode(run.state, DART)).attachedTo).toBe(inPlayCard(run.state, MOON));
  });

  it("ATTACH: otherwise to the enemy leader (Rhino)", () => {
    const run = villainPhase(game(), PLAIN, DART);
    expect(inst(run.state, instanceOfCode(run.state, DART)).attachedTo).toBe(villainOf(run.state));
  });

  it("FORCED INTERRUPT on the leader: the attack is ranged and piercing (damage lands through tough), then it is discarded", () => {
    const placed = villainPhase(game(), PLAIN, DART).state;
    const armed = toughen(placed, identityOf(placed));
    const run = villainPhase(armed, PLAIN, FILLER_A);
    const rhino = attackedEvents(run.events).find((a) => a.attackerInstanceId === villainOf(run.state))!;
    expect(rhino.ranged).toBe(true);
    expect(tough(run.state, identityOf(run.state))).toBe(0);
    expect(damageOn(run.state)).toBe(damageOn(armed) + 5); // ATK 2 + the Dart's 2 + the boost card's 1 icon
    expect(inDiscard(run.state, DART)).toHaveLength(1);
    // Control: without the Dart the same tough status stops Rhino's whole attack.
    const base = game();
    const control = villainPhase(toughen(base, identityOf(base)), PLAIN, FILLER_A);
    expect(damageOn(control.state)).toBe(0);
    expect(attackedEvents(control.events).find((a) => a.attackerInstanceId === villainOf(control.state))?.ranged).toBe(
      undefined,
    );
  });

  it("FORCED INTERRUPT on Moon Knight: his attack is ranged too, and the Dart is discarded after it", () => {
    const dressed = villainPhase(withMoonKnight(), PLAIN, DART).state;
    const placed = patchInstance(dressed, identityOf(dressed), { damage: 0 }); // two rounds of hits would end the game
    const moonId = inPlayCard(placed, MOON)!;
    const run = villainPhase(placed, PLAIN, FILLER_A);
    expect(attackedEvents(run.events).find((a) => a.attackerInstanceId === moonId)?.ranged).toBe(true);
    expect(inDiscard(run.state, DART)).toHaveLength(1);
    // Control: with no Dart on him, Moon Knight's attack is not ranged.
    const bare = withMoonKnight();
    const free = villainPhase(patchInstance(bare, identityOf(bare), { damage: 0 }), PLAIN, FILLER_A);
    const plain = attackedEvents(free.events).find((a) => a.attackerInstanceId === inPlayCard(free.state, MOON))!;
    expect(plain.ranged).toBeUndefined();
  });
});

describe("Khonshu's Avatar (57068) When Defeated", () => {
  const avatar = (state: GameState) => encounterCardInVillainArea(state, AVATAR, 1);

  it("discards from the top until a treachery, passing over other cards, and resolves its When Revealed", () => {
    const placed = avatar(game());
    const stacked = stackEncounterDeck(placed.state, SHOCKER, DART, TOUGH, PLAIN);
    const run = heroThwarts(deps, stacked, placed.id);
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(inDiscard(run.state, SHOCKER)).toHaveLength(1);
    expect(inDiscard(run.state, DART)).toHaveLength(1);
    expect(inDiscard(run.state, TOUGH)).toHaveLength(1);
    expect(codeOf(run.state, piles(run.state).deck[0]!)).toBe(PLAIN); // the rest is untouched
    expect(revealedCodes(run.state, run.events)).toEqual([]); // not a reveal
    expect(inDiscard(run.state, AVATAR)).toHaveLength(1);
  });

  it("while threat remains nothing is discarded (control)", () => {
    const placed = encounterCardInVillainArea(game(), AVATAR, 3);
    const run = heroThwarts(deps, stackEncounterDeck(placed.state, TOUGH), placed.id);
    expect(tough(run.state, villainOf(run.state))).toBe(0);
    expect(inDiscard(run.state, TOUGH)).toHaveLength(0);
  });

  it("stops when the encounter deck is emptied with no treachery: nothing resolves", () => {
    const placed = avatar(game());
    const deckId = activeEncounterDeckId(placed.state);
    const onlyMinions = {
      ...placed.state,
      encounterDecks: {
        ...placed.state.encounterDecks,
        [deckId]: {
          deck: piles(placed.state).deck.filter((i) => typeOfInstance(placed.state, i) === "minion"),
          discard: [],
        },
      },
    } as GameState;
    expect(piles(onlyMinions).deck.length).toBeGreaterThan(0);
    const run = heroThwarts(deps, onlyMinions, placed.id);
    expect(tough(run.state, villainOf(run.state))).toBe(0);
    expect(inDiscard(run.state, AVATAR)).toHaveLength(1);
  });

  it("two players: P2 defeats it; the resolved Fist hits the first player (P1), as for an encounter card with no named player", () => {
    const placed = avatar(game([SPIDER_MAN, CAPTAIN_MARVEL]));
    const passed = driveEventsPicking(deps, placed.state, firstLegal, endTurn(P1)).state;
    const stacked = stackEncounterDeck(passed, FIST);
    const run = heroThwarts(deps, stacked, placed.id, { player: P2 });
    expect(damageOn(run.state, P1)).toBe(damageOn(stacked, P1) + 2);
    expect(damageOn(run.state, P2)).toBe(damageOn(stacked, P2));
    expect(mainThreat(run.state)).toBe(mainThreat(stacked));
  });
});

describe("Moon Knight (57065) further cases", () => {
  const twoSeats = [SPIDER_MAN, CAPTAIN_MARVEL] as const;

  it("two players: revealed to P2, the Fist from the discard exhausts and damages P2 only", () => {
    const start = withDiscard(game(twoSeats), FIST);
    const control = villainPhase(game(twoSeats), PLAIN, PLAIN, FILLER_A, MOON);
    const run = villainPhase(start, PLAIN, PLAIN, FILLER_A, MOON);
    expect(inst(run.state, inPlayCard(run.state, MOON)!).engagedWith).toBe(P2);
    expect(damageOn(run.state, P2)).toBe(damageOn(control.state, P2) + 2);
    expect(damageOn(run.state, P1)).toBe(damageOn(control.state, P1));
    expect(exhaustedIdentity(run.state, run.events, P2)).toHaveLength(1);
    expect(exhaustedIdentity(run.state, run.events, P1)).toHaveLength(0);
  });

  it("Teenage Superheroes topmost: it resolves Moon Knight, which is limited out; the chain ends and nothing surges", () => {
    const start = withDiscard(game(), TEENAGE, TOUGH);
    const run = villainPhase(start, PLAIN, MOON, FILLER_A);
    expect(revealedCodes(run.state, run.events)).toEqual([MOON]);
    expect(tough(run.state, villainOf(run.state))).toBe(0); // the Tough below Teenage is never reached
    expect(inDiscard(run.state, TEENAGE)).toHaveLength(1);
  });

  it("a use that changed nothing (empty discard) still counts: Teenage later in the phase is limited out and surges", () => {
    const run = villainPhase(game([SPIDER_MAN, CAPTAIN_MARVEL]), PLAIN, PLAIN, MOON, TEENAGE, FILLER_A, FILLER_B);
    expect(revealedCodes(run.state, run.events)).toEqual([MOON, TEENAGE, FILLER_A]);
  });

  // Changed by the owner's decision of 2026-10-20 (spec §S7 E37, revising docs/phase7-wave4.md §4 Q23): FFG ruling,
  // September 22, 2026, "an ability that targets a card's 'When Revealed' ability would also include the 'Surge'
  // keyword if on that card". Until then this test pinned the opposite (its surge did not resolve).
  it("a treachery with a printed surge keyword in the discard pile: its surge resolves too, dealing the next card", () => {
    const herb = "01158"; // Heart-Shaped Herb, printed surge
    const start = withDiscard(game([SPIDER_MAN], [herb]), herb);
    const run = villainPhase(start, PLAIN, MOON, FILLER_A, FILLER_B);
    // Herb's printed When Revealed (a tough status on Rhino) and its surge (FILLER_A dealt to and revealed by P1).
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([MOON, FILLER_A]);
    // The herb stays in the discard pile: resolving its abilities is not revealing it.
    expect(inDiscard(run.state, herb)).toHaveLength(1);
  });

  it("Moon Knight enters with a tough status (Toughness)", () => {
    const run = villainPhase(game(), PLAIN, MOON, FILLER_A);
    expect(tough(run.state, inPlayCard(run.state, MOON)!)).toBe(1);
  });
});
