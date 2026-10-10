import {
  activeVillain,
  applyCommand,
  createGame,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { BLACK_TOM_CASSIDY } from "./black-tom-cassidy.js";

vi.setConfig({ testTimeout: 120_000 });

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const ONE = [SPIDER_MAN] as const;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

const TOM = "40132";
const WILLOW = "40133";
const MAKING_GREEN = "40134";
const THRASHING = "40135";
const FILLER = "40124"; // Building Momentum: a side scheme that only sits in the villain area

/** Juggernaut with Black Tom Cassidy as the modular set, past setup. */
function game(players: Seats = ONE): GameState {
  const config = wave7Scenario("juggernaut", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: ["black_tom_cassidy"],
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

const cardOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const mainOf = (s: GameState) => s.mainScheme.instanceId;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const inPlayOf = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).playArea.find((id) => cardOf(s, id) === code);
/** No threat on the main scheme, so the villain phase's acceleration completes nothing (it would reshuffle the stacked deck). */
const calm = (s: GameState): GameState => patchInstance(s, mainOf(s), { threat: 0 });
/** Surgery: `code` engaged with `player`, and (when asked) a state of its own. */
const engaged = (s: GameState, code: string, player: PlayerId = P1) => engageMinion(s, code, player);
const withStatus = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough", n = 1) =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: n } });

interface Plan {
  /** Label (start) of the option to pick at a card or target prompt; the first offered otherwise. */
  readonly pick?: readonly string[];
  /** Characters that defend, one per prompt (each only if offered); nobody otherwise. */
  readonly defenders?: readonly InstanceId[];
}
interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
function drive(state: GameState, plan: Plan, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const picks = [...(plan.pick ?? [])];
  const defenders = [...(plan.defenders ?? [])];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, labels: choice.options.map((o) => o.label) });
    switch (choice.prompt.kind) {
      case "declareDefender": {
        const next = defenders.shift();
        return [next && choice.options.some((o) => o.optionId === next) ? next : "decline"];
      }
      case "chooseTriggers":
        return [];
      default: {
        const hit = picks[0] ? choice.options.find((o) => o.label.startsWith(picks[0]!)) : undefined;
        if (hit) {
          picks.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
  const { state: after, events: log } = driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);
  return { state: after, events: log, prompts };
}
/** Hero form, every player ends their turn. `stack` is the top of the encounter deck: the villain's boost card(s), then the deals. */
function round(state: GameState, stack: readonly string[], plan: Plan = {}, form: "hero" | "alterEgo" = "hero"): Run {
  const stacked = stackEncounterDeck(state, ...stack);
  const formed = state.players.reduce(
    (s, p) => withForm(s, form === "alterEgo" ? "alterEgo" : { heroForm: 0 }, p.playerId),
    stacked,
  );
  return drive(formed, plan, ...state.players.map((p) => endTurn(p.playerId)));
}
/** A blank boost card for each of the villain's activations, then `deals`. */
const BLANK = ["01186", "01187"] as const;

const attacksBy = (run: Run, id: InstanceId) =>
  events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === id);
const ids = (s: GameState, code: string) =>
  Object.keys(s.instances).filter((i) => cardOf(s, i as InstanceId) === code) as InstanceId[];

const sinisterLike = (s: GameState, run: Run) => attacksBy(run, villainId(s))[0];
const villainId = (s: GameState) => activeVillain(s).instanceId;
const revealedIds = (run: Run) => events(run.events, "encounterCardRevealed").map((e) => e.cardId as string);
const revealedId = (run: Run, code: string): InstanceId =>
  events(run.events, "encounterCardRevealed").find((e) => e.cardId === code)!.instanceId;
const stunnedOf = (s: GameState, id: InstanceId) => inst(s, id).statuses.stunned;
const hopeOf = (s: GameState, p: PlayerId = P1) => inPlayOf(s, p, "40130")!;
/** How many copies of `code` are in play, and engaged with whom. */
const inPlayCopies = (s: GameState, code: string) =>
  Object.keys(s.instances).filter(
    (i) => cardOf(s, i as InstanceId) === code && s.players.some((p) => p.playArea.includes(i as InstanceId)),
  ) as InstanceId[];
const attackBy = (s: GameState, player: PlayerId, target: InstanceId): Parameters<typeof driveEventsPicking>[3] => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: identityOf(s, player),
  targetInstanceId: target,
});

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(BLACK_TOM_CASSIDY).sort()).toEqual(
      [
        "40132.black-tom-cassidy-constant",
        "40132.when-revealed",
        "40133.creeping-willow-forced-response",
        "40133.boost",
        "40134.making-green-constant",
        "40135.when-revealed",
      ].sort(),
    );
  });
});

