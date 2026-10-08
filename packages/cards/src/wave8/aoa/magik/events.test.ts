import { AOA_CARDS, AOA_STARTER_DECKS, CORE_CARDS, cardId } from "@mc/content";
import {
  createGame,
  getInstance,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { MAGIK_EVENTS } from "./events.js";
import { MAGIK_IDENTITY } from "./identity.js";
import { MAGIK_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magik's signature events (45036 to 45040), docs/phase7-wave8.md section 7.1, 3.50, 3.60. Her real starter deck
 * (`magik-aggression`) against Rhino (Core, standard); hand, top of the deck and discard pile arranged by surgery. Printed
 * icons of the cards used as "the top card": Limbo physical, Magik's Crown mental, Mystical Armor energy, Colossus wild,
 * Scrying mental, Stepping Disc energy, Exorcism energy, Soul Strike mental, Magic Barrier physical, Clobber physical.
 * Rhino: SCH 1, ATK 2; the boost cards 01104 / 01100 print 0 / 2 icons.
 */
const SCRYING = "45036";
const DISC = "45037";
const EXORCISM = "45038";
const STRIKE = "45039";
const BARRIER = "45040";
const COLOSSUS = "45031";
const LIMBO = "45032";
const CROWN = "45033";
const ARMOR = "45035";
const CLOBBER = "45046";
const BOOST_0 = "01104";
const BOOST_2 = "01100";
const DEAL = "01098";

const REF = {
  scrying: "45036.scrying-action",
  disc: "45037.stepping-disc-action",
  exorcism: "45038.exorcism-action",
  strike: "45039.soul-strike-action",
  barrier: "45040.magic-barrier-interrupt",
} as const;

const DECK = AOA_STARTER_DECKS.find((d) => d.id === "magik-aggression")!;
const MAGIK_SEAT = {
  identityCardId: DECK.identityCardId,
  aspects: DECK.aspects,
  deck: DECK.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, MAGIK_IDENTITY, MAGIK_EVENTS, MAGIK_SUPPORT_UPGRADES_ALLIES),
};

const codeOf = (s: GameState, id: InstanceId): string => (getInstance(s, id)?.cardId as string | undefined) ?? "?";
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const deckOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).deck);
const discardOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard);
const sorted = (list: readonly string[]): string[] => [...list].sort();
const rhinoOf = (s: GameState): InstanceId => s.activeVillainId!;
const damageOf = (s: GameState): number => inst(s, identityOf(s)).damage;
const threatOf = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => c.id === cardId(code)) as never as Record<string, unknown> & { abilities: { id: string }[] };

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  } as never);
  const created = createGame({ ...config, players: [MAGIK_SEAT] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (): GameState => withForm(setupGame(), { heroForm: 0 });

/** The discard pile is exactly these cards (taken from the deck, hand or discard pile; the first is the bottom). */
function withDiscard(state: GameState, ...wanted: readonly string[]): GameState {
  const owner = playerOf(state, P1);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find(
      (c) => codeOf(state, c) === code && !used.includes(c),
    );
    if (!id) throw new Error(`no ${code}`);
    used.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !used.includes(id));
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: strip(p.deck), discard: used, hand: strip(p.hand) } : p,
    ),
  };
}

interface Cast {
  before: GameState;
  state: GameState;
  events: readonly GameEvent[];
  card: InstanceId;
  paying: readonly InstanceId[];
}

/**
 * Plays `code` from the hand, paying with the first `cost` other cards of the hand, after the top of the deck was set to
 * `top`, answering every choice with `pick`. The hand's other cards never include the stacked ones.
 */
function cast(
  base: GameState,
  code: string,
  cost: number,
  opts: { top?: readonly string[]; pick?: Picker; discard?: readonly string[]; deckSize?: number } = {},
): Cast {
  let s = base;
  if (opts.discard) s = withDiscard(s, ...opts.discard);
  if (opts.top) s = putOnTopOfDeck(s, P1, ...opts.top).state;
  const handed = moveToHand(s, P1, code);
  const size = opts.deckSize;
  const moved = {
    ids: handed.ids,
    state:
      size === undefined
        ? handed.state
        : {
            ...handed.state,
            players: handed.state.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.slice(0, size) } : p)),
          },
  };
  const card = moved.ids[0]!;
  const paying = playerOf(moved.state, P1)
    .hand.filter((id) => id !== card)
    .slice(0, cost);
  const run = driveEventsPicking(DEPS, moved.state, opts.pick ?? firstLegal, play(P1, card, paying));
  return { before: moved.state, state: run.state, events: run.events, card, paying };
}

