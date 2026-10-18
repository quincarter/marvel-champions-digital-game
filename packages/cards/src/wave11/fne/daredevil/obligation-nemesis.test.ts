import { FNE_STARTER_DECKS, PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  FNE_DAREDEVIL_OBLIGATION_NEMESIS as REGISTRY,
  FNE_DAREDEVIL_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * Daredevil's obligation and nemesis set (60032 Sensory Overload; 60033 Bullseye, 60034 Deadliest Man Alive, 60035
 * Stolen Sai, 60036 Eye on the Target), docs/phase7-wave11.md section 8.4 line 5, read against the scans. The printed
 * precon `fne-daredevil-justice` against Core's Rhino (ATK 2, SCH 1). The obligation is in the encounter deck; the
 * nemesis set is set aside, so its cards are staged for a real reveal in the villain phase or put into play by surgery
 * where the reveal is not the point. Rhino is stunned wherever his own attack would blur an assertion. Persona
 * supports Foggy Nelson 60013 and Karen Page 60014 and the ally Elektra 60007 come from the starter deck.
 */
const OBLIGATION = "60032";
const BULLSEYE = "60033";
const SCHEME = "60034";
const SAI = "60035";
const EYE = "60036";
const FOGGY = "60013";
const KAREN = "60014";
const ELEKTRA = "60007";
const ADVANCE = "01186";
const REFS = [
  "60032.obligation",
  "60032.sensory-overload-forced-response",
  "60032.sensory-overload-response",
  "60033.when-revealed",
  "60034.deadliest-man-alive-forced-interrupt",
  "60035.stolen-sai-constant",
  "60035.stolen-sai-action",
  "60035.boost",
  "60036.when-revealed",
];
const RESPONSE = "60032.sensory-overload-response";
const SAI_ACTION = "60035.stolen-sai-action";
const SENSES = "60001a.superhuman-senses";

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const damageOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const toughOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.tough;
const withTough = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 1 } });
const inPlayArea = (s: GameState, id: InstanceId) => playerOf(s, P1).playArea.includes(id);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const stunned = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });
const encounterDiscardCodes = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;

function newGame(seed = 1): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}
const heroGame = (): GameState => withForm(newGame(), { heroForm: 0 });
const alterEgoGame = (): GameState => withForm(newGame(), "alterEgo");

/** The first set-aside copy of `code` of P1's, taken out of the set-aside cards. */
function fromSetAside(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no set-aside ${code}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
      ),
    },
  };
}
/** Bullseye (the set-aside copy) in P1's play area, faceup, engaged with P1, as if revealed earlier. */
function engagedBullseye(state: GameState) {
  const found = fromSetAside(state, BULLSEYE);
  const placed: GameState = {
    ...found.state,
    players: found.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, found.id] } : p)),
  };
  return {
    id: found.id,
    state: patchInstance(placed, found.id, { faceup: true, controllerId: null, engagedWith: P1 }),
  };
}
/** Deadliest Man Alive (set aside) faceup in the villain area. */
function withScheme(state: GameState) {
  const found = fromSetAside(state, SCHEME);
  const placed: GameState = { ...found.state, villainArea: [...found.state.villainArea, found.id] };
  return { id: found.id, state: patchInstance(placed, found.id, { faceup: true, threat: 5 }) };
}
/** Stolen Sai (set aside) attached to `host`, faceup. */
function sceneAttached(state: GameState, host: InstanceId) {
  const found = fromSetAside(state, SAI);
  const placed = patchInstance(found.state, found.id, { faceup: true, attachedTo: host, controllerId: null });
  return {
    id: found.id,
    state: patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, found.id] }),
  };
}
/** The cards of P1's deck whose printed resources include a physical (or wild) icon, as codes. */
const physicalCodes = (state: GameState, n: number): string[] => {
  const codes = playerOf(state, P1)
    .deck.concat(playerOf(state, P1).hand)
    .map((i) => codeOf(state, i))
    .filter((code) => {
      const icons = (PLAYABLE_CARDS.find((c) => c.id === cardId(code)) as any)?.resourceIcons ?? {};
      return (icons.physical ?? 0) + (icons.wild ?? 0) > 0;
    });
  const unique: string[] = [];
  for (const code of codes)
    if (unique.filter((c) => c === code).length < codes.filter((c) => c === code).length) unique.push(code);
  return unique.slice(0, n);
};

