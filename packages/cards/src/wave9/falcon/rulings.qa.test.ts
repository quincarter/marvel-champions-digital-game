/**
 * Rules QA for the Falcon pack `falcon` (53001a/b to 53037, scripted modules only; the `techno` module is not scripted): the
 * interactions the module tests do not assert, each tied to an RRG 1.8 section (`mc_rulesreference_v18_compressed.pdf`), an FFG
 * ruling by its date heading (marvel-champions-rulings-post-rrg-1-7.md) or an owner answer (docs/phase7-wave9.md section 4.1). A
 * `FINDING` comment marks a case where the game and its source disagree: the expected behavior is an `it.fails`, with a passing
 * companion that pins today's behavior. Findings are tabled in docs/phase7-wave9-qa.md.
 */
import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  cardsInPlay,
  createGame,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
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
  type Picker,
} from "../../testing/harness.js";
import { coreScenario } from "../../core/setup.js";
import { WAVE9_CARDS } from "../cards.js";
import { driveEventsPicking, encounterCardInVillainArea, stackSetAside, withForm } from "../../testing/staging.js";
import { FALCON_DEPS, engageMinion, falconGame, falconHeroGame, falconSeat, stagedInPlay } from "./testing.js";

vi.setConfig({ testTimeout: 180_000 });

const BIRD = "53003";
const VIEW = "53004";
const AWAY = "53005";
const REDWING = "53002";
const FLOCK = "53006";
const EVAC = "53008";
const RECON = "53009";
const FIRE = "53011";
const WEAVE = "53013";
const ENERGY = "53025";
const PROTECTOR = "53029";
const SOLUTIONS = "53031";
const SOLDIER = "53032";
const REDWING_ACTION = "53002.redwing-action";
const EVAC_INTERRUPT = "53008.aerial-evacuation-interrupt";
const RECON_INTERRUPT = "53009.aerial-recon-interrupt";
const FIRE_RESPONSE = "53011.draw-their-fire-response";
const WEAVE_INTERRUPT = "53013.vibranium-microweave-interrupt";
const AWAY_RESPONSE = "53005.up-up-and-away-response";
const EAGLE = "53001a.eagle-eyed";
const ZERO = "01098"; // Armored Rhino Suit: no boost icons
const ONE = "01101"; // Hydra Mercenary: 1 boost icon
const TWO = "01099"; // Charge: 2 boost icons
const THREE = "01118"; // Sonic Converter: 3 boost icons
const SHOCKER = "01103"; // Rhino set minion, 3 hit points
const FILLER = "01186"; // Advance: no boost icons

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const deckOf = (s: GameState) => activeEncounterDeck(s).deck;
const discardOf = (s: GameState) => activeEncounterDeck(s).discard;
const damage = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const inPlay = (s: GameState, id: InstanceId): boolean => cardsInPlay(s).includes(id);
const formOf = (s: GameState, player = P1) => playerOf(s, player).identity.form;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: n } });
const withThreat = (s: GameState, n: number): GameState => patchInstance(s, s.mainScheme.instanceId, { threat: n });
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;

/** The encounter deck's top cards turned (by surgery) into these cards, top first. */
function withTop(s: GameState, ...codes: readonly string[]): GameState {
  const deck = deckOf(s);
  return codes.reduce((acc, code, n) => relabel(acc, deck[n]!, code), s);
}

interface Plan {
  /** The option id (a target prompt) to answer with, when offered. */
  readonly target?: InstanceId;
  /** Answer the Bird of Prey / Bird's-Eye View "you may discard" prompt (default: discard). */
  readonly discard?: boolean;
  /** Ability-id suffixes to take when a trigger is offered; everything else is declined. */
  readonly take?: readonly string[];
  /** Who defends when offered (default: nobody). */
  readonly defend?: InstanceId;
  /** Records every trigger id offered. */
  readonly offered?: string[];
  /** Records every prompt kind asked. */
  readonly kinds?: string[];
  /** Hand cards that must not be discarded down to hand size. */
  readonly keep?: readonly InstanceId[];
}

