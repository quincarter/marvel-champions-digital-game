import { CORE_CARDS, encounterSetId } from "@mc/content";
import { activeEncounterDeckId, createGame, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  picking,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  BLACK_CAT,
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  SPIDER_MAN,
  codeOf,
  heroForm,
  heroThwarts,
  inDiscard,
  inPlayCard,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS } from "../../testing.js";
import { SYNTHEZOID_MODULAR_SCARLET_TWINS, SYNTHEZOID_MODULAR_SCARLET_TWINS_SKIPPED } from "./scarlet-twins.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Scarlet Twins modular set (57060 Speed, 57061 Wiccan, 57062 Superspeed, 57063 Spellcasting, 57064 Superpowered
 * Siblings), docs/phase7-synthezoid.md section 8.3 and M11. Tested in Core's Rhino scenario against Core starter decks
 * with the set's cards added to the encounter deck by hand (as the Deadly Duo tests do).
 */
const SPEED = "57060";
const WICCAN = "57061";
const SUPERSPEED = "57062";
const SPELL = "57063";
const SIBLINGS = "57064";
const SET = [SPEED, WICCAN, SUPERSPEED, SPELL, SIBLINGS];
const REFS = [
  "57060.when-revealed",
  "57061.when-revealed",
  "57062.when-revealed",
  "57062.boost",
  "57063.obligation",
  "57064.when-defeated",
];
const FIRST_AID = "01086"; // Core event, cost 1: heals 4 damage from a character
const WEB_SHOOTER = "01008"; // Core upgrade, cost 1, attaches to your hero
const AUNT_MAY = "01006"; // Core support, cost 1
const ENERGY = "01088"; // Core resources: pay for plays
const GENIUS = "01089";
const STRENGTH = "01090";
const deps = WAVE10_DEPS;

type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL;

function game(seats: readonly Seat[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = WAVE10_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("scarlet_twins")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, deps);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
  return heroForm(settled, ...seats.map((_, i) => [P1, P2][i]!));
}
const villainPhase = (state: GameState, stack: readonly string[]) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...state.players.map((p) => endTurn(p.playerId)),
  );
const playerOf = (s: GameState, p: PlayerId) => s.players.find((x) => x.playerId === p)!;
const damageOn = (s: GameState, p: PlayerId) => inst(s, identityOf(s, p)).damage;
const statusOn = (s: GameState, p: PlayerId, status: "stunned" | "confused") =>
  inst(s, identityOf(s, p)).statuses[status];
const withStatus = (s: GameState, p: PlayerId, status: "stunned" | "confused"): GameState => {
  const id = identityOf(s, p);
  return patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: 1 } });
};
const dataOf = (code: string) =>
  WAVE10_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
/** `player`'s hand set to exactly these Core cards (the rest of the hand goes back to the top of the deck). */
function handOf(state: GameState, player: PlayerId, ...codes: readonly string[]) {
  const given = moveToHand(state, player, ...codes);
  const keep = new Set(given.ids);
  const next: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player
        ? { ...p, hand: [...given.ids], deck: [...p.hand.filter((i) => !keep.has(i)), ...p.deck] }
        : p,
    ),
  };
  return { state: next, ids: [...given.ids] };
}
/**
 * Spellcasting revealed for real in the villain phase (an obligation has no controller; its "you" is the player it was
 * dealt to, RRG 1.8 "Obligation", p. 30). P1 is the revealer: the stack holds one boost card per player's attack, then
 * Spellcasting for P1 and a filler for P2.
 */
function withSpellcasting(state: GameState): GameState {
  const stack = state.players.length > 1 ? [BLANK, BLANK, SPELL, FILLER_A] : [BLANK, SPELL];
  const next = villainPhase(state, stack).state;
  const id = inPlayCard(next, SPELL);
  if (!id || !playerOf(next, P1).playArea.includes(id)) throw new Error("Spellcasting was not dealt to P1");
  return next;
}