/**
 * Puts the card `code` (set aside, or in the encounter deck) behind the villain's own boost card, if he draws one (a
 * villain draws one for any activation, but a stunned villain facing a hero in hero form does not attack; Bullseye is
 * not villainous, so a minion draws none), and makes the next 14 cards Advance too, so it is P1's revealed card and
 * any later boost is blank.
 */
function staged(state: GameState, code: string): GameState {
  const deckId = activeEncounterDeckId(state);
  const setAside = playerOf(state, P1).setAside.find((i) => codeOf(state, i) === code);
  const id = setAside ?? activeEncounterDeck(state).deck.find((i) => codeOf(state, i) === code)!;
  const pile = state.encounterDecks[deckId]!;
  const rest = pile.deck.filter((i) => i !== id);
  const hero = playerOf(state, P1).identity.form === "hero";
  const boosting = hero && inst(state, villainOf(state)).statuses.stunned > 0 ? 0 : 1;
  const placed: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...rest.slice(0, boosting), id, ...rest.slice(boosting)] },
    },
  };
  return [...rest.slice(0, 15)].reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), placed);
}
/** P1 ends the turn: the villain phase reveals `code` to them. */
function reveal(state: GameState, code: string, pick: Picker) {
  const run = driveEventsPicking(WAVE11_DEPS, staged(state, code), pick, endTurn(P1));
  return { ...run, id: idOf(run.state, code) };
}
const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
const picks = (...labels: readonly string[]): Picker => {
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    for (const label of labels) {
      const hit = choice.options.find((o) => o.label.startsWith(label));
      if (hit) return [hit.optionId];
    }
    return firstLegal(s);
  };
};
const accepting =
  (...ids: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "chooseTriggers") {
      return choice.options
        .map((o) => o.optionId as string)
        .filter((o) => ids.some((id) => o.endsWith(id)))
        .slice(0, choice.maxSelections);
    }
    if (choice.prompt.kind === "spendResources" || choice.prompt.kind === "chooseTarget")
      return [choice.options[0]!.optionId];
    return firstLegal(s);
  };
const labelsOffered = (s: GameState): string[] => s.pendingChoice?.options.map((o) => o.label) ?? [];

describe("registry", () => {
  it("registers every printed ref; nothing is skipped", () => {
    const printed = [OBLIGATION, BULLSEYE, SCHEME, SAI, EYE].flatMap((c) => abilityRefIds(data(c)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!)).toEqual([]);
  });
});

describe("60032 Sensory Overload", () => {
  /** Sensory Overload revealed to P1 (Rhino stunned so he does not attack), the next player phase begun. */
  function held() {
    const start = heroGame();
    const run = reveal(stunned(start, villainOf(start)), OBLIGATION, declines);
    return run;
  }

  it("60032.obligation: stays in the Matt Murdock player's play area when revealed", () => {
    const { state, id } = held();
    expect(inPlayArea(state, id)).toBe(true);
    expect(encounterDiscardCodes(state)).not.toContain(OBLIGATION);
  });

  it("60032.sensory-overload-forced-response: a Sense upgrade entering play deals the Matt Murdock player 1 damage", () => {
    const { state } = held();
    const before = damageOf(state);
    const run = driveEventsPicking(WAVE11_DEPS, state, accepting(), use(P1, identityOf(state), SENSES));
    expect(damageOf(run.state)).toBe(before + 1);
  });

  it("without it in play, the same Sense upgrade deals no damage", () => {
    const state = heroGame();
    const run = driveEventsPicking(WAVE11_DEPS, state, accepting(), use(P1, identityOf(state), SENSES));
    expect(damageOf(run.state)).toBe(0);
  });

  it("60032.sensory-overload-response: after you recover in alter-ego form, you may discard it", () => {
    const start = alterEgoGame();
    const { state, id } = reveal(stunned(start, villainOf(start)), OBLIGATION, declines);
    const damaged = patchInstance(state, identityOf(state), { damage: 3 });
    const accepted = driveEventsPicking(WAVE11_DEPS, damaged, accepting(RESPONSE), {
      type: "basicRecover",
      playerId: P1,
    });
    expect(inPlayArea(accepted.state, id)).toBe(false);
    expect(encounterDiscardCodes(accepted.state)).toContain(OBLIGATION);
    const declined = driveEventsPicking(WAVE11_DEPS, damaged, accepting(), { type: "basicRecover", playerId: P1 });
    expect(inPlayArea(declined.state, id)).toBe(true);
  });
});

