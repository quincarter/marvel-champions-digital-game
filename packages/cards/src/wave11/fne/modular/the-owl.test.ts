import { PLAYABLE_CARDS, trait } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  cardsInPlay,
  characterProfile,
  createGame,
  legalActions,
  traitsOf,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_MODULAR_THE_OWL as REGISTRY, FNE_MODULAR_THE_OWL_SKIPPED as SKIPPED } from "./the-owl.js";

vi.setConfig({ testTimeout: 180_000 });

const SERUM = "60191";
const FISH = "60192";
const OWL = "60193";
const SWOOP = "60194";
const RHINO = "01094";
const ADVANCE = "01186"; // Core treachery, 0 boost icons
const ASSAULT = "01187"; // Core treachery, 0 boost icons
const HARD_TO_KEEP_DOWN = "01104"; // Core Rhino treachery, 0 boost icons
const IM_TOUGH = "01105"; // Core Rhino treachery, 0 boost icons
const RHINO_SUIT = "01098"; // Core Rhino attachment, 0 boost icons; attaches to the villain
const HORN = "01100"; // Core Rhino attachment; attaches to the villain
const SHOCKER = "01103"; // Core minion, ATK 2, SCH 1, 3 hit points
const KICK = "01005"; // Swinging Web Kick: an Attack event (Spider-Man)
const BLAST = "01013"; // Photonic Blast: an Attack event (Captain Marvel)
const BACKFLIP = "01003"; // a Defense event, not an Attack
const AERIAL = trait("AERIAL");
const SPIDER = { starterDeckId: "core-spider-man-justice" } as const;
const MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const SHE_HULK = { starterDeckId: "core-she-hulk-aggression" } as const;
/** Boost cards that print no boost icon and no harmful Boost, enough for the activations of one villain phase. */
const POOL = [ADVANCE, ADVANCE, ASSAULT, ASSAULT, HARD_TO_KEEP_DOWN, HARD_TO_KEEP_DOWN, IM_TOUGH, IM_TOUGH, RHINO_SUIT];
const REFS = [
  "60191.flight-serum-constant",
  "60191.flight-serum-constant-2",
  "60191.flight-serum-action",
  "60192.mister-fish-constant",
  "60192.when-revealed",
  "60193.the-owl-constant",
  "60193.boost",
  "60194.when-revealed-alter-ego",
  "60194.when-revealed-hero",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const heroDamage = (s: GameState, p: PlayerId = P1): number => inst(s, identityOf(s, p)).damage;
const discardCodes = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const traitsHere = (s: GameState, id: InstanceId) => traitsOf(s, id, WAVE11_DEPS);
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;

type Seat = typeof SPIDER | typeof MARVEL | typeof SHE_HULK;

/** Rhino's game against Core decks (hero form) with The Owl set added to the encounter deck. */
function newGame(seats: readonly Seat[] = [SPIDER]): GameState {
  const base = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...base, encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["the_owl"], PLAYABLE_CARDS)] },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return seats.reduce((s, _, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2), settled);
}
const alterEgo = (s: GameState, ...players: PlayerId[]): GameState =>
  players.reduce((acc, p) => withForm(acc, "alterEgo", p), s);

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));

/** Every player ends the turn and the villain phase runs on the stacked deck (top first: boost cards, then dealt cards). */
function villainPhase(state: GameState, stack: readonly string[], pick: Picker = declines) {
  return driveEventsPicking(
    WAVE11_DEPS,
    stackEncounterDeck(state, ...stack),
    pick,
    ...state.players.map((p) => endTurn(p.playerId)),
  );
}