describe("registry", () => {
  it("registers the six refs, each valid, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_MODULAR_SCARLET_TWINS).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_MODULAR_SCARLET_TWINS))
      expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_MODULAR_SCARLET_TWINS_SKIPPED).toEqual({});
  });

  it("the card data names exactly these refs, with the printed timing", () => {
    const refs = SET.flatMap((code) => [...abilityRefIds(dataOf(code) as never)]);
    expect(refs.sort()).toEqual([...REFS].sort());
    const trig = (ref: string) => SYNTHEZOID_MODULAR_SCARLET_TWINS[ref]!.trigger;
    expect(trig("57060.when-revealed")).toMatchObject({ kind: "whenRevealed" });
    expect(trig("57062.boost")).toMatchObject({ kind: "boost" });
    expect(trig("57063.obligation")).toMatchObject({ kind: "interrupt" });
    expect(trig("57064.when-defeated")).toMatchObject({ kind: "whenDefeated" });
  });
});

describe("Speed (57060) and Wiccan (57061)", () => {
  it("Speed: you are stunned", () => {
    const run = villainPhase(game(), [BLANK, SPEED]);
    expect(statusOn(run.state, P1, "stunned")).toBe(1);
    const control = villainPhase(game(), [BLANK, FILLER_A]);
    expect(statusOn(control.state, P1, "stunned")).toBe(0);
  });

  it("Speed: already stunned, 'Otherwise' deals 2 damage to the identity and adds no second status", () => {
    const fresh = villainPhase(game(), [BLANK, SPEED]);
    const run = villainPhase(withStatus(game(), P1, "stunned"), [BLANK, SPEED]);
    expect(statusOn(run.state, P1, "stunned")).toBe(1);
    // The same Quickstrike attack lands in both runs; the 2 extra damage is the Otherwise sentence.
    expect(damageOn(run.state, P1) - damageOn(fresh.state, P1)).toBe(2);
  });

  it("Wiccan: you are confused and no threat is placed; already confused, 'Otherwise' places 2 threat", () => {
    const run = villainPhase(game(), [BLANK, WICCAN]);
    const already = villainPhase(withStatus(game(), P1, "confused"), [BLANK, WICCAN]);
    const control = villainPhase(game(), [BLANK, FILLER_A]);
    expect(statusOn(run.state, P1, "confused")).toBe(1);
    expect(statusOn(already.state, P1, "confused")).toBe(1);
    const threat = (s: GameState) => s.instances[s.mainScheme.instanceId]!.threat;
    // Incite 1 adds the same threat in each Wiccan run; the Otherwise sentence adds 2 on top.
    expect(threat(already.state) - threat(run.state)).toBe(2);
    expect(threat(run.state)).toBeGreaterThan(threat(control.state) - 1);
  });
});