describe("60033 Bullseye", () => {
  const readyBullseye = (form: "hero" | "alterEgo", persona: readonly string[]) => {
    let state = form === "hero" ? heroGame() : alterEgoGame();
    state = stunned(state, villainOf(state));
    const supports = persona.map((code) => {
      const placed = stagedInPlay(state, code);
      state = placed.state;
      return placed.id;
    });
    return { state, supports };
  };

  it.each(["hero", "alterEgo"] as const)(
    "60033.when-revealed: with no Persona support the only choice is the attack; Bullseye hits you for 3 in %s form",
    (form) => {
      const { state } = readyBullseye(form, []);
      const seen: string[][] = [];
      const run = reveal(state, BULLSEYE, (s) => {
        seen.push(labelsOffered(s));
        return declines(s);
      });
      expect(inPlayArea(run.state, run.id)).toBe(true);
      expect(inst(run.state, run.id).engagedWith).toBe(P1);
      expect(damageOf(run.state)).toBe(3);
      expect(seen.flat().some((l) => l.startsWith("Discard a Persona"))).toBe(false);
    },
  );

  it("choosing the Persona support discards it and Bullseye does not attack", () => {
    const { state, supports } = readyBullseye("hero", [FOGGY]);
    const run = reveal(state, BULLSEYE, picks("Discard a Persona"));
    expect(playerOf(run.state, P1).discard).toContain(supports[0]);
    expect(inPlayArea(run.state, supports[0]!)).toBe(false);
    expect(damageOf(run.state)).toBe(0);
    expect(inPlayArea(run.state, run.id)).toBe(true);
  });

  it("choosing the attack leaves the Persona support alone", () => {
    const { state, supports } = readyBullseye("hero", [KAREN]);
    const run = reveal(state, BULLSEYE, picks("Bullseye attacks you"));
    expect(inPlayArea(run.state, supports[0]!)).toBe(true);
    expect(damageOf(run.state)).toBe(3);
  });
});

describe("60034 Deadliest Man Alive", () => {
  /** Bullseye engaged with P1, Rhino stunned; Bullseye is the only enemy that attacks this villain phase. */
  const phase = (scheme: boolean) => {
    const start = heroGame();
    const bull = engagedBullseye(stunned(start, villainOf(start)));
    const placed = scheme ? withScheme(bull.state) : { state: bull.state };
    const filled = activeEncounterDeck(placed.state)
      .deck.slice(0, 14)
      .reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), placed.state);
    const run = driveEventsPicking(WAVE11_DEPS, filled, declines, endTurn(P1));
    return { ...run, bull: bull.id };
  };
  const flipsFor = (events: readonly GameEvent[], enemy: InstanceId) =>
    ofType(events, "boostCardFlipped").filter((e) => e.enemyInstanceId === enemy).length;

  it("60034.deadliest-man-alive-forced-interrupt: when Bullseye attacks he is given a facedown boost card, flipped in that attack", () => {
    const control = phase(false);
    expect(flipsFor(control.events, control.bull)).toBe(0);
    const run = phase(true);
    expect(flipsFor(run.events, run.bull)).toBe(1);
    // Bullseye ATK 3 plus the flipped card's boost icon (Advance has one).
    const icons = ofType(run.events, "boostCardFlipped").find((e) => e.enemyInstanceId === run.bull)!.boostIcons;
    expect(damageOf(control.state)).toBe(3);
    expect(damageOf(run.state)).toBe(3 + icons);
  });

  it("it does not answer another enemy's attack: Rhino alone flips the same boost cards with or without it", () => {
    const flips = (scheme: boolean) => {
      const start = heroGame();
      const placed = scheme ? withScheme(start) : { state: start };
      const filled = activeEncounterDeck(placed.state)
        .deck.slice(0, 14)
        .reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), placed.state);
      const run = driveEventsPicking(WAVE11_DEPS, filled, declines, endTurn(P1));
      return flipsFor(run.events, villainOf(start));
    };
    expect(flips(true)).toBe(flips(false));
  });
});

