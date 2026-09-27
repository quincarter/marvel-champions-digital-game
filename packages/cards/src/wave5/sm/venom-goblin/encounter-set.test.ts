import { cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  activeVillain,
  createGame,
  currentName,
  getInstance,
  handSize,
  hasKeyword,
  maxHitPoints,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  P1,
  type Picker,
} from "../../../testing/harness.js";
import { driveEvents, driveEventsPicking } from "../../../testing/staging.js";
import { startWave5Game, runWave5, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario, ghostSpiderScenarioWithExtras } from "../ghost-spider/support.js";

/**
 * Venom Goblin's own encounter set (`sm` 27120–27126, MC27 p. 17): We Are One, Symbiotic Berserker, Symbiotic
 * Monstrosity, Symbiotic Thrall, Festering Mass, Joy Ride and Spreading Panic. `wave5Scenario("venom-goblin", …)`
 * shuffles this set into the encounter deck (it is the scenario's own required non-modular set, `venom`'s own
 * Bell Tower precedent), so a card under test is staged directly by code (`stackEncounterDeck`), the same
 * `wave5/sm/venom/encounter-set.test.ts` convention. Bomb Scare (Core) stands in for the box's own Goblin Gear
 * modular (`scenario.test.ts`'s own note; not scripted yet).
 */
function venomGoblin(overrides: Partial<Parameters<typeof ghostSpiderScenario>[1]> = {}): GameState {
  return startWave5Game(
    ghostSpiderScenario("venom-goblin", { seed, modularSetIds: [encounterSetId("bomb_scare")], ...overrides }),
  );
}
const seed = 7;

const schemes = (state: GameState): readonly InstanceId[] => [
  state.mainScheme.instanceId,
  ...(state.extraMainSchemes ?? []).map((s) => s.instanceId),
];
const schemeNamed = (state: GameState, name: string): InstanceId => {
  const found = schemes(state).find((id) => currentName(state, id) === name);
  if (!found)
    throw new Error(`no main scheme named ${name} among ${schemes(state).map((id) => currentName(state, id))}`);
  return found;
};
const gliderOn = (state: GameState): string | undefined =>
  schemes(state)
    .filter((id) => (getInstance(state, id)?.counters["glider"] ?? 0) > 0)
    .map((id) => currentName(state, id))[0];

/** The events between `abilityId`'s own `abilityResolved` and the very next `abilityResolved` of any id — a boost
 * ability's own leaf effects, and nothing an enemy's later Forced Response does in the same activation (Venom
 * Goblin's own Infest the City/Claim the Throne/Reign of Terror, `wave5/sm/venom-goblin/villain.ts`, fires
 * immediately after the natural activation completes, in the same `enemyActivations` step, so
 * `villain.test.ts`'s own `eventsDuring` — which stops at the next `stepChanged` — would still include it here).
 * Only safe for a boost ability with no nested ability resolution of its own (none of the boosts below call
 * `resolveSpecialsOf`). */
const eventsAfterAbility = (events: readonly GameEvent[], abilityId: string): readonly GameEvent[] => {
  const start = events.findIndex((e) => e.type === "abilityResolved" && String(e.abilityId) === abilityId);
  if (start < 0) return [];
  const end = events.findIndex((e, i) => i > start && e.type === "abilityResolved");
  return events.slice(start, end < 0 ? events.length : end);
};

/** Accepts the named optional interrupt/response (by ability id suffix); declines everything else —
 * `wave5/sm/venom/encounter-set.test.ts`'s own `accepting` precedent. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** `toHero` toggles form, so it must only be sent when the identity isn't hero already. */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

/** Puts P1's copy of the ally `code` into play under P1's control (test surgery) — `sandman/villain.test.ts`'s
 * own `allyIntoPlay` precedent. */
function allyIntoPlay(start: GameState, code: string): { readonly state: GameState; readonly ally: InstanceId } {
  const found = moveToHand(start, P1, code);
  const ally = found.ids[0]!;
  const seat = playerOf(found.state, P1);
  const state: GameState = {
    ...found.state,
    players: found.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: seat.hand.filter((id) => id !== ally), playArea: [...seat.playArea, ally] } : p,
    ),
  };
  return { state: patchInstance(state, ally, { controllerId: P1, faceup: true }), ally };
}

/** Puts Festering Mass into play in the villain area (test surgery), so it "is considered a [Symbiote] environment"
 * per its own constant while no other one is in play — `sandman/villain.test.ts`'s own `attachToHost` shape,
 * adapted for a card that just needs to be in play unattached. */
function festeringMassIntoPlay(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId("27124");
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error("no 27124 in the encounter deck or discard");
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true } },
    },
  };
}