/** Surgery: every copy of `code` leaves the encounter deck and discard pile (set aside), or goes to the discard pile. */
function withCopies(s: GameState, code: string, keep: "none" | "discard", howMany = 1): GameState {
  const deckId = Object.keys(s.encounterDecks)[0]!;
  const copies = ids(s, code).filter((i) => piles(s).deck.includes(i) || piles(s).discard.includes(i));
  const discarded = keep === "discard" ? copies.slice(0, howMany) : [];
  return {
    ...s,
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: {
        deck: piles(s).deck.filter((i) => !copies.includes(i)),
        discard: [...piles(s).discard.filter((i) => !copies.includes(i)), ...discarded],
      },
    },
  };
}
const UNSEEN = "none" as InstanceId; // a defender id that is never offered: nobody defends

describe("Black Tom Cassidy (40132): 40132.black-tom-cassidy-constant", () => {
  // The hero attacks Black Tom (2 ATK). An enemy that cannot take damage is not a legal target of the attack at all.
  const strike = (state: GameState) => {
    const tom = inPlayCopies(state, TOM)[0]!;
    const ready = withForm(state, { heroForm: 0 }, P1);
    const result = applyCommand(ready, attackBy(ready, P1, tom) as Command, WAVE7_DEPS);
    return { tom, result };
  };
  const damageTaken = (state: GameState) => {
    const { tom, result } = strike(state);
    if (!result.ok) throw new Error(result.error.message);
    return inst(settle(result.state, firstLegal, undefined, WAVE7_DEPS), tom).damage;
  };

  it("he cannot take damage while a Creeping Willow is in play (even one engaged with another player): the hero cannot damage him", () => {
    const a = engaged(calm(game(TWO)), TOM, P1);
    const b = engaged(a.state, WILLOW, P2);
    const { result, tom } = strike(b.state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
    expect(inst(b.state, tom).damage).toBe(0);
  });

  it("with Creeping Willow only in the encounter deck he takes the 2 damage", () => {
    const { state } = engaged(calm(game(TWO)), TOM, P1);
    expect(inPlayCopies(state, WILLOW)).toEqual([]);
    expect(damageTaken(state)).toBe(2);
  });

  it("with Creeping Willow only in the encounter discard pile he takes the damage too (it is not in play)", () => {
    const { state } = engaged(withCopies(calm(game(TWO)), WILLOW, "discard", 4), TOM, P1);
    expect(damageTaken(state)).toBe(2);
  });

  it("the rule follows the Willow: once the last one leaves play he takes damage", () => {
    const a = engaged(calm(game(TWO)), TOM, P1);
    const b = engaged(a.state, WILLOW, P2);
    const gone = {
      ...b.state,
      players: b.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== b.id) })),
      encounterDecks: {
        ...b.state.encounterDecks,
        [Object.keys(b.state.encounterDecks)[0]!]: {
          deck: piles(b.state).deck,
          discard: [...piles(b.state).discard, b.id],
        },
      },
    };
    expect(damageTaken(gone)).toBe(2);
  });

  it("villainous: he draws a boost card when he activates (Making Green, 2 icons: 1 ATK + 2 = 3 damage)", () => {
    const { state, id } = engaged(calm(game()), TOM);
    const run = round(state, ["01186", MAKING_GREEN, FILLER]);
    const dealt = events(run.events, "boostCardDealt").filter((e) => e.enemyInstanceId === id);
    expect(dealt).toHaveLength(1);
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 1, boostIcons: 2, damageDealt: 3 }]);
  });
});

