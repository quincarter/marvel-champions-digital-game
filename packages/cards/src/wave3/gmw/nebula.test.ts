import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  characterProfile,
  damageTakenAfterConstants,
  hasKeyword,
  mainSchemeValue,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  P1,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { wave3Scenario } from "../setup.js";
import { encounterCardInVillainArea, playFromHand, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/** Did this exact ability id's `effects` resolve, anywhere in the event log (`gmw/badoon.test.ts`'s own helper —
 * needed here for the same reason: a Technique's Boost body fires both `.boost` and `.special` in one activation,
 * and neither always leaves a state change that's simple to assert on alone). */
const resolvedAbility = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => e.type === "abilityResolved" && (e as { readonly abilityId?: string }).abilityId === abilityId);

/** Nebula (docs/phase7-wave3.md §2.2), standard mode: the villain Nebula I/II, The Art of Evasion, Nebula's Ship,
 * the five Technique attachments, Lethal Intent, Barrel Roll, Combat Ready, the Space Pirates modular set, and the
 * Power Stone modular card (shared with Ronan the Accuser). */
const nebula = (opts: { readonly difficulty?: "standard" | "expert" } = {}) =>
  startWave3Game(
    wave3Scenario("nebula", {
      players: [{ starterDeckId: "groot-protection" }],
      seed: 2026,
      ...(opts.difficulty ? { difficulty: opts.difficulty } : {}),
    }),
  );

/** Nebula's own stage, changed directly (bypassing the combat that would normally reach it) — the same
 * `atVillainStage` shape `gmw/badoon.test.ts` uses for Drang. */
const atNebulaStage = (state: GameState, stageIndex: number): GameState =>
  patchInstance(
    { ...state, villains: state.villains.map((v) => ({ ...v, stageIndex })) },
    state.villains[0]!.instanceId,
    { damage: 0 },
  );

/** Attaches an encounter-deck card straight to the villain (surgery: added to the villain's own `attachments`
 * array and given `attachedTo`, the shape `power-stone.test.ts`'s own `attached()` helper uses) — for testing a
 * Technique's `constant` ability without going through the setup's own discard-and-attach draw. */
function attachToVillain(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const villain = state.villains[0]!.instanceId;
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [villain]: { ...inst(state, villain), attachments: [...inst(state, villain).attachments, id] },
        [id]: { ...inst(state, id), attachedTo: villain, faceup: true },
      },
    },
  };
}

describe("Nebula 1A Setup (16091a.setup)", () => {
  it("puts Nebula's Ship and the Milano into play, and never leaves a discarded Technique undiscarded-but-unattached", () => {
    const state = nebula();
    const [ship] = instancesOf(state, "16093");
    const [milano] = instancesOf(state, "16142");
    expect(ship).toBeDefined();
    expect(state.villainArea).toContain(ship);
    expect(milano).toBeDefined();
    expect(state.players.some((p) => p.playArea.includes(milano!))).toBe(true);
    expect(inst(state, milano!).controllerId).toBe(P1);
    // "Discard the top 2[per_hero] cards … then attach each Technique attachment discarded this way to Nebula":
    // whichever cards the discard drew, no Technique is left sitting in the discard pile (module docblock).
    const TECHNIQUES = ["16094", "16095", "16096", "16097", "16098"];
    const discard = activeEncounterDeck(state).discard;
    const discardedTechnique = discard.some((id) => TECHNIQUES.includes(state.instances[id]!.cardId as string));
    expect(discardedTechnique).toBe(false);
    expect(discard.length).toBe(2); // solo: 2[per_hero] = 2
  });

  it("the Power Stone (16149) is auto-attached to Nebula by its own Setup keyword, before this ability's own text runs", () => {
    const state = nebula();
    const [stone] = instancesOf(state, "16149");
    expect(stone).toBeDefined();
    expect(inst(state, stone!).attachedTo).toBe(state.villains[0]!.instanceId);
  });
});