describe("Superspeed (57062)", () => {
  // The turn's draw refills a short hand before the villain phase, so a pinned hand holds 5 cards of one cost.
  const costed = (state: GameState, ...codes: string[]) => handOf(state, P1, ...codes).state;
  const reveal = (state: GameState) => {
    const run = villainPhase(state, [BLANK, SUPERSPEED]);
    const control = villainPhase(state, [BLANK, FILLER_A]);
    const lost = playerOf(run.state, P1).discard.filter((i) => !playerOf(control.state, P1).discard.includes(i));
    return { lost, extra: damageOn(run.state, P1) - damageOn(control.state, P1) };
  };

  it("WHEN REVEALED: discards 1 random card from the hand and takes indirect damage equal to its printed cost", () => {
    const hand = costed(game(), FIRST_AID, AUNT_MAY, WEB_SHOOTER, "01004", "01007"); // all cost 1
    const { lost, extra } = reveal(hand);
    expect(lost).toHaveLength(1);
    expect(playerOf(hand, P1).hand).toContain(lost[0]);
    expect(extra).toBe(1);
  });

  it("a hand of cost-0 cards and resources (no cost) discards one and takes no damage", () => {
    const hand = costed(game(), "01003", "01061", ENERGY, GENIUS, STRENGTH);
    const { lost, extra } = reveal(hand);
    expect(lost).toHaveLength(1);
    expect(extra).toBe(0);
  });

  it("an empty hand and deck discards nothing and takes no damage", () => {
    const empty = handOf(game(), P1).state;
    const bare = {
      ...empty,
      players: empty.players.map((p) => (p.playerId === P1 ? { ...p, deck: [] } : p)),
    } as GameState;
    const { lost, extra } = reveal(bare);
    expect(lost).toHaveLength(0);
    expect(extra).toBe(0);
  });

  it("BOOST: the attacked player discards 1 card from their hand", () => {
    const { state, ids } = handOf(game(), P1, BLACK_CAT, AUNT_MAY);
    const run = villainPhase(state, [SUPERSPEED, FILLER_A]);
    const control = villainPhase(state, [BLANK, FILLER_A]);
    const gone = (s: GameState) => ids.filter((i) => playerOf(s, P1).discard.includes(i));
    expect(gone(control.state)).toHaveLength(0);
    expect(gone(run.state)).toHaveLength(1);
  });
});