describe("60035 Stolen Sai", () => {
  it("attaches to the enemy with the highest ATK (Bullseye 3 over Rhino 2) when revealed", () => {
    const start = heroGame();
    const bull = engagedBullseye(stunned(start, villainOf(start)));
    const run = reveal(bull.state, SAI, declines);
    expect(inst(run.state, run.id).attachedTo).toBe(bull.id);
  });

  it("60035.stolen-sai-constant: the attached enemy's attacks gain piercing (the tough status is discarded and the damage lands)", () => {
    const start = heroGame();
    const bull = engagedBullseye(stunned(start, villainOf(start)));
    const filled = activeEncounterDeck(bull.state)
      .deck.slice(0, 14)
      .reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), bull.state);
    const tough = withTough(filled, identityOf(filled));
    const control = driveEventsPicking(WAVE11_DEPS, tough, declines, endTurn(P1));
    expect(toughOn(control.state, identityOf(control.state))).toBe(0);
    expect(damageOf(control.state)).toBe(0);
    const sai = sceneAttached(tough, bull.id);
    const run = driveEventsPicking(WAVE11_DEPS, sai.state, declines, endTurn(P1));
    expect(toughOn(run.state, identityOf(run.state))).toBe(0);
    expect(damageOf(run.state)).toBe(4);
  });

  it("60035.stolen-sai-constant: a scheme activation of the attached enemy is left alone (no tough discarded, no damage)", () => {
    const start = alterEgoGame();
    const bull = engagedBullseye(stunned(start, villainOf(start)));
    const filled = activeEncounterDeck(bull.state)
      .deck.slice(0, 14)
      .reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), bull.state);
    const tough = withTough(filled, identityOf(filled));
    const sai = sceneAttached(tough, bull.id);
    const run = driveEventsPicking(WAVE11_DEPS, sai.state, declines, endTurn(P1));
    expect(ofType(run.events, "schemeResolved").some((e) => e.enemyInstanceId === bull.id)).toBe(true);
    expect(ofType(run.events, "attackResolved").filter((e) => e.enemyInstanceId === bull.id)).toHaveLength(0);
    expect(toughOn(run.state, identityOf(run.state))).toBe(1);
    expect(damageOf(run.state)).toBe(0);
  });

  const useAction = (state: GameState, sai: InstanceId, pick: Picker) => {
    const given = moveToHand(state, P1, ...physicalCodes(state, 2));
    return driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      pick,
      use(
        P1,
        sai,
        SAI_ACTION,
        given.ids.map((fromHand) => ({ fromHand })),
      ),
    );
  };

  it("60035.stolen-sai-action: spend two physical resources, then discard it", () => {
    const start = heroGame();
    const bull = engagedBullseye(start);
    const sai = sceneAttached(bull.state, bull.id);
    const run = useAction(sai.state, sai.id, picks("Discard this card"));
    expect(encounterDiscardCodes(run.state)).toContain(SAI);
    expect(inst(run.state, bull.id).attachments).not.toContain(sai.id);
  });

  it("60035.stolen-sai-action: with Elektra in play, attach it to her instead; not offered without her", () => {
    const start = heroGame();
    const bull = engagedBullseye(start);
    const sai = sceneAttached(bull.state, bull.id);
    const seen: string[][] = [];
    const without = useAction(sai.state, sai.id, (s) => {
      seen.push(labelsOffered(s));
      return picks("Discard this card")(s);
    });
    expect(seen.flat().some((l) => l.startsWith("Attach this card to Elektra"))).toBe(false);
    expect(encounterDiscardCodes(without.state)).toContain(SAI);

    const elektra = stagedInPlay(sai.state, ELEKTRA);
    const run = useAction(elektra.state, sai.id, picks("Attach this card to Elektra"));
    expect(inst(run.state, sai.id).attachedTo).toBe(elektra.id);
    expect(inst(run.state, bull.id).attachments).not.toContain(sai.id);
  });

  it("60035.boost: when it is flipped as the villain's boost card, the attack gains piercing", () => {
    const start = heroGame();
    const found = fromSetAside(start, SAI);
    const deckId = activeEncounterDeckId(found.state);
    const pile = found.state.encounterDecks[deckId]!;
    const withBoost: GameState = {
      ...found.state,
      encounterDecks: { ...found.state.encounterDecks, [deckId]: { ...pile, deck: [found.id, ...pile.deck] } },
    };
    const blanked = pile.deck
      .slice(0, 14)
      .reduce((acc, i) => patchInstance(acc, i, { cardId: cardId(ADVANCE) }), withBoost);
    const tough = withTough(blanked, identityOf(blanked));
    const run = driveEventsPicking(WAVE11_DEPS, tough, declines, endTurn(P1));
    expect(ofType(run.events, "boostCardFlipped").some((e) => e.instanceId === found.id)).toBe(true);
    // Rhino ATK 2 + the 1 boost icon; piercing: the tough status card is discarded and the damage lands anyway.
    expect(toughOn(run.state, identityOf(run.state))).toBe(0);
    expect(damageOf(run.state)).toBe(3);
  });
});