describe("Black Tom Cassidy (40132): 40132.when-revealed", () => {
  it("searches the encounter deck for a Creeping Willow and puts it into play engaged with you (not revealed: no surge)", () => {
    const state = calm(game());
    const run = round(state, ["01186", TOM]);
    expect(revealedIds(run)).toEqual([TOM]);
    const [willow] = inPlayCopies(run.state, WILLOW);
    expect(inPlayCopies(run.state, WILLOW)).toHaveLength(1);
    expect(inst(run.state, willow!).engagedWith).toBe(P1);
    expect(inst(run.state, revealedId(run, TOM)).engagedWith).toBe(P1);
    // It engages a hero-form player, so its quickstrike attack follows (RRG 1.8 "Quickstrike", p. 36).
    expect(attacksBy(run, willow!)).toMatchObject([{ baseAtk: 1, targetInstanceId: identityOf(state, P1) }]);
    // Three copies are left to find, one of them shuffled back in with the rest of the deck.
    expect(piles(run.state).deck.filter((i) => cardOf(run.state, i) === WILLOW)).toHaveLength(3);
  });

  it("2 players: the Willow is engaged with the player who revealed Black Tom", () => {
    const state = calm(game(TWO));
    const run = round(state, [...BLANK, FILLER, TOM]);
    expect(inst(run.state, revealedId(run, TOM)).engagedWith).toBe(P2);
    const [willow] = inPlayCopies(run.state, WILLOW);
    expect(inst(run.state, willow!).engagedWith).toBe(P2);
  });

  it("finds the Willow in the discard pile when none is left in the deck", () => {
    const state = withCopies(calm(game()), WILLOW, "discard", 1);
    const run = round(state, ["01186", TOM]);
    expect(inPlayCopies(run.state, WILLOW)).toHaveLength(1);
    expect(piles(run.state).discard.some((i) => cardOf(run.state, i) === WILLOW)).toBe(false);
  });

  it("another Willow already in play does not stop him fetching one: 2 in play", () => {
    const { state } = engaged(calm(game()), WILLOW);
    const run = round(state, ["01186", TOM]);
    expect(inPlayCopies(run.state, WILLOW)).toHaveLength(2);
  });

  it("with no Creeping Willow in the deck or discard nothing is put into play", () => {
    const state = withCopies(calm(game()), WILLOW, "none");
    const run = round(state, ["01186", TOM]);
    expect(inPlayCopies(run.state, WILLOW)).toEqual([]);
    expect(revealedIds(run)).toEqual([TOM]);
  });
});

describe("Creeping Willow (40133): 40133.creeping-willow-forced-response, 40133.boost", () => {
  it("after it attacks and damages a character, that character is stunned: the hero", () => {
    const { state, id } = engaged(calm(game()), WILLOW);
    const run = round(state, ["01186", FILLER], { pick: ["Place 1 momentum"] });
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 1, boostIcons: 0, damageDealt: 1 }]);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
    expect(stunnedOf(run.state, hopeOf(state))).toBe(0);
  });

  it("no damage (the hero's tough status card prevents it): no stun. Thrashing makes it attack an alter-ego player", () => {
    const base = calm(game());
    const hero = identityOf(base, P1);
    const { state, id } = engaged(withStatus(base, hero, "tough"), WILLOW);
    const run = round(state, ["01186", THRASHING], {}, "alterEgo");
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 1 }]);
    expect(
      events(run.events, "statusRemoved").filter((e) => e.instanceId === hero && e.status === "tough"),
    ).toHaveLength(1);
    expect(inst(run.state, hero).damage).toBe(0);
    expect(stunnedOf(run.state, hero)).toBe(0);
  });

  it("control: the same attack that does damage (no tough status card) stuns the alter-ego hero", () => {
    const { state, id } = engaged(calm(game()), WILLOW);
    const run = round(state, ["01186", THRASHING], {}, "alterEgo");
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 1 }]);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
  });

  it("when an ally defends and is damaged, the ally is stunned (not the hero)", () => {
    const { state, id } = engaged(calm(game()), WILLOW);
    const hope = hopeOf(state);
    const run = round(state, ["01186", FILLER], { defenders: [UNSEEN, hope] });
    expect(attacksBy(run, id)).toMatchObject([{ damageDealt: 1, targetInstanceId: hope }]);
    expect(stunnedOf(run.state, hope)).toBe(1);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(0);
  });

  it("2 players: the Willow engaged with the second player stuns that player's hero only", () => {
    const { state } = engaged(calm(game(TWO)), WILLOW, P2);
    const run = round(state, [...BLANK, FILLER, MAKING_GREEN]);
    expect(stunnedOf(run.state, identityOf(state, P2))).toBe(1);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(0);
  });

  it("[star] Boost: you are stunned (Juggernaut's attack: 3 ATK + 1 icon = 4, then the hero is stunned)", () => {
    const state = calm(game());
    const run = round(state, [WILLOW, FILLER]);
    expect(sinisterLike(state, run)).toMatchObject({ baseAtk: 3, boostIcons: 1, damageDealt: 4 });
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
    expect(stunnedOf(run.state, hopeOf(state))).toBe(0);
  });

  it("[star] Boost, 2 players: only the player attacked is stunned", () => {
    const state = calm(game(TWO));
    const run = round(state, [WILLOW, "01186", FILLER, MAKING_GREEN]);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
    expect(stunnedOf(run.state, identityOf(state, P2))).toBe(0);
  });
});