/** A picker following `plan`; everything not named is `firstLegal`. */
function planned(plan: Plan = {}): Picker {
  return (s) => {
    const c = s.pendingChoice!;
    plan.kinds?.push(c.prompt.kind);
    const ids = c.options.map((o) => o.optionId as string);
    switch (c.prompt.kind) {
      case "chooseTriggers": {
        plan.offered?.push(...ids);
        const hit = ids.find((id) => plan.take?.some((t) => id.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "chooseTarget":
        return [plan.target !== undefined && ids.includes(plan.target) ? plan.target : ids[0]!];
      case "chooseOption":
        return [plan.discard === false ? ids[1]! : ids[0]!];
      case "declareDefender":
        return plan.defend !== undefined && ids.includes(plan.defend) ? [plan.defend] : ["decline"];
      case "discardDownToHandSize":
        return c.options
          .filter((o) => !(plan.keep ?? []).includes(o.optionId as InstanceId))
          .slice(0, c.minSelections)
          .map((o) => o.optionId);
      default:
        return firstLegal(s);
    }
  };
}

const run = (s: GameState, plan: Plan, ...commands: readonly Command[]) =>
  driveEventsPicking(FALCON_DEPS, s, planned(plan), ...commands);

/** Plays `code` (with Energy to pay for it) from `state`. */
function cast(state: GameState, code: string, plan: Plan = {}) {
  const given = moveToHand(state, P1, code, ENERGY);
  const [event, pay] = given.ids as [InstanceId, InstanceId];
  return { ...run(given.state, plan, play(P1, event, [pay])), event };
}

// ---------------------------------------------------------------------------------------------------------------------
// A stunned or confused Falcon and the labeled events
// ---------------------------------------------------------------------------------------------------------------------

describe("Bird of Prey and Bird's-Eye View with a status card on Falcon (RRG 1.8 'Labeled Ability' p. 26, 'Stun' p. 41, 'Confuse' p. 13)", () => {
  // Labeled Ability: a status card that cancels the labeled type cancels "the entire ability (except for its costs)", and the
  // status card is removed. Ruling August 13, 2026 - Ruling 1 (1): the card was still "played".

  it("a stunned Falcon plays Bird of Prey (attack): the event is spent and Eagle-Eyed is offered, but no damage is dealt, the top card is NOT discarded and the stun is removed", () => {
    const base = withTop(falconHeroGame(), THREE, ZERO);
    const stunned = withStatus(base, identityOf(base), "stunned");
    const top = deckOf(stunned)[0]!;
    const offered: string[] = [];
    const r = cast(stunned, BIRD, { offered });
    expect(playerOf(r.state, P1).discard).toContain(r.event);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
    // The discard is part of the canceled effect, not a cost.
    expect(deckOf(r.state)[0]).toBe(top);
    expect(offered.some((id) => id.endsWith(EAGLE))).toBe(true);
  });

  it("a confused Falcon plays Bird of Prey: confuse cancels only a thwart, so 4 + 3 damage and the confused card stays", () => {
    const base = withTop(falconHeroGame(), THREE, ZERO);
    const confused = withStatus(base, identityOf(base), "confused");
    const r = cast(confused, BIRD);
    expect(damage(r.state, villainOf(r.state))).toBe(7);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(1);
  });

  it("a confused Falcon plays Bird's-Eye View (thwart): no threat is removed, the top card stays and the confused card is removed", () => {
    const base = withThreat(withTop(falconHeroGame(), THREE, ZERO), 10);
    const confused = withStatus(base, identityOf(base), "confused");
    const top = deckOf(confused)[0]!;
    const r = cast(confused, VIEW);
    expect(threatOf(r.state, r.state.mainScheme.instanceId)).toBe(10);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(0);
    expect(deckOf(r.state)[0]).toBe(top);
    expect(playerOf(r.state, P1).discard).toContain(r.event);
  });

  it("a stunned Falcon plays Bird's-Eye View: stun cancels only an attack, so 3 + 3 threat is removed and the stunned card stays", () => {
    const base = withThreat(withTop(falconHeroGame(), THREE, ZERO), 10);
    const stunned = withStatus(base, identityOf(base), "stunned");
    const r = cast(stunned, VIEW);
    expect(threatOf(r.state, r.state.mainScheme.instanceId)).toBe(4);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(1);
  });

  it("Redwing's action is neither an attack nor a thwart (Redwing FAQ, RRG p. 65): a stunned and confused Falcon uses it in full and both cards stay", () => {
    const staged = stagedInPlay(withTop(falconHeroGame(), TWO, ZERO), REDWING);
    const marked = withStatus(
      withStatus(staged.state, identityOf(staged.state), "stunned"),
      identityOf(staged.state),
      "confused",
    );
    const r = run(
      marked,
      {},
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: staged.id,
        abilityId: REDWING_ACTION as never,
        payment: [],
      },
    );
    expect(damage(r.state, villainOf(r.state))).toBe(2);
    expect(inst(r.state, identityOf(r.state)).statuses).toMatchObject({ stunned: 1, confused: 1 });
    expect(playerOf(r.state, P1).hand).toContain(staged.id);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Tough
// ---------------------------------------------------------------------------------------------------------------------

describe("the discard and a tough status card (RRG 1.8 'Tough' p. 44)", () => {
  // Tough: "prevent all of that damage and discard a tough status card"; the character "is not considered to have taken damage".
  const shocker = "shock" as InstanceId;
  const toughTable = (top: readonly string[]) =>
    withStatus(engageMinion(withTop(falconHeroGame(), ...top), SHOCKER, "shock"), shocker, "tough");

  it("Bird of Prey at a tough minion: the top card is discarded (the +X is read) but all the damage is prevented and the tough card is spent", () => {
    const s = toughTable([THREE, ZERO]);
    const top = deckOf(s)[0]!;
    const r = cast(s, BIRD, { target: shocker });
    expect(discardOf(r.state)).toContain(top);
    expect(damage(r.state, shocker)).toBe(0);
    expect(inst(r.state, shocker).statuses.tough).toBe(0);
    expect(inPlay(r.state, shocker)).toBe(true);
    expect(damage(r.state, villainOf(r.state))).toBe(0);
  });

  it("Redwing's X damage at a tough minion is damage too: prevented in full, the tough card spent, Redwing back in hand", () => {
    const staged = stagedInPlay(toughTable([TWO, ZERO]), REDWING);
    const r = run(
      staged.state,
      { target: shocker },
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: staged.id,
        abilityId: REDWING_ACTION as never,
        payment: [],
      },
    );
    expect(damage(r.state, shocker)).toBe(0);
    expect(inst(r.state, shocker).statuses.tough).toBe(0);
    expect(playerOf(r.state, P1).hand).toContain(staged.id);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Aerial Evacuation
// ---------------------------------------------------------------------------------------------------------------------

describe("Aerial Evacuation 53008 and Overkill (ruling March 6, 2026 - Ruling 1 (2); RRG 1.8 'Overkill' p. 31)", () => {
  // Ruling: "Sam Wilson does not take excess Overkill damage ... Aerial Evacuation is treated the same way" as an ally's Tough.
  // Rhino with Charge attached has +3 ATK and the attack gains overkill (RRG: "If excess damage from an attack with overkill is
  // prevented, that damage is not dealt").
  function chargedRhino(withEvac: boolean) {
    let s = falconHeroGame();
    const red = stagedInPlay(s, REDWING);
    s = red.state;
    if (withEvac) s = stagedInPlay(s, EVAC, { attach: true }).state;
    // Charge: surgery attaches it to Rhino (the printed +3 ATK applies while attached).
    const charge = deckOf(s).find((i) => codeOf(s, i) === TWO)!;
    const v = villainOf(s);
    const pile = activeEncounterDeck(s);
    s = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [Object.keys(s.encounterDecks).find((k) => s.encounterDecks[k]!.deck.includes(charge))!]: {
          deck: pile.deck.filter((i) => i !== charge),
          discard: pile.discard,
        },
      },
    };
    s = patchInstance(s, charge, { faceup: true, attachedTo: v });
    s = patchInstance(s, v, { attachments: [...inst(s, v).attachments, charge] });
    return { state: withTop(s, ZERO, ZERO, ZERO, ZERO), redwing: red.id };
  }

  it("control, no Aerial Evacuation: Redwing (2 hit points) defends Rhino's ATK 5 overkill attack, is defeated, and the 3 excess damage is dealt to Falcon", () => {
    const { state, redwing } = chargedRhino(false);
    const r = run(state, { defend: redwing }, endTurn());
    expect(inPlay(r.state, redwing)).toBe(false);
    expect(damage(r.state, identityOf(r.state))).toBe(3);
  });

  it("with Aerial Evacuation: all the damage to Redwing is prevented, so he is not defeated and no overkill excess reaches Falcon (who changes to alter-ego form)", () => {
    const { state, redwing } = chargedRhino(true);
    const r = run(state, { defend: redwing, take: [EVAC_INTERRUPT] }, endTurn());
    expect(inPlay(r.state, redwing)).toBe(true);
    expect(damage(r.state, redwing)).toBe(0);
    expect(damage(r.state, identityOf(r.state))).toBe(0);
    expect(formOf(r.state)).toBe("alterEgo");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Vibranium Microweave
// ---------------------------------------------------------------------------------------------------------------------

describe("Vibranium Microweave 53013 with exactly 1 damage (RRG 1.8 'Prevent' / 'Interrupt'; ruling July 9, 2026 - Ruling 2)", () => {
  it("prevents the only damage point of an undefended attack and still deals its 1 damage to an enemy: Falcon takes 0, the chosen minion takes 1", () => {
    // Rhino is stunned (his stun card is spent on his activation), so the only attack is Hydra Mercenary's 1 damage.
    const base = engageMinion(withTop(falconHeroGame(), ZERO, ZERO, ZERO, ZERO), ONE, "merc");
    const stunned = withStatus(base, villainOf(base), "stunned");
    const staged = stagedInPlay(stunned, WEAVE, { attach: true });
    const merc = "merc" as InstanceId;
    const r = run(staged.state, { take: [WEAVE_INTERRUPT], target: merc }, endTurn());
    expect(damage(r.state, identityOf(r.state))).toBe(0);
    expect(damage(r.state, merc)).toBe(1);
    expect(inst(r.state, staged.id).exhausted).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Two-player cases
// ---------------------------------------------------------------------------------------------------------------------

describe("Draw Their Fire 53011 changes Falcon only (card text 'Falcon does not exhaust to defend'; RRG 1.8 'Defend' p. 15)", () => {
  it("another player's hero attacked in the same villain phase still exhausts to defend", () => {
    const base = withForm(falconHeroGame({ twoPlayers: true }), { heroForm: 0 }, P2);
    const staged = stagedInPlay(withTop(engageMinion(base, ONE, "m2", P2), ZERO, ZERO, ZERO, ZERO), FIRE, {
      attach: true,
    });
    const p2hero = identityOf(staged.state, P2);
    const r = run(staged.state, { take: [FIRE_RESPONSE], defend: p2hero }, endTurn(P1), endTurn(P2));
    expect(ofType(r.events, "defenderDeclared").filter((e) => e.defenderInstanceId === p2hero)).toHaveLength(1);
    expect(
      ofType(r.events, "defenderDeclared").every(
        (e) => e.withoutExhausting !== true || e.defenderInstanceId !== p2hero,
      ),
    ).toBe(true);
    expect(ofType(r.events, "cardExhausted").some((e) => e.instanceId === p2hero)).toBe(true);
  });
});

describe("Eagle-Eyed 53001a answers its own player's plays only ('After you play an Aerial card')", () => {
  it("the other player playing an Aerial card does not offer it to Falcon's player and discards nothing", () => {
    const base = withForm(falconHeroGame({ twoPlayers: true }), { heroForm: 0 }, P2);
    // Spider-Man's player holds a Redwing (turned from a hand card by surgery) and pays for it with two other cards.
    const hand = playerOf(base, P2).hand;
    const red = hand[0]!;
    const s = withTop(relabel(base, red, REDWING), THREE, ZERO);
    const top = deckOf(s)[0]!;
    const offered: string[] = [];
    const r = run(s, { offered }, endTurn(P1), play(P2, red, payWith(s, P2, 2, [red])));
    expect(inPlay(r.state, red)).toBe(true);
    expect(offered.some((id) => id.endsWith(EAGLE))).toBe(false);
    expect(deckOf(r.state)[0]).toBe(top);
  });
});

describe("Harlem's Protector 53029 goes to the Sam Wilson player, not the first player (card text 'Give to the Sam Wilson player')", () => {
  it("Falcon is the second seat: the obligation, dealt to the first player, is revealed into P2's play area with its 3 emergency counters", () => {
    const s = swappedSeats();
    expect(identityName(s, P2)).toBe("53001");
    const staged = stackEncounterDeck(s, FILLER, "01187", PROTECTOR, "01188");
    // The villain activates once against each of the two players, so two boost cards come off first.
    const protector = deckOf(staged)[2]!;
    const r = run(staged, {}, endTurn(P1), endTurn(P2));
    expect(playerOf(r.state, P2).playArea).toContain(protector);
    expect(playerOf(r.state, P1).playArea).not.toContain(protector);
    expect(inst(r.state, protector).counters.emergency).toBe(3);
  });
});

/** Falcon's precon as P2 and Core's Spider-Man as P1 (the first player). */
function swappedSeats(): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const spider = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: [],
  }).players[0]!;
  const created = createGame({ ...base, requireLegalDecks: false, players: [spider, falconSeat()] }, FALCON_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (st) => st.step.phase === "player", FALCON_DEPS);
}
const identityName = (s: GameState, player: typeof P1): string =>
  (s.instances[identityOf(s, player)]!.cardId as string).replace(/[ab]$/, "");

// ---------------------------------------------------------------------------------------------------------------------
// Serpent Solutions and the first player; Aerial Recon
// ---------------------------------------------------------------------------------------------------------------------

describe("Serpent Solutions 53031 deals to the first player ('deal that minion to the first player'; RRG 1.8 'Deal' p. 15)", () => {
  /** Falcon (P1) in hero form, Solutions in play, a Serpent Soldier on top of the deck; `first` is the first player. */
  function table(first: typeof P1) {
    const base = withForm(falconHeroGame({ twoPlayers: true }), { heroForm: 0 });
    const aside = encounterCardInVillainArea(stackSetAside(base, SOLUTIONS), SOLUTIONS, 6);
    const placed = stackSetAside(aside.state, SOLDIER);
    const soldier = deckOf(placed)[0]!;
    return { state: { ...placed, firstPlayerId: first }, soldier };
  }
  const playFlock = (s: GameState, plan: Plan) => {
    const given = moveToHand(s, P1, FLOCK);
    return run(given.state, plan, play(P1, given.ids[0]!, payWith(given.state, P1, 2, [given.ids[0]!])));
  };

  it("Eagle-Eyed discards a Serpent Soldier while P2 is the first player: it is dealt facedown to P2, not P1", () => {
    const { state, soldier } = table(P2);
    expect(codeOf(state, deckOf(state)[0]!)).toBe(SOLDIER);
    const r = playFlock(state, { take: [EAGLE] });
    expect(playerOf(r.state, P2).dealtEncounter).toEqual([soldier]);
    expect(playerOf(r.state, P1).dealtEncounter).toEqual([]);
    expect(inst(r.state, soldier).faceup).toBe(false);
  });

  // FINDING 1: docs/phase7-wave9.md section 3.45 says Aerial Recon "hears every deal to any player ... a card's 'deal ... as a
  // facedown encounter card' (Serpent Solutions, The Raft)" and lists "Serpent Solutions' deal of a discarded minion replaced:
  // the minion stays in the encounter discard pile" as a test. The engine does not announce a named-card deal (the comment on
  // `TriggerEvent encounterCardBeingDealt`, trigger-events.ts: "Not announced: ... a named card dealt to a player"), so the
  // interrupt is never offered. Needs the engine (a would-be-dealt window in `dealAsEncounterCards`); the script is right.
  it.fails("Aerial Recon 53009 hears that deal ('When a player would be dealt an encounter card'; spec 3.45): taken, the Soldier stays in the discard pile, nothing is dealt and the counter is spent", () => {
    const { state, soldier } = table(P1);
    const withRecon = stagedInPlay(state, RECON, { attach: true, counters: { recon: 1 } });
    const offered: string[] = [];
    const r = playFlock(withRecon.state, { take: [EAGLE, RECON_INTERRUPT], offered });
    expect(offered.some((id) => id.endsWith(RECON_INTERRUPT))).toBe(true);
    expect(playerOf(r.state, P1).dealtEncounter).toEqual([]);
    expect(discardOf(r.state)).toContain(soldier);
    expect(inst(r.state, withRecon.id).counters.recon ?? 0).toBe(0);
  });

  it("today: Aerial Recon is not offered for that deal, the Soldier is dealt facedown to the first player and the recon counter stays", () => {
    const { state, soldier } = table(P1);
    const withRecon = stagedInPlay(state, RECON, { attach: true, counters: { recon: 1 } });
    const offered: string[] = [];
    const r = playFlock(withRecon.state, { take: [EAGLE, RECON_INTERRUPT], offered });
    expect(offered.some((id) => id.endsWith(RECON_INTERRUPT))).toBe(false);
    expect(playerOf(r.state, P1).dealtEncounter).toEqual([soldier]);
    expect(inst(r.state, withRecon.id).counters.recon).toBe(1);
  });
});

describe("Up, Up, and Away 53005 on an attack against another player (RRG 1.8 'Labeled Ability' p. 26)", () => {
  // "When such an ability [labeled (defense)] is initiated during an attack, the player's identity becomes the defender of that
  // attack." The card names no target of the attack: "After an attacking enemy is given a facedown boost card".
  function table() {
    const base = withForm(falconHeroGame({ twoPlayers: true }), { heroForm: 0 }, P2);
    const staged = engageMinion(withTop(base, ZERO, ZERO, ZERO, ZERO, ZERO, ZERO), ONE, "m2", P2);
    const given = moveToHand(staged, P1, AWAY);
    return { state: given.state, away: given.ids[0]! };
  }
  /** Drives the villain phase, taking Up, Up, and Away on the second offer (Rhino's attack on P2); records each declare-defender prompt. */
  function villain(s: GameState, away: InstanceId, takeAt = 1) {
    let offers = 0;
    const defenders: { player: string; options: string[] }[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice!;
      const ids = c.options.map((o) => o.optionId as string);
      if (c.prompt.kind === "chooseTriggers") {
        const mine = ids.find((id) => id.endsWith(AWAY_RESPONSE));
        return mine && offers++ === takeAt ? [mine] : [];
      }
      if (c.prompt.kind === "declareDefender") {
        defenders.push({ player: c.playerId as string, options: ids });
        return ["decline"];
      }
      if (c.prompt.kind === "discardDownToHandSize")
        return c.options
          .filter((o) => o.optionId !== away)
          .slice(0, c.minSelections)
          .map((o) => o.optionId);
      return firstLegal(st);
    };
    return { ...driveEventsPicking(FALCON_DEPS, s, pick, endTurn(P1), endTurn(P2)), offers: () => offers, defenders };
  }

  const targets = (r: ReturnType<typeof villain>, s: GameState) =>
    ofType(r.events, "attackResolved")
      .filter((e) => e.enemyInstanceId === villainOf(s))
      .map((e) => e.targetInstanceId);

  it("control, declined both times: Rhino's two attacks land on Falcon and on P2", () => {
    const { state, away } = table();
    const r = villain(state, away, -1);
    expect(targets(r, state)).toEqual([identityOf(state, P1), identityOf(state, P2)]);
  });

  it("it is offered for Rhino's attack on P2 as well (the card names no target), and taking it makes Falcon the defender of that attack: the hit lands on Falcon", () => {
    const { state, away } = table();
    const r = villain(state, away);
    expect(r.offers()).toBe(2);
    expect(targets(r, state)).toEqual([identityOf(state, P1), identityOf(state, P1)]);
  });
});

describe("Viper 53030 with a short encounter deck (RRG 1.8 'Encounter Deck' p. 17)", () => {
  // "If a card ability discards a specified number of cards from the encounter deck ... If the encounter deck is emptied this way,
  // that card ability is considered to be fulfilled. Do not continue the discard effect with the newly shuffled encounter deck."
  it("a deck of three when the forced response resolves: only those three of the five are discarded, the deck is reset, and the other two are not taken from the new deck", () => {
    const base = withForm(falconGame(), { heroForm: 0 });
    const viperId = base.players[0]!.setAside.find((i) => codeOf(base, i) === "53030")!;
    const engaged: GameState = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((i) => i !== viperId),
        playArea: [...p.playArea, viperId],
      })),
      instances: {
        ...base.instances,
        [viperId]: { ...base.instances[viperId]!, faceup: true, controllerId: null, engagedWith: P1 },
      },
    };
    const id = activeEncounterDeckKey(engaged);
    const pile = engaged.encounterDecks[id]!;
    // Four cards remain before the villain phase; three are left when Viper's forced response resolves (Rhino's boost card is one).
    const shortDeck = pile.deck.slice(0, 4);
    const rest = [...pile.deck.slice(4), ...pile.discard];
    const s: GameState = {
      ...engaged,
      encounterDecks: { ...engaged.encounterDecks, [id]: { deck: shortDeck, discard: rest } },
    };
    const r = run(s, {}, endTurn(P1));
    const viperHit = r.events.findIndex((e) => e.type === "attackResolved" && e.enemyInstanceId === viperId);
    expect(viperHit).toBeGreaterThan(-1);
    const after = r.events.slice(viperHit);
    const response = after.slice(
      0,
      after.findIndex((e) => e.type === "stepChanged"),
    );
    const moves = response.flatMap((e, n) => (e.type === "cardMoved" && e.to.kind === "encounterDiscard" ? [n] : []));
    const shuffled = response.findIndex((e) => e.type === "deckShuffled");
    // Viper asked for five; the deck held three, so three are discarded, the deck is reset (one acceleration token) and it stops.
    expect(moves).toHaveLength(3);
    expect(shuffled).toBeGreaterThan(moves[2]!);
    expect(response.filter((e) => e.type === "accelerationTokenAdded")).toHaveLength(1);
    expect(response.slice(shuffled).some((e) => e.type === "cardMoved" && e.to.kind === "encounterDiscard")).toBe(
      false,
    );
  });
});
const activeEncounterDeckKey = (s: GameState): string => Object.keys(s.encounterDecks)[0]!;
