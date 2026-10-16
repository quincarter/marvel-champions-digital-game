import { CW_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  traitsOf,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { constant, forcedResponse, gainsTrait, on } from "../../../dsl/abilities.js";
import { dealDamage } from "../../../dsl/effects.js";
import { defineAbilities, validateDefinition } from "../../../dsl/validate.js";
import { grantedTo, query } from "../../../dsl/values.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { attacksBy, codeOf, piles, revealedCodes, types } from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { IRON_MAN_SCENARIO, WAVE10_DEPS, civilWarHeroGame, stagedInPlay } from "../../testing.js";
import { UNREGISTERED } from "./cape-killer.js";
import { BOUNTY_HUNTING, MODULAR_HEROES_FOR_HIRE } from "./heroes-for-hire.js";
import { MODULAR_PALADIN, MODULAR_PALADIN_SKIPPED } from "./paladin.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Paladin modular set (56117 Paladin, 56118 Paladin's Pistol x2, 56119 Bounty Hunting, 56120 Government
 * Contractor), docs/phase7-wave10.md sections 3.16 and 3.23. Every test is a real game in the `registration-iron-man`
 * scenario with Cape-Killer, Heroes for Hire and Paladin as its modular sets, seated with the Tigra precon (and the
 * Core Spider-Man deck with `twoPlayers`). Iron Man's attachments and his side scheme Stark Tower (a hazard icon, which
 * would deal one more card) are taken off by `game`, so his activation is ATK 1 and SCH 1 and a villain phase deals
 * exactly one card to each player. Iron Man activates once against each player, drawing a boost card each time
 * (Advance, then Assault: no icon, no ability), so a stack reads "boost cards, then the dealt cards in turn order".
 */
const PALADIN = "56117";
const PISTOL = "56118";
const BOUNTY = "56119";
const CONTRACTOR = "56120";
const SUPER = "56106";
const ARREST = "56108"; // a side scheme with a crisis icon: enters play, does nothing else
const ADVANCE = "01186";
const ASSAULT = "01187";
const TWO_GUN_KID = "56010"; // Tigra's Aggression ally: 3 hit points
const SETS = ["cape_killer", "heroes_for_hire", "paladin"];
const REFS = [
  "56117.when-revealed",
  "56118.paladins-pistol-forced-interrupt",
  "56119.when-revealed",
  "56120.government-contractor-constant",
];
const HUNTING = "56097b";
/** The printed resource icons of the Tigra cards in the starting hand. */
const ICONS: Readonly<Record<string, number>> = { "56007": 1, "56008": 1, "56013": 1, "56014": 1, "56022": 2 };

const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, player: PlayerId = P1) => identityOf(s, player);
const hasTrait = (s: GameState, id: InstanceId) => traitsOf(s, id, WAVE10_DEPS).includes(UNREGISTERED);
const handOf = (s: GameState, player: PlayerId = P1) => s.players.find((p) => p.playerId === player)!.hand;
const discardOf = (s: GameState, player: PlayerId = P1) => s.players.find((p) => p.playerId === player)!.discard;
const copiesIn = (s: GameState, code: string) => instancesOf(s, code);
const encounterDiscard = (s: GameState) => piles(s).discard.map((i) => codeOf(s, i));

/** The scenario past setup in hero form, with every attachment taken off Iron Man (and his tough card) and Stark Tower gone. */
function game(opts: { readonly twoPlayers?: boolean; readonly seed?: number } = {}): GameState {
  const start = civilWarHeroGame(IRON_MAN_SCENARIO, {
    modularSetIds: SETS,
    ...(opts.seed ? { seed: opts.seed } : {}),
    ...(opts.twoPlayers ? { twoPlayers: true } : {}),
  });
  const iron = leaderOf(start);
  let current = patchInstance(start, iron, { attachments: [], statuses: { ...inst(start, iron).statuses, tough: 0 } });
  const deckId = activeEncounterDeckId(current);
  const pile = current.encounterDecks[deckId]!;
  const old = inst(start, iron).attachments;
  for (const id of old) current = patchInstance(current, id, { attachedTo: null });
  current = {
    ...current,
    encounterDecks: { ...current.encounterDecks, [deckId]: { deck: pile.deck, discard: [...old, ...pile.discard] } },
    villainArea: current.villainArea.filter((i) => codeOf(current, i) !== "56072"),
  };
  const heroes = opts.twoPlayers ? withForm(current, { heroForm: 0 }, P2) : current;
  // The hero hand size is 5: a hand of 6 would be a forced discard at the end of the turn, one of 4 a draw.
  return {
    ...heroes,
    players: heroes.players.map((p) => ({ ...p, hand: p.hand.slice(0, 5), deck: [...p.hand.slice(5), ...p.deck] })),
  };
}