describe("Spellcasting (57063) forced interrupt (M11)", () => {
  const paid = (s: GameState, id: InstanceId, cost: number) => payWith(s, P1, cost, [id]);

  it("EVENT: its effects are canceled (the cost is paid), the event is discarded, then Spellcasting is discarded", () => {
    const { state, ids } = handOf(withSpellcasting(game()), P1, FIRST_AID, BLACK_CAT);
    const hurt = patchInstance(state, identityOf(state, P1), { damage: 4 });
    const aid = ids[0]!;
    const payment = paid(hurt, aid, 1);
    const run = driveEventsPicking(deps, hurt, picking(identityOf(hurt, P1)), play(P1, aid, payment));
    expect(damageOn(run.state, P1)).toBe(4);
    expect(playerOf(run.state, P1).discard).toContain(aid);
    expect(playerOf(run.state, P1).discard).toContain(payment[0]); // the payment was spent
    expect(inPlayCard(run.state, SPELL)).toBeUndefined();
    expect(inDiscard(run.state, SPELL)).toHaveLength(1);
  });

  it("control: without Spellcasting First Aid heals", () => {
    const { state, ids } = handOf(game(), P1, FIRST_AID, BLACK_CAT);
    const hurt = patchInstance(state, identityOf(state, P1), { damage: 4 });
    const pick = picking(identityOf(hurt, P1));
    const run = driveEventsPicking(deps, hurt, pick, play(P1, ids[0]!, paid(hurt, ids[0]!, 1)));
    expect(damageOn(run.state, P1)).toBe(2); // First Aid heals 2
  });

  it("ALLY: the ally is discarded instead of staying in play, and Spellcasting is discarded", () => {
    const { state, ids } = handOf(withSpellcasting(game()), P1, BLACK_CAT, FIRST_AID, AUNT_MAY);
    const cat = ids[0]!;
    const run = driveEventsPicking(deps, state, firstLegal, play(P1, cat, paid(state, cat, 2)));
    expect(inPlayCard(run.state, BLACK_CAT)).toBeUndefined();
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(inPlayCard(run.state, SPELL)).toBeUndefined();
    expect(inDiscard(run.state, SPELL)).toHaveLength(1);
  });

  it("control: without Spellcasting the ally stays in play", () => {
    const { state, ids } = handOf(game(), P1, BLACK_CAT, FIRST_AID, AUNT_MAY);
    const run = driveEventsPicking(deps, state, firstLegal, play(P1, ids[0]!, paid(state, ids[0]!, 2)));
    expect(inPlayCard(run.state, BLACK_CAT)).toBeDefined();
  });

  it("UPGRADE: the upgrade is discarded instead of attaching, and Spellcasting is discarded", () => {
    const { state, ids } = handOf(withSpellcasting(game()), P1, WEB_SHOOTER, FIRST_AID);
    const shooter = ids[0]!;
    const run = driveEventsPicking(
      deps,
      state,
      firstLegal,
      play(P1, shooter, paid(state, shooter, 1), { attachToInstanceId: identityOf(state, P1) }),
    );
    expect(inPlayCard(run.state, WEB_SHOOTER)).toBeUndefined();
    expect(inst(run.state, identityOf(run.state, P1)).attachments).toEqual([]);
    expect(playerOf(run.state, P1).discard).toContain(shooter);
    expect(inDiscard(run.state, SPELL)).toHaveLength(1);
  });

  it("control: without Spellcasting the upgrade attaches", () => {
    const { state, ids } = handOf(game(), P1, WEB_SHOOTER, FIRST_AID);
    const run = driveEventsPicking(
      deps,
      state,
      firstLegal,
      play(P1, ids[0]!, paid(state, ids[0]!, 1), { attachToInstanceId: identityOf(state, P1) }),
    );
    expect(inst(run.state, identityOf(run.state, P1)).attachments).toContain(ids[0]);
  });

  it("SUPPORT: the support is discarded, and only the first card is canceled (the obligation is gone after)", () => {
    const { state, ids } = handOf(withSpellcasting(game()), P1, AUNT_MAY, BLACK_CAT, ENERGY, GENIUS, STRENGTH);
    const [may, cat, energy, genius, strength] = ids as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const first = driveEventsPicking(deps, state, firstLegal, play(P1, may, [energy]));
    expect(inPlayCard(first.state, AUNT_MAY)).toBeUndefined();
    expect(playerOf(first.state, P1).discard).toContain(may);
    expect(inDiscard(first.state, SPELL)).toHaveLength(1);
    const second = driveEventsPicking(deps, first.state, firstLegal, play(P1, cat, [genius, strength]));
    expect(inPlayCard(second.state, BLACK_CAT)).toBeDefined(); // Spellcasting is gone: the next card is not canceled
  });

  it("TWO PLAYERS: it answers only its holder's plays (RRG 1.8 'Obligation', p. 30)", () => {
    const base = withSpellcasting(game([SPIDER_MAN, CAPTAIN_MARVEL]));
    const p2 = playerOf(base, P2);
    const typeOf = (code: string) => (CORE_CARDS.find((c) => (c.id as string) === code) as { type: string }).type;
    const costOf = (code: string) => (CORE_CARDS.find((c) => (c.id as string) === code) as { cost?: number }).cost ?? 0;
    const ally = [...p2.hand, ...p2.deck].find(
      (i) => typeOf(codeOf(base, i)) === "ally" && costOf(codeOf(base, i)) <= 3,
    );
    expect(ally).toBeDefined();
    const code = codeOf(base, ally!);
    const given = moveToHand(base, P2, code);
    const id = given.ids[0]!;
    const payment = payWith(given.state, P2, costOf(code), [id]);
    const run = driveEventsPicking(deps, given.state, firstLegal, play(P2, id, payment));
    expect(inPlayCard(run.state, code)).toBeDefined(); // P2's ally is not canceled
    expect(inPlayCard(run.state, SPELL)).toBeDefined(); // and the obligation stays
  });
});

/** P1 ends the turn so P2 is the active player. */
const passTurn = (s: GameState): GameState => driveEventsPicking(deps, s, firstLegal, endTurn(P1)).state;