/** A copy of `code` taken out of the encounter deck and discard pile (surgery), as its real instance. */
function take(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
    },
  };
}
/** A Flight Serum attached to `host` (surgery: no reveal). */
function serumOn(state: GameState, host: InstanceId): { state: GameState; id: InstanceId } {
  const taken = take(state, SERUM);
  const attached = patchInstance(taken.state, taken.id, { faceup: true, attachedTo: host });
  return {
    id: taken.id,
    state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, taken.id] }),
  };
}
/** The set's minion put into play engaged with `player` as its real card (surgery: no reveal, no Quickstrike). */
function minionOf(state: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const taken = take(state, code);
  const placed: GameState = {
    ...taken.state,
    players: taken.state.players.map((p) =>
      p.playerId === player ? { ...p, playArea: [...p.playArea, taken.id] } : p,
    ),
  };
  return {
    id: taken.id,
    state: patchInstance(placed, taken.id, { faceup: true, engagedWith: player, controllerId: null }),
  };
}
const withTough = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 1 } });
const stunned = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });
const attackedEvents = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked" ? [e.event] : [],
  );
/** Events from the first reveal of `code` on. */
const from = (s: GameState, events: readonly GameEvent[], code: string): readonly GameEvent[] => {
  const at = events.findIndex((e) => e.type === "encounterCardRevealed" && codeOf(s, e.instanceId) === code);
  if (at < 0) throw new Error(`${code} was never revealed`);
  return events.slice(at);
};
const revealedCodes = (s: GameState, events: readonly GameEvent[]) =>
  ofType(events, "encounterCardRevealed").map((e) => codeOf(s, e.instanceId));