/** Surgery: `code`'s first copy in the encounter deck moved into `player`'s play area, faceup (an obligation revealed to them). */
function inPlayAreaOf(state: GameState, code: string, player: PlayerId = P1): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => codeOf(state, i) === code)!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
  };
}

/** Surgery: the encounter deck's own copy of minion `code`, engaged with `player` (no reveal, no When Revealed, no quickstrike). */
function engaged(state: GameState, code: string, player: PlayerId = P1) {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => codeOf(state, i) === code)!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: player, faceup: true } },
    } as GameState,
  };
}

/** Surgery: the first Paladin's Pistol in the encounter deck attached to `host`, as if it had been revealed. */
function pistolOn(state: GameState, host: InstanceId) {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => codeOf(state, i) === PISTOL)!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, attachedTo: host, faceup: true },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    } as GameState,
  };
}

/** The players in turn order, from the first player. */
function seats(state: GameState): PlayerId[] {
  const at = state.players.findIndex((p) => p.playerId === state.firstPlayerId);
  return [...state.players.slice(at), ...state.players.slice(0, at)].map((p) => p.playerId);
}

const FILLERS = [ADVANCE, ASSAULT];
/** Every player ends the turn and the villain phase runs; `dealt` are the cards dealt in turn order (see the header). */
const villainPhase = (state: GameState, pick = firstLegal, ...dealt: string[]) =>
  driveEventsPicking(
    WAVE10_DEPS,
    stackEncounterDeck(state, ...FILLERS.slice(0, state.players.length), ...dealt),
    pick,
    ...seats(state).map((p) => endTurn(p)),
  );

/** A picker that answers the effect's own prompt offering `code`'s card with it, and records that prompt. */
function choosing(code: string, asked: PendingChoice[] = []) {
  return (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    // Only the effect's own prompt: a defender or the hand-size discard also list these cards.
    if (!["chooseTarget", "chooseCards"].includes(choice.prompt.kind)) return firstLegal(s);
    const option = choice.options.find((o) => o.ref.kind === "card" && codeOf(s, o.ref.instanceId) === code);
    if (!option) return firstLegal(s);
    asked.push(choice);
    return [option.optionId];
  };
}

/** A picker that defends `enemy`'s attack with the ally `ally` (every other prompt is declined). */
const defendingAgainst =
  (enemy: InstanceId, ally: InstanceId) =>
  (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender" && choice.prompt.attack.enemyInstanceId === enemy) return [ally];
    return firstLegal(s);
  };

const thwart = (state: GameState, scheme: InstanceId) =>
  driveEventsPicking(WAVE10_DEPS, state, firstLegal, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: hero(state, P1),
    schemeInstanceId: scheme,
  });

/** The threat placed on the main scheme with `code`'s card as the source. */
const placedBy = (state: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "threatPlaced")
    .filter((e) => e.sourceInstanceId === instancesOf(state, code)[0])
    .map((e) => e.amount);