/** Chooses the given cards (by code) in order, one prompt at a time, when a chooseCards prompt offers them. */
const choosingCodes = (...wanted: readonly string[]): Picker => {
  const left = [...wanted];
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "chooseCards") {
      const code = left[0];
      const hit = choice.options.find((o) => codeOf(s, o.optionId as InstanceId) === code);
      if (hit) {
        left.shift();
        return [hit.optionId];
      }
    }
    return firstLegal(s);
  };
};

describe("registry and data", () => {
  it.each(Object.values(REF))("%s validates", (ref) => {
    expect(validateDefinition(MAGIK_EVENTS[ref]!)).toEqual([]);
  });
  it("registers exactly the five refs the data names on these five cards", () => {
    expect(Object.keys(MAGIK_EVENTS).sort()).toEqual(Object.values(REF).sort());
    const named = [SCRYING, DISC, EXORCISM, STRIKE, BARRIER].flatMap((c) => dataOf(c).abilities.map((a) => a.id));
    expect(named.sort()).toEqual(Object.values(REF).sort());
  });
  it("printed data: cost, icon, traits; current text equals printed", () => {
    const row = (c: string) => {
      const d = dataOf(c) as never as {
        type: string;
        cost: number;
        resourceIcons: Record<string, number>;
        traits: string[];
        text: { printed: string; current: string };
      };
      return [d.type, d.cost, d.resourceIcons, d.traits, d.text.current === d.text.printed];
    };
    expect(row(SCRYING)).toEqual(["event", 0, { mental: 1 }, ["SPELL"], true]);
    expect(row(DISC)).toEqual(["event", 1, { energy: 1 }, ["SUPERPOWER"], true]);
    expect(row(EXORCISM)).toEqual(["event", 2, { energy: 1 }, ["SPELL", "THWART"], true]);
    expect(row(STRIKE)).toEqual(["event", 2, { mental: 1 }, ["ATTACK", "SPELL"], true]);
    expect(row(BARRIER)).toEqual(["event", 1, { physical: 1 }, ["DEFENSE", "SPELL"], true]);
  });
});

describe("Scrying (45036): look at the top 3; draw one, discard one, put one back on top", () => {
  it("draws the chosen card, discards the chosen one of the other two, and the last stays on top", () => {
    const run = cast(heroGame(), SCRYING, 0, { top: [LIMBO, CROWN, ARMOR], pick: choosingCodes(CROWN, ARMOR) });
    expect(handOf(run.state)).toContain(CROWN);
    expect(handOf(run.state)).toHaveLength(handOf(run.before).length); // the event left, one card arrived
    expect(discardOf(run.state)).toEqual(expect.arrayContaining([ARMOR, SCRYING]));
    expect(discardOf(run.state)).toHaveLength(2);
    expect(deckOf(run.state)[0]).toBe(LIMBO);
    expect(deckOf(run.state)).toHaveLength(deckOf(run.before).length - 2);
  });
  it("the third card can be the one drawn: the other two are the discard choice, the unchosen stays on top", () => {
    const run = cast(heroGame(), SCRYING, 0, { top: [LIMBO, CROWN, ARMOR], pick: choosingCodes(ARMOR, LIMBO) });
    expect(handOf(run.state)).toContain(ARMOR);
    expect(discardOf(run.state)).toContain(LIMBO);
    expect(deckOf(run.state)[0]).toBe(CROWN);
  });
  it("costs nothing (cost 0) and is an Action, so it is played in alter-ego form too", () => {
    const ego = withForm(setupGame(), "alterEgo");
    const run = cast(ego, SCRYING, 0, { top: [LIMBO, CROWN, ARMOR] });
    expect(discardOf(run.state)).toContain(SCRYING);
    expect(handOf(run.state)).toContain(LIMBO);
  });
  it("a deck of 2 cards: one drawn, the other discarded, nothing put back", () => {
    const run = cast(heroGame(), SCRYING, 0, { top: [LIMBO, CROWN], deckSize: 2, pick: choosingCodes(LIMBO, CROWN) });
    expect(handOf(run.state)).toContain(LIMBO);
    // The deck ran out while the event was still resolving, so the discarded Crown was reshuffled into a new deck.
    expect(run.events.some((e) => e.type === "playerDeckReset")).toBe(true);
    expect(deckOf(run.state)).toEqual([CROWN]);
    expect(discardOf(run.state)).toEqual([SCRYING]);
  });
  it("a deck of 1 card: it is drawn", () => {
    const run = cast(heroGame(), SCRYING, 0, { top: [LIMBO], deckSize: 1 });
    expect(handOf(run.state)).toContain(LIMBO);
    expect(run.events.some((e) => e.type === "playerDeckReset")).toBe(true);
    expect(deckOf(run.state)).toEqual([SCRYING]);
  });
});

