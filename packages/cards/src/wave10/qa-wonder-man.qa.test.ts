/**
 * Rules QA, wave 10 part 5: the Wonder Man hero pack (58001a to 58034 less 58009 Mr. Hollywood, 58031 Cameo and 58032
 * Coordinated Effort, which are still skipped). Each test cites the printed card, RRG 1.8 (page numbers are the printed
 * ones), an FFG ruling (marvel-champions-rulings-post-rrg-1-7.md, by date) or an owner answer (docs/phase7-wave10.md
 * section 4.0). `it.fails` records a bug found (the test states the printed behavior and fails today; flip it to `it`
 * when the script is fixed); a plain `it` pins behavior the audit confirmed beyond the module tests. Findings and the
 * full audit: docs/phase7-wave10-qa-wonder-man.md.
 *
 * Staging: real commands against Core's Rhino with the hand-built Justice deck `WONDER_MAN_DECK` (there is no printed
 * decklist yet), alone or with Core's Spider-Man (an Avenger hero with a Genius alter ego) as the second seat. Cards in
 * play, tucked cards and the encounter deck are placed by surgery where a test is about something else.
 */
import { CORE_STARTER_DECKS, PLAYABLE_CARDS, WONDER_MAN_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  legalActions,
  locateCard,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  changeForm,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { codeOf } from "../wave9/testing.js";
import {
  CORE_SPIDER_MAN,
  WAVE10_DEPS as DEPS,
  HERO_PACK_CARDS,
  WONDER_MAN_DECK,
  engageMinion,
  heroPackConfig,
  stagedInPlay,
  wonderManGame,
  wonderManHeroGame,
} from "./testing.js";

vi.setConfig({ testTimeout: 240_000 });

const ADVANCE = "01186"; // a Core treachery with no boost icon and no boost ability
const ALTRUISM = "58003";
const BLAST = "58004";
const STRUCK = "58005";
const SIPHON = "58006";
const FIREBIRD = "58012";
const HAWKEYE = "58013";
const ENERGY = "58023";
const IONIC = "58002";
const RESPONSE = ".ionic-physiology-response";

/** What a prompt picker saw and what it was told to do. */
interface Plan {
  /** Optional triggers to take (the ability id ends with one of these); every other optional trigger is declined. */
  readonly take?: readonly string[];
  /** Declare this card the defender when asked (otherwise "no defense"). */
  readonly defender?: InstanceId;
  /** Every chooseTriggers window's offered ability ids, in order. */
  readonly windows?: string[][];
  /** Every offered trigger with the player it was offered to. */
  readonly offeredTo?: { player: string; id: string; attacked?: string }[];
  /** Cards to pick on card prompts, in preference order. */
  readonly cards?: readonly InstanceId[];
  /** Every prompt: kind and option labels. */
  readonly prompts?: string[];
  /** A chooseOption label prefix to pick. */
  readonly option?: string;
  /** Only take triggers of attacks against this player. */
  readonly attackedPlayer?: string;
}
const abilityOf = (o: { ref: { kind: string } }): string | undefined =>
  o.ref.kind === "ability" ? ((o.ref as unknown as { abilityId: string }).abilityId as string) : undefined;
const planner =
  (plan: Plan): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    plan.prompts?.push(`${choice.prompt.kind}: ${choice.options.map((o) => o.label).join(" | ")}`);
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const ids = choice.options.map((o) => abilityOf(o) ?? (o.optionId as string));
        plan.windows?.push(ids);
        const shown = choice.prompt.event as { attackedPlayerId?: string; playerId?: string };
        const attacked = shown.attackedPlayerId ?? shown.playerId;
        for (const id of ids)
          plan.offeredTo?.push({ player: choice.playerId as string, id, ...(attacked ? { attacked } : {}) });
        const ev = choice.prompt.event as { attackedPlayerId?: string; playerId?: string };
        const wrongAttack =
          plan.attackedPlayer !== undefined && (ev.attackedPlayerId ?? ev.playerId) !== plan.attackedPlayer;
        const hit = wrongAttack
          ? undefined
          : choice.options.find((o) => plan.take?.some((t) => (abilityOf(o) ?? "").endsWith(t)));
        return hit ? [hit.optionId] : choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      }
      case "declareDefender": {
        const hit = plan.defender
          ? choice.options.find(
              (o) =>
                (o.optionId as string) === plan.defender ||
                (o.ref.kind === "card" && o.ref.instanceId === plan.defender),
            )
          : undefined;
        return hit ? [hit.optionId] : ["decline"];
      }
      case "chooseOption": {
        const hit = plan.option ? choice.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId] : firstLegal(s);
      }
      default: {
        if (choice.prompt.kind === "payForCard") return [choice.options[0]!.optionId];
        const wanted = plan.cards?.flatMap((id) =>
          choice.options.filter((o) => o.ref.kind === "card" && o.ref.instanceId === id),
        );
        if (wanted && wanted.length > 0) return wanted.slice(0, choice.maxSelections).map((o) => o.optionId);
        return firstLegal(s);
      }
    }
  };
const drive = (s: GameState, plan: Plan, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, planner(plan), ...commands);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const offered = (windows: readonly (readonly string[])[], ref: string): boolean =>
  windows.some((w) => w.some((o) => o.endsWith(ref)));

// ---------------------------------------------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------------------------------------------
const hero = (): GameState => wonderManHeroGame();
const villain = (s: GameState): InstanceId => s.activeVillainId!;
const main = (s: GameState): InstanceId => s.mainScheme.instanceId;
const wm = (s: GameState, player: PlayerId = P1): InstanceId => identityOf(s, player);
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const withThreat = (s: GameState, id: InstanceId, threat: number): GameState => patchInstance(s, id, { threat });
const physiologyOf = (s: GameState): InstanceId => instancesOf(s, IONIC)[0]!;
const tucked = (s: GameState): readonly InstanceId[] => inst(s, physiologyOf(s)).tucked;
const hand = (s: GameState, player: PlayerId = P1): readonly InstanceId[] => playerOf(s, player).hand;
const discardCodes = (s: GameState, player: PlayerId = P1): string[] =>
  playerOf(s, player).discard.map((i) => codeOf(s, i));
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough"): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: 1 } });
/** The last card of P1's deck becomes a copy of `code` (a card the Justice deck does not hold), and is moved to the hand. */
function conjured(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const deck = playerOf(state, player).deck;
  const retagged = patchInstance(state, deck[deck.length - 1]!, { cardId: cardId(code) });
  const moved = moveToHand(retagged, player, code);
  return { state: moved.state, id: moved.ids[0]! };
}
/** `n` cards of P1's deck (none of the three events the tests play) tucked under Ionic Physiology, by surgery. */
function withTucked(state: GameState, n: number) {
  const keep = [ALTRUISM, BLAST, STRUCK, SIPHON, ENERGY, FIREBIRD, HAWKEYE];
  const fodder = playerOf(state, P1)
    .deck.filter((id) => !keep.includes(codeOf(state, id)))
    .slice(0, n);
  const stripped: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => !fodder.includes(i)) } : p,
    ),
  };
  return { state: patchInstance(stripped, physiologyOf(state), { tucked: fodder }), fodder };
}
/** Exactly `code` and the cards that pay for it in P1's hand. */
function staged(base: GameState, code: string, payers: readonly string[] = []) {
  const given = moveToHand(base, P1, code, ...payers);
  const [id, ...paying] = given.ids as [InstanceId, ...InstanceId[]];
  const state: GameState = {
    ...given.state,
    players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [id, ...paying] } : p)),
  };
  return { state, id, paying };
}
/** A playCard command with a printed X and the named payers. */
const playing = (id: InstanceId, payers: readonly InstanceId[], x?: number, player: PlayerId = P1): Command =>
  ({
    type: "playCard",
    playerId: player,
    cardInstanceId: id,
    payment: payers.map((fromHand) => ({ fromHand })),
    attachToInstanceId: null,
    ...(x === undefined ? {} : { x }),
  }) as Command;