describe("registry", () => {
  it("registers the four refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(MODULAR_PALADIN).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_PALADIN)) expect(validateDefinition(def), id).toEqual([]);
    expect(MODULAR_PALADIN_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the four cards", () => {
    const refs = [PALADIN, PISTOL, BOUNTY, CONTRACTOR].flatMap((c) =>
      ((dataOf(c).abilities ?? []) as { id: string }[]).map((a) => a.id),
    );
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const reg = MODULAR_PALADIN;
    expect(reg["56117.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(reg["56118.paladins-pistol-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
      on: { on: "enemyAttack" },
    });
    expect(reg["56119.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(reg["56120.government-contractor-constant"]!.trigger).toMatchObject({ kind: "constant" });
  });

  it("56119 is Heroes for Hire's Bounty Hunting 56115, the one shared definition", () => {
    expect(MODULAR_PALADIN["56119.when-revealed"]).toBe(BOUNTY_HUNTING);
    expect(MODULAR_PALADIN["56119.when-revealed"]).toBe(MODULAR_HEROES_FOR_HIRE["56115.when-revealed"]);
  });

  it("setup: the encounter deck holds one copy of each card and two Pistols", () => {
    const s = game();
    expect([PALADIN, PISTOL, BOUNTY, CONTRACTOR].map((c) => copiesIn(s, c).length)).toEqual([1, 2, 1, 1]);
  });
});

describe("Paladin (56117)", () => {
  it("is data: a unique Elite Hero for Hire minion, ATK 2, SCH 2, 5 hit points, Quickstrike and Toughness", () => {
    const card = dataOf(PALADIN);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      2,
      2,
      5,
      2,
      true,
    ]);
    expect(card.keywords).toEqual([{ name: "quickstrike" }, { name: "toughness" }]);
  });

  it("WHEN REVEALED: you choose a card from your hand to discard; no threat is placed", () => {
    const start = game();
    const claws = handOf(start).find((i) => codeOf(start, i) === "56007")!;
    const asked: PendingChoice[] = [];
    const run = villainPhase(start, choosing("56007", asked), PALADIN);
    expect(asked.map((c) => [c.playerId, c.authority])).toEqual([[P1, "player"]]);
    expect(asked[0]!.options).toHaveLength(5);
    expect(discardOf(run.state)).toContain(claws);
    expect(handOf(run.state)).toHaveLength(4);
    expect(revealedCodes(run.state, run.events)).toEqual([PALADIN]);
    expect(inst(run.state, copiesIn(run.state, PALADIN)[0]!)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(
      types(run.events, "threatPlaced").filter((e) => e.sourceInstanceId === copiesIn(run.state, PALADIN)[0]),
    ).toEqual([]);
  });

  it("WHEN REVEALED with the Unregistered trait: a random card is discarded with no choice", () => {
    const start = inPlayAreaOf(game(), SUPER);
    const before = handOf(start);
    const prompts: string[] = [];
    const run = villainPhase(
      start,
      (s) => {
        prompts.push(s.pendingChoice!.prompt.kind);
        return firstLegal(s);
      },
      PALADIN,
    );
    expect(prompts).not.toContain("chooseCards");
    const gone = before.filter((i) => !handOf(run.state).includes(i));
    expect(gone).toHaveLength(1);
    expect(discardOf(run.state)).toContain(gone[0]);
  });

  it("WHEN REVEALED with the Unregistered trait: another seed can discard another card (the game's random)", () => {
    const picks = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const start = inPlayAreaOf(game({ seed }), SUPER);
      const run = villainPhase(start, firstLegal, PALADIN);
      const gone = handOf(start).filter((i) => !handOf(run.state).includes(i));
      expect(gone).toHaveLength(1);
      picks.add(codeOf(run.state, gone[0]!));
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  // RRG 1.8 "Quickstrike" (p. 36): revealed, his Quickstrike resolves after his When Revealed (the owner's answer 30B,
  // 2026-10-12). "Toughness" (p. 45) is a forced response held to the end of the reveal (RRG v1.8 p.38; owner decision
  // 2026-10-16 (audit finding 18), superseding answer 33A) and placed before his Quickstrike: he attacks holding it.
  it("WHEN REVEALED resolves before his Quickstrike (RRG p. 36): the card is gone from your hand when his attack initiates, and he attacks holding his tough card", () => {
    const start = game();
    const claws = handOf(start).find((i) => codeOf(start, i) === "56007")!;
    let handAtAttack: readonly InstanceId[] | undefined;
    let toughAtAttack: number | undefined;
    const paladinOf = (s: GameState) => copiesIn(s, PALADIN)[0]!;
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice!;
      // The first question his attack asks: who defends it.
      if (choice.prompt.kind === "declareDefender" && choice.prompt.attack.enemyInstanceId === paladinOf(s)) {
        handAtAttack ??= handOf(s);
        toughAtAttack ??= inst(s, paladinOf(s)).statuses.tough;
      }
      return choosing("56007")(s);
    };
    const run = villainPhase(start, pick, PALADIN);
    const paladin = paladinOf(run.state);
    const discarded = run.events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === claws && e.to.kind === "discard",
    );
    const attacked = run.events.findIndex(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "enemyAttack" &&
        e.event.enemyInstanceId === paladin,
    );
    expect(discarded).toBeGreaterThanOrEqual(0);
    expect(discarded).toBeLessThan(attacked);
    expect(handAtAttack).toHaveLength(4);
    expect(handAtAttack).not.toContain(claws);
    expect(toughAtAttack).toBe(1);
    expect(types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === paladin)).toMatchObject([
      { baseAtk: 2 },
    ]);
  });

  it("WHEN REVEALED with an empty hand: nothing is discarded", () => {
    const start = game();
    const emptied = { ...start, players: start.players.map((p) => ({ ...p, hand: [], deck: [], discard: [] })) };
    const run = villainPhase(emptied, firstLegal, PALADIN);
    expect(types(run.events, "cardDiscardedFromHand")).toEqual([]);
    expect(inst(run.state, copiesIn(run.state, PALADIN)[0]!).engagedWith).toBe(P1);
  });
});