describe("Stepping Disc (45037): ready your hero; a Magik card not named Stepping Disc from the discard pile onto the deck", () => {
  it("readies an exhausted hero and puts the chosen Magik card on top", () => {
    const tired = patchInstance(heroGame(), identityOf(heroGame()), { exhausted: true });
    const run = cast(tired, DISC, 1, { discard: [SCRYING, CROWN], pick: choosingCodes(CROWN) });
    expect(inst(run.before, identityOf(run.before)).exhausted).toBe(true);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(deckOf(run.state)[0]).toBe(CROWN);
    expect(discardOf(run.state)).toContain(SCRYING);
    expect(discardOf(run.state)).not.toContain(CROWN);
  });
  it("a Stepping Disc in the discard pile is not a choice, an Aggression card is not a Magik card", () => {
    const run = cast(heroGame(), DISC, 1, {
      discard: [DISC, CLOBBER, SCRYING],
      pick: (s) => {
        const choose = choosingCodes(SCRYING)(s);
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "chooseCards") {
          const offered = codes(
            s,
            choice.options.map((o) => o.optionId as InstanceId),
          );
          expect(offered).toContain(SCRYING);
          expect(offered).not.toContain(DISC);
          expect(offered).not.toContain(CLOBBER);
        }
        return choose;
      },
    });
    expect(deckOf(run.state)[0]).toBe(SCRYING);
  });
  it("with no eligible card the hero still readies and nothing moves", () => {
    const tired = patchInstance(heroGame(), identityOf(heroGame()), { exhausted: true });
    const run = cast(tired, DISC, 1, { discard: [DISC, CLOBBER] });
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(deckOf(run.state)[0]).not.toBe(CLOBBER);
    expect(sorted(discardOf(run.state))).toEqual(sorted([DISC, CLOBBER, DISC]));
  });
});

describe("Exorcism (45038): remove 4 threat; confuse the villain if the top card has mental or wild", () => {
  const base = (): GameState => patchInstance(heroGame(), heroGame().mainScheme.instanceId, { threat: 8 });
  const confused = (s: GameState): number => inst(s, rhinoOf(s)).statuses.confused ?? 0;

  it("mental on top (Magik's Crown): 4 threat removed and Rhino confused", () => {
    const run = cast(base(), EXORCISM, 2, { top: [CROWN] });
    expect(threatOf(run.before)).toBe(8);
    expect(threatOf(run.state)).toBe(4);
    expect(confused(run.state)).toBeGreaterThan(0);
    expect(discardOf(run.state)).toContain(EXORCISM);
  });
  it("wild on top (Colossus): confused too", () => {
    const run = cast(base(), EXORCISM, 2, { top: [COLOSSUS] });
    expect(confused(run.state)).toBeGreaterThan(0);
  });
  it("physical on top (Limbo): the threat comes off, Rhino is not confused", () => {
    const run = cast(base(), EXORCISM, 2, { top: [LIMBO] });
    expect(threatOf(run.state)).toBe(4);
    expect(confused(run.state)).toBe(0);
  });
  it("the top card is read after the threat is removed: nothing moves the deck, so the card stays", () => {
    const run = cast(base(), EXORCISM, 2, { top: [CROWN] });
    expect(deckOf(run.state)[0]).toBe(CROWN);
  });
});

