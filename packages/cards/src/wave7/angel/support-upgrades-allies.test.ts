import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  type Command,
  type EngineDeps,
  type GameState,
} from "@mc/engine";
import type { InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, dealDamage, draw, enemyAttack, heroAction, query, theVillain } from "../../dsl/index.js";
import { defineAbilities, validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  moveToDiscard,
  withDamage,
  withForm,
} from "../../testing/staging.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { ANGEL_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Angel's allies, supports, upgrades, resources and side scheme (42002, 42008-42013, 42017-42020, 42022, 42023),
 * docs/phase7-wave7.md §7.2, §3.62, §3.68, §3.71. His precon (`angel-protection`) against Stryfe through
 * `wave7Scenario`. Angel (`heroForm: 0`): THW 2, ATK 1, DEF 2; Archangel (`heroForm: 1`): THW 0, ATK 2, DEF 3.
 *
 * Fixtures from his own kit by printed id, whose abilities are another module's: this file overrides their refs in
 * its own `DEPS` with stand-ins that cost and discard as the printed card does: 42015 Ever Vigilant (AERIAL event,
 * cost 2) with a "Hero Action" that deals 2 damage to the villain, 42016 Taunt (a TACTIC event, cost 1) with a plain
 * "Action", and 42007 Razor Dive (AERIAL event, cost 3).
 */
const PSYLOCKE_ALLY = "42002.psylocke-response";
const AVIAN = "42008.avian-anatomy-response";
const WORTHINGTON = "42009.worthington-industries-action";
const WINGS = "42010.techno-organic-wings-action";
const ELIXIR_CONSTANT = "42011.elixir-constant";
const ELIXIR = "42011.elixir-response";
const SIRYN = "42012.siryn-response";
const WARPATH = "42013.warpath-response";
const RENDER = "42017.when-defeated";
const AERIE_RESPONSE = "42018.angels-aerie-response";
const AERIE_ACTION = "42018.angels-aerie-action";
const CONTAINMENT = "42019.containment-strategy-response";
const CANNONBALL = "42020.cannonball-interrupt";
const FLIGHT = "42022.the-power-of-flight-constant";
const ACROBATICS = "42023.soaring-acrobatics-interrupt";
const ALL_REFS = [
  PSYLOCKE_ALLY,
  AVIAN,
  WORTHINGTON,
  WINGS,
  ELIXIR_CONSTANT,
  ELIXIR,
  SIRYN,
  WARPATH,
  RENDER,
  AERIE_RESPONSE,
  AERIE_ACTION,
  CONTAINMENT,
  CANNONBALL,
  FLIGHT,
  ACROBATICS,
];

const ANGEL = { starterDeckId: "angel-protection" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
type Seat = typeof ANGEL | typeof SPIDER_MAN | typeof PSYLOCKE;

const VIGILANT = "42015"; // AERIAL event, printed cost 2, Hero Action (stand-in: 2 damage to the villain)
const TAUNT = "42016"; // TACTIC event, cost 1, a plain Action (stand-in)
const RAZOR_DIVE = "42007"; // AERIAL event, printed cost 3 (stand-in)
const ATTACK_ME = "42006"; // Natural Flight, AERIAL event, cost 2, stand-in: each minion engaged with you attacks you
const ALLY_PSYLOCKE = "42002";
const AVIAN_CARD = "42008";
const WORTHINGTON_CARD = "42009";
const WINGS_CARD = "42010";
const ELIXIR_CARD = "42011";
const SIRYN_CARD = "42012";
const WARPATH_CARD = "42013";
const RENDER_CARD = "42017";
const AERIE_CARD = "42018";
const CONTAINMENT_CARD = "42019";
const CANNONBALL_CARD = "42020";
const FLIGHT_CARD = "42022";
const ACROBATICS_CARD = "42023";
const TIGER_SHARK = "01131"; // ATK 3, 6 hit points, no boost icons
const NO_ICONS = "01186"; // Advance, 0 boost icons
const SIDE_SCHEME = "40131"; // an encounter side scheme (3 threat per player), staged

const FIXTURES = defineAbilities({
  "42015.ever-vigilant-action": heroAction(dealDamage(2, theVillain)),
  "42016.taunt-action": action(draw(0)),
  "42007.razor-dive-action": heroAction(draw(0)),
  // Natural Flight's id as a Hero Action that has each minion engaged with you attack you (an attack in the player phase).
  "42006.natural-flight-action": heroAction(
    enemyAttack({ kind: "each", query: query("minion", { engagedWith: "you" }) }),
  ),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

function setupGame(players: readonly Seat[] = [ANGEL], seed = 1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const WARREN = { alterEgo: true } as const;
const ANGEL_FACE = { heroForm: 0 } as const;
const ARCHANGEL = { heroForm: 1 } as const;
const inForm = (to: typeof WARREN | typeof ANGEL_FACE | typeof ARCHANGEL, players?: readonly Seat[], seed = 1) => {
  const base = setupGame(players, seed);
  return "alterEgo" in to ? base : withForm(base, to);
};
/** The first player's identity in `form`, the others in hero form (so a second seat can act and defend). */
const twoHeroes = (form: typeof ANGEL_FACE | typeof ARCHANGEL, players: readonly Seat[]): GameState =>
  players.reduce((s, _seat, i) => withForm(s, i === 0 ? form : ANGEL_FACE, i === 0 ? P1 : P2), setupGame(players));

const stryfe = (s: GameState): InstanceId => activeVillain(s).instanceId;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const handSize = (s: GameState, p = P1): number => playerOf(s, p).hand.length;
const handCodes = (s: GameState, p = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, DEPS).ok;

/** Accepts every optional response whose id contains one of `wanted`; other prompts take the first option. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return firstLegal(state);
  };
/** Answers the first `chooseTarget` that offers `id` with it; everything else is `accepting(...wanted)`. */
const targeting =
  (id: InstanceId, ...wanted: readonly string[]): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "chooseTarget" && state.pendingChoice.options.some((o) => o.optionId === id)
      ? [id]
      : accepting(...wanted)(state);
/** A defender declared as `defender` (the card by id), every other prompt answered by `then`. */
const defendingWith =
  (defender: InstanceId, then: Picker = firstLegal): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") {
      const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === defender);
      return hit ? [hit.optionId] : ["decline"];
    }
    return then(state);
  };
/** Every response id offered while `pick` drives `commands`. */
function driveOffers(state: GameState, pick: Picker, ...commands: Command[]) {
  const offered = new Set<string>();
  const spy: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTriggers")
      for (const o of s.pendingChoice.options) offered.add(o.optionId);
    return pick(s);
  };
  const result = driveEventsPicking(DEPS, state, spy, ...commands);
  return { ...result, offered };
}
const hasOffer = (offered: Set<string>, ref: string): boolean => [...offered].some((o) => o.includes(ref));

/** Moves `code` into hand and plays it, paying with `pay` (cards already in hand) or the next `cost` other cards. */
function put(
  state: GameState,
  code: string,
  cost: number,
  opts: { attach?: InstanceId; player?: typeof P1; pick?: Picker; pay?: readonly InstanceId[] } = {},
): { state: GameState; id: InstanceId; before: number; offered: Set<string> } {
  const player = opts.player ?? P1;
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const pay = opts.pay ?? payWith(given.state, player, cost, [id]);
  const driven = driveOffers(
    given.state,
    opts.pick ?? firstLegal,
    play(player, id, pay, opts.attach ? { attachToInstanceId: opts.attach } : {}),
  );
  return { state: driven.state, id, before: handSize(given.state, player), offered: driven.offered };
}
/** Test-only surgery: the top `n` deck cards into hand. */
const topUp = (s: GameState, n: number, p = P1): GameState => ({
  ...s,
  players: s.players.map((pl) =>
    pl.playerId === p ? { ...pl, deck: pl.deck.slice(n), hand: [...pl.hand, ...pl.deck.slice(0, n)] } : pl,
  ),
});
/** Test-only surgery: the hand is exactly these cards (the old hand goes to the bottom of the deck). */
function setHand(s: GameState, codes: readonly string[], p = P1): GameState {
  const emptied = {
    ...s,
    players: s.players.map((pl) => (pl.playerId === p ? { ...pl, deck: [...pl.deck, ...pl.hand], hand: [] } : pl)),
  };
  return moveToHand(emptied, p, ...codes).state;
}
/** Test-only surgery: a copy of `code` from `from`'s deck into `to`'s hand, owned and controlled by `to`. */
function handOver(
  state: GameState,
  code: string,
  from: typeof P1,
  to: typeof P1,
): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, from);
  const id = [...owner.hand, ...owner.deck].find((x) => codeOf(state, x) === code);
  if (!id) throw new Error(`${from} has no ${code} in hand or deck`);
  const moved = {
    ...state,
    players: state.players.map((pl) =>
      pl.playerId === from
        ? { ...pl, deck: pl.deck.filter((x) => x !== id), hand: pl.hand.filter((x) => x !== id) }
        : pl.playerId === to
          ? { ...pl, hand: [...pl.hand, id] }
          : pl,
    ),
  };
  return { state: patchInstance(moved, id, { ownerId: to, controllerId: to } as never), id };
}
/** Test-only surgery: the other player's turn (they are the active player). */
const itsTurn = (s: GameState, p: typeof P1): GameState =>
  ({ ...s, step: { ...s.step, activePlayerId: p } }) as GameState;