describe("registry", () => {
  it("registers every printed ref of the four cards; nothing is skipped", () => {
    const printed = [SERUM, FISH, OWL, SWOOP].flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Flight Serum 60191", () => {
  it("is data: an attachment for a non-Aerial enemy with +1 ATK and +1 SCH", () => {
    expect(data(SERUM).attachesTo).toMatchObject({ category: "enemy", withoutTrait: AERIAL });
    expect(data(SERUM).statModifiers).toEqual({ atk: 1, sch: 1 });
  });

  it("60191.flight-serum-constant-2: revealed, it attaches to the villain, which gains Aerial and +1 ATK / +1 SCH", () => {
    const s = newGame();
    const before = profile(s, villainOf(s));
    expect(traitsHere(s, villainOf(s))).not.toContain(AERIAL);
    const run = villainPhase(s, [ADVANCE, SERUM]);
    const serum = idsOf(run.state, SERUM).find((i) => inst(run.state, i).attachedTo)!;
    expect(inst(run.state, serum).attachedTo).toBe(villainOf(s));
    expect(traitsHere(run.state, villainOf(s))).toContain(AERIAL);
    const now = profile(run.state, villainOf(s));
    expect([now.atk, now.sch]).toEqual([before.atk + 1, before.sch + 1]);
  });

  it("60191.flight-serum-constant-2: only the host gains Aerial, and it goes with the card", () => {
    const s = engageMinion(newGame(), SHOCKER, "shocker");
    const placed = serumOn(s, villainOf(s));
    expect(traitsHere(placed.state, villainOf(s))).toContain(AERIAL);
    expect(traitsHere(placed.state, "shocker" as InstanceId)).not.toContain(AERIAL);
    const gone = patchInstance(patchInstance(placed.state, placed.id, { attachedTo: null }), villainOf(s), {
      attachments: [],
    });
    expect(traitsHere(gone, villainOf(s))).not.toContain(AERIAL);
  });

  it("60191.flight-serum-constant: with no non-Aerial enemy to attach to, it is not attached and gains surge", () => {
    // Rhino already carries a Flight Serum, so he is Aerial; no minion is in play: the second copy has no host.
    const start = newGame();
    const s = serumOn(start, villainOf(start)).state;
    const run = villainPhase(s, [ADVANCE, SERUM, RHINO_SUIT]);
    const second = idsOf(run.state, SERUM).filter((i) => inst(run.state, i).attachedTo === null);
    expect(second.some((i) => activeEncounterDeck(run.state).discard.includes(i))).toBe(true);
    expect(revealedCodes(run.state, run.events)).toEqual([SERUM, RHINO_SUIT]);
  });

  it("60191.flight-serum-constant: with a non-Aerial host available it is attached and does not surge", () => {
    const run = villainPhase(newGame(), [ADVANCE, SERUM, RHINO_SUIT]);
    expect(revealedCodes(run.state, run.events)).toEqual([SERUM]);
  });

  it("60191.flight-serum-constant: with an Aerial villain and a non-Aerial minion in play, the copy attaches to the minion", () => {
    const start = engageMinion(newGame(), SHOCKER, "shocker");
    const base = serumOn(start, villainOf(start));
    const run = villainPhase(base.state, [ADVANCE, SERUM]);
    const second = idsOf(run.state, SERUM).find((i) => i !== base.id)!;
    expect(inst(run.state, second).attachedTo).toBe("shocker");
    expect(traitsHere(run.state, "shocker" as InstanceId)).toContain(AERIAL);
  });

  it("60191.flight-serum-constant: with two eligible hosts the first player picks, also when it is dealt to the other player", () => {
    const start = engageMinion(newGame([SPIDER, MARVEL]), SHOCKER, "shocker", P2);
    let chooser: PlayerId | undefined;
    const choose =
      (which: "first" | "last"): Picker =>
      (st) => {
        const choice = st.pendingChoice!;
        if (choice.prompt.kind !== "declareDefender" && choice.options.length > 1 && choice.minSelections === 1) {
          chooser = choice.playerId;
          return [(which === "first" ? choice.options[0]! : choice.options.at(-1)!).optionId];
        }
        return declines(st);
      };
    const hostOf = (r: ReturnType<typeof villainPhase>) =>
      inst(
        r.state,
        idsOf(r.state, SERUM).find((i) => inst(r.state, i).attachedTo)!,
      ).attachedTo;
    const stack = [POOL[0]!, POOL[2]!, HORN, SERUM];
    const a = villainPhase(start, stack, choose("first"));
    expect(chooser).toBe(P1);
    const b = villainPhase(start, stack, choose("last"));
    expect(new Set([hostOf(a), hostOf(b)]).size).toBe(2);
    expect([villainOf(start), "shocker"]).toEqual(expect.arrayContaining([hostOf(a), hostOf(b)]));
  });

  describe("60191.flight-serum-action", () => {
    const ACTION = "60191.flight-serum-action";
    function ready(seats: readonly Seat[] = [SPIDER], hand: readonly string[] = [KICK, BACKFLIP]) {
      const start = newGame(seats);
      const placed = serumOn(start, villainOf(start));
      const given = moveToHand(placed.state, P1, ...hand);
      return { state: given.state, serum: placed.id, cards: given.ids };
    }

    it("discarding an Attack event from your hand discards the Serum, and the villain loses Aerial and the stats", () => {
      const { state, serum, cards } = ready();
      const before = profile(state, villainOf(state));
      const run = driveEventsPicking(
        WAVE11_DEPS,
        state,
        declines,
        use(P1, serum, ACTION, [], { discard: [cards[0]!] }),
      );
      expect(discardCodes(run.state)).toContain(SERUM);
      expect(inst(run.state, serum).attachedTo).toBeNull();
      expect(playerOf(run.state, P1).discard).toContain(cards[0]);
      expect(playerOf(run.state, P1).hand).toContain(cards[1]);
      expect(traitsHere(run.state, villainOf(state))).not.toContain(AERIAL);
      expect(profile(run.state, villainOf(state)).atk).toBe(before.atk - 1);
    });

    it("an event that is not an Attack cannot pay", () => {
      const { state, serum, cards } = ready();
      expect(() =>
        driveEventsPicking(WAVE11_DEPS, state, declines, use(P1, serum, ACTION, [], { discard: [cards[1]!] })),
      ).toThrow();
    });

    const offered = (st: GameState, serum: InstanceId): boolean => {
      const actions = legalActions(st, P1, WAVE11_DEPS);
      return (
        actions.kind === "turn" &&
        actions.legal.some((l) => l.action.kind === "useAbility" && l.action.instanceId === serum)
      );
    };

    it("the action is offered with an Attack event in hand and not without one", () => {
      const { state, serum } = ready();
      expect(offered(state, serum)).toBe(true);
      const hand = playerOf(state, P1).hand.filter((i) => !traitsHere(state, i).includes(trait("ATTACK")));
      const trimmed: GameState = {
        ...state,
        players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand } : p)),
      };
      expect(playerOf(trimmed, P1).hand.some((i) => codeOf(trimmed, i) === BACKFLIP)).toBe(true);
      expect(offered(trimmed, serum)).toBe(false);
      expect(() => driveEventsPicking(WAVE11_DEPS, trimmed, declines, use(P1, serum, ACTION))).toThrow();
    });

    it("the other player may use it, paying from their own hand; the first player's hand is untouched", () => {
      const { state, serum } = ready([SPIDER, MARVEL], [KICK]);
      const given = moveToHand(state, P2, BLAST);
      const p1Hand = playerOf(given.state, P1).hand;
      const run = driveEventsPicking(
        WAVE11_DEPS,
        given.state,
        declines,
        use(P2, serum, ACTION, [], { discard: [given.ids[0]!] }),
      );
      expect(discardCodes(run.state)).toContain(SERUM);
      expect(playerOf(run.state, P2).discard).toContain(given.ids[0]);
      expect(playerOf(run.state, P1).hand).toEqual(p1Hand);
    });

    it("it is a Hero Action: an alter-ego player cannot use it", () => {
      const { state, serum, cards } = ready();
      expect(() =>
        driveEventsPicking(
          WAVE11_DEPS,
          alterEgo(state, P1),
          declines,
          use(P1, serum, ACTION, [], { discard: [cards[0]!] }),
        ),
      ).toThrow();
    });
  });
});