describe("Paladin's Pistol (56118)", () => {
  /** Player 1 controls Two-Gun Kid (3 hit points) with 2 damage on him, so 1 hit point is left to absorb a defended attack. */
  function withWoundedAlly(state: GameState) {
    const staged = stagedInPlay(state, TWO_GUN_KID);
    return { state: patchInstance(staged.state, staged.id, { damage: 2 }), kid: staged.id };
  }
  const heroDamage = (s: GameState) => inst(s, hero(s)).damage;

  it("is data: a Weapon attachment giving +2 ATK, attaching to Paladin or otherwise to the enemy leader", () => {
    const card = dataOf(PISTOL);
    expect([card.type, card.statModifiers, card.attachesTo]).toEqual([
      "attachment",
      { atk: 2 },
      { kind: "ifAble", preferred: { kind: "namedCard", name: "Paladin" }, otherwise: { kind: "leader", of: "enemy" } },
    ]);
  });

  it("revealed with Paladin in play: it attaches to Paladin", () => {
    const paladin = engaged(game(), PALADIN);
    const run = villainPhase(paladin.state, firstLegal, PISTOL);
    const pistol = copiesIn(run.state, PISTOL).find((i) => inst(run.state, i).attachedTo)!;
    expect(inst(run.state, pistol).attachedTo).toBe(paladin.id);
    expect(inst(run.state, paladin.id).attachments).toEqual([pistol]);
    expect(inst(run.state, leaderOf(run.state)).attachments).toEqual([]);
  });

  it("revealed with no Paladin in play: it attaches to the enemy leader", () => {
    const run = villainPhase(game(), firstLegal, PISTOL);
    const pistol = copiesIn(run.state, PISTOL).find((i) => inst(run.state, i).attachedTo)!;
    expect(inst(run.state, pistol).attachedTo).toBe(leaderOf(run.state));
    expect(inst(run.state, leaderOf(run.state)).attachments).toEqual([pistol]);
  });

  it("its +2 ATK and FORCED INTERRUPT: Paladin's attack is ATK 4 and overkill, so the damage past a defending ally's last hit point reaches the hero; the Pistol is then discarded", () => {
    const wounded = withWoundedAlly(game());
    const paladin = engaged(wounded.state, PALADIN);
    const armed = pistolOn(paladin.state, paladin.id);
    const run = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(armed.state, ADVANCE, ARREST),
      defendingAgainst(paladin.id, wounded.kid),
      endTurn(P1),
    );
    expect(attacksBy(run.state, run.events, PALADIN)).toMatchObject([{ baseAtk: 4, boostIcons: 0 }]);
    // The ally had 1 hit point left: it is defeated, and the other 3 damage goes to the hero (Iron Man's own attack adds 1).
    expect(types(run.events, "characterDefeated").map((e) => e.instanceId)).toContain(wounded.kid);
    expect(heroDamage(run.state)).toBe(3 + 1);
    // "Discard this card after this attack."
    expect(inst(run.state, armed.id).attachedTo).toBeNull();
    expect(inst(run.state, paladin.id).attachments).toEqual([]);
    expect(piles(run.state).discard).toContain(armed.id);
  });

  it("without the Pistol the same attack is ATK 2 with no overkill: the damage past the ally's last hit point is lost", () => {
    const wounded = withWoundedAlly(game());
    const paladin = engaged(wounded.state, PALADIN);
    const run = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(paladin.state, ADVANCE, ARREST),
      defendingAgainst(paladin.id, wounded.kid),
      endTurn(P1),
    );
    expect(attacksBy(run.state, run.events, PALADIN)).toMatchObject([{ baseAtk: 2, boostIcons: 0 }]);
    expect(types(run.events, "characterDefeated").map((e) => e.instanceId)).toContain(wounded.kid);
    expect(heroDamage(run.state)).toBe(1);
  });

  it("on the enemy leader it applies to Iron Man's attack the same way (ATK 1 + 2, overkill), and is discarded after it", () => {
    const wounded = withWoundedAlly(game());
    const iron = leaderOf(wounded.state);
    const armed = pistolOn(wounded.state, iron);
    const run = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(armed.state, ADVANCE, ARREST),
      defendingAgainst(iron, wounded.kid),
      endTurn(P1),
    );
    expect(attacksBy(run.state, run.events, "56059")).toMatchObject([{ baseAtk: 3, boostIcons: 0 }]);
    // 3 damage: 1 for the ally's last hit point and 2 past it to the hero.
    expect(heroDamage(run.state)).toBe(2);
    expect(inst(run.state, iron).attachments).toEqual([]);
    expect(piles(run.state).discard).toContain(armed.id);
  });

  it("is spent by one attack: the next villain phase Paladin attacks for his printed ATK 2", () => {
    const paladin = engaged(game(), PALADIN);
    const armed = pistolOn(paladin.state, paladin.id);
    const first = villainPhase(armed.state, firstLegal, ARREST);
    expect(attacksBy(first.state, first.events, PALADIN)).toMatchObject([{ baseAtk: 4 }]);
    const reset = patchInstance(first.state, first.state.mainScheme.instanceId, { threat: 0 });
    const second = villainPhase(reset, firstLegal, CONTRACTOR);
    expect(attacksBy(second.state, second.events, PALADIN)).toMatchObject([{ baseAtk: 2 }]);
  });
});