describe("Superpowered Siblings (57064)", () => {
  it("is data: a side scheme with Hinder 1 per hero", () => {
    const card = dataOf(SIBLINGS);
    expect([card.type, card.startingThreat, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("WHEN DEFEATED: the defeating player (P2) discards 1 card from their hand; P1 does not", () => {
    const placed = encounterCardInVillainArea(game([SPIDER_MAN, CAPTAIN_MARVEL]), SIBLINGS, 1);
    const run = heroThwarts(deps, passTurn(placed.state), placed.id, { player: P2 });
    const handSize = (s: GameState, p: PlayerId) => playerOf(s, p).hand.length;
    const before = passTurn(placed.state);
    expect(handSize(run.state, P2)).toBe(handSize(before, P2) - 1);
    expect(handSize(run.state, P1)).toBe(handSize(before, P1));
  });

  it("does nothing while it stands", () => {
    const placed = encounterCardInVillainArea(game([SPIDER_MAN, CAPTAIN_MARVEL]), SIBLINGS, 3);
    const run = heroThwarts(deps, passTurn(placed.state), placed.id, { player: P2 });
    expect(playerOf(run.state, P2).hand).toHaveLength(playerOf(placed.state, P2).hand.length);
  });
});

/**
 * A cancelled play never enters play (RRG 1.8 "Initiating Abilities", p. 24: the card is on the table, not in play,
 * until step 7; "Cancel", p. 11: "Abilities dependent on the canceled effect cannot trigger"), and the costs stand.
 */
describe("Spellcasting (57063): a cancelled card never enters play", () => {
  const HUNTED = "56007"; // Tigra's upgrade: an additional cost puts a minion into play; attach to it and stun it
  const deckOf = (s: GameState) => playerOf(s, P1).deck;
  const blackCat = (state: GameState) => {
    const { state: given, ids } = handOf(state, P1, BLACK_CAT, FIRST_AID, AUNT_MAY);
    const cat = ids[0]!;
    return {
      before: given,
      run: driveEventsPicking(deps, given, firstLegal, play(P1, cat, payWith(given, P1, 2, [cat]))),
    };
  };

  it("BLACK CAT: 'After you play Black Cat' does not resolve: the deck is untouched", () => {
    const { before, run } = blackCat(withSpellcasting(game()));
    expect(inPlayCard(run.state, BLACK_CAT)).toBeUndefined();
    expect(deckOf(run.state)).toEqual(deckOf(before));
  });

  it("control: without Spellcasting Black Cat discards the top 2 cards of the deck", () => {
    const { before, run } = blackCat(game());
    expect(inPlayCard(run.state, BLACK_CAT)).toBeDefined();
    expect(deckOf(run.state)).toEqual(deckOf(before).slice(2));
  });

  /** Hunted in P1's hand (a deck card patched into it), and a Speed in the encounter deck to hunt. */
  function hunted(state: GameState) {
    const patched = patchInstance(state, deckOf(state)[0]!, { cardId: HUNTED as never });
    const { state: given, ids } = moveToHand(patched, P1, HUNTED);
    const pile = given.encounterDecks[activeEncounterDeckId(given)]!;
    const speed = pile.deck.find((i) => codeOf(given, i) === SPEED)!;
    expect(speed).toBeDefined();
    const run = driveEventsPicking(
      deps,
      given,
      firstLegal,
      play(P1, ids[0]!, [], { costChoices: { hunted: [speed] } }),
    );
    return { run, hunted: ids[0]!, speed };
  }

  it("HUNTED: the cost stands (the minion is in play, engaged), but nothing attaches and nothing is stunned", () => {
    const { run, hunted: id, speed } = hunted(withSpellcasting(game()));
    expect(inst(run.state, speed).engagedWith).toBe(P1);
    expect(inst(run.state, speed).statuses.stunned).toBe(0);
    expect(inst(run.state, speed).attachments).toEqual([]);
    expect(playerOf(run.state, P1).discard).toContain(id);
    expect(inDiscard(run.state, SPELL)).toHaveLength(1);
  });

  it("control: without Spellcasting Hunted attaches to the minion and stuns it", () => {
    const { run, hunted: id, speed } = hunted(game());
    expect(inst(run.state, speed).attachments).toEqual([id]);
    expect(inst(run.state, speed).statuses.stunned).toBe(1);
  });
});