describe("Mister Fish 60192", () => {
  it("is data: a unique Criminal and Maggia minion, ATK 2, SCH 1, 4 hit points", () => {
    const card = data(FISH);
    expect([card.unique, card.atk, card.sch, card.hp]).toEqual([true, 2, 1, 4]);
  });

  it("60192.mister-fish-constant: his attack gains piercing and ranged; a Shocker's attack gains neither", () => {
    const fish = minionOf(newGame(), FISH);
    const both = engageMinion(fish.state, SHOCKER, "shocker");
    const quiet = stunned(withTough(both, identityOf(both)), villainOf(both));
    const run = villainPhase(quiet, [HORN]);
    const attacked = attackedEvents(run.events);
    expect(attacked.find((a) => a.attackerInstanceId === fish.id)!.ranged).toBe(true);
    expect(attacked.find((a) => a.attackerInstanceId === ("shocker" as InstanceId))!.ranged).toBeUndefined();
    // Piercing: his ATK 2 lands in full on the tough hero.
    const hits = ofType(run.events, "attackResolved");
    expect(hits.find((a) => a.enemyInstanceId === fish.id)!.damageDealt).toBe(2);
    expect(inst(run.state, identityOf(run.state)).statuses.tough).toBe(0);
  });

  it("60192.mister-fish-constant: control: without piercing a tough card absorbs the attack", () => {
    const s = engageMinion(newGame(), SHOCKER, "shocker");
    const quiet = stunned(withTough(s, identityOf(s)), villainOf(s));
    const run = villainPhase(quiet, [HORN]);
    expect(heroDamage(run.state)).toBe(0);
    expect(inst(run.state, identityOf(run.state)).statuses.tough).toBe(0);
  });

  describe("60192.when-revealed", () => {
    /** Two alter-ego players: the villain activates twice (two boost cards), P1 is dealt the Fish. */
    const reveal = (s: GameState, pick: Picker = declines) =>
      villainPhase(alterEgo(s, P1, P2), [POOL[0]!, POOL[2]!, FISH, HORN], pick);
    const fishOf = (s: GameState) => idsOf(s, FISH)[0]!;
    const remaining = (s: GameState, p: PlayerId) => profile(s, identityOf(s, p)).maxHp - heroDamage(s, p);

    it("engages the player whose identity has the fewest remaining hit points, not the player it was dealt to", () => {
      const s = patchInstance(newGame([SPIDER, MARVEL]), identityOf(newGame([SPIDER, MARVEL]), P2), { damage: 5 });
      const run = reveal(s);
      expect(inst(run.state, fishOf(run.state)).engagedWith).toBe(P2);
      expect(playerOf(run.state, P2).playArea).toContain(fishOf(run.state));
      expect(playerOf(run.state, P1).playArea).not.toContain(fishOf(run.state));
    });

    it("engages the other player when that one has fewer remaining hit points", () => {
      const start = newGame([SPIDER, MARVEL]);
      const run = reveal(patchInstance(start, identityOf(start, P1), { damage: 5 }));
      expect(inst(run.state, fishOf(run.state)).engagedWith).toBe(P1);
    });

    it("compares remaining hit points, not damage taken: the player with more damage but more hit points left is not chosen", () => {
      const start = alterEgo(newGame([SPIDER, MARVEL]), P1, P2);
      const hurt = patchInstance(start, identityOf(start, P2), { damage: 1 });
      expect(remaining(hurt, P1)).toBeLessThan(remaining(hurt, P2));
      expect(heroDamage(hurt, P2)).toBeGreaterThan(heroDamage(hurt, P1));
      const run = reveal(hurt);
      expect(inst(run.state, fishOf(run.state)).engagedWith).toBe(P1);
    });

    it("a tie is the first player's choice", () => {
      const start = alterEgo(newGame([SPIDER, MARVEL]), P1, P2);
      const gap = profile(start, identityOf(start, P2)).maxHp - profile(start, identityOf(start, P1)).maxHp;
      const tied =
        gap >= 0
          ? patchInstance(start, identityOf(start, P2), { damage: gap })
          : patchInstance(start, identityOf(start, P1), { damage: -gap });
      expect(remaining(tied, P1)).toBe(remaining(tied, P2));
      let chooser: PlayerId | undefined;
      const choose =
        (which: "first" | "last"): Picker =>
        (st) => {
          const choice = st.pendingChoice!;
          if (choice.prompt.kind === "declareDefender") return ["decline"];
          if (choice.options.length > 1 && choice.minSelections === 1) {
            chooser = choice.playerId;
            return [(which === "first" ? choice.options[0]! : choice.options.at(-1)!).optionId];
          }
          return firstLegal(st);
        };
      const a = reveal(tied, choose("first"));
      expect(chooser).toBe(P1);
      const b = reveal(tied, choose("last"));
      expect(inst(a.state, fishOf(a.state)).engagedWith).not.toBe(inst(b.state, fishOf(b.state)).engagedWith);
    });

    it("a single player is simply engaged", () => {
      const run = villainPhase(alterEgo(newGame(), P1), [POOL[0]!, FISH, HORN]);
      expect(inst(run.state, fishOf(run.state)).engagedWith).toBe(P1);
      expect(cardsInPlay(run.state)).toContain(fishOf(run.state));
    });
  });
});