describe("We Are One (27120)", () => {
  it("27120.we-are-one-action: Hero Action spends [energy][mental][physical] to discard this card", () => {
    // Energy (01088), Genius (01089, mental), Strength (01090, physical): the three basic resource cards, added
    // to Ghost-Spider's own deck (`symbiotic-strength.test.ts` 27164's own precedent).
    const config = ghostSpiderScenarioWithExtras("venom-goblin", {
      seed,
      modularSetIds: [encounterSetId("bomb_scare")],
      extraCodes: ["01088", "01089", "01090"],
    });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const villain = activeVillain(state).instanceId;
    const deckId = activeEncounterDeckId(state);
    const pile = state.encounterDecks[deckId]!;
    const weAreOneId =
      pile.deck.find((i) => state.instances[i]?.cardId === cardId("27120")) ??
      pile.discard.find((i) => state.instances[i]?.cardId === cardId("27120"));
    if (!weAreOneId) throw new Error("no We Are One in the encounter deck or discard");
    const attached: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((i) => i !== weAreOneId),
          discard: pile.discard.filter((i) => i !== weAreOneId),
        },
      },
      instances: {
        ...state.instances,
        [weAreOneId]: { ...state.instances[weAreOneId]!, faceup: true, attachedTo: villain },
        [villain]: {
          ...state.instances[villain]!,
          attachments: [...state.instances[villain]!.attachments, weAreOneId],
        },
      },
    };
    const hero = asHero(attached);
    const given = moveToHand(hero, P1, "01088", "01089", "01090");
    const paid = runWave5(
      given.state,
      use(
        P1,
        weAreOneId,
        "27120.we-are-one-action",
        given.ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inst(paid, weAreOneId).attachedTo).toBeNull();
  });
});

describe("Symbiotic Berserker (27121)", () => {
  it("27121.symbiotic-berserker-constant: gains quickstrike only while a [Symbiote] environment is in play", () => {
    const state = venomGoblin();
    const staged = stackEncounterDeck(state, "27121");
    const revealedDeck = staged.encounterDecks[activeEncounterDeckId(staged)]!;
    const berserkerId = revealedDeck.deck[0]!;
    const inPlay: GameState = {
      ...staged,
      villainArea: [...staged.villainArea, berserkerId],
      instances: { ...staged.instances, [berserkerId]: { ...staged.instances[berserkerId]!, faceup: true } },
      encounterDecks: {
        ...staged.encounterDecks,
        [activeEncounterDeckId(staged)]: { ...revealedDeck, deck: revealedDeck.deck.slice(1) },
      },
    };
    expect(hasKeyword(inPlay, berserkerId, "quickstrike", WAVE5_DEPS)).toBe(false);
    const withEnv = festeringMassIntoPlay(inPlay);
    expect(hasKeyword(withEnv.state, berserkerId, "quickstrike", WAVE5_DEPS)).toBe(true);
  });

  it("27121.boost: moves the glider counter to the main scheme with the most threat and places 1 threat there", () => {
    let state = venomGoblin();
    // Lower 1, Midtown 2 (glider), Upper 0 before step one (1-hero setup, `scenario.test.ts`); Upper patched above
    // both so it is the highest after step one's own +1 each.
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 5 });
    const upper = schemeNamed(state, "Upper Manhattan");
    const stacked = stackEncounterDeck(state, "27121");
    const { events } = driveEventsPicking(WAVE5_DEPS, stacked, accepting("27121.boost"), toHero(P1), endTurn(P1));
    // Isolated to the boost's own event window (`eventsAfterAbility`'s own doc comment): Venom Goblin's own Forced
    // Response fires immediately afterward in the same activation and moves the glider again (to the *least*-threat
    // scheme), which would otherwise undo this card's own "most threat" move before a final read could see it.
    const during = eventsAfterAbility(events, "27121.boost");
    expect(during.some((e) => e.type === "countersMoved" && e.counterType === "glider" && e.to === upper)).toBe(true);
    expect(during.some((e) => e.type === "threatPlaced" && e.schemeInstanceId === upper && e.amount === 1)).toBe(true);
  });
});