describe("Soul Strike (45039): 4 damage to an enemy; stun it if the top card has physical or wild", () => {
  const stunned = (s: GameState): number => inst(s, rhinoOf(s)).statuses.stunned ?? 0;

  it("physical on top (Clobber): 4 damage and Rhino stunned", () => {
    const run = cast(heroGame(), STRIKE, 2, { top: [CLOBBER] });
    expect(inst(run.state, rhinoOf(run.state)).damage).toBe(4);
    expect(stunned(run.state)).toBeGreaterThan(0);
    expect(discardOf(run.state)).toContain(STRIKE);
  });
  it("wild on top (Colossus): stunned", () => {
    const run = cast(heroGame(), STRIKE, 2, { top: [COLOSSUS] });
    expect(stunned(run.state)).toBeGreaterThan(0);
  });
  it("mental on top (Scrying): damage only, no stun", () => {
    const run = cast(heroGame(), STRIKE, 2, { top: [SCRYING] });
    expect(inst(run.state, rhinoOf(run.state)).damage).toBe(4);
    expect(stunned(run.state)).toBe(0);
  });
  it("Q48 = A: the label makes it one attack by Magik on the enemy, and its 4 damage is attack damage", () => {
    const run = cast(heroGame(), STRIKE, 2, { top: [SCRYING] });
    const attacks = run.events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
    );
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ attackerInstanceId: identityOf(run.state), labeled: true });
    expect(attacks[0]!.attacked).toEqual([rhinoOf(run.state)]);
    expect(attacks[0]!.results?.damage).toBe(4);
    const dealt = run.events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" ? [e.event] : [],
    );
    expect(dealt.map((d) => d.fromAttack)).toEqual([true]);
  });
});

describe("Magic Barrier (45040): prevent 3 damage from the attack; 3 damage to the attacker if energy or wild is on top", () => {
  /** Barrier in hand with one payer; the villain phase with Rhino's attack (ATK 2 + the boost) undefended. */
  function defend(top: string, boost: string, take = true) {
    const base = heroGame();
    const stackedTop = putOnTopOfDeck(base, P1, top).state;
    const { state, ids } = moveToHand(stackedTop, P1, BARRIER);
    const owner = playerOf(state, P1);
    // A full hand of 5 (so ending the turn draws nothing and the stacked top card stays), the event among them.
    const hand = [ids[0]!, ...owner.hand.filter((i) => i !== ids[0]).slice(0, 4)];
    const arranged = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand, deck: [...p.hand.filter((i) => !hand.includes(i)), ...p.deck] } : p,
      ),
    };
    // The stacked top card must still be on top after the hand cards were put back on the deck.
    const topId = putOnTopOfDeck(arranged, P1, top);
    const stacked = stackEncounterDeck(topId.state, boost, DEAL);
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") {
        const own = choice.options.find((o) => o.optionId.endsWith(REF.barrier));
        return take && own ? [own.optionId] : [];
      }
      if (choice.prompt.kind === "declareDefender") return ["decline"];
      if (choice.prompt.kind === "payForCard") return choice.options.slice(0, 1).map((o) => o.optionId);
      return firstLegal(s);
    };
    const run = driveEventsPicking(DEPS, stacked, pick, endTurn(P1));
    return { before: stacked, state: run.state, events: run.events, card: ids[0]! };
  }

  it("control: undefended, an attack of 4 (ATK 2 + 2 icons) deals 4 and Rhino takes nothing", () => {
    const run = defend(CLOBBER, BOOST_2, false);
    expect(damageOf(run.state)).toBe(4);
    expect(inst(run.state, rhinoOf(run.state)).damage).toBe(0);
  });
  it("energy on top (Mystical Armor): 3 of the 4 prevented (1 taken), Rhino takes 3 damage, the event is discarded", () => {
    const run = defend(ARMOR, BOOST_2);
    expect(damageOf(run.state)).toBe(1);
    expect(inst(run.state, rhinoOf(run.state)).damage).toBe(3);
    expect(discardOf(run.state)).toContain(BARRIER);
  });
  it("wild on top (Colossus): Rhino takes 3 as well", () => {
    const run = defend(COLOSSUS, BOOST_2);
    expect(inst(run.state, rhinoOf(run.state)).damage).toBe(3);
    expect(damageOf(run.state)).toBe(1);
  });
  it("physical on top: damage prevented, Rhino takes none", () => {
    const run = defend(CLOBBER, BOOST_2);
    expect(damageOf(run.state)).toBe(1);
    expect(inst(run.state, rhinoOf(run.state)).damage).toBe(0);
  });
  it("an attack of 2 (no boost icons): all of it is prevented, the prevention is capped at the damage", () => {
    const run = defend(ARMOR, BOOST_0);
    expect(damageOf(run.state)).toBe(0);
    expect(inst(run.state, rhinoOf(run.state)).damage).toBe(3);
  });
});