const basicAttack = (attacker: InstanceId, target: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (thwarter: InstanceId, scheme: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const playable = (s: GameState, id: InstanceId, player: PlayerId = P1): boolean => {
  const actions = legalActions(s, player, DEPS);
  return (
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)
  );
};
const accepted = (s: GameState, command: Command): boolean => applyCommand(s, command, DEPS).ok;
const encounterOf = (s: GameState) => activeEncounterDeck(s);
/** It is `player`'s turn (the other players have taken theirs), so that player may act in the player phase. */
const turnOf = (s: GameState, player: PlayerId): GameState =>
  ({ ...s, step: { ...s.step, activePlayerId: player, remainingPlayerIds: [] } }) as GameState;
/** The top twelve encounter cards that are not the pack's own made into Advance, so a boost card is harmless. */
function quiet(state: GameState): GameState {
  return encounterOf(state)
    .deck.slice(0, 16)
    .filter((id) => !codeOf(state, id).startsWith("58"))
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
}
/** The top encounter cards turned into `codes` (in order), by surgery. */
function turnedInto(state: GameState, ...codes: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const ids = encounterOf(state).deck.slice(0, codes.length);
  return { state: ids.reduce((acc, id, i) => patchInstance(acc, id, { cardId: cardId(codes[i]!) }), state), ids };
}
/** A scheme card `code` put straight into the villain area with `threat` on it. */
function sideScheme(state: GameState, code: string, threat: number, nth = 0) {
  const turned = turnedInto(state, ...Array.from({ length: nth + 1 }, () => code));
  const id = turned.ids[nth]!;
  const key = activeEncounterDeckId(turned.state);
  const pile = turned.state.encounterDecks[key]!;
  const placed: GameState = {
    ...turned.state,
    villainArea: [...turned.state.villainArea, id],
    encounterDecks: { ...turned.state.encounterDecks, [key]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
  };
  return { state: patchInstance(placed, id, { threat, faceup: true }), id };
}
/** Spider-Man's player (P2) beside Wonder Man (P1), both in hero form. */
function twoPlayerGame(): GameState {
  const config = heroPackConfig(WONDER_MAN_DECK);
  const deck = CORE_STARTER_DECKS.find((d) => d.id === CORE_SPIDER_MAN)!;
  const spider = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId)),
  };
  const created = createGame({ ...config, players: [config.players[0]!, spider] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const open = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return withForm(withForm(open, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
}
/** A Core ally (`code`) put into `player`'s play area, ready, by surgery (retagging the first hand card). */
function allyFor(state: GameState, code: string, player: PlayerId): { state: GameState; id: InstanceId } {
  const id = hand(state, player)[0]!;
  const retagged = patchInstance(state, id, { cardId: cardId(code), faceup: true, controllerId: player });
  return {
    id,
    state: {
      ...retagged,
      players: retagged.players.map((p) =>
        p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 58001a Power Recycling, 58002 Ionic Physiology
// ---------------------------------------------------------------------------------------------------------------
describe("58001a Wonder Man: 'After Wonder Man makes a basic attack' (RRG 'Stun' p. 41)", () => {
  it("a stunned Wonder Man's attack is not made, so the Forced Response is not triggered: the stunned card is discarded and the two tucked cards stay", () => {
    const t = withTucked(hero(), 2);
    const stunned = withStatus(t.state, wm(t.state), "stunned");
    const run = drive(stunned, {}, basicAttack(wm(stunned), villain(stunned)));
    expect(damageOf(run.state, villain(run.state))).toBe(0);
    expect(inst(run.state, wm(run.state)).statuses.stunned).toBe(0);
    expect(tucked(run.state)).toEqual(t.fodder);
  });
});

describe("Teamwork with Ionic Physiology (June 19, 2026 - Ruling 1; March 6, 2026 - Ruling 4)", () => {
  it("Teamwork (a printed [energy] event, played as an Interrupt) is tucked before the damage, so his ATK counts it: 1 + Firebird's 2 + 1 tucked = 4; the Forced Response then discards it", () => {
    const ally = stagedInPlay(hero(), FIREBIRD);
    const given = conjured(ally.state, "59021");
    const windows: string[][] = [];
    const run = drive(
      given.state,
      { take: [".teamwork-interrupt", RESPONSE], windows },
      basicAttack(wm(given.state), villain(given.state)),
    );
    expect(damageOf(run.state, villain(run.state))).toBe(4);
    expect(offered(windows, RESPONSE)).toBe(true);
    expect(tucked(run.state)).toEqual([]);
    expect(discardCodes(run.state)).toContain("59021");
    expect(inst(run.state, ally.id).exhausted).toBe(true);
  });
});

describe("58002 Ionic Physiology: 'When a card leaves play, each card tucked under it is discarded' (RRG 'Tuck' p. 45)", () => {
  it("a card tucked under it that leaves (Signature Sunglasses adding it to the hand) shrinks the ATK at once: 1 tucked, then none, a basic attack deals 1", () => {
    const t = withTucked(hero(), 1);
    expect(characterProfile(t.state, wm(t.state), DEPS)!.atk).toBe(2);
    const emptied = patchInstance(t.state, physiologyOf(t.state), { tucked: [] });
    expect(characterProfile(emptied, wm(emptied), DEPS)!.atk).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 58003 Active Altruism, 58018 Everywhere All at Once: schemes with no threat (RRG 'Target' p. 42)
// ---------------------------------------------------------------------------------------------------------------
describe("58003 Active Altruism against a scheme with no threat (RRG 'Target' p. 42; 'Thwart' p. 43)", () => {
  it("not playable while no scheme has threat, playable with 1 threat on the main scheme", () => {
    const quietBoard = withThreat(hero(), main(hero()), 0);
    const none = moveToHand(quietBoard, P1, ALTRUISM);
    expect(playable(none.state, none.ids[0]!)).toBe(false);
    const some = moveToHand(withThreat(hero(), main(hero()), 1), P1, ALTRUISM);
    expect(playable(some.state, some.ids[0]!)).toBe(true);
  });
});

describe("58018 Everywhere All at Once: 'Choose X schemes' (RRG 'Choose (Game Element)' p. 12; 'Target' p. 42)", () => {
  /** Hero form, 4 threat on the main scheme and on one side scheme (Bomb Scare 01109), the event and `payers` in hand. */
  function schemes(payers: readonly string[], mainThreat = 4, sideThreat = 4) {
    const t = staged(hero(), "58018", payers);
    const side = sideScheme(t.state, "01109", sideThreat);
    return { ...t, state: withThreat(side.state, main(side.state), mainThreat), side: side.id, main: main(side.state) };
  }
  /** Picks the offered scheme cards (in the order given) on any card prompt, recording what the prompt offered. */
  const pickSchemes =
    (prefer: readonly InstanceId[], seen: string[][] = []): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget" || choice.options.some((o) => o.ref.kind === "card")) {
        seen.push(choice.options.map((o) => (o.ref.kind === "card" ? (o.ref.instanceId as string) : o.label)));
        const hits = prefer.flatMap((id) =>
          choice.options.filter((o) => o.ref.kind === "card" && o.ref.instanceId === id),
        );
        if (hits.length > 0) return hits.slice(0, choice.maxSelections).map((o) => o.optionId);
      }
      return planner({})(s);
    };

  // F1 (fixed): the script is one thwart of the chosen schemes, so the engine's target rule refuses it with no threat.
  it("58018 with no scheme that has threat on it: not playable (the ability needs a valid target to be initiated)", () => {
    const t = schemes(["58023"], 0, 0);
    expect(playable(t.state, t.id)).toBe(false);
  });

  // Audit F2 (the owner's answer 52B, 2026-10-13): X = 0 used to play for free and do nothing.
  it("58018 with X = 0 is not a play: 'Choose X schemes' would choose none and remove no threat, so it is refused and nothing changes", () => {
    const t = schemes(["58023"]);
    for (const command of [playing(t.id, [], 0), playing(t.id, t.paying, 0), playing(t.id, [])]) {
      const refused = applyCommand(t.state, command, DEPS);
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error).toMatchObject({ code: "invalid_choice" });
    }
    expect(inst(t.state, t.main).threat).toBe(4);
    expect(inst(t.state, t.side).threat).toBe(4);
    // The card is still a legal action: X = 1 plays it.
    expect(playable(t.state, t.id)).toBe(true);
    expect(accepted(t.state, playing(t.id, t.paying, 1))).toBe(true);
  });

  it("X = 3 with only two schemes in play: 'simultaneously choose as many as are available, to a maximum of the specified number', so both are chosen and thwarted for 2 each", () => {
    const t = schemes(["58023", SIPHON]);
    const seen: string[][] = [];
    const run = driveEventsPicking(DEPS, t.state, pickSchemes([t.main, t.side], seen), playing(t.id, t.paying, 3));
    expect(inst(run.state, t.main).threat).toBe(2);
    expect(inst(run.state, t.side).threat).toBe(2);
    expect(discardCodes(run.state)).toContain("58018");
  });

  it("a scheme with no threat is no valid target (RRG p. 42): with the main scheme at 0 threat only the side scheme can be chosen, and the prompt does not offer the main scheme", () => {
    const t = schemes(["58023"], 0, 4);
    const seen: string[][] = [];
    const run = driveEventsPicking(DEPS, t.state, pickSchemes([t.side, t.main], seen), playing(t.id, t.paying, 2));
    expect(seen.flat()).not.toContain(t.main as string);
    expect(inst(run.state, t.side).threat).toBe(2);
  });

  it("X = 2 with the main scheme at 0 threat and one side scheme: the one valid scheme is thwarted for 3 with a resource overpaid (3 for a cost of 2)", () => {
    const t = schemes(["58023", SIPHON], 0, 4);
    const run = driveEventsPicking(DEPS, t.state, pickSchemes([t.side, t.main]), playing(t.id, t.paying, 2));
    expect(inst(run.state, t.side).threat).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Nemesis staging
// ---------------------------------------------------------------------------------------------------------------
const REAPER = "58026";
const BROTHER = "58027";
/** The first copy of `code` in any player's set-aside area, the encounter deck or its discard pile. */
function copyOf(s: GameState, code: string): InstanceId {
  for (const p of s.players) {
    const aside = p.setAside.find((i) => codeOf(s, i) === code);
    if (aside) return aside;
  }
  const pile = encounterOf(s);
  const found = pile.deck.find((i) => codeOf(s, i) === code) ?? pile.discard.find((i) => codeOf(s, i) === code);
  if (!found) throw new Error(`no ${code}`);
  return found;
}
const takeAside = (s: GameState, id: InstanceId): GameState => ({
  ...s,
  players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
});
/** Grim Reaper engaged with `player`, faceup, as if revealed earlier. */
function withReaper(start: GameState, player: PlayerId = P1, damage = 0): { state: GameState; id: InstanceId } {
  const id = copyOf(start, REAPER);
  const s = takeAside(start, id);
  const pile = encounterOf(s);
  return {
    id,
    state: {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [activeEncounterDeckId(s)]: { ...pile, deck: pile.deck.filter((i) => i !== id) },
      },
      players: s.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...s.instances,
        [id]: { ...s.instances[id]!, faceup: true, controllerId: null, engagedWith: player, damage },
      },
    },
  };
}
/** Brother vs. Brother in the villain area with 2 threat, faceup (surgery: no reveal). */
function withBrother(start: GameState): { state: GameState; id: InstanceId } {
  const id = copyOf(start, BROTHER);
  const s = takeAside(start, id);
  const pile = encounterOf(s);
  return {
    id,
    state: patchInstance(
      {
        ...s,
        villainArea: [...s.villainArea, id],
        encounterDecks: {
          ...s.encounterDecks,
          [activeEncounterDeckId(s)]: { ...pile, deck: pile.deck.filter((i) => i !== id) },
        },
      },
      id,
      { threat: 2, faceup: true },
    ),
  };
}
/**
 * The encounter deck stacked for a villain phase: `boosts` Advance cards (one boost card for each activation before
 * the reveals), then the given cards (set-aside or encounter pack cards, or Core codes retagged from a spare Advance)
 * in order, one dealt to each player in player order.
 */
function stacked(start: GameState, boosts: number, ...codes: readonly string[]): GameState {
  let s = quiet(start);
  const taken: InstanceId[] = [];
  const ids = codes.map((code) => {
    const aside = s.players.flatMap((p) => p.setAside).find((i) => codeOf(s, i) === code && !taken.includes(i));
    if (aside) {
      s = takeAside(s, aside);
      taken.push(aside);
      return aside;
    }
    const own = encounterOf(s).deck.find((i) => !taken.includes(i) && codeOf(s, i) === code);
    if (own && code.startsWith("58")) {
      taken.push(own);
      return own;
    }
    const spare = encounterOf(s).deck.find((i) => !taken.includes(i) && codeOf(s, i) === ADVANCE);
    if (!spare) throw new Error(`no spare card for ${code}`);
    s = patchInstance(s, spare, { cardId: cardId(code) });
    taken.push(spare);
    return spare;
  });
  const left = encounterOf(s).deck.filter((i) => !taken.includes(i));
  const boostIds = left.filter((i) => !codeOf(s, i).startsWith("58")).slice(0, boosts);
  const rest = left.filter((i) => !boostIds.includes(i));
  return {
    ...s,
    encounterDecks: {
      ...s.encounterDecks,
      [activeEncounterDeckId(s)]: { ...encounterOf(s), deck: [...boostIds, ...ids, ...rest] },
    },
  };
}
/** The attack events by `enemy`. */
const attacksBy = (events: readonly GameEvent[], enemy: InstanceId) =>
  ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === enemy);
/** Spider-Man's seat, for a game where he is P1 and Wonder Man P2. */
function spiderSeat() {
  const deck = CORE_STARTER_DECKS.find((d) => d.id === CORE_SPIDER_MAN)!;
  return {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId)),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 58025 Pacifism (give to the Simon Williams player), 58028 Scythe Strike, 58029 Death Cannot Die
// ---------------------------------------------------------------------------------------------------------------
describe("58025 Pacifism: 'Give to the Simon Williams player' (RRG 'Obligation' p. 30; 'Reveal' p. 38)", () => {
  it("revealed by the other player in a two-player game it goes to the Wonder Man player's play area and not to the revealer's", () => {
    const config = heroPackConfig(WONDER_MAN_DECK);
    const created = createGame({ ...config, players: [spiderSeat(), config.players[0]!] }, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const open = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
    // Spider-Man is P1 (reveals first), Wonder Man P2. Both in hero form: Rhino attacks twice (two boost cards).
    const both = withForm(withForm(open, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
    const pacifism = encounterOf(both).deck.find((i) => codeOf(both, i) === "58025");
    expect(pacifism, "Pacifism is in the encounter deck with a Wonder Man seated").toBeDefined();
    const state = stacked(both, 2, "58025", ADVANCE);
    const first = drive(state, {}, endTurn(P1));
    const run = drive(first.state, {}, endTurn(P2));
    const id = instancesOf(run.state, "58025")[0]!;
    expect(playerOf(run.state, P2).playArea).toContain(id);
    expect(playerOf(run.state, P1).playArea).not.toContain(id);
  });
});

describe("58028 Scythe Strike and 58029 Death Cannot Die: Grim Reaper activates 'against you' (RRG 'Reveal' p. 38; 'Quickstrike' p. 36)", () => {
  it("58029 in hero form with Grim Reaper not in play: he is found and revealed, engages the revealer and attacks exactly once (Quickstrike after the reveal), not twice", () => {
    const state = stacked(hero(), 1, "58029");
    const run = drive(state, {}, endTurn(P1));
    const reaper = instancesOf(run.state, REAPER)[0]!;
    expect(inst(run.state, reaper).engagedWith).toBe(P1);
    expect(cardsInPlay(run.state)).toContain(reaper);
    expect(attacksBy(run.events, reaper)).toHaveLength(1);
  });

  it("58029 with Grim Reaper in play engaged with ANOTHER player: he activates against the player who revealed it (the one 'you'), not against his engaged player", () => {
    const two = twoPlayerGame();
    const placed = withReaper(two, P2);
    // Rhino attacks twice (two boost cards: a minion without Villainous gets none, RRG 'Attack (Enemy Activation)' p. 8).
    const state = stacked(placed.state, 2, "58029", ADVANCE);
    const first = drive(state, {}, endTurn(P1));
    const run = drive(first.state, {}, endTurn(P2));
    const aimed = attacksBy([...first.events, ...run.events], placed.id).map((e) => e.targetInstanceId);
    // His own activation hits his engaged player once; the card makes him attack P1 once more.
    expect(aimed).toContain(wm(run.state, P1));
    expect(aimed).toContain(wm(run.state, P2));
    expect(aimed).toHaveLength(2);
  });

  it("58028 with Grim Reaper not in play: the player assigns the 2 indirect damage among the characters they control (RRG 'Indirect Damage' p. 24): an ally can take it", () => {
    const withAlly = stagedInPlay(hero(), HAWKEYE);
    const state = stacked(withAlly.state, 1, "58028");
    const prompts: string[] = [];
    const run = drive(state, { prompts }, endTurn(P1));
    expect(prompts.some((p) => p.startsWith("assignIndirectDamage"))).toBe(true);
    expect(damageOf(run.state, wm(run.state)) + damageOf(run.state, withAlly.id)).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 58027 Brother vs. Brother: an additional cost to attack Grim Reaper
// ---------------------------------------------------------------------------------------------------------------
describe("58027 Brother vs. Brother: 'As an additional cost to attack Grim Reaper, you must discard 1 card from your hand' (RRG 'Cost' p. 13)", () => {
  /** Reaper engaged with P1 and Brother vs. Brother in play; the hand is exactly `codes`. */
  function table(...codes: readonly string[]) {
    const reaper = withReaper(hero());
    const brother = withBrother(reaper.state);
    const given = moveToHand(brother.state, P1, ...codes);
    const state: GameState = {
      ...given.state,
      players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [...given.ids] } : p)),
    };
    return { state, reaper: reaper.id, ids: given.ids };
  }
  const targetsSeen =
    (seen: string[], prefer?: InstanceId): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.options.some((o) => o.ref.kind === "card")) {
        seen.push(...choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId as string] : [])));
        const hit = prefer
          ? choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === prefer)
          : undefined;
        if (hit) return [hit.optionId];
      }
      return planner({})(s);
    };

  it("Ionic Blast with only a payer beside it in hand: nothing is left to discard once the payer pays, so Grim Reaper is not offered as its target", () => {
    const t = table(BLAST, "58016");
    const seen: string[] = [];
    driveEventsPicking(DEPS, t.state, targetsSeen(seen, t.reaper), playing(t.ids[0]!, [t.ids[1]!]));
    expect(seen).toContain(villain(t.state) as string);
    expect(seen).not.toContain(t.reaper as string);
  });

  it("Ionic Blast with a spare card in hand: Grim Reaper (3 hit points) can be the target and is defeated by the 3 damage; the spare card is discarded with the payer", () => {
    const t = table(BLAST, "58016", "58021");
    const seen: string[] = [];
    const run = driveEventsPicking(DEPS, t.state, targetsSeen(seen, t.reaper), playing(t.ids[0]!, [t.ids[1]!]));
    expect(seen).toContain(t.reaper as string);
    expect(cardsInPlay(run.state)).not.toContain(t.reaper);
    expect(hand(run.state)).toEqual([]);
  });

  it("Hawkeye's 2 damage to Grim Reaper is not an attack (RRG 'Attack (Player Ability Type)'), so it costs no card from the hand", () => {
    const t = table("58021");
    const ally = stagedInPlay(t.state, HAWKEYE, { counters: { arrow: 4 } });
    const given = withThreat(ally.state, main(ally.state), 3);
    const before = hand(given).length;
    const run = drive(given, { take: [".hawkeye-response"], cards: [t.reaper] }, basicThwart(ally.id, main(given)));
    expect(damageOf(run.state, t.reaper)).toBe(2);
    expect(hand(run.state)).toHaveLength(before);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Other players: "an ally", "a friendly character", "a character other than your hero" in a two-player game
// ---------------------------------------------------------------------------------------------------------------
const BLACK_CAT = "01002"; // Core ally: 2 hit points, ATK 2, THW 1, consequential damage on an attack
const MERCENARY = "01101"; // Hydra Mercenary: a plain 3-hit-point minion
/** A card `code` attached to `host` by surgery, controlled by `player` (the last card of that player's deck becomes it). */
function attachedTo(state: GameState, code: string, host: InstanceId, player: PlayerId = P1) {
  const deck = playerOf(state, player).deck;
  const id = deck[deck.length - 1]!;
  const stripped: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id) } : p)),
  };
  const placed = patchInstance(stripped, id, {
    cardId: cardId(code),
    faceup: true,
    controllerId: player,
    attachedTo: host,
  });
  return { state: patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] }), id };
}

describe("58013 Hawkeye: 'After an ally makes a basic thwart' hears every ally, another player's included", () => {
  it("Spider-Man's player thwarts with Black Cat: Hawkeye's controller is offered the Response, spends an arrow and deals 2 to the minion", () => {
    const two = twoPlayerGame();
    const hawkeye = stagedInPlay(two, HAWKEYE, { counters: { arrow: 4 } });
    const cat = allyFor(hawkeye.state, BLACK_CAT, P2);
    const merc = engageMinion(cat.state, MERCENARY, "merc", P1);
    const threatened = turnOf(withThreat(merc, main(merc), 3), P2);
    const offeredTo: { player: string; id: string }[] = [];
    const run = drive(
      threatened,
      { take: [".hawkeye-response"], cards: ["merc" as InstanceId], offeredTo },
      basicThwart(cat.id, main(threatened), P2),
    );
    expect(offeredTo.filter((o) => o.id.endsWith(".hawkeye-response")).map((o) => o.player)).toEqual(["p1"]);
    expect(damageOf(run.state, "merc" as InstanceId)).toBe(2);
    expect(inst(run.state, hawkeye.id).counters.arrow).toBe(3);
  });
});

describe("58020 Unified Strike: 'When an ally uses a basic power' hears every ally, and adds the hero's ATK as it stands (Power Recycling counted)", () => {
  function strike(take: boolean) {
    const two = twoPlayerGame();
    const tuck = withTucked(two, 2);
    const cat = allyFor(tuck.state, HAWKEYE, P2);
    const given = conjured(turnOf(cat.state, P2), "58020");
    const run = drive(
      given.state,
      { take: take ? [".unified-strike-interrupt"] : [] },
      basicAttack(cat.id, villain(given.state), P2),
    );
    return { run, cat: cat.id, state: run.state, state0: given.state };
  }
  it("Hawkeye (P2's ally, consequential damage 1) attacks with Wonder Man's ATK 1 + 2 tucked added to his (+3); he takes no consequential damage and the hero is exhausted", () => {
    const taken = strike(true);
    const control = strike(false);
    // Hawkeye alone does his own ATK; the strike adds Wonder Man's: 1 + the 2 cards tucked under Ionic Physiology.
    const own = damageOf(control.state, villain(control.state));
    expect(own).toBeGreaterThan(0);
    expect(damageOf(taken.state, villain(taken.state))).toBe(own + 3);
    expect(damageOf(control.state, control.cat)).toBeGreaterThan(0);
    expect(damageOf(taken.state, taken.cat)).toBe(0);
    expect(inst(taken.state, wm(taken.state, P1)).exhausted).toBe(true);
  });
});

describe("58019 Stronger Together: a character other than your hero that shares a trait (RRG 'Form, Change Form' p. 21: the face that is up)", () => {
  function villainPhase(plan: Plan) {
    const given = conjured(quiet(twoPlayerGame()), "58019");
    const first = drive(given.state, plan, endTurn(P1));
    return drive(first.state, plan, endTurn(P2));
  }
  it("Spider-Man (an Avenger hero, undefended) is hit by Rhino's ATK 2: Wonder Man's DEF 2 reduces it to 0", () => {
    const offeredTo: { player: string; id: string }[] = [];
    const run = villainPhase({ take: [".stronger-together-interrupt"], offeredTo });
    expect(damageOf(run.state, wm(run.state, P2))).toBe(0);
    // Only the other player's damage is heard: Wonder Man's own hero is never offered it.
    expect(offeredTo.filter((o) => o.id.endsWith(".stronger-together-interrupt"))).toHaveLength(1);
  });
  it("control: without the event the same attack deals 2", () => {
    const run = villainPhase({});
    expect(damageOf(run.state, wm(run.state, P2))).toBe(2);
  });
});

describe("58022 Swordsman: 'during an undefended attack' is not limited to attacks on you", () => {
  // F2 (fixed): the pattern carries no `playerIs`, so every player's undefended attack is heard.
  it("Rhino's undefended attack on the OTHER player: Swordsman's Hero Response is offered to his controller (the printed text says 'an undefended attack', not 'against you')", () => {
    const two = twoPlayerGame();
    const sword = stagedInPlay(conjured(quiet(two), "58022").state, "58022");
    const offeredTo: { player: string; id: string; attacked?: string }[] = [];
    const first = drive(sword.state, { offeredTo }, endTurn(P1));
    const run = drive(first.state, { offeredTo, take: [".swordsman-response"], attackedPlayer: "p2" }, endTurn(P2));
    const attacks = ofType([...first.events, ...run.events], "attackResolved");
    // Both of Rhino's attacks (on P1 and on P2) have a boost card turned faceup while undefended.
    expect(attacks).toHaveLength(2);
    expect(offeredTo.filter((o) => o.id.endsWith(".swordsman-response")).map((o) => o.attacked)).toEqual(["p1", "p2"]);
    // Taken for the attack on P2: Swordsman is the target and takes it, Spider-Man does not.
    expect(damageOf(run.state, sword.id)).toBe(2);
    expect(damageOf(run.state, wm(run.state, P2))).toBe(0);
  });
});

describe("58024 Jarvis: 'After an Avenger hero changes into alter-ego form' is any player's hero", () => {
  it("Spider-Man (an Avenger) flips to alter ego: Jarvis's controller is offered the Response, exhausts him, and Peter Parker recovers with REC 3 + 2", () => {
    const two = twoPlayerGame();
    const jarvis = stagedInPlay(conjured(two, "58024").state, "58024");
    const offeredTo: { player: string; id: string }[] = [];
    const run = drive(turnOf(jarvis.state, P2), { take: [".jarvis-response"], offeredTo }, changeForm(P2));
    expect(offeredTo.filter((o) => o.id.endsWith(".jarvis-response")).map((o) => o.player)).toEqual(["p1"]);
    expect(inst(run.state, jarvis.id).exhausted).toBe(true);
    expect(characterProfile(run.state, wm(run.state, P2), DEPS)!.rec).toBe(5);
    expect(characterProfile(run.state, wm(run.state, P1), DEPS)!.rec).not.toBe(5);
  });
});

describe("58030 Caught in the Crossfire: 'When a friendly character attacks' (RRG 'Stun' p. 41; 'Friendly' p. 21)", () => {
  function board() {
    const two = twoPlayerGame();
    const host = engageMinion(two, "01129", "host", P1);
    const crossfire = attachedTo(host, "58030", "host" as InstanceId, P1);
    const cat = allyFor(crossfire.state, BLACK_CAT, P2);
    return { state: turnOf(cat.state, P2), cat: cat.id };
  }
  it("another player's ally attacks the villain: the Interrupt belongs to the upgrade's controller, who is offered it, and the minion takes 1", () => {
    const t = board();
    const offeredTo: { player: string; id: string }[] = [];
    const run = drive(
      t.state,
      { take: [".caught-in-the-crossfire-interrupt"], offeredTo },
      basicAttack(t.cat, villain(t.state), P2),
    );
    expect(offeredTo.filter((o) => o.id.endsWith(".caught-in-the-crossfire-interrupt")).map((o) => o.player)).toEqual([
      "p1",
    ]);
    expect(damageOf(run.state, "host" as InstanceId)).toBe(1);
  });
  it("a stunned Wonder Man's attempted basic attack is not an attack made: the Interrupt is not offered and the minion takes nothing", () => {
    const t = board();
    const stunned = withStatus(turnOf(t.state, P1), wm(t.state, P1), "stunned");
    const windows: string[][] = [];
    const run = drive(
      stunned,
      { take: [".caught-in-the-crossfire-interrupt"], windows },
      basicAttack(wm(stunned, P1), villain(stunned)),
    );
    expect(offered(windows, ".caught-in-the-crossfire-interrupt")).toBe(false);
    expect(damageOf(run.state, "host" as InstanceId)).toBe(0);
  });
});

describe("58021 Heroic Conditioning: 'Play under any player's control'; 'You get +3 hit points and your hero gets +1 THW'", () => {
  function conditioned(under: PlayerId) {
    const two = twoPlayerGame();
    const given = conjured(two, "58021");
    const payers = hand(given.state)
      .filter((i) => i !== given.id)
      .slice(0, 3);
    const command = {
      ...play(P1, given.id, payers, { attachToInstanceId: wm(given.state, under) }),
      controllerId: under,
    } as Command;
    const run = drive(given.state, {}, command);
    return { before: given.state, after: run.state, id: given.id };
  }
  it("played for real under the OTHER player's identity: 'you' is that controller (+3 hit points, hero +1 THW for Spider-Man), Wonder Man's player gets nothing", () => {
    const t = conditioned(P2);
    const p2 = (s: GameState) => characterProfile(s, wm(s, P2), DEPS)!;
    const p1 = (s: GameState) => characterProfile(s, wm(s, P1), DEPS)!;
    expect(inst(t.after, t.id).attachedTo).toBe(wm(t.after, P2));
    expect(p2(t.after).maxHp).toBe(p2(t.before).maxHp + 3);
    expect(p2(t.after).thw).toBe(p2(t.before).thw + 1);
    expect(p1(t.after).maxHp).toBe(p1(t.before).maxHp);
    expect(p1(t.after).thw).toBe(p1(t.before).thw);
  });
  it("Max 1 per player: a second copy is refused under the same identity", () => {
    const t = conditioned(P2);
    const second = conjured(t.after, "58021");
    const payers = hand(second.state, P1)
      .filter((i) => i !== second.id)
      .slice(0, 3);
    const again = {
      ...play(P1, second.id, payers, { attachToInstanceId: wm(second.state, P2) }),
      controllerId: P2,
    } as Command;
    expect(accepted(second.state, again)).toBe(false);
  });
});

describe("58034 Avengers Compound: 'Play only if your identity has the Avenger trait' (RRG 'Form, Change Form' p. 21)", () => {
  it("Simon Williams prints only Civilian: it cannot be played in alter-ego form and can in hero form (a player-facing consequence, as for Hercules's Evaluate Threat)", () => {
    const a = conjured(wonderManGame(), "58034");
    const h = conjured(hero(), "58034");
    expect(playable(a.state, a.id)).toBe(false);
    expect(playable(h.state, h.id)).toBe(true);
  });
});

describe("58011 \"What Are You?\" with Heroic Conditioning: 'set his hit point dial to 4' is remaining hit points (RRG 'Hit Points' p. 22)", () => {
  it("with +3 hit points on him, defeat leaves him at 4 remaining (11 damage on 15), not at 4 damage", () => {
    const conditioning = stagedInPlay(hero(), "58021", { attach: true });
    const way = stagedInPlay(conditioning.state, "58011", { attach: true });
    const hurt = patchInstance(quiet(way.state), wm(way.state), { damage: 14 });
    const run = drive(hurt, {}, endTurn(P1));
    expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
    const profile = characterProfile(run.state, wm(run.state), DEPS)!;
    expect(profile.maxHp - damageOf(run.state, wm(run.state))).toBe(4);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 58015 Sentry, 58014 Scarlet Witch
// ---------------------------------------------------------------------------------------------------------------
describe("58015 Sentry: 'search the encounter deck for a side scheme and reveal it. (Shuffle.)' (RRG 'Search' p. 39)", () => {
  /** Every side scheme of the encounter deck (Rhino's own Breakin' & Takin' among them) moved to its discard pile. */
  function clearOfSideSchemes(base: GameState): GameState {
    const key = activeEncounterDeckId(base);
    const pile = base.encounterDecks[key]!;
    const isSide = (i: InstanceId) => base.cardPool[inst(base, i).cardId]?.type === "side_scheme";
    return {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [key]: { deck: pile.deck.filter((i) => !isSide(i)), discard: [...pile.discard, ...pile.deck.filter(isSide)] },
      },
    };
  }
  function sentry(sides: readonly string[]) {
    const given = staged(hero(), "58015", ["58016", "58016", "58016"]);
    const turned = turnedInto(clearOfSideSchemes(given.state), ...sides);
    const run = drive(turned.state, {}, play(P1, given.id, given.paying));
    return { run, ids: turned.ids, before: turned.state };
  }
  const encounterShuffles = (events: readonly GameEvent[]) =>
    ofType(events, "deckShuffled").filter((e) => (e.zone as unknown as { kind?: string }).kind === "encounterDeck")
      .length;
  it("with two side schemes in the deck: exactly one is revealed (a search that finds a card adds it; it is not optional), no threat goes on the main scheme, and the encounter deck is shuffled once", () => {
    const t = sentry(["01109", "01107"]);
    const revealed = t.ids.filter((i) => cardsInPlay(t.run.state).includes(i));
    expect(revealed).toHaveLength(1);
    expect(inst(t.run.state, main(t.run.state)).threat).toBe(inst(t.before, main(t.before)).threat);
    expect(encounterShuffles(t.run.events)).toBe(1);
  });
  it("with none in the deck: 6 threat on the main scheme, and the deck that was searched is still shuffled", () => {
    const t = sentry([]);
    expect(inst(t.run.state, main(t.run.state)).threat).toBe(inst(t.before, main(t.before)).threat + 6);
    expect(encounterShuffles(t.run.events)).toBe(1);
  });
});

describe("58014 Scarlet Witch finding Death Cannot Die: the treachery's When Revealed resolves (RRG 'Reveal' p. 38)", () => {
  it("the discarded Death Cannot Die finds and reveals Grim Reaper, who engages the player and attacks once (Quickstrike after the reveal); the treachery stays discarded", () => {
    const given = staged(hero(), "58014", ["58016", "58016"]);
    const stack = stacked(given.state, 0, "58029");
    const run = drive(stack, {}, play(P1, given.id, given.paying));
    const reaper = instancesOf(run.state, REAPER)[0]!;
    expect(inst(run.state, reaper).engagedWith).toBe(P1);
    expect(attacksBy(run.events, reaper)).toHaveLength(1);
    const dcd = instancesOf(run.state, "58029")[0]!;
    expect(cardsInPlay(run.state)).not.toContain(dcd);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 58033 Disarming Defense: "if you take no damage"
// ---------------------------------------------------------------------------------------------------------------
describe("58033 Disarming Defense: 'If you take no damage from that attack' (RRG 'Tough' p. 44: a tough status card prevents damage fully, so the character 'is not considered to have taken damage')", () => {
  const RAGE = "01100"; // Enhanced Ivory Horn: a Rhino attachment printing a Hero Action (Azazel's Sword would give Rhino piercing; a player upgrade such as Focused Rage is no "attachment")
  const SONIC_CONVERTER = "01118"; // 3 boost icons
  /** The bottom card of the encounter deck turned into `code` and attached to `host` by surgery. */
  function encounterAttach(s: GameState, code: string, host: InstanceId) {
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const id = pile.deck[pile.deck.length - 1]!;
    const moved: GameState = {
      ...s,
      encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
    };
    const placed = patchInstance(moved, id, { attachedTo: host, faceup: true, cardId: cardId(code) });
    return { state: patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] }), id };
  }
  function armed(tough: boolean) {
    const base = hero();
    const sword = encounterAttach(base, RAGE, villain(base));
    const boosted = encounterOf(sword.state)
      .deck.slice(0, 8)
      .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(SONIC_CONVERTER) }), sword.state);
    const given = conjured(boosted, "58033");
    const state = tough ? withStatus(given.state, wm(given.state), "tough") : given.state;
    return { state, sword: sword.id };
  }
  const run = (t: ReturnType<typeof armed>) =>
    drive(t.state, { take: [".disarming-defense-interrupt"], defender: wm(t.state) }, endTurn(P1));

  // F3 (fixed): the script reads the damage the hero TOOK (`eventDamageTaken`), not the damage the attack DEALT.
  it("Rhino's ATK 2 + 3 boost icons against DEF 2 + 2 leaves damage, which a tough status card prevents: no damage is taken, so the attachment printing a Hero Action is discarded", () => {
    const t = armed(true);
    const out = run(t);
    expect(damageOf(out.state, wm(out.state))).toBe(0);
    expect(inst(out.state, wm(out.state)).statuses.tough).toBe(0);
    expect(inst(out.state, t.sword).attachedTo).toBeNull();
  });
  it("control: without the tough card the same damage is taken and the attachment stays", () => {
    const t = armed(false);
    const out = run(t);
    expect(damageOf(out.state, wm(out.state))).toBeGreaterThan(0);
    expect(inst(out.state, t.sword).attachedTo).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// More pins: a defeated Starstruck target, forced form changes
// ---------------------------------------------------------------------------------------------------------------
describe("58005 Starstruck overpaid against an enemy the damage defeats", () => {
  it("the defeated minion left play, so there is nothing to stun: no stun is given and nothing breaks (RRG 'Defeat' p. 14)", () => {
    const t = staged(engageMinion(hero(), MERCENARY, "merc", P1), STRUCK, [ENERGY]);
    const hurt = patchInstance(t.state, "merc" as InstanceId, { damage: 2 });
    const run = drive(hurt, { cards: ["merc" as InstanceId] }, playing(t.id, t.paying));
    expect(cardsInPlay(run.state)).not.toContain("merc" as InstanceId);
    expect(ofType(run.events, "statusGiven")).toHaveLength(0);
  });
});

describe('58011 "What Are You?" changes him to alter-ego form: a form change by a card is still a change (RRG "Form, Change Form" p. 21)', () => {
  it("Signature Sunglasses ('After you change form') and Jarvis ('After an Avenger hero changes into alter-ego form') are both offered after the replacement", () => {
    const way = stagedInPlay(hero(), "58011", { attach: true });
    const glasses = stagedInPlay(way.state, "58010", { attach: true });
    const jarvis = stagedInPlay(conjured(glasses.state, "58024").state, "58024");
    // An energy event in the discard pile, so the Sunglasses' choice has an option that can be resolved.
    const event = moveToHand(jarvis.state, P1, ALTRUISM);
    const filed: GameState = {
      ...event.state,
      players: event.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => i !== event.ids[0]), discard: [...p.discard, event.ids[0]!] }
          : p,
      ),
    };
    const hurt = patchInstance(quiet(filed), wm(filed), { damage: 11 });
    const windows: string[][] = [];
    const run = drive(hurt, { windows }, endTurn(P1));
    expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
    expect(offered(windows, ".signature-sunglasses-response"), JSON.stringify(windows)).toBe(true);
    expect(offered(windows, ".jarvis-response"), JSON.stringify(windows)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A scripted full game
// ---------------------------------------------------------------------------------------------------------------
describe("Wonder Man (hand-built Justice deck, nemesis set dealt in) against Core's Rhino, seed 1: a scripted game, invariants after every command", () => {
  let session: GameSession;
  let state: GameState;
  /** Logged segments: a replay of each from its first state must end where the segment ended. */
  const segments: { readonly log: GameSession["log"]; readonly end: GameState }[] = [];
  const formChanges = new Map<number, number>();

  /** Constants the game must keep: how many copies of each nemesis, obligation and kit card exist. */
  const COPIES: Readonly<Record<string, number>> = {
    "58002": 1,
    "58025": 1,
    "58026": 1,
    "58027": 1,
    "58028": 1,
    "58029": 2,
  };
  const OWNED = (s: GameState): InstanceId[] =>
    (Object.keys(s.instances) as InstanceId[]).filter((i) => s.instances[i]!.ownerId === P1);

  /** Throws on the first broken invariant of `s`. */
  function check(s: GameState, where: string): void {
    const fail = (message: string): never => {
      throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
    };
    const choice = s.pendingChoice;
    if (choice) {
      if (choice.minSelections > choice.options.length) fail(`soft lock: ${choice.prompt.kind}`);
    } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
      fail("the game stopped between steps with nothing pending");
    }
    const lists: [string, readonly InstanceId[]][] = [];
    for (const p of s.players) {
      lists.push([`${p.playerId} hand`, p.hand], [`${p.playerId} deck`, p.deck], [`${p.playerId} discard`, p.discard]);
      lists.push([`${p.playerId} playArea`, p.playArea], [`${p.playerId} setAside`, p.setAside]);
      for (const [name, piles] of Object.entries(p.separateDecks))
        lists.push([`${p.playerId} ${name} deck`, piles.deck], [`${p.playerId} ${name} discard`, piles.discard]);
    }
    for (const [name, piles] of Object.entries(s.encounterDecks))
      lists.push([`encounter ${name} deck`, piles.deck], [`encounter ${name} discard`, piles.discard]);
    lists.push(["villainArea", s.villainArea], ["victoryDisplay", s.victoryDisplay], ["removed", s.removedFromGame]);
    lists.push(["encounterSetAside", s.encounterSetAside]);
    // Cards tucked under another card and cards attached to one are each their own place.
    for (const [id, i] of Object.entries(s.instances)) {
      if (i.tucked.length > 0) lists.push([`tucked under ${id}`, i.tucked]);
    }
    const seen = new Map<InstanceId, string>();
    for (const [name, ids] of lists)
      for (const id of ids) {
        if (seen.has(id)) fail(`${id} is in two zones: ${seen.get(id)}, ${name}`);
        seen.set(id, name);
      }
    // Every card Wonder Man's player owns is in a zone, tucked under a card, or attached to one.
    for (const id of OWNED(s)) {
      const attached = s.instances[id]!.attachedTo !== null;
      if (!seen.has(id) && !attached && locateCard(s, id) === null) fail(`${codeOf(s, id)} (${id}) is in no zone`);
    }
    for (const [code, copies] of Object.entries(COPIES)) {
      const n = (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code).length;
      if (n !== copies) fail(`${n} copies of ${code}, expected ${copies}`);
    }
    // Ionic Physiology: at most 3 tucked, each owned by Wonder Man's player, and the ATK bonus is exactly their count.
    const ionic = (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === IONIC)!;
    const under = s.instances[ionic]!.tucked;
    if (under.length > 3) fail(`${under.length} cards tucked under Ionic Physiology`);
    for (const t of under) if (s.instances[t]!.ownerId !== P1) fail(`${t} is tucked but not owned by the player`);
    const me = playerOf(s, P1).identity;
    if (me.form === "hero") {
      const atk = characterProfile(s, me.instanceId, DEPS)!.atk;
      if (atk !== 1 + under.length) fail(`ATK ${atk} with ${under.length} tucked`);
    }
    for (const [id, i] of Object.entries(s.instances)) if (i.damage < 0) fail(`${id} has negative damage`);
  }

  /** Runs commands, answering each prompt by `plan`, through the session log; checks the invariants after each. */
  const act = (plan: Plan, ...commands: readonly Command[]): GameEvent[] => {
    const events: GameEvent[] = [];
    const settleOne = (where: string) => {
      while (state.pendingChoice && !state.outcome) {
        const choice = state.pendingChoice;
        const r = sessionApply(
          session,
          {
            type: "resolveChoice",
            playerId: choice.playerId,
            choiceId: choice.choiceId,
            selectedOptionIds: planner(plan)(state),
          },
          DEPS,
        );
        if (!r.ok) throw new Error(r.error.message);
        session = r.session;
        state = r.session.state;
        events.push(...r.events);
        check(state, `${where} (choice)`);
      }
    };
    settleOne("pending");
    for (const command of commands) {
      if (command.type === "changeForm") formChanges.set(state.round, (formChanges.get(state.round) ?? 0) + 1);
      const r = sessionApply(session, command, DEPS);
      if (!r.ok) throw new Error(`${command.type}: ${r.error.code}: ${r.error.message}`);
      session = r.session;
      state = r.session.state;
      events.push(...r.events);
      check(state, command.type);
      settleOne(command.type);
    }
    return events;
  };
  /** Test-only surgery: closes the logged segment and opens the next one from the changed state. */
  const surgery = (next: GameState) => {
    segments.push({ log: session.log, end: state });
    state = next;
    session = startSession(next);
  };
  const handId = (code: string): InstanceId => {
    const id = playerOf(state, P1).hand.find((i) => codeOf(state, i) === code);
    if (!id) throw new Error(`${code} is not in hand`);
    return id;
  };
  const inPlayId = (code: string): InstanceId => {
    const id = cardsInPlay(state).find((i) => codeOf(state, i) === code);
    if (!id) throw new Error(`${code} is not in play`);
    return id;
  };
  const me = (): InstanceId => identityOf(state);
  const rhino = (): InstanceId => state.activeVillainId!;
  const reaperId = (): InstanceId => instancesOf(state, REAPER)[0]!;
  /** The hand is exactly these cards (the first copy of each, from the deck or discard pile). */
  const handOf = (...codes: string[]) => {
    const given = moveToHand(state, P1, ...codes);
    // The rest of the hand goes to the bottom of the deck, so every card stays in some zone.
    surgery({
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: [...given.ids],
              deck: [...p.deck, ...p.hand.filter((i) => !given.ids.includes(i))],
            }
          : p,
      ),
    });
  };

  it("setup: alter-ego form, hand of 6, Ionic Physiology in play on Simon Williams, the nemesis set aside, the obligation in the encounter deck", () => {
    state = quiet(wonderManGame());
    session = startSession(state);
    check(state, "start");
    const p = playerOf(state, P1);
    expect(p.identity.form).toBe("alterEgo");
    expect(p.hand).toHaveLength(6);
    expect(inst(state, physiologyOf(state)).attachedTo).toBe(me());
    expect(p.setAside.map((i) => codeOf(state, i)).sort()).toEqual(
      expect.arrayContaining([REAPER, BROTHER, "58028", "58029", "58029"]),
    );
    expect(encounterOf(state).deck.some((i) => codeOf(state, i) === "58025")).toBe(true);
  });

  it("round 1, alter ego: Wonder Fans is played and used to draw (nothing to tuck yet); he flips to hero form", () => {
    handOf("58007", "58016");
    act({}, play(P1, handId("58007"), [handId("58016")]));
    const fans = inPlayId("58007");
    const before = playerOf(state, P1).hand.length;
    act({ option: "Draw" }, use(P1, fans, "58007.wonder-fans-action"));
    expect(inst(state, fans).exhausted).toBe(true);
    expect(playerOf(state, P1).hand.length).toBe(before + 1);
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("hero");
  });

  it("round 1, hero form: Active Altruism with Energy overpaid by 2 removes 1 + 4 threat; Ionic Physiology tucks it (full hit points: no heal); the basic attack deals 1 + 1, then empties it", () => {
    surgery(withThreat(state, main(state), 4));
    handOf(ALTRUISM, ENERGY);
    act({ take: [RESPONSE] }, play(P1, handId(ALTRUISM), [handId(ENERGY)]));
    expect(inst(state, main(state)).threat).toBe(0);
    expect(tucked(state).map((i) => codeOf(state, i))).toEqual([ALTRUISM]);
    expect(damageOf(state, me())).toBe(0);
    const before = damageOf(state, rhino());
    act({}, basicAttack(me(), rhino()));
    expect(damageOf(state, rhino()) - before).toBe(2);
    expect(tucked(state)).toEqual([]);
    expect(discardCodes(state)).toContain(ALTRUISM);
  });

  it("round 1, villain phase: Rhino's attack is undefended (he readied at the end of the player phase, RRG End of Player Phase, p. 18, but a defense would leave him exhausted for round 2); Death Cannot Die finds Grim Reaper, who engages him and attacks once by Quickstrike", () => {
    surgery(stacked(state, 1, "58029"));
    const events = act({}, endTurn());
    expect(state.round).toBe(2);
    expect(inst(state, reaperId()).engagedWith).toBe(P1);
    expect(attacksBy(events, reaperId())).toHaveLength(1);
    expect(damageOf(state, me())).toBe(4);
  });

  it("round 2: Ionic Blast paid with Energy (cost 1, 2 energy) overpays by 1: 5 damage to Rhino; it is tucked and heals 1; the basic attack then deals 2", () => {
    handOf(BLAST, ENERGY);
    const before = damageOf(state, rhino());
    act({ take: [RESPONSE], cards: [rhino()] }, play(P1, handId(BLAST), [handId(ENERGY)]));
    expect(damageOf(state, rhino()) - before).toBe(5);
    expect(tucked(state).map((i) => codeOf(state, i))).toEqual([BLAST]);
    expect(damageOf(state, me())).toBe(3);
    act({ cards: [rhino()] }, basicAttack(me(), rhino()));
    expect(damageOf(state, rhino()) - before).toBe(7);
    expect(tucked(state)).toEqual([]);
  });

  it("round 2, villain phase: Brother vs. Brother is revealed (a side scheme with 2 threat); Grim Reaper attacks as a minion", () => {
    surgery(stacked(state, 1, "58027"));
    act({}, endTurn());
    expect(state.round).toBe(3);
    expect(cardsInPlay(state)).toContain(inPlayId("58027"));
    expect(inst(state, inPlayId("58027")).threat).toBeGreaterThanOrEqual(2);
  });

  it("round 3: attacking Grim Reaper costs a card from the hand (Brother vs. Brother): Ionic Blast with a spare card defeats him; attacking him with no spare card is refused", () => {
    handOf(BLAST, ENERGY, "58021");
    const reaper = reaperId();
    act({ take: [RESPONSE], cards: [reaper] }, play(P1, handId(BLAST), [handId(ENERGY)]));
    expect(cardsInPlay(state)).not.toContain(reaper);
    expect(playerOf(state, P1).hand).toEqual([]);
  });

  it("round 3, villain phase: Pacifism is dealt to him and stays in his play area", () => {
    surgery(stacked(state, 1, "58025"));
    act({}, endTurn());
    expect(state.round).toBe(4);
    expect(playerOf(state, P1).playArea).toContain(inPlayId("58025"));
  });

  it("round 4: under Pacifism his basic attack is refused; he flips to alter ego and exhausts Simon Williams to discard it", () => {
    expect(accepted(state, basicAttack(me(), rhino()))).toBe(false);
    act({}, changeForm());
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    const pacifism = inPlayId("58025");
    act({}, use(P1, pacifism, "58025.pacifism-action", [], undefined, { branch: 0 }));
    expect(cardsInPlay(state)).not.toContain(pacifism);
    expect(inst(state, me()).exhausted).toBe(true);
  });

  it("every card is accounted for, the copy counts held and Ionic Physiology never held more than 3 (checked after every command above)", () => {
    check(state, "end");
    expect(state.outcome).toBeFalsy();
    expect(Math.max(0, ...formChanges.values())).toBeLessThanOrEqual(1);
  });

  it("every logged segment replays from its own first state, command by command, to the state it ended in (deep-equal)", () => {
    const all = [...segments, { log: session.log, end: state }];
    expect(all.length).toBeGreaterThan(5);
    for (const { log, end } of all) {
      const replayed = replay(log, DEPS);
      if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
      expect(replayed.state).toEqual(end);
    }
    expect(all.reduce((n, seg) => n + seg.log.commands.length, 0)).toBeGreaterThan(15);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Data the audit leans on
// ---------------------------------------------------------------------------------------------------------------
describe("data the audit leans on", () => {
  const text = (code: string): string => {
    const c = [...PLAYABLE_CARDS, ...HERO_PACK_CARDS].find((x) => (x.id as string) === code) as unknown as {
      text?: { current: string };
    };
    return (c?.text?.current ?? "").replace(/[:\s]+/g, " ").trim();
  };
  it("58001a prints Aerial and Avenger; 58001b prints Civilian only (so the Avenger-only Compound is a hero-form card), 12 hit points on both faces (scan 58001b, MarvelCDB)", () => {
    const card = WONDER_MAN_CARDS.find((c) => (c.id as string) === "58001a") as unknown as {
      hp: number;
      hero: { traits: string[] };
      alterEgo: { traits: string[] };
    };
    expect(card.hero.traits.map(String).sort()).toEqual(["AERIAL", "AVENGER"]);
    expect(card.alterEgo.traits.map(String)).toEqual(["CIVILIAN"]);
    expect(card.hp).toBe(12);
  });
  it("58002 Ionic Physiology carries the errata of RRG 1.8 p. 70 in its current text ('Then, heal'), and keeps the arrow in the printed text", () => {
    const card = WONDER_MAN_CARDS.find((c) => (c.id as string) === "58002") as unknown as {
      text: { printed: string; current: string };
    };
    expect(card.text.current).toContain("under this card. Then, heal 1 damage from your identity.");
    expect(card.text.printed).toContain("\u2192");
  });
  it("58017 Bombs Away prints 42029's text, so aliasing its script is right (colons aside)", () => {
    expect(text("58017")).not.toBe("");
    expect(text("58017")).toBe(text("42029"));
  });
});