describe("The Owl 60193", () => {
  it("is data: a unique Aerial Criminal minion with Quickstrike, ATK 2, SCH 3, 5 hit points", () => {
    const card = data(OWL);
    expect([card.unique, card.atk, card.sch, card.hp, card.keywords]).toEqual([
      true,
      2,
      3,
      5,
      [{ name: "quickstrike" }],
    ]);
    expect(card.traits).toEqual([AERIAL, trait("CRIMINAL")]);
  });

  it("60193.the-owl-constant: his attack gains piercing (ATK 2 lands on a tough hero)", () => {
    const owl = minionOf(newGame(), OWL);
    const quiet = stunned(withTough(owl.state, identityOf(owl.state)), villainOf(owl.state));
    const run = villainPhase(quiet, [HORN]);
    expect(ofType(run.events, "attackResolved").find((a) => a.enemyInstanceId === owl.id)!.damageDealt).toBe(2);
    expect(heroDamage(run.state)).toBe(2);
    expect(inst(run.state, identityOf(run.state)).statuses.tough).toBe(0);
  });

  it("60193.the-owl-constant: control: another minion's attack does not (a Shocker's ATK 2 is absorbed by the tough card)", () => {
    const s = engageMinion(newGame(), SHOCKER, "shocker");
    const run = villainPhase(stunned(withTough(s, identityOf(s)), villainOf(s)), [HORN]);
    expect(heroDamage(run.state)).toBe(0);
  });

  it("60193.the-owl-constant: revealed, Quickstrike attacks at once, and that attack has piercing", () => {
    const s = newGame();
    const quiet = stunned(withTough(s, identityOf(s)), villainOf(s));
    const run = villainPhase(quiet, [OWL, HORN]);
    const hit = ofType(run.events, "attackResolved").find((a) => codeOf(run.state, a.enemyInstanceId) === OWL)!;
    expect(hit.damageDealt).toBe(2);
    expect(heroDamage(run.state)).toBe(2);
  });

  it("60193.boost: on an attack the boosted attack gains piercing (a tough hero takes the damage)", () => {
    const s = newGame();
    const run = villainPhase(withTough(s, identityOf(s)), [OWL, HORN]);
    const hit = ofType(run.events, "attackResolved").find((a) => codeOf(run.state, a.enemyInstanceId) === RHINO)!;
    expect(hit.damageDealt).toBe(hit.baseAtk + hit.boostIcons);
    expect(hit.damageDealt).toBeGreaterThan(0);
    expect(heroDamage(run.state)).toBe(hit.damageDealt);
    expect(inst(run.state, identityOf(run.state)).statuses.tough).toBe(0);
  });

  it("60193.boost: control: a blank boost card leaves the tough card to absorb the attack", () => {
    const s = newGame();
    const run = villainPhase(withTough(s, identityOf(s)), [POOL[0]!, HORN]);
    expect(heroDamage(run.state)).toBe(0);
  });

  it("60193.boost: during a scheme it does nothing (the threat placed matches a blank boost)", () => {
    const s = alterEgo(newGame(), P1);
    const control = villainPhase(s, [POOL[0]!, HORN]);
    const run = villainPhase(s, [OWL, HORN]);
    expect(heroDamage(run.state)).toBe(0);
    const placed = (r: typeof run) => ofType(r.events, "schemeResolved").map((e) => e.threatPlaced);
    expect(placed(run)).toEqual(placed(control));
  });
});