describe("Bounty Hunting (56119, the same card as 56115)", () => {
  it("is data: a treachery with 1 boost icon", () => {
    const card = dataOf(BOUNTY);
    expect([card.type, card.boostIcons]).toEqual(["treachery", 1]);
  });

  it("WHEN REVEALED: you choose the card to discard, and its printed resource icons are the threat on the main scheme", () => {
    const start = game();
    const strength = handOf(start).find((i) => codeOf(start, i) === "56022")!;
    const asked: PendingChoice[] = [];
    const run = villainPhase(start, choosing("56022", asked), BOUNTY);
    expect(asked.map((c) => [c.playerId, c.authority])).toEqual([[P1, "player"]]);
    expect(discardOf(run.state)).toContain(strength);
    expect(placedBy(run.state, run.events, BOUNTY)).toEqual([2]);
    const one = villainPhase(start, choosing("56008"), BOUNTY);
    expect(placedBy(one.state, one.events, BOUNTY)).toEqual([1]);
  });

  it("WHEN REVEALED with the Unregistered trait: a random card is discarded with no choice, and its icons are the threat", () => {
    const start = inPlayAreaOf(game(), SUPER);
    const prompts: string[] = [];
    const run = villainPhase(
      start,
      (s) => {
        prompts.push(s.pendingChoice!.prompt.kind);
        return firstLegal(s);
      },
      BOUNTY,
    );
    expect(prompts).not.toContain("chooseCards");
    const gone = handOf(start).filter((i) => !handOf(run.state).includes(i));
    expect(gone).toHaveLength(1);
    expect(discardOf(run.state)).toContain(gone[0]);
    expect(placedBy(run.state, run.events, BOUNTY)).toEqual([ICONS[codeOf(run.state, gone[0]!)]!]);
  });

  it("WHEN REVEALED with an empty hand: nothing is discarded and no threat is placed", () => {
    const start = game();
    const emptied = { ...start, players: start.players.map((p) => ({ ...p, hand: [], deck: [], discard: [] })) };
    const run = villainPhase(emptied, firstLegal, BOUNTY);
    expect(placedBy(run.state, run.events, BOUNTY).reduce((a, b) => a + b, 0)).toBe(0);
    expect(encounterDiscard(run.state)).toContain(BOUNTY);
  });
});