/** A minion by surgery: `code` engaged with `player`, in their play area. */
function withMinion(state: GameState, code: string, player = P1): { state: GameState; id: InstanceId } {
  const id = `i9${300 + Object.keys(state.instances).length}` as InstanceId;
  const instance = {
    instanceId: id,
    cardId: code,
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: player,
    flipped: false,
  } as unknown as GameState["instances"][string];
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: instance },
    },
  };
}
const stunned = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });

const basicAttack = (target: InstanceId, who: InstanceId, p = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: who,
  targetInstanceId: target,
});
const basicThwart = (scheme: InstanceId, who: InstanceId, p = P1): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: who,
  schemeInstanceId: scheme,
});
/** The villain phase from this state: Stryfe stunned (he does not attack), the encounter deck topped with a 0-icon card. */
function villainPhase(state: GameState, pick: Picker) {
  const quiet = stunned(stackEncounterDeck(state, NO_ICONS), stryfe(state));
  return driveOffers(quiet, pick, ...state.players.map((pl) => endTurn(pl.playerId)));
}

describe("Angel's allies, supports, upgrades and resources registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(ANGEL_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });
  it("holds exactly its refs", () => {
    expect(Object.keys(ANGEL_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...ALL_REFS].sort());
  });
});

describe("Psylocke, the ally (42002)", () => {
  /** Psylocke in play (3 hit points, ATK 1, her attack's consequential damage 1) beside the identity in `form`. */
  const withPsylocke = (form: typeof ANGEL_FACE | typeof ARCHANGEL | typeof WARREN) => {
    const base = topUp(inForm(form), 4);
    return put(base, ALLY_PSYLOCKE, 3);
  };
  it("costs 3 and enters play ready", () => {
    const { state, id, before } = withPsylocke(ANGEL_FACE);
    expect(handSize(state)).toBe(before - 4);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("as Angel, after she attacks, heals 1 damage from her: 1 damage + 1 consequential - 1 healed = 1", () => {
    const { state: s0, id } = withPsylocke(ANGEL_FACE);
    const s = withDamage(s0, id, 1);
    const { state, offered } = driveOffers(s, accepting(PSYLOCKE_ALLY), basicAttack(stryfe(s), id));
    expect(hasOffer(offered, PSYLOCKE_ALLY)).toBe(true);
    expect(damageOn(state, stryfe(state))).toBe(1);
    expect(damageOn(state, id)).toBe(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("declined, the same attack leaves her at 2 damage", () => {
    const { state: s0, id } = withPsylocke(ANGEL_FACE);
    const s = withDamage(s0, id, 1);
    const { state } = driveOffers(s, accepting("nothing"), basicAttack(stryfe(s), id));
    expect(damageOn(state, id)).toBe(2);
  });
  it("as Archangel, after she attacks, readies the hero and heals nothing", () => {
    const { state: s0, id } = withPsylocke(ARCHANGEL);
    const tired = patchInstance(withDamage(s0, id, 1), identityOf(s0), { exhausted: true });
    const { state, offered } = driveOffers(tired, accepting(PSYLOCKE_ALLY), basicAttack(stryfe(tired), id));
    expect(hasOffer(offered, PSYLOCKE_ALLY)).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(damageOn(state, id)).toBe(2);
    expect(damageOn(state, stryfe(state))).toBe(1);
  });
  it("as Angel it does not ready the hero", () => {
    const { state: s0, id } = withPsylocke(ANGEL_FACE);
    const tired = patchInstance(s0, identityOf(s0), { exhausted: true });
    const { state } = driveOffers(tired, accepting(PSYLOCKE_ALLY), basicAttack(stryfe(tired), id));
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("is a Hero Response (hero form only)", () => {
    expect(ANGEL_SUPPORT_UPGRADES_ALLIES[PSYLOCKE_ALLY]!.trigger).toMatchObject({ kind: "response", form: "hero" });
    const { state: s, id } = withPsylocke(WARREN);
    const attack = basicAttack(stryfe(s), id);
    expect(applyCommand(s, attack, DEPS).ok).toBe(true);
    const { offered } = driveOffers(s, accepting(PSYLOCKE_ALLY), attack);
    expect(hasOffer(offered, PSYLOCKE_ALLY)).toBe(false);
  });
  it("two players: Archangel's player readies his own hero only; Spider-Man's identity stays exhausted", () => {
    const s0 = twoHeroes(ARCHANGEL, [ANGEL, SPIDER_MAN]);
    const given = put(topUp(s0, 4, P1), ALLY_PSYLOCKE, 3);
    const tired = patchInstance(
      patchInstance(given.state, identityOf(given.state, P1), { exhausted: true }),
      identityOf(given.state, P2),
      { exhausted: true },
    );
    const { state } = driveOffers(tired, accepting(PSYLOCKE_ALLY), basicAttack(stryfe(tired), given.id));
    expect(inst(state, identityOf(state, P1)).exhausted).toBe(false);
    expect(inst(state, identityOf(state, P2)).exhausted).toBe(true);
  });
  it("unique: cannot be played while a Psylocke identity is in play (another player's), and can without one", () => {
    const s = topUp(twoHeroes(ANGEL_FACE, [ANGEL, PSYLOCKE]), 4);
    const given = moveToHand(s, P1, ALLY_PSYLOCKE);
    const cmd = play(P1, given.ids[0]!, payWith(given.state, P1, 3, [given.ids[0]!]));
    expect(rejected(given.state, cmd)).toBe(true);
    const alone = moveToHand(topUp(inForm(ANGEL_FACE), 4), P1, ALLY_PSYLOCKE);
    expect(
      applyCommand(alone.state, play(P1, alone.ids[0]!, payWith(alone.state, P1, 3, [alone.ids[0]!])), DEPS).ok,
    ).toBe(true);
  });
  it("the Angel ally (41003) in Psylocke's deck is refused while the Angel identity is in play, in every form", () => {
    for (const form of [WARREN, ANGEL_FACE, ARCHANGEL] as const) {
      const players = [PSYLOCKE, ANGEL] as const;
      const base = setupGame(players);
      const s =
        "alterEgo" in form
          ? withForm(withForm(base, ANGEL_FACE, P1), "alterEgo", P2)
          : withForm(withForm(base, ANGEL_FACE, P1), form, P2);
      const given = moveToHand(topUp(s, 4), P1, "41003");
      const cmd = play(P1, given.ids[0]!, payWith(given.state, P1, 3, [given.ids[0]!]));
      expect(rejected(given.state, cmd), JSON.stringify(form)).toBe(true);
    }
    const alone = moveToHand(topUp(setupGame([PSYLOCKE]), 4), P1, "41003");
    const cmd = play(P1, alone.ids[0]!, payWith(alone.state, P1, 3, [alone.ids[0]!]));
    expect(applyCommand(withForm(alone.state, ANGEL_FACE), cmd, DEPS).ok).toBe(true);
  });
});

describe("Avian Anatomy (42008)", () => {
  /** A hand of exactly these cards, an AERIAL event among them, Avian Anatomy first. */
  const staged = (codes: readonly string[], form = ANGEL_FACE, players?: readonly Seat[]) =>
    setHand(inForm(form, players), codes);
  const eventPaidWith = (
    s: GameState,
    event: string,
    pay: readonly string[],
    pick: Picker,
    player = P1,
    cards?: readonly InstanceId[],
  ) => {
    const given = moveToHand(s, player, event, ...pay);
    const [id, ...rest] = given.ids as [InstanceId, ...InstanceId[]];
    const paid = cards ?? rest;
    const driven = driveOffers(given.state, pick, play(player, id, paid));
    return { ...driven, id, before: handSize(given.state, player) };
  };
  it("is an any-form response to spending this card to play an AERIAL event (no form label)", () => {
    expect(ANGEL_SUPPORT_UPGRADES_ALLIES[AVIAN]!.trigger).not.toHaveProperty("form");
  });
  it("paying for an AERIAL event with it, the event goes back to hand after it resolves: the 2 damage still lands", () => {
    const s = staged([AVIAN_CARD, TAUNT]);
    const r = eventPaidWith(s, VIGILANT, [AVIAN_CARD, TAUNT], accepting(AVIAN));
    expect(hasOffer(r.offered, AVIAN)).toBe(true);
    expect(damageOn(r.state, stryfe(r.state))).toBe(2);
    expect(handCodes(r.state)).toEqual([VIGILANT]);
    expect(discardCodes(r.state).sort()).toEqual([AVIAN_CARD, TAUNT].sort());
  });
  it("optional: declined, the event is discarded", () => {
    const s = staged([AVIAN_CARD, TAUNT]);
    const r = eventPaidWith(s, VIGILANT, [AVIAN_CARD, TAUNT], accepting("nothing"));
    expect(hasOffer(r.offered, AVIAN)).toBe(true);
    expect(handCodes(r.state)).toEqual([]);
    expect(discardCodes(r.state)).toContain(VIGILANT);
  });
  it("not an AERIAL event: Taunt paid with it offers nothing and is discarded", () => {
    const s = staged([AVIAN_CARD]);
    const r = eventPaidWith(s, TAUNT, [AVIAN_CARD], accepting(AVIAN));
    expect(hasOffer(r.offered, AVIAN)).toBe(false);
    expect(discardCodes(r.state)).toContain(TAUNT);
  });
  it("not an event: Siryn (an AERIAL ally) paid with it offers nothing", () => {
    const s = staged([AVIAN_CARD, TAUNT, TAUNT, TAUNT]);
    const r = eventPaidWith(s, SIRYN_CARD, [AVIAN_CARD, TAUNT, TAUNT, TAUNT], accepting(AVIAN));
    expect(hasOffer(r.offered, AVIAN)).toBe(false);
  });
  it("two copies spent on one event return it once", () => {
    const s = staged([AVIAN_CARD, AVIAN_CARD, TAUNT]);
    const r = eventPaidWith(s, RAZOR_DIVE, [AVIAN_CARD, AVIAN_CARD, TAUNT], accepting(AVIAN));
    expect(handCodes(r.state)).toEqual([RAZOR_DIVE]);
    expect(discardCodes(r.state).filter((c) => c === RAZOR_DIVE)).toEqual([]);
  });
  it("the event was still played: Angel of Life (after you play an AERIAL event, draw 1) answers it", () => {
    const s = staged([AVIAN_CARD, TAUNT]);
    const r = eventPaidWith(s, VIGILANT, [AVIAN_CARD, TAUNT], accepting(AVIAN, "42001a.angel-of-life"));
    expect(hasOffer(r.offered, "42001a.angel-of-life")).toBe(true);
    expect(handSize(r.state)).toBe(r.before - 3 + 1 + 1);
  });
  it("two players: another player's AERIAL event does not offer Angel's copy, and his zones are untouched", () => {
    const first = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const withAvian = setHand(first, [AVIAN_CARD, TAUNT], P1);
    const turn = driveEventsPicking(DEPS, withAvian, firstLegal, endTurn(P1)).state;
    const second = withForm(turn, ANGEL_FACE, P2);
    const kick = moveToHand(second, P2, "01005");
    const paid = payWith(kick.state, P2, 3, [kick.ids[0]!]);
    const r = eventPaidWith(second, "01005", [], accepting(AVIAN), P2, paid);
    expect(hasOffer(r.offered, AVIAN)).toBe(false);
    expect(handCodes(r.state, P1)).toEqual(handCodes(second, P1));
  });
});

describe("The Power of Flight (42022)", () => {
  const trying = (target: string, others: readonly string[], form = ANGEL_FACE) => {
    const s = setHand(inForm(form), [FLIGHT_CARD, ...others]);
    const given = moveToHand(s, P1, target);
    const [id] = given.ids as [InstanceId];
    const hand = playerOf(given.state, P1).hand.filter((x) => x !== id);
    return { state: given.state, command: play(P1, id, hand) };
  };
  const ok = (target: string, others: readonly string[], form = ANGEL_FACE) => {
    const t = trying(target, others, form);
    return applyCommand(t.state, t.command, DEPS).ok;
  };
  it("is one definition of its own, an energy resource whose icon is doubled for an AERIAL card", () => {
    expect(ANGEL_SUPPORT_UPGRADES_ALLIES[FLIGHT]).toMatchObject({
      trigger: { kind: "constant" },
    });
  });
  it("an AERIAL ally (Siryn, cost 4): it and 2 other cards pay for it (2 + 1 + 1); it and 1 other do not (2 + 1)", () => {
    expect(ok(SIRYN_CARD, [TAUNT, TAUNT])).toBe(true);
    expect(ok(SIRYN_CARD, [TAUNT])).toBe(false);
  });
  it("an AERIAL event (Ever Vigilant, cost 2): it alone pays for it", () => {
    expect(ok(VIGILANT, [])).toBe(true);
  });
  it("not an AERIAL card (Elixir, cost 4): it and 2 others (1 + 1 + 1) do not pay; it and 3 do", () => {
    expect(ok(ELIXIR_CARD, [TAUNT, TAUNT])).toBe(false);
    expect(ok(ELIXIR_CARD, [TAUNT, TAUNT, TAUNT])).toBe(true);
  });
  it("two copies pay for Siryn alone (2 + 2)", () => {
    const s = setHand(inForm(ANGEL_FACE), [FLIGHT_CARD, FLIGHT_CARD]);
    const given = moveToHand(s, P1, SIRYN_CARD);
    const [id] = given.ids as [InstanceId];
    const hand = playerOf(given.state, P1).hand.filter((x) => x !== id);
    const r = applyCommand(given.state, play(P1, id, hand), DEPS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(playerOf(r.state, P1).playArea).toContain(id);
  });
  it("the doubling is its own: other cards' icons in the same payment are not doubled", () => {
    expect(ok(SIRYN_CARD, [TAUNT])).toBe(false);
    expect(ok(SIRYN_CARD, [TAUNT, TAUNT])).toBe(true);
  });
  it("two players: Spider-Man's own AERIAL event is not paid for by Angel's copy (he has no access to it)", () => {
    const first = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const turn = driveEventsPicking(DEPS, setHand(first, [FLIGHT_CARD, TAUNT], P1), firstLegal, endTurn(P1)).state;
    const s = withForm(turn, ANGEL_FACE, P2);
    const given = moveToHand(s, P2, "01005");
    const [kick] = given.ids as [InstanceId];
    const two = playerOf(given.state, P2)
      .hand.filter((x) => x !== kick)
      .slice(0, 2);
    expect(rejected(given.state, play(P2, kick, two))).toBe(true);
  });
});

describe("Worthington Industries (42009)", () => {
  const withIndustries = (form: typeof WARREN | typeof ANGEL_FACE | typeof ARCHANGEL, discard: readonly string[]) => {
    let s = topUp(inForm(form), 3);
    for (const code of discard) s = moveToDiscard(s, P1, code).state;
    return put(s, WORTHINGTON_CARD, 1);
  };
  const pickCard =
    (code: string): Picker =>
    (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseCards") {
        const hit = c.options.find((o) => codeOf(s, o.optionId as InstanceId) === code);
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    };
  it("costs 1", () => {
    const { state, before } = withIndustries(ANGEL_FACE, []);
    expect(handSize(state)).toBe(before - 2);
  });
  it("in hero form: exhaust, shuffle the chosen AERIAL card from your discard pile into your deck, no draw", () => {
    const { state: s, id } = withIndustries(ANGEL_FACE, [VIGILANT, TAUNT]);
    const hand = handSize(s);
    const deck = deckCodes(s).length;
    const { state } = driveEventsPicking(DEPS, s, pickCard(VIGILANT), use(P1, id, WORTHINGTON));
    expect(inst(state, id).exhausted).toBe(true);
    expect(discardCodes(state)).not.toContain(VIGILANT);
    expect(discardCodes(state)).toContain(TAUNT);
    expect(deckCodes(state).length).toBe(deck + 1);
    expect(deckCodes(state)).toContain(VIGILANT);
    expect(handSize(state)).toBe(hand);
  });
  it("in alter-ego form it also draws 1 card", () => {
    const { state: s, id } = withIndustries(WARREN, [VIGILANT]);
    const hand = handSize(s);
    const { state } = driveEventsPicking(DEPS, s, pickCard(VIGILANT), use(P1, id, WORTHINGTON));
    expect(discardCodes(state)).not.toContain(VIGILANT);
    expect(handSize(state)).toBe(hand + 1);
  });
  it("only an AERIAL card is shuffled: with Taunt alone in the discard pile nothing moves", () => {
    const { state: s0, id } = withIndustries(ANGEL_FACE, []);
    const taunt = moveToHand(s0, P1, TAUNT).ids[0]!;
    const s = {
      ...s0,
      players: s0.players.map((pl) =>
        pl.playerId === P1
          ? {
              ...pl,
              hand: pl.hand.filter((x) => x !== taunt),
              deck: pl.deck.filter((x) => x !== taunt),
              discard: [taunt],
            }
          : pl,
      ),
    };
    const deck = deckCodes(s).length;
    const r = applyCommand(s, use(P1, id, WORTHINGTON), DEPS);
    // The engine initiates it anyway (the alter-ego draw is another part of the ability): nothing is shuffled.
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(discardCodes(r.state)).toEqual([TAUNT]);
      expect(deckCodes(r.state).length).toBe(deck);
    }
  });
  it("an exhausted Worthington Industries cannot be used", () => {
    const { state: s, id } = withIndustries(ANGEL_FACE, [VIGILANT]);
    const tired = patchInstance(s, id, { exhausted: true });
    expect(rejected(tired, use(P1, id, WORTHINGTON))).toBe(true);
  });
  it("two players: only the controller's own discard pile is read and shuffled", () => {
    let s = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    s = moveToDiscard(s, P2, "01005").state;
    s = moveToDiscard(s, P1, VIGILANT).state;
    const { state: base, id } = put(s, WORTHINGTON_CARD, 1);
    const { state } = driveEventsPicking(DEPS, base, firstLegal, use(P1, id, WORTHINGTON));
    expect(discardCodes(state, P2)).toEqual(["01005"]);
    expect(deckCodes(state, P1)).toContain(VIGILANT);
  });
});

describe("Techno-Organic Wings (42010)", () => {
  const withWings = (form: typeof WARREN | typeof ANGEL_FACE | typeof ARCHANGEL, players?: readonly Seat[]) =>
    put(topUp(inForm(form, players), 4), WINGS_CARD, 3);
  it("costs 3 and attaches to the identity", () => {
    const { state, id, before } = withWings(ANGEL_FACE);
    expect(handSize(state)).toBe(before - 4);
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
  it("as Angel: exhaust it to ready your hero", () => {
    const { state: s0, id } = withWings(ANGEL_FACE);
    const tired = patchInstance(s0, identityOf(s0), { exhausted: true });
    const { state } = driveEventsPicking(DEPS, tired, firstLegal, use(P1, id, WINGS));
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("as Angel it does not reduce a cost: the next AERIAL event costs its full 2", () => {
    const { state: s0, id } = withWings(ANGEL_FACE);
    const { state: s } = driveEventsPicking(DEPS, s0, firstLegal, use(P1, id, WINGS));
    const given = moveToHand(s, P1, VIGILANT);
    expect(rejected(given.state, play(P1, given.ids[0]!, []))).toBe(true);
  });
  it("as Archangel: the next AERIAL event from hand costs 2 less (Ever Vigilant free), and it is used up by that event", () => {
    const { state: s0, id } = withWings(ARCHANGEL);
    const { state: s } = driveEventsPicking(DEPS, s0, firstLegal, use(P1, id, WINGS));
    expect(inst(s, id).exhausted).toBe(true);
    const given = moveToHand(s, P1, VIGILANT, RAZOR_DIVE);
    const [vigilant, dive] = given.ids as [InstanceId, InstanceId];
    const free = driveEventsPicking(DEPS, given.state, firstLegal, play(P1, vigilant, []));
    expect(handSize(free.state)).toBe(handSize(given.state) - 1);
    expect(damageOn(free.state, stryfe(free.state))).toBe(2);
    // The second AERIAL event pays in full: Razor Dive needs 3.
    expect(rejected(free.state, play(P1, dive, payWith(free.state, P1, 2, [dive])))).toBe(true);
    expect(rejected(free.state, play(P1, dive, payWith(free.state, P1, 3, [dive])))).toBe(false);
  });
  it("as Archangel a 3-cost AERIAL event costs 1 (Razor Dive)", () => {
    const { state: s0, id } = withWings(ARCHANGEL);
    const { state: s } = driveEventsPicking(DEPS, s0, firstLegal, use(P1, id, WINGS));
    const given = moveToHand(s, P1, RAZOR_DIVE);
    const [dive] = given.ids as [InstanceId];
    expect(rejected(given.state, play(P1, dive, []))).toBe(true);
    const r = applyCommand(given.state, play(P1, dive, payWith(given.state, P1, 1, [dive])), DEPS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(handSize(r.state)).toBe(handSize(given.state) - 2);
  });
  it("an event that is not AERIAL (Taunt) pays in full and leaves the reduction for the next AERIAL event", () => {
    const { state: s0, id } = withWings(ARCHANGEL);
    const { state: s } = driveEventsPicking(DEPS, s0, firstLegal, use(P1, id, WINGS));
    const given = moveToHand(s, P1, TAUNT, VIGILANT);
    const [taunt, vigilant] = given.ids as [InstanceId, InstanceId];
    expect(rejected(given.state, play(P1, taunt, []))).toBe(true);
    const afterTaunt = driveEventsPicking(
      DEPS,
      given.state,
      firstLegal,
      play(P1, taunt, payWith(given.state, P1, 1, [taunt, vigilant])),
    ).state;
    expect(rejected(afterTaunt, play(P1, vigilant, []))).toBe(false);
  });
  it("it is a Hero Action: refused as Warren Worthington III; and an exhausted copy cannot be used", () => {
    const { state: warren, id } = withWings(WARREN);
    expect(rejected(warren, use(P1, id, WINGS))).toBe(true);
    const { state: hero, id: wings } = withWings(ANGEL_FACE);
    expect(rejected(patchInstance(hero, wings, { exhausted: true }), use(P1, wings, WINGS))).toBe(true);
  });
  it("two players: the reduction is the Archangel player's only; Spider-Man's AERIAL event pays in full", () => {
    const s0 = twoHeroes(ARCHANGEL, [ANGEL, SPIDER_MAN]);
    const { state: placed, id } = put(topUp(s0, 4), WINGS_CARD, 3);
    const { state: s } = driveEventsPicking(DEPS, placed, firstLegal, use(P1, id, WINGS));
    const turn = driveEventsPicking(DEPS, s, firstLegal, endTurn(P1)).state;
    const second = withForm(turn, ANGEL_FACE, P2);
    const kick = moveToHand(second, P2, "01005");
    expect(rejected(kick.state, play(P2, kick.ids[0]!, payWith(kick.state, P2, 2, [kick.ids[0]!])))).toBe(true);
  });
});

describe("Elixir (42011)", () => {
  const elixirIn = (form: typeof WARREN | typeof ANGEL_FACE | typeof ARCHANGEL, players?: readonly Seat[]) =>
    put(topUp(inForm(form, players), 4), ELIXIR_CARD, 4);
  const canPlay = (s: GameState, player = P1): boolean => {
    const given = moveToHand(topUp(s, 5, player), player, ELIXIR_CARD);
    return applyCommand(
      given.state,
      play(player, given.ids[0]!, payWith(given.state, player, 4, [given.ids[0]!])),
      DEPS,
    ).ok;
  };
  it("costs 4 and enters play ready", () => {
    const { state, id, before } = elixirIn(ANGEL_FACE);
    expect(handSize(state)).toBe(before - 5);
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("play only if your identity has the X-FORCE or X-MEN trait: Angel and Archangel yes, Warren Worthington III no", () => {
    expect(canPlay(inForm(ANGEL_FACE))).toBe(true);
    expect(canPlay(inForm(ARCHANGEL))).toBe(true);
    expect(canPlay(inForm(WARREN))).toBe(false);
  });
  it("another identity, a copy handed to the second seat: Spider-Man (neither trait) is refused, Psylocke (X-FORCE) is allowed", () => {
    const tried = (seat: Seat): boolean => {
      const base = withForm(twoHeroes(ANGEL_FACE, [ANGEL, seat]), { heroForm: 0 }, P2);
      const handed = handOver(topUp(itsTurn(base, P2), 5, P2), ELIXIR_CARD, P1, P2);
      return applyCommand(handed.state, play(P2, handed.id, payWith(handed.state, P2, 4, [handed.id])), DEPS).ok;
    };
    expect(tried(SPIDER_MAN)).toBe(false);
    expect(tried(PSYLOCKE)).toBe(true);
  });
  it("after Elixir attacks, heals 1 damage from another friendly character of your choice (the hero)", () => {
    const { state: s0, id } = elixirIn(ANGEL_FACE);
    const s = withDamage(s0, identityOf(s0), 3);
    const { state, offered } = driveOffers(s, targeting(identityOf(s), ELIXIR), basicAttack(stryfe(s), id));
    expect(hasOffer(offered, ELIXIR)).toBe(true);
    expect(damageOn(state, identityOf(state))).toBe(2);
    expect(damageOn(state, stryfe(state))).toBe(1);
    expect(damageOn(state, id)).toBe(1);
  });
  it("after Elixir thwarts, it heals 1 damage from another ally", () => {
    const { state: s0, id } = elixirIn(ANGEL_FACE);
    const ally = put(s0, ALLY_PSYLOCKE, 3);
    const staged = encounterCardInVillainArea(withDamage(ally.state, ally.id, 2), SIDE_SCHEME, 3);
    const { state } = driveOffers(staged.state, targeting(ally.id, ELIXIR), basicThwart(staged.id, id));
    expect(inst(state, staged.id).threat).toBe(2);
    expect(damageOn(state, ally.id)).toBe(1);
  });
  it("never itself: Elixir is not among the candidates, even damaged", () => {
    const { state: s0, id } = elixirIn(ANGEL_FACE);
    const s = withDamage(s0, id, 1);
    let seen: string[] = [];
    const pick: Picker = (st) => {
      if (st.pendingChoice?.prompt.kind === "chooseTarget") seen = st.pendingChoice.options.map((o) => o.optionId);
      return accepting(ELIXIR)(st);
    };
    driveOffers(s, pick, basicAttack(stryfe(s), id));
    expect(seen).toContain(identityOf(s));
    expect(seen).not.toContain(id);
  });
  it("optional: declined, nothing is healed", () => {
    const { state: s0, id } = elixirIn(ANGEL_FACE);
    const s = withDamage(s0, identityOf(s0), 3);
    const { state } = driveOffers(s, accepting("nothing"), basicAttack(stryfe(s), id));
    expect(damageOn(state, identityOf(state))).toBe(3);
  });
  it("two players: Spider-Man is a friendly character too, and his damage is healed", () => {
    const s0 = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const { state: placed, id } = put(topUp(s0, 4), ELIXIR_CARD, 4);
    const s = withDamage(placed, identityOf(placed, P2), 2);
    const { state } = driveOffers(s, targeting(identityOf(s, P2), ELIXIR), basicAttack(stryfe(s), id));
    expect(damageOn(state, identityOf(state, P2))).toBe(1);
  });
});

describe("Siryn (42012)", () => {
  const siryn = (players?: readonly Seat[]) => put(topUp(inForm(ANGEL_FACE, players), 4), SIRYN_CARD, 4);
  const TARGET_MINION = (id: InstanceId): Picker => targeting(id, SIRYN);
  it("costs 4 and attacks for 2", () => {
    const { state: s, id, before } = siryn();
    expect(handSize(s)).toBe(before - 5);
    const { state } = driveEventsPicking(DEPS, s, firstLegal, basicAttack(stryfe(s), id));
    expect(damageOn(state, stryfe(state))).toBe(2);
  });
  it("after Siryn attacks, stuns a minion (not the villain)", () => {
    const { state: s0, id } = siryn();
    const m = withMinion(s0, TIGER_SHARK);
    const { state, offered } = driveOffers(m.state, TARGET_MINION(m.id), basicAttack(stryfe(m.state), id));
    expect(hasOffer(offered, SIRYN)).toBe(true);
    expect(inst(state, m.id).statuses.stunned).toBe(1);
    expect(inst(state, stryfe(state)).statuses.stunned).toBe(0);
  });
  it("any minion: one engaged with the other player is stunned when chosen", () => {
    const s0 = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const { state: placed, id } = put(topUp(s0, 4), SIRYN_CARD, 4);
    const mine = withMinion(placed, TIGER_SHARK, P1);
    const theirs = withMinion(mine.state, TIGER_SHARK, P2);
    const { state } = driveOffers(theirs.state, TARGET_MINION(theirs.id), basicAttack(stryfe(theirs.state), id));
    expect(inst(state, theirs.id).statuses.stunned).toBe(1);
    expect(inst(state, mine.id).statuses.stunned).toBe(0);
  });
  it("it can stun the minion she attacked", () => {
    const { state: s0, id } = siryn();
    const m = withMinion(s0, TIGER_SHARK);
    const { state } = driveOffers(m.state, TARGET_MINION(m.id), basicAttack(m.id, id));
    expect(damageOn(state, m.id)).toBe(2);
    expect(inst(state, m.id).statuses.stunned).toBe(1);
  });
  it("with no minion in play there is nothing to stun and the villain is not stunned", () => {
    const { state: s, id } = siryn();
    const { state } = driveOffers(s, accepting(SIRYN), basicAttack(stryfe(s), id));
    expect(inst(state, stryfe(state)).statuses.stunned).toBe(0);
  });
  it("declined, the minion stays unstunned", () => {
    const { state: s0, id } = siryn();
    const m = withMinion(s0, TIGER_SHARK);
    const { state } = driveOffers(m.state, accepting("nothing"), basicAttack(stryfe(m.state), id));
    expect(inst(state, m.id).statuses.stunned).toBe(0);
  });
});

describe("Cannonball (42020)", () => {
  const cannonball = (hand: readonly string[], form: typeof ANGEL_FACE | typeof ARCHANGEL = ANGEL_FACE) => {
    const { state, id } = put(topUp(inForm(form), 3), CANNONBALL_CARD, 3);
    return { state: setHand(state, hand), id };
  };
  const preventing = accepting(CANNONBALL);
  it("costs 3; consequential damage from his attack is reduced by the AERIAL cards in hand: 2 in hand, 2 prevented", () => {
    const { state: s, id } = cannonball([VIGILANT, RAZOR_DIVE, TAUNT]);
    const { state, offered } = driveOffers(s, preventing, basicAttack(stryfe(s), id));
    expect(hasOffer(offered, CANNONBALL)).toBe(true);
    expect(damageOn(state, id)).toBe(0);
    expect(damageOn(state, stryfe(state))).toBe(2);
  });
  it("1 AERIAL card in hand reduces his 2 consequential damage to 1", () => {
    const { state: s, id } = cannonball([VIGILANT, TAUNT]);
    const { state } = driveOffers(s, preventing, basicAttack(stryfe(s), id));
    expect(damageOn(state, id)).toBe(1);
  });
  it("AERIAL cards of any type count: two AERIAL allies in hand", () => {
    const { state: s, id } = cannonball([SIRYN_CARD, WARPATH_CARD]);
    const { state } = driveOffers(s, preventing, basicAttack(stryfe(s), id));
    expect(damageOn(state, id)).toBe(0);
  });
  it("no AERIAL card in hand: he takes the full 2 and is defeated (2 hit points)", () => {
    const { state: s, id } = cannonball([TAUNT, ELIXIR_CARD]);
    const { state } = driveOffers(s, preventing, basicAttack(stryfe(s), id));
    expect(playerOf(state, P1).playArea).not.toContain(id);
  });
  it("optional: declined, he takes the full 2 with AERIAL cards in hand", () => {
    const { state: s, id } = cannonball([VIGILANT, RAZOR_DIVE]);
    const { state } = driveOffers(s, accepting("nothing"), basicAttack(stryfe(s), id));
    expect(playerOf(state, P1).playArea).not.toContain(id);
  });
  it("it is consequential damage from a thwart too", () => {
    const { state: s, id } = cannonball([VIGILANT, RAZOR_DIVE]);
    const staged = encounterCardInVillainArea(s, SIDE_SCHEME, 3);
    const { state } = driveOffers(staged.state, preventing, basicThwart(staged.id, id));
    expect(inst(state, staged.id).threat).toBe(1);
    expect(damageOn(state, id)).toBe(0);
  });
  it("only consequential damage: as a defender against Tiger Shark (3) the interrupt is not offered", () => {
    const { state: s0, id } = cannonball([VIGILANT, RAZOR_DIVE]);
    const m = withMinion(s0, TIGER_SHARK);
    const { offered } = villainPhase(m.state, defendingWith(id, preventing));
    expect(hasOffer(offered, CANNONBALL)).toBe(false);
  });
  it("it is his controller's hand that counts: with Angel's hand empty of AERIAL cards, another player's hand does not help", () => {
    const s0 = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const { state: placed, id } = put(topUp(s0, 3), CANNONBALL_CARD, 3);
    const staged = setHand(placed, [TAUNT, VIGILANT, RAZOR_DIVE], P1);
    const given = handOver(handOver(staged, VIGILANT, P1, P2).state, RAZOR_DIVE, P1, P2).state;
    const s = given;
    const { state } = driveOffers(s, preventing, basicAttack(stryfe(s), id));
    expect(playerOf(state, P1).playArea).not.toContain(id);
  });
});

describe("Warpath (42013)", () => {
  /** Hand order matters: the first two other cards pay for the attack-me event, the rest are what Warpath may play. */
  const HAND = [TAUNT, TAUNT, ATTACK_ME, VIGILANT, TAUNT, "42014"];
  /** Warpath in play (Toughness: a tough status card, data), Tiger Shark (ATK 3) engaged with the first player. */
  const warpath = (hand: readonly string[] = HAND, players?: readonly Seat[]) => {
    const base = twoHeroes(ANGEL_FACE, players ?? [ANGEL]);
    const { state, id } = put(topUp(base, 4), WARPATH_CARD, 4);
    const m = withMinion(setHand(state, hand), TIGER_SHARK);
    return { state: stackEncounterDeck(m.state, NO_ICONS), id, minion: m.id };
  };
  /** Spends every offered card when a play from an effect asks for its payment; otherwise `then`. */
  const spendingAll =
    (then: Picker): Picker =>
    (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "spendResources") return c.options.slice(0, c.maxSelections).map((o) => o.optionId);
      return then(st);
    };
  /** Plays the attack-me event in the first player's own turn: Tiger Shark attacks them, `defender` declared. */
  const attacked = (s: GameState, defender: InstanceId, then: Picker, p = P1) => {
    const given = moveToHand(s, p, ATTACK_ME);
    const [id] = given.ids as [InstanceId];
    const result = driveOffers(
      given.state,
      spendingAll(defendingWith(defender, then)),
      play(p, id, payWith(given.state, p, 2, [id])),
    );
    return { ...result, before: handSize(given.state, p) - 3 };
  };
  it("costs 4 and has Toughness (data)", () => {
    const { state, id, before } = put(topUp(inForm(ANGEL_FACE), 4), WARPATH_CARD, 4);
    expect(handSize(state)).toBe(before - 5);
    expect(inst(state, id).statuses.tough).toBe(1);
  });
  it("is a Hero Response (hero form only)", () => {
    expect(ANGEL_SUPPORT_UPGRADES_ALLIES[WARPATH]!.trigger).toMatchObject({ kind: "response", form: "hero" });
  });
  it("after Warpath defends, plays an event with a Hero Action from hand, paying its cost: Ever Vigilant (2) deals 2 damage", () => {
    const { state: s, id } = warpath();
    const { state, offered, before } = attacked(s, id, accepting(WARPATH));
    expect(hasOffer(offered, WARPATH)).toBe(true);
    expect(damageOn(state, stryfe(state))).toBe(2);
    expect(discardCodes(state)).toContain(VIGILANT);
    expect(handSize(state)).toBe(before - 3);
  });
  it("only an event with a Hero Action: Taunt (a plain Action) and Aerial Intervention (an Interrupt) are not offered", () => {
    const { state: s, id } = warpath([TAUNT, TAUNT, ATTACK_ME, TAUNT, "42014"]);
    const seen: string[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "chooseCards") seen.push(...c.options.map((o) => codeOf(st, o.optionId as InstanceId)));
      return accepting(WARPATH)(st);
    };
    const { state } = attacked(s, id, pick);
    expect(seen).toEqual([]);
    expect(damageOn(state, stryfe(state))).toBe(0);
  });
  it("only when Warpath defends: the hero defending does not offer it", () => {
    const { state: s } = warpath();
    const { offered, state } = attacked(s, identityOf(s), accepting(WARPATH));
    expect(hasOffer(offered, WARPATH)).toBe(false);
    expect(damageOn(state, stryfe(state))).toBe(0);
  });
  it("optional: declined, the event stays in hand", () => {
    const { state: s, id } = warpath();
    const { state } = attacked(s, id, accepting("nothing"));
    expect(handCodes(state)).toContain(VIGILANT);
    expect(damageOn(state, stryfe(state))).toBe(0);
  });
  it("two players: the other player's hand is untouched", () => {
    const { state: s, id } = warpath(HAND, [ANGEL, SPIDER_MAN]);
    const p2 = handCodes(s, P2);
    const { state } = attacked(s, id, accepting(WARPATH));
    expect(damageOn(state, stryfe(state))).toBe(2);
    expect(handCodes(state, P2)).toEqual(p2);
  });
  // Owner ruling 2026-10-06 (docs/phase7-wave7.md §4.1): his Response overrides the Hero Action's timing for that
  // event, so it is played in the villain phase, where enemies attack (`playFromHand.ignoreActionTiming`). The hand
  // holds no attack-me event here: it has a Hero Action too and would be a second legal pick.
  it("the same response in the villain phase (a minion's own attack) plays the Hero Action event", () => {
    const { state: s, id } = warpath([TAUNT, TAUNT, VIGILANT, TAUNT, "42014"]);
    const { state, offered } = villainPhase(s, spendingAll(defendingWith(id, accepting(WARPATH))));
    expect(hasOffer(offered, WARPATH)).toBe(true);
    expect(discardCodes(state)).toContain(VIGILANT);
    expect(damageOn(state, stryfe(state))).toBe(2);
  });
});

describe("Angel's Aerie (42018)", () => {
  const aerie = (form: typeof WARREN | typeof ANGEL_FACE | typeof ARCHANGEL, players?: readonly Seat[]) => {
    const { state, id } = put(topUp(inForm(form, players), 4), AERIE_CARD, 1);
    return { state, id };
  };
  const fatigue = (s: GameState, id: InstanceId) => inst(s, id).counters.fatigue ?? 0;
  it("costs 1", () => {
    const { state, id } = aerie(ANGEL_FACE);
    expect(playerOf(state, P1).playArea).toContain(id);
  });
  it("after you defend against an attack, places 1 fatigue counter on it (Angel takes 1 from Tiger Shark's 3)", () => {
    const { state: s0, id } = aerie(ANGEL_FACE);
    const m = withMinion(s0, TIGER_SHARK);
    const { state, offered } = villainPhase(m.state, defendingWith(identityOf(m.state), accepting(AERIE_RESPONSE)));
    expect(hasOffer(offered, AERIE_RESPONSE)).toBe(true);
    expect(fatigue(state, id)).toBe(1);
    expect(damageOn(state, identityOf(state))).toBe(1);
  });
  it("also when no damage is taken: Archangel (DEF 3) takes 0 and the counter is still placed", () => {
    const { state: s0, id } = aerie(ARCHANGEL);
    const m = withMinion(s0, TIGER_SHARK);
    const { state } = villainPhase(m.state, defendingWith(identityOf(m.state), accepting(AERIE_RESPONSE)));
    expect(damageOn(state, identityOf(state))).toBe(0);
    expect(fatigue(state, id)).toBe(1);
  });
  it("optional: declined, no counter", () => {
    const { state: s0, id } = aerie(ANGEL_FACE);
    const m = withMinion(s0, TIGER_SHARK);
    const { state } = villainPhase(m.state, defendingWith(identityOf(m.state), accepting("nothing")));
    expect(fatigue(state, id)).toBe(0);
  });
  it("you defend: an ally defending (Warpath) places nothing", () => {
    const { state: s0, id } = aerie(ANGEL_FACE);
    const ally = put(topUp(s0, 4), WARPATH_CARD, 4);
    const m = withMinion(ally.state, TIGER_SHARK);
    const { offered, state } = villainPhase(m.state, defendingWith(ally.id, accepting(AERIE_RESPONSE)));
    expect(hasOffer(offered, AERIE_RESPONSE)).toBe(false);
    expect(fatigue(state, id)).toBe(0);
  });
  it("two players: the other player's hero defending places nothing", () => {
    const s0 = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const { state: placed, id } = put(topUp(s0, 4), AERIE_CARD, 1);
    const m = withMinion(placed, TIGER_SHARK, P2);
    const { offered, state } = villainPhase(m.state, defendingWith(identityOf(m.state, P2), accepting(AERIE_RESPONSE)));
    expect(hasOffer(offered, AERIE_RESPONSE)).toBe(false);
    expect(fatigue(state, id)).toBe(0);
  });
  it("Alter-Ego Action: remove each fatigue counter, heal 1 damage from your identity for each: 3 counters, 5 damage, 2 left", () => {
    const { state: s0, id } = aerie(WARREN);
    const s = withDamage(patchInstance(s0, id, { counters: { fatigue: 3 } }), identityOf(s0), 5);
    const { state } = driveEventsPicking(DEPS, s, firstLegal, use(P1, id, AERIE_ACTION));
    expect(fatigue(state, id)).toBe(0);
    expect(damageOn(state, identityOf(state))).toBe(2);
  });
  it("heals no more than the damage on the identity: 3 counters, 1 damage", () => {
    const { state: s0, id } = aerie(WARREN);
    const s = withDamage(patchInstance(s0, id, { counters: { fatigue: 3 } }), identityOf(s0), 1);
    const { state } = driveEventsPicking(DEPS, s, firstLegal, use(P1, id, AERIE_ACTION));
    expect(fatigue(state, id)).toBe(0);
    expect(damageOn(state, identityOf(state))).toBe(0);
  });
  it("it is an Alter-Ego Action: refused in hero form", () => {
    const { state: s0, id } = aerie(ANGEL_FACE);
    const s = patchInstance(s0, id, { counters: { fatigue: 2 } });
    expect(rejected(s, use(P1, id, AERIE_ACTION))).toBe(true);
  });
});

describe("Containment Strategy (42019)", () => {
  const SCHEME_THREAT = 5;
  /** The side scheme (5 threat) with Containment Strategy attached, Tiger Shark (ATK 3) engaged. */
  const contained = (form: typeof ANGEL_FACE | typeof ARCHANGEL = ANGEL_FACE, players?: readonly Seat[]) => {
    const base = topUp(inForm(form, players), 4);
    const scheme = encounterCardInVillainArea(base, SIDE_SCHEME, SCHEME_THREAT);
    const placed = put(scheme.state, CONTAINMENT_CARD, 1, { attach: scheme.id });
    return { state: placed.state, scheme: scheme.id, upgrade: placed.id, before: placed.before };
  };
  it("costs 1 and attaches to a side scheme", () => {
    const { state, scheme, upgrade, before } = contained();
    expect(inst(state, upgrade).attachedTo).toBe(scheme);
    expect(handSize(state)).toBe(before - 2);
  });
  it("cannot attach to the main scheme or to a minion", () => {
    const base = topUp(inForm(ANGEL_FACE), 4);
    const given = moveToHand(base, P1, CONTAINMENT_CARD);
    const [id] = given.ids as [InstanceId];
    const pay = payWith(given.state, P1, 1, [id]);
    expect(rejected(given.state, play(P1, id, pay, { attachToInstanceId: given.state.mainScheme.instanceId }))).toBe(
      true,
    );
    const m = withMinion(given.state, TIGER_SHARK);
    expect(rejected(m.state, play(P1, id, pay, { attachToInstanceId: m.id }))).toBe(true);
  });
  it("max 1 per side scheme: a second copy cannot attach to the same scheme but can attach to another", () => {
    const { state, scheme } = contained();
    const given = moveToHand(topUp(state, 3), P1, CONTAINMENT_CARD);
    const [id] = given.ids as [InstanceId];
    const pay = payWith(given.state, P1, 1, [id]);
    expect(rejected(given.state, play(P1, id, pay, { attachToInstanceId: scheme }))).toBe(true);
    // A player side scheme (Render Medical Aid, cost 0) is a side scheme, so it is another host.
    const render = put(given.state, RENDER_CARD, 0);
    const again = moveToHand(render.state, P1, CONTAINMENT_CARD);
    const [second] = again.ids.filter((x) => x !== render.id) as [InstanceId];
    const r = applyCommand(
      again.state,
      play(P1, second, payWith(again.state, P1, 1, [second]), { attachToInstanceId: render.id }),
      DEPS,
    );
    expect(r.ok).toBe(true);
  });
  it("after a hero defends and takes damage (Angel, DEF 2 vs 3), removes 1 threat from the attached scheme", () => {
    const { state: s0, scheme } = contained(ANGEL_FACE);
    const m = withMinion(s0, TIGER_SHARK);
    const { state, offered } = villainPhase(m.state, defendingWith(identityOf(m.state), accepting(CONTAINMENT)));
    expect(hasOffer(offered, CONTAINMENT)).toBe(true);
    expect(damageOn(state, identityOf(state))).toBe(1);
    expect(inst(state, scheme).threat).toBe(SCHEME_THREAT - 1);
  });
  it("removes 2 threat if that hero took no damage (Archangel, DEF 3)", () => {
    const { state: s0, scheme } = contained(ARCHANGEL);
    const m = withMinion(s0, TIGER_SHARK);
    const { state } = villainPhase(m.state, defendingWith(identityOf(m.state), accepting(CONTAINMENT)));
    expect(damageOn(state, identityOf(state))).toBe(0);
    expect(inst(state, scheme).threat).toBe(SCHEME_THREAT - 2);
  });
  it("optional: declined, no threat is removed", () => {
    const { state: s0, scheme } = contained(ANGEL_FACE);
    const m = withMinion(s0, TIGER_SHARK);
    const { state } = villainPhase(m.state, defendingWith(identityOf(m.state), accepting("nothing")));
    expect(inst(state, scheme).threat).toBe(SCHEME_THREAT);
  });
  it("only a hero: an ally defending (Warpath) does not offer it", () => {
    const { state: s0, scheme } = contained(ANGEL_FACE);
    const ally = put(topUp(s0, 4), WARPATH_CARD, 4);
    const m = withMinion(ally.state, TIGER_SHARK);
    const { state, offered } = villainPhase(m.state, defendingWith(ally.id, accepting(CONTAINMENT)));
    expect(hasOffer(offered, CONTAINMENT)).toBe(false);
    expect(inst(state, scheme).threat).toBe(SCHEME_THREAT);
  });
  it("two players: any hero defending counts, the other player's included (Spider-Man defends Tiger Shark)", () => {
    const s0 = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const base = topUp(s0, 4);
    const scheme = encounterCardInVillainArea(base, SIDE_SCHEME, SCHEME_THREAT);
    const placed = put(scheme.state, CONTAINMENT_CARD, 1, { attach: scheme.id });
    const m = withMinion(placed.state, TIGER_SHARK, P2);
    const { state, offered } = villainPhase(m.state, defendingWith(identityOf(m.state, P2), accepting(CONTAINMENT)));
    expect(hasOffer(offered, CONTAINMENT)).toBe(true);
    // Tiger Shark (ATK 3) against Spider-Man's own DEF: the damage he takes decides 1 threat or 2.
    const took = Math.max(0, 3 - characterProfile(m.state, identityOf(m.state, P2), DEPS)!.def);
    expect(inst(state, scheme.id).threat).toBe(SCHEME_THREAT - (took === 0 ? 2 : 1));
  });
});

describe("Soaring Acrobatics (42023)", () => {
  const acrobatics = (form: typeof WARREN | typeof ANGEL_FACE | typeof ARCHANGEL, players?: readonly Seat[]) =>
    put(topUp(inForm(form, players), 4), ACROBATICS_CARD, 2);
  const boosting = accepting(ACROBATICS);
  it("costs 2 and attaches to your identity", () => {
    const { state, id, before } = acrobatics(ANGEL_FACE);
    expect(handSize(state)).toBe(before - 3);
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
  it("as Angel (ATK 1), exhaust it: his basic attack gets +1, so 2 damage; the upgrade is exhausted", () => {
    const { state: s, id } = acrobatics(ANGEL_FACE);
    const { state, offered } = driveOffers(s, boosting, basicAttack(stryfe(s), identityOf(s)));
    expect(hasOffer(offered, ACROBATICS)).toBe(true);
    expect(damageOn(state, stryfe(state))).toBe(2);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("as Archangel (ATK 2): 3 damage", () => {
    const { state: s } = acrobatics(ARCHANGEL);
    const { state } = driveOffers(s, boosting, basicAttack(stryfe(s), identityOf(s)));
    expect(damageOn(state, stryfe(state))).toBe(3);
  });
  it("a basic thwart too: Angel (THW 2) removes 3 threat from a side scheme", () => {
    const { state: s0 } = acrobatics(ANGEL_FACE);
    const staged = encounterCardInVillainArea(s0, SIDE_SCHEME, 5);
    const { state } = driveOffers(staged.state, boosting, basicThwart(staged.id, identityOf(s0)));
    expect(inst(state, staged.id).threat).toBe(2);
  });
  it("declined, the attack is Angel's own ATK 1 and the upgrade stays ready", () => {
    const { state: s, id } = acrobatics(ANGEL_FACE);
    const { state } = driveOffers(s, accepting("nothing"), basicAttack(stryfe(s), identityOf(s)));
    expect(damageOn(state, stryfe(state))).toBe(1);
    expect(inst(state, id).exhausted).toBe(false);
  });
  it("an AERIAL character you control: Siryn (ATK 2) gets +1, 3 damage", () => {
    const { state: s0 } = acrobatics(ANGEL_FACE);
    const siryn = put(topUp(s0, 4), SIRYN_CARD, 4);
    const { state, offered } = driveOffers(siryn.state, boosting, basicAttack(stryfe(siryn.state), siryn.id));
    expect(hasOffer(offered, ACROBATICS)).toBe(true);
    expect(damageOn(state, stryfe(state))).toBe(3);
  });
  it("not an AERIAL character: Elixir (ATK 1) is not offered it", () => {
    const { state: s0 } = acrobatics(ANGEL_FACE);
    const elixir = put(topUp(s0, 5), ELIXIR_CARD, 4);
    const { state, offered } = driveOffers(elixir.state, boosting, basicAttack(stryfe(elixir.state), elixir.id));
    expect(hasOffer(offered, ACROBATICS)).toBe(false);
    expect(damageOn(state, stryfe(state))).toBe(1);
  });
  it("a Hero Interrupt: not offered to Warren Worthington III's basic recovery", () => {
    const { state: s0, id } = acrobatics(WARREN);
    const s = withDamage(s0, identityOf(s0), 4);
    const recover: Command = { type: "basicRecover", playerId: P1 } as unknown as Command;
    expect(applyCommand(s, recover, DEPS).ok).toBe(true);
    const { offered, state } = driveOffers(s, boosting, recover);
    expect(hasOffer(offered, ACROBATICS)).toBe(false);
    expect(damageOn(state, identityOf(state))).toBe(1);
    expect(inst(s0, id).exhausted).toBe(false);
  });
  it("an exhausted copy is not offered", () => {
    const { state: s0, id } = acrobatics(ANGEL_FACE);
    const s = patchInstance(s0, id, { exhausted: true });
    const { state, offered } = driveOffers(s, boosting, basicAttack(stryfe(s), identityOf(s)));
    expect(hasOffer(offered, ACROBATICS)).toBe(false);
    expect(damageOn(state, stryfe(state))).toBe(1);
  });
  it("max 1 per player: a second copy cannot be played under the same control", () => {
    const { state: s } = acrobatics(ANGEL_FACE);
    const given = moveToHand(topUp(s, 3), P1, ACROBATICS_CARD);
    const [id] = given.ids as [InstanceId];
    expect(rejected(given.state, play(P1, id, payWith(given.state, P1, 2, [id])))).toBe(true);
  });
  it("two players: Angel's copy does nothing for Spider-Man (not AERIAL); it can be played under his control", () => {
    const s0 = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const { state: placed, id } = put(topUp(s0, 4), ACROBATICS_CARD, 2);
    const turn = itsTurn(placed, P2);
    const { state, offered } = driveOffers(turn, boosting, basicAttack(stryfe(turn), identityOf(turn, P2), P2));
    expect(hasOffer(offered, ACROBATICS)).toBe(false);
    expect(inst(state, id).exhausted).toBe(false);
    // "Play under any player's control": Angel's player puts one under Spider-Man's control, on his identity.
    const second = moveToHand(topUp(s0, 4), P1, ACROBATICS_CARD);
    const [acro] = second.ids as [InstanceId];
    const command = {
      ...play(P1, acro, payWith(second.state, P1, 2, [acro])),
      controllerId: P2,
    } as Command;
    const r = applyCommand(second.state, command, DEPS);
    expect(r.ok ? "ok" : r.error.message).toBe("ok");
    if (r.ok) expect(inst(r.state, acro).attachedTo).toBe(identityOf(r.state, P2));
  });
  it("it is refused under another player's control for a card without that text (Containment Strategy)", () => {
    const s0 = twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]);
    const given = moveToHand(topUp(s0, 4), P1, ACROBATICS_CARD);
    const [acro] = given.ids as [InstanceId];
    const command = { ...play(P1, acro, payWith(given.state, P1, 2, [acro])), controllerId: P2 } as Command;
    expect(applyCommand(given.state, command, DEPS).ok).toBe(true);
    const other = moveToHand(topUp(s0, 4), P1, CONTAINMENT_CARD);
    const [cs] = other.ids as [InstanceId];
    const scheme = encounterCardInVillainArea(other.state, SIDE_SCHEME, 3);
    const refused = {
      ...play(P1, cs, payWith(scheme.state, P1, 1, [cs]), { attachToInstanceId: scheme.id }),
      controllerId: P2,
    } as Command;
    expect(rejected(scheme.state, refused)).toBe(true);
  });
});

describe("Render Medical Aid (42017)", () => {
  /** The player side scheme in play (cost 0), threat set to `threat`. */
  const render = (players?: readonly Seat[], threat?: number) => {
    const put0 = put(topUp(twoHeroes(ANGEL_FACE, players ?? [ANGEL]), 4), RENDER_CARD, 0);
    return { ...put0, state: threat === undefined ? put0.state : patchInstance(put0.state, put0.id, { threat }) };
  };
  /** Divides every heal as `plan` says by owner (a card id to the points it gets), answering each player's prompt. */
  const dividing =
    (plan: (state: GameState, chooser: string) => ReadonlyMap<InstanceId, number>): Picker =>
    (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind !== "divide") return firstLegal(st);
      const wanted = plan(st, c.playerId);
      const picked: string[] = [];
      for (const [card, n] of wanted) {
        const units = c.options.map((o) => o.optionId).filter((o) => o.startsWith(`${card}#`));
        picked.push(...units.slice(0, n));
      }
      return picked.slice(0, c.maxSelections);
    };
  const asked: { max: number[]; min: number[] } = { max: [], min: [] };
  const watching =
    (pick: Picker): Picker =>
    (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "divide") {
        asked.max.push(c.maxSelections);
        asked.min.push(c.minSelections);
      }
      return pick(st);
    };
  const thwartOut = (s: GameState, id: InstanceId, pick: Picker, who = identityOf(s), p = P1) =>
    driveEventsPicking(DEPS, s, pick, basicThwart(id, who, p)).state;

  it("is a player side scheme that costs 0 and enters play with 3 threat per player (3, then 6)", () => {
    const one = render();
    expect(one.state.villainArea).toContain(one.id);
    expect(inst(one.state, one.id).threat).toBe(3);
    expect(handSize(one.state)).toBe(one.before - 1);
    const two = put(topUp(twoHeroes(ANGEL_FACE, [ANGEL, SPIDER_MAN]), 4), RENDER_CARD, 0);
    expect(inst(two.state, two.id).threat).toBe(6);
  });
  it("thwarted to 0 it is defeated and its When Defeated heals a total of 5 among your characters: 4 on the hero, 3 on an ally", () => {
    const { state: s0, id } = render(undefined, 1);
    const ally = put(topUp(s0, 4), ALLY_PSYLOCKE, 3);
    const hurt = withDamage(withDamage(ally.state, ally.id, 3), identityOf(ally.state), 4);
    const plan = (st: GameState) =>
      new Map<InstanceId, number>([
        [identityOf(st), 3],
        [ally.id, 2],
      ]);
    const state = thwartOut(hurt, id, watching(dividing(plan)));
    expect(state.victoryDisplay).toContain(id);
    expect(asked.max.at(-1)).toBe(5);
    expect(damageOn(state, identityOf(state))).toBe(1);
    expect(damageOn(state, ally.id)).toBe(1);
  });
  it("heals no more than the damage there is: 2 damage on the hero and nothing else is healed away", () => {
    const { state: s0, id } = render(undefined, 1);
    const hurt = withDamage(s0, identityOf(s0), 2);
    const state = thwartOut(hurt, id, firstLegal);
    expect(damageOn(state, identityOf(state))).toBe(0);
  });
  it("not defeated (threat 3, Angel's THW 2): nothing is healed", () => {
    const { state: s0, id } = render();
    const hurt = withDamage(s0, identityOf(s0), 4);
    const state = thwartOut(hurt, id, firstLegal);
    expect(inst(state, id).threat).toBe(1);
    expect(damageOn(state, identityOf(state))).toBe(4);
  });
  it("two players: each player heals 5 among their own characters, never the other's", () => {
    const { state: s0, id } = render([ANGEL, SPIDER_MAN], 1);
    const hurt = withDamage(withDamage(s0, identityOf(s0, P1), 4), identityOf(s0, P2), 3);
    const plan = (st: GameState, chooser: string) =>
      new Map<InstanceId, number>([[identityOf(st, chooser === "p2" ? P2 : P1), 5]]);
    const state = thwartOut(hurt, id, dividing(plan));
    expect(damageOn(state, identityOf(state, P1))).toBe(0);
    expect(damageOn(state, identityOf(state, P2))).toBe(0);
  });
  it("two players: a hero's 5 cannot be spent on the other player's ally", () => {
    const { state: s0, id } = render([ANGEL, SPIDER_MAN], 1);
    const theirs = handOver(s0, "42002", P1, P2);
    const placed = {
      ...theirs.state,
      players: theirs.state.players.map((pl) =>
        pl.playerId === P2
          ? { ...pl, hand: pl.hand.filter((x) => x !== theirs.id), playArea: [...pl.playArea, theirs.id] }
          : pl,
      ),
    } as GameState;
    const withAlly = patchInstance(placed, theirs.id, {
      home: { kind: "playArea", playerId: P2 },
      faceup: true,
    } as never);
    const hurt = withDamage(withDamage(withAlly, theirs.id, 2), identityOf(withAlly, P1), 1);
    let optionsSeenByP1: string[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "divide" && c.playerId === P1) optionsSeenByP1 = c.options.map((o) => o.optionId);
      return dividing(() => new Map())(st);
    };
    thwartOut(hurt, id, pick);
    expect(optionsSeenByP1.some((o) => o.startsWith(`${theirs.id}#`))).toBe(false);
  });
});