describe("Making Green (40134): 40134.making-green-constant", () => {
  // Making Green's hazard icon deals each player a second encounter card (RRG 1.8 "Hazard"), both moved before the first
  // is revealed, so a surge deals the third card of the stack. Wave 9 Q22: that card joins the back of the player's
  // queue and is revealed after the hazard card ("in the order in which they were dealt", RRG 1.8 p. 47 step 4).
  const CAPTIVE_HOPE = "40131";

  it("each copy of Creeping Willow gains surge: a Willow revealed with Making Green in play reveals the next card too", () => {
    const planted = encounterCardInVillainArea(calm(game()), MAKING_GREEN, 2);
    const run = round(planted.state, ["01186", WILLOW, FILLER, CAPTIVE_HOPE]);
    expect(revealedIds(run)).toEqual([WILLOW, FILLER, CAPTIVE_HOPE]);
    expect(events(run.events, "surgeTriggered").map((e) => cardOf(run.state, e.instanceId))).toEqual([WILLOW]);
  });

  it("control: a Willow revealed without Making Green has no surge", () => {
    const run = round(calm(game()), ["01186", WILLOW, FILLER, CAPTIVE_HOPE]);
    expect(revealedIds(run)).toEqual([WILLOW]);
    expect(events(run.events, "surgeTriggered")).toEqual([]);
  });

  it("only the Willows: Black Tom revealed with Making Green in play has no surge (just the hazard card after him)", () => {
    const planted = encounterCardInVillainArea(calm(game()), MAKING_GREEN, 2);
    const run = round(planted.state, ["01186", TOM, FILLER, CAPTIVE_HOPE]);
    expect(revealedIds(run)).toEqual([TOM, FILLER]);
    expect(events(run.events, "surgeTriggered")).toEqual([]);
  });

  it("a Willow fetched by Black Tom is put into play, not revealed: no surge from Making Green", () => {
    const planted = encounterCardInVillainArea(calm(game()), MAKING_GREEN, 2);
    const run = round(planted.state, ["01186", TOM, FILLER, CAPTIVE_HOPE]);
    expect(inPlayCopies(run.state, WILLOW)).toHaveLength(1);
    expect(events(run.events, "surgeTriggered")).toEqual([]);
  });
});