describe("The Art of Evasion 1B — X is the number of evasion counters on Nebula's Ship (16091b.the-art-of-evasion-constant)", () => {
  it("the main scheme's acceleration tracks Nebula's Ship's evasion counters", () => {
    const state = nebula();
    const [ship] = instancesOf(state, "16093");
    const withCounters = patchInstance(state, ship!, { counters: { evasion: 4 } });
    expect(mainSchemeValue(withCounters, "acceleration", WAVE3_DEPS)).toBe(4);
  });
});

describe("Warp Drive Initiated (16092a.when-revealed, 16092b.warp-drive-initiated-constant)", () => {
  it("advancing to stage 2 places 2 evasion counters on Nebula's Ship, discards cards scaled by the total, and its own acceleration keeps tracking evasion counters", () => {
    const state = nebula();
    const [ship] = instancesOf(state, "16093");
    const scheme = state.mainScheme.instanceId;
    // Patch stage 1's threat 1 below its target (perPlayer 6, solo), so this villain phase's own step-one
    // placement (from Nebula's Ship's own accumulated evasion counters) completes it and pushes 2A's real When
    // Revealed frames — a direct `stageIndex` patch would skip that push (`gmw/badoon.test.ts`'s own documented
    // caveat for the same shape).
    const primed = patchInstance(state, scheme, { threat: 5 });
    const evasionBefore = inst(primed, ship!).counters.evasion ?? 0;
    const deckBefore = playerOf(primed, P1).deck.length;
    const { state: after } = driveEvents(WAVE3_DEPS, primed, endTurn());
    expect(after.mainScheme.stageIndex).toBe(1); // Warp Drive Initiated
    const evasionAfter = inst(after, ship!).counters.evasion ?? 0;
    expect(evasionAfter).toBeGreaterThanOrEqual(evasionBefore + 2);
    expect(playerOf(after, P1).deck.length).toBeLessThan(deckBefore);
    expect(mainSchemeValue(after, "acceleration", WAVE3_DEPS)).toBe(evasionAfter);
  });
});