describe("Government Contractor (56120)", () => {
  /** Government Contractor in play with 1 threat. */
  function withContractor(state: GameState) {
    const deckId = activeEncounterDeckId(state);
    const pile = piles(state);
    const scheme = pile.deck.find((i) => codeOf(state, i) === CONTRACTOR)!;
    return {
      scheme,
      state: {
        ...state,
        encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== scheme) } },
        villainArea: [...state.villainArea, scheme],
        instances: { ...state.instances, [scheme]: { ...state.instances[scheme]!, threat: 1, faceup: true } },
      } as GameState,
    };
  }

  it("is data: a side scheme with 3 threat, an acceleration icon, Hinder 1 per hero and 2 boost icons", () => {
    const card = dataOf(CONTRACTOR);
    expect([card.type, card.startingThreat, card.icons, card.keywords, card.boostIcons]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      ["acceleration"],
      [{ name: "hinder", value: 0, perPlayer: 1 }],
      2,
    ]);
  });

  it("CONSTANT: while it is in play every identity, in either form, has the Unregistered trait; once defeated, none does", () => {
    const start = withForm(game({ twoPlayers: true }), "alterEgo", P2);
    expect([P1, P2].map((p) => hasTrait(start, hero(start, p)))).toEqual([false, false]);
    const { state, scheme } = withContractor(start);
    expect([P1, P2].map((p) => hasTrait(state, hero(state, p)))).toEqual([true, true]);
    const done = thwart(state, scheme);
    expect(types(done.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([scheme]);
    expect([P1, P2].map((p) => hasTrait(done.state, hero(done.state, p)))).toEqual([false, false]);
  });

  it("CONSTANT: revealed, it enters play with 3 threat and 1 for Hinder (one hero), and its acceleration icon adds 1 to step one", () => {
    const run = villainPhase(game(), firstLegal, CONTRACTOR);
    const id = copiesIn(run.state, CONTRACTOR)[0]!;
    expect(inst(run.state, id).threat).toBe(4);
    expect(hasTrait(run.state, hero(run.state))).toBe(true);
    const stepOne = (state: GameState) => {
      const phase = villainPhase(state, firstLegal, ARREST);
      return types(phase.events, "threatPlaced").find((e) => e.schemeInstanceId === state.mainScheme.instanceId)!
        .amount;
    };
    const base = game();
    expect(stepOne(withContractor(base).state)).toBe(stepOne(base) + 1);
  });

  it("CONSTANT: a revealed 56120 is heard as a card that gives heroes the trait (Hunting Rebel Heroes' response, question 12 = A)", () => {
    const start = game({ twoPlayers: true });
    const card = WAVE10_CARDS.find((c) => c.id === start.mainScheme.cardId);
    if (card?.type !== "main_scheme") throw new Error("no main scheme card");
    const stageIndex = card.stages.findIndex((stage) => (stage.printedCardId as string | undefined) === HUNTING);
    expect(stageIndex).toBeGreaterThanOrEqual(0);
    const scripts = defineAbilities({
      "56097b.hunting-rebel-heroes-constant": constant(gainsTrait(UNREGISTERED, query("hero"))),
      "56097b.hunting-rebel-heroes-forced-response": forcedResponse(
        on.cardRevealedGranting(UNREGISTERED, { to: query("hero"), another: true }),
        dealDamage(2, grantedTo(UNREGISTERED, query("hero"))),
      ),
    });
    const deps: EngineDeps = { ...WAVE10_DEPS, abilities: { ...WAVE10_DEPS.abilities, ...scripts } };
    const damageFrom = (state: GameState, events: readonly GameEvent[]) =>
      types(events, "damageDealt")
        .filter((e) => e.sourceInstanceId === state.mainScheme.instanceId)
        .map((e): [InstanceId, number] => [e.targetInstanceId, e.amount])
        .sort(([a], [b]) => a.localeCompare(b));
    const run = (from: GameState) => {
      const staged = stackEncounterDeck(
        { ...from, mainScheme: { ...from.mainScheme, stageIndex } },
        ADVANCE,
        ASSAULT,
        CONTRACTOR,
        ARREST,
      );
      return driveEventsPicking(deps, staged, firstLegal, ...seats(staged).map((p) => endTurn(p)));
    };
    // Both heroes already had the trait from Hunting Rebel Heroes, and each is given it again by the revealed card.
    const both = run(start);
    expect(damageFrom(both.state, both.events)).toEqual(
      [P1, P2].map((p): [InstanceId, number] => [hero(both.state, p), 2]).sort(([a], [b]) => a.localeCompare(b)),
    );
    // A player in alter-ego form is given the trait but is not one of "those heroes".
    const mixed = run(withForm(start, "alterEgo", P2));
    expect(damageFrom(mixed.state, mixed.events)).toEqual([[hero(mixed.state, P1), 2]]);
    expect(hasTrait(mixed.state, hero(mixed.state, P2))).toBe(true);
  });
});