describe("A Sound Thrashing (40135): 40135.when-revealed", () => {
  it("each Willow attacks the player it is engaged with; attacked, so nothing is searched for (hero form)", () => {
    const { state, id } = engaged(calm(game()), WILLOW);
    const run = round(state, ["01186", THRASHING]);
    expect(attacksBy(run, id)).toHaveLength(2); // the villain phase's own attack, then the treachery's
    expect(revealedIds(run)).toEqual([THRASHING]);
    expect(inPlayCopies(run.state, WILLOW)).toEqual([id]);
  });

  it("even if the player is in alter-ego form", () => {
    const { state, id } = engaged(calm(game()), WILLOW);
    const run = round(state, ["01186", THRASHING], {}, "alterEgo");
    const hero = identityOf(state, P1);
    expect(attacksBy(run, id)).toMatchObject([{ targetInstanceId: hero, baseAtk: 1, damageDealt: 1 }]);
    expect(revealedIds(run)).toEqual([THRASHING]);
  });

  it("each Willow attacks: two Willows engaged with you make two attacks (and you are stunned by the first)", () => {
    const a = engaged(calm(game()), WILLOW);
    const b = engaged(a.state, WILLOW);
    const run = round(b.state, ["01186", THRASHING], {}, "alterEgo");
    expect(attacksBy(run, a.id)).toHaveLength(1);
    expect(attacksBy(run, b.id)).toHaveLength(1);
    expect(revealedIds(run)).toEqual([THRASHING]);
  });

  it("no Willow in play: no one is attacked, so a Willow is found in the deck and revealed (engaged with you)", () => {
    const state = calm(game());
    const run = round(state, ["01186", THRASHING]);
    expect(revealedIds(run)).toEqual([THRASHING, WILLOW]);
    const [willow] = inPlayCopies(run.state, WILLOW);
    expect(inst(run.state, willow!).engagedWith).toBe(P1);
    // Nobody was attacked by the card's own text, but a Willow revealed to a hero-form player engages it and its
    // quickstrike attack follows (RRG 1.8 "Quickstrike", p. 36).
    expect(attacksBy(run, willow!)).toMatchObject([{ baseAtk: 1, targetInstanceId: identityOf(state, P1) }]);
  });

  it("the same search in alter-ego form: the revealed Willow makes no quickstrike attack", () => {
    const run = round(calm(game()), ["01186", THRASHING], {}, "alterEgo");
    expect(revealedIds(run)).toEqual([THRASHING, WILLOW]);
    const [willow] = inPlayCopies(run.state, WILLOW);
    expect(attacksBy(run, willow!)).toEqual([]);
  });

  it("the Willow found may come from the discard pile", () => {
    const state = withCopies(calm(game()), WILLOW, "discard", 1);
    const run = round(state, ["01186", THRASHING]);
    expect(revealedIds(run)).toEqual([THRASHING, WILLOW]);
    expect(piles(run.state).discard.some((i) => cardOf(run.state, i) === WILLOW)).toBe(false);
  });

  it("no Willow anywhere: nothing is revealed after it", () => {
    const state = withCopies(calm(game()), WILLOW, "none");
    const run = round(state, ["01186", THRASHING]);
    expect(revealedIds(run)).toEqual([THRASHING]);
  });

  it("2 players: only the other player's Willow is in play, so that player is attacked and you, not attacked, search for one", () => {
    const { state, id } = engaged(calm(game(TWO)), WILLOW, P2);
    const run = round(state, [...BLANK, THRASHING, FILLER]);
    expect(attacksBy(run, id)).toMatchObject([
      { targetInstanceId: identityOf(state, P2) },
      { targetInstanceId: identityOf(state, P2) },
    ]);
    expect(revealedIds(run)).toEqual([THRASHING, WILLOW, FILLER]);
    const mine = inPlayCopies(run.state, WILLOW).filter((i) => inst(run.state, i).engagedWith === P1);
    expect(mine).toHaveLength(1);
  });

  it("2 players: your own Willow attacks you, so you do not search, whatever the other player has", () => {
    const { state, id } = engaged(calm(game(TWO)), WILLOW, P1);
    const run = round(state, [...BLANK, THRASHING, FILLER]);
    expect(attacksBy(run, id)).toHaveLength(2);
    expect(revealedIds(run)).toEqual([THRASHING, FILLER]);
    expect(inPlayCopies(run.state, WILLOW)).toEqual([id]);
  });

  it("2 players: a Willow engaged with each: each attacks its own player, you are attacked, no search", () => {
    const a = engaged(calm(game(TWO)), WILLOW, P1);
    const b = engaged(a.state, WILLOW, P2);
    const run = round(b.state, [...BLANK, THRASHING, FILLER]);
    expect(attacksBy(run, a.id)).toHaveLength(2);
    expect(attacksBy(run, b.id)).toHaveLength(2);
    expect(revealedIds(run)).toEqual([THRASHING, FILLER]);
  });
});