describe("Symbiotic Monstrosity (27122)", () => {
  it("27122.symbiotic-monstrosity-constant: gets +3 hit points only while a [Symbiote] environment is in play", () => {
    const state = venomGoblin();
    const staged = stackEncounterDeck(state, "27122");
    const deck = staged.encounterDecks[activeEncounterDeckId(staged)]!;
    const monstrosityId = deck.deck[0]!;
    const inPlay: GameState = {
      ...staged,
      villainArea: [...staged.villainArea, monstrosityId],
      instances: { ...staged.instances, [monstrosityId]: { ...staged.instances[monstrosityId]!, faceup: true } },
      encounterDecks: {
        ...staged.encounterDecks,
        [activeEncounterDeckId(staged)]: { ...deck, deck: deck.deck.slice(1) },
      },
    };
    const baseline = maxHitPoints(inPlay, monstrosityId, WAVE5_DEPS);
    const withEnv = festeringMassIntoPlay(inPlay);
    expect(maxHitPoints(withEnv.state, monstrosityId, WAVE5_DEPS)).toBe((baseline ?? 0) + 3);
  });

  it('27122.boost: "if this activation is an attack, this attack deals indirect damage" — divisible among P1\'s own characters', () => {
    const SPIDER_UK = "27012"; // Ghost-Spider precon ally.
    const withAlly = allyIntoPlay(asHero(venomGoblin()), SPIDER_UK);
    const stacked = stackEncounterDeck(withAlly.state, "27122");
    // Accepts the boost, then always assigns the indirect-damage prompt's shares to the ally first — an indirect
    // attack lets the attacked player divide its damage among every character they control (RRG 1.8 "Indirect
    // Damage", p. 24), which a plain (non-indirect) undefended attack could never do (it can only ever hit the
    // identity). Seeing any damage dealt to the ally by the villain's own activation proves the rule fired.
    const pick: Picker = (current) => {
      const choice = current.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "assignIndirectDamage") {
        const toAlly = choice.options.filter((o) => o.optionId.startsWith(`${withAlly.ally}#`));
        if (toAlly.length > 0) return toAlly.slice(0, choice.minSelections).map((o) => o.optionId);
      }
      return accepting("27122.boost")(current);
    };
    const { events } = driveEventsPicking(WAVE5_DEPS, stacked, pick, endTurn(P1));
    const villain = activeVillain(stacked).instanceId;
    const dealtToAlly = events.some(
      (e) => e.type === "damageDealt" && e.sourceInstanceId === villain && e.targetInstanceId === withAlly.ally,
    );
    expect(dealtToAlly).toBe(true);
  });
});

describe("Symbiotic Thrall (27123)", () => {
  it("27123.symbiotic-thrall-constant: gains patrol only while a [Symbiote] environment is in play", () => {
    const state = venomGoblin();
    const staged = stackEncounterDeck(state, "27123");
    const deck = staged.encounterDecks[activeEncounterDeckId(staged)]!;
    const thrallId = deck.deck[0]!;
    const inPlay: GameState = {
      ...staged,
      villainArea: [...staged.villainArea, thrallId],
      instances: { ...staged.instances, [thrallId]: { ...staged.instances[thrallId]!, faceup: true } },
      encounterDecks: {
        ...staged.encounterDecks,
        [activeEncounterDeckId(staged)]: { ...deck, deck: deck.deck.slice(1) },
      },
    };
    expect(hasKeyword(inPlay, thrallId, "patrol", WAVE5_DEPS)).toBe(false);
    const withEnv = festeringMassIntoPlay(inPlay);
    expect(hasKeyword(withEnv.state, thrallId, "patrol", WAVE5_DEPS)).toBe(true);
  });

  it("27123.boost: places 1 threat on each main scheme without the glider counter", () => {
    const state = venomGoblin(); // glider on Midtown Manhattan
    const lower = schemeNamed(state, "Lower Manhattan");
    const upper = schemeNamed(state, "Upper Manhattan");
    const stacked = stackEncounterDeck(state, "27123");
    const { events } = driveEventsPicking(WAVE5_DEPS, stacked, accepting("27123.boost"), toHero(P1), endTurn(P1));
    // Isolated to the boost's own event window (`eventsAfterAbility`'s own doc comment): Venom Goblin's own Forced
    // Response fires immediately afterward in the same activation and can place its own threat on these same
    // schemes too, which would otherwise be indistinguishable from this card's own contribution.
    const during = eventsAfterAbility(events, "27123.boost");
    const placedOn = (id: string): number =>
      during
        .filter((e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced")
        .filter((e) => e.schemeInstanceId === id)
        .reduce((sum, e) => sum + e.amount, 0);
    expect(placedOn(lower)).toBe(1);
    expect(placedOn(upper)).toBe(1);
  });
});

describe("Festering Mass (27124)", () => {
  it('27124.festering-mass-constant: "considered a [Symbiote] environment" only while no other one is in play', () => {
    const state = venomGoblin();
    const withMass = festeringMassIntoPlay(state);
    // Symbiotic Berserker's own constant reads "a [Symbiote] environment in play" (its own precedent above), the
    // cleanest existing probe for this: staged alone with Festering Mass, it gains quickstrike.
    const staged = stackEncounterDeck(withMass.state, "27121");
    const deck = staged.encounterDecks[activeEncounterDeckId(staged)]!;
    const berserkerId = deck.deck[0]!;
    const inPlay: GameState = {
      ...staged,
      villainArea: [...staged.villainArea, berserkerId],
      instances: { ...staged.instances, [berserkerId]: { ...staged.instances[berserkerId]!, faceup: true } },
      encounterDecks: {
        ...staged.encounterDecks,
        [activeEncounterDeckId(staged)]: { ...deck, deck: deck.deck.slice(1) },
      },
    };
    expect(hasKeyword(inPlay, berserkerId, "quickstrike", WAVE5_DEPS)).toBe(true);
  });

  it("27124.boost: reveals this card", () => {
    const state = venomGoblin();
    const stacked = stackEncounterDeck(state, "27124");
    const revealed = settle(
      runWave5(stacked, toHero(P1), endTurn(P1)),
      accepting("27124.boost"),
      undefined,
      WAVE5_DEPS,
    );
    const id = instancesOf(revealed, "27124")[0]!;
    expect(inst(revealed, id).faceup).toBe(true);
  });
});

describe("Joy Ride (27125)", () => {
  it('27125.when-revealed: moves the glider to the main scheme with the most threat and resolves that scheme\'s "Special" ability', () => {
    let state = venomGoblin();
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: 5 }); // now the highest-threat scheme
    // End-of-turn discards down to the hero form's own hand size limit before the villain phase runs, independent of
    // Joy Ride (Ghost-Spider's alter-ego hand size is larger, so this has to read the hero-form limit, not the
    // opening alter-ego hand) — the baseline for "1 more card discarded by the Special" is that capped size.
    const hero = runWave5(state, toHero(P1));
    const beforeSpecial = Math.min(playerOf(hero, P1).hand.length, handSize(hero, P1, WAVE5_DEPS));
    const stacked = stackEncounterDeck(hero, "01186", "27125");
    const revealed = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(gliderOn(revealed)).toBe("Upper Manhattan");
    // Upper Manhattan's own Special (27119a): "Discard 1 card from your hand."
    expect(playerOf(revealed, P1).hand.length).toBe(beforeSpecial - 1);
  });
});