describe("60036 Eye on the Target", () => {
  const eyeGame = (persona: readonly string[], allies: readonly string[], bullseye: "play" | "aside") => {
    let state = heroGame();
    state = stunned(state, villainOf(state));
    const held: InstanceId[] = [];
    for (const code of [...persona, ...allies]) {
      const placed = stagedInPlay(state, code);
      state = placed.state;
      held.push(placed.id);
    }
    const bull = bullseye === "play" ? engagedBullseye(state) : null;
    return { state: bull?.state ?? state, held, bull: bull?.id ?? null };
  };

  it("60036.when-revealed: removes an ally you control from the game", () => {
    const { state, held } = eyeGame([], [ELEKTRA], "aside");
    const run = reveal(state, EYE, picks("Remove an ally"));
    expect(inPlayArea(run.state, held[0]!)).toBe(false);
    expect(playerOf(run.state, P1).discard).not.toContain(held[0]);
    expect(run.state.removedFromGame ?? []).toContain(held[0]);
    expect(damageOf(run.state)).toBe(0);
  });

  it("removes a Persona support you control from the game", () => {
    const { state, held } = eyeGame([FOGGY], [], "aside");
    const run = reveal(state, EYE, picks("Remove an ally"));
    expect(inPlayArea(run.state, held[0]!)).toBe(false);
    expect(run.state.removedFromGame ?? []).toContain(held[0]);
  });

  it("Bullseye in play attacks you again (his own activation, then this one)", () => {
    const { state, held, bull: bullId } = eyeGame([FOGGY], [], "play");
    const bull = bullId!;
    const run = reveal(state, EYE, picks("Bullseye attacks you"));
    expect(inPlayArea(run.state, held[0]!)).toBe(true);
    // Bullseye is ready, so he also attacks at his own villain-phase activation (3), before this reveal: 3 + 3.
    expect(ofType(run.events, "attackResolved").filter((e) => e.enemyInstanceId === bull)).toHaveLength(2);
    expect(damageOf(run.state)).toBe(6);
  });

  it("Bullseye not in play: he is found and revealed, his own When Revealed then choosing (the attack, with no Persona support)", () => {
    const { state } = eyeGame([], [], "aside");
    const run = reveal(state, EYE, declines);
    const bull = idOf(run.state, BULLSEYE);
    expect(inPlayArea(run.state, bull)).toBe(true);
    expect(inst(run.state, bull).engagedWith).toBe(P1);
    expect(damageOf(run.state)).toBe(3);
  });

  it("with nothing to remove the only choice is the Bullseye one", () => {
    const { state } = eyeGame([], [], "play");
    const seen: string[][] = [];
    reveal(state, EYE, (s) => {
      seen.push(labelsOffered(s));
      return declines(s);
    });
    expect(seen.flat().some((l) => l.startsWith("Remove an ally"))).toBe(false);
  });
});