describe("Nebula's Ship (16093)", () => {
  it("Forced Interrupt: gains 1 evasion counter when the villain phase begins (16093.nebulas-ship-forced-interrupt)", () => {
    const state = nebula();
    const [ship] = instancesOf(state, "16093");
    const before = inst(state, ship!).counters.evasion ?? 0;
    const after = settle(runWave3(state, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(after, ship!).counters.evasion ?? 0).toBeGreaterThanOrEqual(before + 1);
  });

  it('"Shoot the Thrusters!": exhaust the Milano and spend resources to remove that many evasion counters (16093.nebulas-ship-constant)', () => {
    const state = nebula();
    const [ship] = instancesOf(state, "16093");
    const [milano] = instancesOf(state, "16142");
    const withCounters = patchInstance(state, ship!, { counters: { evasion: 5 } });
    const hand = playerOf(withCounters, P1).hand.filter((id) => withCounters.instances[id]?.cardId !== cardId("16142"));
    const paying = hand.slice(0, 2);
    const used = runWave3(
      withCounters,
      use(
        P1,
        ship!,
        "16093.nebulas-ship-constant",
        paying.map((fromHand) => ({ fromHand })),
        { exhausted: [milano!] },
      ),
    );
    expect(inst(used, milano!).exhausted).toBe(true);
    expect(inst(used, ship!).counters.evasion).toBe(5 - paying.length);
  });
});

describe("Nebula I (16088) — firstRevealGainsSurge and the Forced Interrupt", () => {
  it("resolves Special on each attached Technique, then discards all of them (16088.nebula-forced-interrupt)", () => {
    const state = nebula(); // starts on Nebula I
    const { state: withA, id: cutthroat } = attachToVillain(state, "16094"); // Special: place 1 threat
    const { state: withBoth, id: wideStance } = attachToVillain(withA, "16098"); // Special: discard 1 from hand
    const threatBefore = mainThreat(withBoth);
    const handBefore = playerOf(withBoth, P1).hand.length;
    const after = settle(runWave3(withBoth, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(mainThreat(after)).toBeGreaterThanOrEqual(threatBefore + 1);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1);
    expect(inst(after, cutthroat).attachedTo).toBeNull();
    expect(inst(after, wideStance).attachedTo).toBeNull();
  });

  it("the first Technique attachment revealed each round gains surge (16088.nebula-constant)", () => {
    const state = nebula();
    const staged = stackEncounterDeck(state, "01186", "16094"); // filler absorbs the boost draw, `16094` is revealed
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(events.some((e) => e.type === "surgeGranted")).toBe(true);
  });
});

describe("Nebula II (16089) — resolves Special on each, then chooses and discards exactly 1", () => {
  // 16089.nebula-constant is the same firstRevealGainsSurge text as 16088.nebula-constant (module docblock's
  // `firstTechniqueGainsSurge()`, shared across all three stages), already covered by the 16088 test above.
  it("(16089.nebula-forced-interrupt, 16089.nebula-constant)", () => {
    const state = atNebulaStage(nebula(), 1);
    const { state: withA, id: a } = attachToVillain(state, "16094");
    const { state: withBoth, id: b } = attachToVillain(withA, "16097");
    const after = settle(runWave3(withBoth, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    const stillAttached = [a, b].filter((id) => inst(after, id).attachedTo !== null);
    expect(stillAttached.length).toBe(1);
  });

  // `resolveSpecials` on an empty `TECHNIQUE_IN_PLAY` is vacuously true, so it can't leave the "then" itself
  // pre-then-unresolved with the current engine; this only exercises the required `chooseTarget` finding nothing
  // inside the "then" (RRG 1.8 "Choose (Game Element)", p. 12) — no attachment to discard, no crash.
  it("with no Technique attachment in play, the required choose-and-discard finds nothing and discards nothing", () => {
    const state = atNebulaStage(nebula(), 1);
    const { events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(events).toContainEqual({ type: "choiceFoundNothing", slot: "technique" });
    expect(events.some((e) => e.type === "cardDiscardedFromPlay")).toBe(false);
  });
});

describe("Nebula III (16090) — you may remove the top card of your deck to choose-and-discard 1", () => {
  // 16090.nebula-constant: same shared firstRevealGainsSurge text, already covered by the 16088 test above.
  it("(16090.nebula-forced-interrupt, 16090.nebula-constant)", () => {
    const state = atNebulaStage(nebula(), 2);
    const { state: withTechnique, id: a } = attachToVillain(state, "16094");
    // Cutthroat Ambition's own Special places 1 threat on the main scheme; reset its threat well below target
    // first, so this one villain phase can't also complete/advance the main scheme (Warp Drive Initiated 2A's own
    // "discard the top 2 cards of each player deck… for each evasion counter" would otherwise confound the
    // "removed exactly 1 card" assertion below with a much larger, unrelated discard).
    const withA = patchInstance(withTechnique, withTechnique.mainScheme.instanceId, { threat: 0 });
    const deckBefore = playerOf(withA, P1).deck.length;
    const after = settle(
      runWave3(withA, endTurn()),
      (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const hit = choice.options.find((o) => o.label.startsWith("Remove the top card"));
        return hit ? [hit.optionId] : firstLegal(s);
      },
      undefined,
      WAVE3_DEPS,
    );
    expect(playerOf(after, P1).deck.length).toBe(deckBefore - 1);
    expect(inst(after, a).attachedTo).toBeNull();
  });
});

describe("Techniques — constants (16094-16098)", () => {
  it("Cutthroat Ambition: Nebula cannot take more than 5 damage from a single attack (16094.cutthroat-ambition-constant)", () => {
    const { state } = attachToVillain(nebula(), "16094");
    const villain = state.villains[0]!.instanceId;
    expect(damageTakenAfterConstants(state, WAVE3_DEPS, villain, 10, true)).toBe(5);
  });

  it("Evasive Maneuvering: Nebula gains stalwart (16095.evasive-maneuvering-constant)", () => {
    const { state } = attachToVillain(nebula(), "16095");
    const villain = state.villains[0]!.instanceId;
    expect(hasKeyword(state, villain, "stalwart", WAVE3_DEPS)).toBe(true);
  });

  it("Unyielding Persistence: Nebula gains stalwart (16096.unyielding-persistence-constant)", () => {
    const { state } = attachToVillain(nebula(), "16096");
    const villain = state.villains[0]!.instanceId;
    expect(hasKeyword(state, villain, "stalwart", WAVE3_DEPS)).toBe(true);
  });

  it("Weapon Mastery: Nebula gains retaliate 1 (16097.weapon-mastery-constant)", () => {
    const { state } = attachToVillain(nebula(), "16097");
    const villain = state.villains[0]!.instanceId;
    expect(hasKeyword(state, villain, "retaliate", WAVE3_DEPS)).toBe(true);
  });

  it("Wide Stance: reduce the damage Nebula takes from each attack by 1 (16098.wide-stance-constant)", () => {
    const { state } = attachToVillain(nebula(), "16098");
    const villain = state.villains[0]!.instanceId;
    expect(damageTakenAfterConstants(state, WAVE3_DEPS, villain, 4, true)).toBe(3);
  });
});

describe("Techniques — Boost: attach and resolve Special (16094-16098 .special/.boost)", () => {
  const boostedAsVillainDraw = (state: GameState, code: string): GameState => stackEncounterDeck(state, code);

  it("Cutthroat Ambition: attaches to Nebula and places 1 threat on the main scheme (16094.cutthroat-ambition-special, 16094.boost)", () => {
    const base = nebula();
    // Cutthroat Ambition prints `quantityInSet: 2` — find *this specific* copy before staging (the same lookup
    // `stackEncounterDeck` itself does), since `instancesOf` would return either physical copy ambiguously
    // (docs/card-scripting-process.md §6c's own "instancesOf returns every printed copy" trap).
    const deckId = activeEncounterDeckId(base);
    const technique = base.encounterDecks[deckId]!.deck.find((i) => base.instances[i]?.cardId === cardId("16094"))!;
    const state = boostedAsVillainDraw(base, "16094");
    const threatBefore = mainThreat(state);
    const { state: after, events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(resolvedAbility(events, "16094.boost")).toBe(true);
    expect(resolvedAbility(events, "16094.cutthroat-ambition-special")).toBe(true);
    expect(inst(after, technique).attachedTo).toBe(after.villains[0]!.instanceId);
    expect(mainThreat(after)).toBeGreaterThanOrEqual(threatBefore + 1);
  });

  it("Evasive Maneuvering: stuns you (16095.evasive-maneuvering-special, 16095.boost)", () => {
    const state = boostedAsVillainDraw(nebula(), "16095");
    const { state: after, events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(resolvedAbility(events, "16095.boost")).toBe(true);
    expect(inst(after, identityOf(after)).statuses.stunned).toBeGreaterThanOrEqual(1);
  });

  it("Unyielding Persistence: gives Nebula a tough status card (16096.unyielding-persistence-special, 16096.boost)", () => {
    const state = boostedAsVillainDraw(nebula(), "16096");
    const { state: after, events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(resolvedAbility(events, "16096.boost")).toBe(true);
    expect(inst(after, after.villains[0]!.instanceId).statuses.tough).toBeGreaterThanOrEqual(1);
  });

  it("Weapon Mastery: you take 1 damage (16097.weapon-mastery-special, 16097.boost)", () => {
    const state = boostedAsVillainDraw(nebula(), "16097");
    const damageBefore = inst(state, identityOf(state)).damage;
    const { state: after, events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(resolvedAbility(events, "16097.boost")).toBe(true);
    expect(inst(after, identityOf(after)).damage).toBeGreaterThanOrEqual(damageBefore + 1);
  });

  it("Wide Stance: discards 1 card at random from your hand (16098.wide-stance-special, 16098.boost)", () => {
    const state = boostedAsVillainDraw(nebula(), "16098");
    const handBefore = playerOf(state, P1).hand.length;
    const { state: after, events } = driveEvents(WAVE3_DEPS, state, endTurn());
    expect(resolvedAbility(events, "16098.boost")).toBe(true);
    expect(playerOf(after, P1).hand.length).toBeLessThan(handBefore);
  });
});

describe("Lethal Intent (16099)", () => {
  it("When Revealed: discards down to a Technique attachment and reveals it (16099.when-revealed)", () => {
    const state = nebula();
    // One filler absorbs Nebula's own boost draw (docs/card-scripting-process.md's `stackSetAsideBehindBoost`
    // lesson); Lethal Intent (16099) itself is then the card dealt and revealed. It finds its own Technique by
    // discarding down through whatever the (already-shuffled) remaining deck holds — no further staging needed.
    const staged = stackEncounterDeck(state, "01186", "16099");
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(events.some((e) => e.type === "encounterCardRevealed")).toBe(true);
  });
});

describe("Barrel Roll (16100)", () => {
  it("When Revealed: places 1 evasion counter on Nebula's Ship (16100.when-revealed)", () => {
    const state = nebula();
    const [ship] = instancesOf(state, "16093");
    const before = inst(state, ship!).counters.evasion ?? 0;
    const staged = stackEncounterDeck(state, "01186", "16100");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(inst(after, ship!).counters.evasion ?? 0).toBeGreaterThan(before);
  });

  it("[star] Boost: places 1 evasion counter on Nebula's Ship (16100.boost)", () => {
    const state = nebula();
    const [ship] = instancesOf(state, "16093");
    const before = inst(state, ship!).counters.evasion ?? 0;
    const staged = stackEncounterDeck(state, "16100");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(inst(after, ship!).counters.evasion ?? 0).toBeGreaterThan(before);
  });
});

describe("Combat Ready (16101)", () => {
  it("When Revealed: discards down to a Technique, reveals it, then resolves its Special (16101.when-revealed)", () => {
    const state = nebula();
    // One filler absorbs the boost draw; Combat Ready (16101) is dealt and revealed, then its own discard-until
    // finds Weapon Mastery (16097) staged immediately below it.
    const staged = stackEncounterDeck(state, "01186", "16101", "16097");
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(events.some((e) => e.type === "encounterCardRevealed")).toBe(true);
    expect(resolvedAbility(events, "16097.weapon-mastery-special")).toBe(true);
  });
});

/** Engages an encounter-deck minion with a player directly (surgery mirroring the `engage` effect's own
 * `moveCard`/`engagedWith` update): into the player's `playArea`, `engagedWith` set, no controller. */
function engageMinion(
  state: GameState,
  code: string,
  player = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id = pile.deck.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, engagedWith: player, controllerId: null },
      },
    },
  };
}

describe("Space Pirates modular (16138-16141)", () => {
  it("Pirate Commander: after it attacks and damages you, removes 1 random hand card from the game (16138.pirate-commander-forced-response)", () => {
    const hero = runWave3(nebula(), toHero());
    const { state: engaged } = engageMinion(hero, "16138");
    const handBefore = playerOf(engaged, P1).hand.length;
    const after = settle(runWave3(engaged, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(playerOf(after, P1).hand.length).toBeLessThan(handBefore);
  });

  it("[star] Boost: gives an additional boost card for this activation (16138.boost)", () => {
    const hero = runWave3(nebula(), toHero());
    const { state: engaged } = engageMinion(hero, "16139"); // an ordinary engaged minion draws the boost
    const staged = stackEncounterDeck(engaged, "16138"); // Pirate Commander itself drawn as that minion's boost card
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(resolvedAbility(events, "16138.boost")).toBe(true);
  });

  it("Pirate Lackey: after it attacks and damages you, removes the top card of your deck from the game (16139.pirate-lackey-forced-response)", () => {
    const hero = runWave3(nebula(), toHero());
    const { state: engaged } = engageMinion(hero, "16139");
    const deckBefore = playerOf(engaged, P1).deck.length;
    const after = settle(runWave3(engaged, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(playerOf(after, P1).deck.length).toBeLessThan(deckBefore);
  });

  it("[star] Boost: gives an additional boost card for this activation (16139.boost)", () => {
    const hero = runWave3(nebula(), toHero());
    const { state: engaged } = engageMinion(hero, "16138");
    const staged = stackEncounterDeck(engaged, "16139");
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(resolvedAbility(events, "16139.boost")).toBe(true);
  });

  it("Sound the Alarms: each enemy gets +1 ATK while it's in play (16140.sound-the-alarms-constant)", () => {
    const state = nebula();
    const villain = state.villains[0]!.instanceId;
    const atkBefore = characterProfile(state, villain, WAVE3_DEPS)!.atk;
    const { state: withSideScheme } = encounterCardInVillainArea(state, "16140");
    const atkAfter = characterProfile(withSideScheme, villain, WAVE3_DEPS)!.atk;
    expect(atkAfter).toBe(atkBefore + 1);
  });

  it("[star] Boost: reveals this card (16140.boost)", () => {
    const state = nebula();
    const staged = stackEncounterDeck(state, "16140");
    const { events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(resolvedAbility(events, "16140.boost")).toBe(true);
  });

  it("Honor Among Thieves: discards down to a Criminal minion, reveals it, gives it tough and the villain a boost card (16141.when-revealed)", () => {
    const base = nebula();
    // One filler absorbs the boost draw; Honor Among Thieves (16141) is dealt and revealed, then its own
    // discard-until finds Pirate Lackey (16139) staged immediately below it. Pirate Lackey prints
    // `quantityInSet: 4`, so track this exact staged copy rather than `instancesOf(...)[0]` (ambiguous among the
    // four physical copies — docs/card-scripting-process.md §6c's own trap).
    const deckId = activeEncounterDeckId(base);
    const lackey = base.encounterDecks[deckId]!.deck.find((i) => base.instances[i]?.cardId === cardId("16139"))!;
    const staged = stackEncounterDeck(base, "01186", "16141", "16139");
    const { state: after, events } = driveEvents(WAVE3_DEPS, staged, endTurn());
    expect(events.some((e) => e.type === "encounterCardRevealed")).toBe(true);
    expect(inst(after, lackey).statuses.tough).toBeGreaterThanOrEqual(1);
    expect(inst(after, after.villains[0]!.instanceId).boostCards.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Power Stone (16149) — shared modular card, first scripted for this scenario", () => {
  it("moves to whichever hero or villain deals attached character 3+ damage in a single attack (16149.power-stone-forced-response)", () => {
    const hero = runWave3(nebula(), toHero());
    const [stone] = instancesOf(hero, "16149");
    expect(inst(hero, stone!).attachedTo).toBe(hero.villains[0]!.instanceId);
    const groot = identityOf(hero);
    // Root Stomp (16005.root-stomp-action, Groot's own event, already scripted and tested in `groot-kit.test.ts`):
    // a 5-damage attack, well past the Power Stone's 3-damage threshold, against the only enemy in play — reused
    // here rather than patching a stat, since ATK isn't stored per-instance.
    const { state: attacked } = playFromHand(hero, "16005", 2);
    expect(inst(attacked, stone!).attachedTo).toBe(groot);
  });
});