/** The three Manhattan stages' own printed Special ability ids (`main-scheme.ts`), keyed by their own ability id. */
const MANHATTAN_SPECIAL_IDS = new Set([
  "27117a.lower-manhattan-special",
  "27118a.midtown-manhattan-special",
  "27119a.upper-manhattan-special",
]);

describe("Spreading Panic (27126)", () => {
  it('27126.when-revealed: resolves the "Special" ability of the scheme with the glider counter', () => {
    const state = venomGoblin(); // glider on Midtown Manhattan at setup
    const stacked = stackEncounterDeck(state, "01186", "27126");
    const { events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    const revealedIdx = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === "27126.when-revealed");
    expect(revealedIdx).toBeGreaterThanOrEqual(0);
    // The glider can already have moved by the time Spreading Panic itself reveals: Venom Goblin's own Forced
    // Response (Infest the City et al., `wave5/sm/venom-goblin/villain.ts`) fires earlier in this same round, on
    // his own natural activation. Read wherever it actually is at reveal time — the most recent `countersMoved`
    // before this — rather than assuming the Midtown Manhattan it started on.
    const priorMoves = events
      .slice(0, revealedIdx)
      .filter(
        (e): e is Extract<GameEvent, { type: "countersMoved" }> =>
          e.type === "countersMoved" && e.counterType === "glider",
      );
    const gliderSchemeId = priorMoves.length > 0 ? priorMoves.at(-1)!.to : schemeNamed(stacked, "Midtown Manhattan");
    // The very next ability to resolve after Spreading Panic's own reveal is that scheme's own printed Special —
    // proven by ability id and by instance (so it's specifically the glider's scheme, not merely *a* main scheme).
    const nextAbility = events
      .slice(revealedIdx + 1)
      .find((e): e is Extract<GameEvent, { type: "abilityResolved" }> => e.type === "abilityResolved");
    expect(nextAbility?.instanceId).toBe(gliderSchemeId);
    expect(nextAbility && MANHATTAN_SPECIAL_IDS.has(String(nextAbility.abilityId))).toBe(true);
  });

  it('27126.boost: resolves the "Special" ability of the scheme with the glider counter', () => {
    const state = venomGoblin();
    const stacked = stackEncounterDeck(state, "27126");
    const midtown = schemeNamed(stacked, "Midtown Manhattan");
    const { events } = driveEventsPicking(WAVE5_DEPS, stacked, accepting("27126.boost"), toHero(P1), endTurn(P1));
    const fromMidtown = events.reduce(
      (sum, e) => (e.type === "damageDealt" && e.sourceInstanceId === midtown ? sum + e.amount : sum),
      0,
    );
    expect(fromMidtown).toBeGreaterThanOrEqual(2);
  });
});