describe("Swoop Down 60194", () => {
  const schemesAfter = (s: GameState, events: readonly GameEvent[]) =>
    ofType(from(s, events, SWOOP), "schemeResolved").map((e) => [e.enemyInstanceId as string, e.baseSch]);
  const attacksAfter = (s: GameState, events: readonly GameEvent[]) =>
    ofType(from(s, events, SWOOP), "attackResolved").map((e) => [
      e.enemyInstanceId as string,
      e.baseAtk,
      e.targetInstanceId as string,
    ]);

  it("is data: a treachery with 3 boost icons", () => {
    expect(data(SWOOP).type).toBe("treachery");
    expect(data(SWOOP).boostIcons).toBe(3);
  });

  /** P1 has the Owl (Aerial) and a Shocker engaged. The villain and both minions activate before the card is dealt. */
  function engagedP1(seats: readonly Seat[] = [SPIDER]) {
    const owl = minionOf(newGame(seats), OWL);
    const placed = engageMinion(owl.state, SHOCKER, "shocker");
    // Threat the schemes place would end the game at the main scheme's target; start well below zero so it never does.
    return { state: patchInstance(placed, placed.mainScheme!.instanceId, { threat: -30 }), owl: owl.id };
  }
  // Only the villain is dealt a boost card (RRG 1.8 "Attack (Enemy Activation)", pp. 8-9): its activation, Swoop Down, its second one.
  const stack1 = [POOL[0]!, SWOOP, POOL[2]!];

  it("60194.when-revealed-alter-ego: the villain and each minion engaged with you scheme; the Aerial one gets +2 SCH", () => {
    const { state, owl } = engagedP1();
    const run = villainPhase(alterEgo(state, P1), stack1);
    expect(run.state.outcome).toBeNull();
    const swoop = schemesAfter(run.state, run.events);
    expect(swoop).toHaveLength(3);
    expect(swoop).toContainEqual([villainOf(state), profile(state, villainOf(state)).sch]);
    expect(swoop).toContainEqual([owl, 3 + 2]);
    expect(swoop).toContainEqual(["shocker", 1]);
  });

  it("60194.when-revealed-alter-ego: an Aerial villain (Flight Serum) gets +2 SCH too, on top of the Serum's +1", () => {
    const { state, owl } = engagedP1();
    const base = profile(state, villainOf(state)).sch;
    const aerial = serumOn(alterEgo(state, P1), villainOf(state)).state;
    const run = villainPhase(aerial, stack1);
    expect(run.state.outcome).toBeNull();
    const swoop = schemesAfter(run.state, run.events);
    expect(swoop).toContainEqual([villainOf(state), base + 1 + 2]);
    expect(swoop).toContainEqual([owl, 5]);
  });

  it("60194.when-revealed-alter-ego: a minion that gained Aerial from Flight Serum gets +2 SCH (1 + 1 from the Serum + 2)", () => {
    const { state } = engagedP1();
    const aerial = serumOn(alterEgo(state, P1), "shocker" as InstanceId).state;
    const run = villainPhase(aerial, stack1);
    expect(run.state.outcome).toBeNull();
    expect(schemesAfter(run.state, run.events)).toContainEqual(["shocker", 4]);
  });

  it("60194.when-revealed-alter-ego: the +2 is for that activation only (the Owl schemed for 3, then 5, and is 3 again)", () => {
    const { state, owl } = engagedP1();
    const run = villainPhase(alterEgo(state, P1), stack1);
    const owlSchemes = ofType(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === owl);
    expect(owlSchemes.map((e) => e.baseSch)).toEqual([3, 5]);
    expect(profile(run.state, owl).sch).toBe(3);
  });

  it("60194.when-revealed-alter-ego: only the villain and minions engaged with you, in a two-player game (dealt to P2)", () => {
    const owl = minionOf(newGame([SPIDER, MARVEL]), OWL, P1); // engaged with P1: stays out of it
    const withP2 = engageMinion(owl.state, SHOCKER, "p2shocker", P2);
    const all = alterEgo(withP2, P1, P2);
    // The villain activates twice (two boost cards); P1 is dealt a filler, P2 Swoop Down.
    const run = villainPhase(all, [POOL[0]!, POOL[2]!, HORN, SWOOP, POOL[4]!]);
    const swoop = schemesAfter(run.state, run.events);
    expect(swoop.map(([id]) => id).sort()).toEqual([villainOf(all), "p2shocker"].sort());
  });

  it("60194.when-revealed-hero: the villain and each minion engaged with you attack you; the Aerial one gets +2 ATK", () => {
    const { state, owl } = engagedP1([SHE_HULK]);
    const run = villainPhase(state, stack1);
    const swoop = attacksAfter(run.state, run.events);
    const me = identityOf(state);
    expect(swoop).toHaveLength(3);
    expect(swoop).toContainEqual([villainOf(state), profile(state, villainOf(state)).atk, me]);
    expect(swoop).toContainEqual([owl, 2 + 2, me]);
    expect(swoop).toContainEqual(["shocker", 2, me]);
  });

  it("60194.when-revealed-hero: the alter-ego half does not run for a hero (no scheme after it)", () => {
    const { state } = engagedP1([SHE_HULK]);
    const run = villainPhase(state, stack1);
    expect(ofType(from(run.state, run.events, SWOOP), "schemeResolved")).toEqual([]);
  });

  it("60194.when-revealed-hero: only the villain and minions engaged with you, in a two-player game (dealt to P2)", () => {
    const owl = minionOf(newGame([SHE_HULK, MARVEL]), OWL, P1);
    const withP2 = engageMinion(owl.state, SHOCKER, "p2shocker", P2);
    const run = villainPhase(withP2, [POOL[0]!, POOL[2]!, HORN, SWOOP, POOL[4]!]);
    const swoop = attacksAfter(run.state, run.events);
    expect(swoop.map(([id]) => id).sort()).toEqual([villainOf(withP2), "p2shocker"].sort());
    expect(swoop.every(([, , target]) => target === identityOf(run.state, P2))).toBe(true);
  });
});
