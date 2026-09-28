import { cardId, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  activeVillain,
  applyCommand,
  canAttack,
  cardsInPlay,
  handSize,
  legalActions,
  statBonus,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  driveEvents,
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand as playFromHandFor,
} from "../../testing/staging.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { ironheartScenario, ironheartScenarioWithExtras } from "./support.js";

/**
 * The Zzzax modular set (`ironheart` 29033–29040, `zzzax.ts`). Games sit at Core's Rhino, Ironheart's own precon
 * with the Zzzax modular set added (`ironheartScenario`/`ironheartScenarioWithExtras`, `wave5Scenario` falls back
 * to `coreScenario(..., { cardPool: WAVE5_CARDS })` for a non-`sm` scenario id, `nova/armadillo.test.ts`'s own
 * "a non-Core modular set needs the pool passed both times" precedent already covered by that fallback). Photon
 * Beam (29006, `[energy]`, her own precon at 3 copies) and Falcon (29015, `[energy]`, 1 copy) are real deck cards,
 * used throughout to give hand/in-play cards a known printed `[energy]` icon count without extra surgery;
 * Propulsion Jets (29013, `[physical]`, 1 copy) is used where a *non*-energy hand card is needed (Haywire's own
 * override). Bombshell (29033) and Wasp (29034) are not in her real precon (Zzzax modular allies), so
 * `ironheartScenarioWithExtras` (deck legality off) carries them; Haywire (29038) and Air Static (29039) are
 * encounter cards (`encounterSetIds`, `attachesTo`/no printed cost) and enter play by being revealed. They're
 * shuffled into the encounter deck (not a set-aside nemesis card), so `revealFromEncounterDeck`/
 * `stageNemesisCardForReveal` is the wrong tool (throws "no `<code>` set aside") — this file's own `reveal` stacks
 * them on top instead, `nova/armadillo.test.ts`'s own `stageForReveal` precedent. Haywire's printed "Attach to your
 * identity" is data the engine's own implicit attach already handles at reveal (`armadillo.ts`'s own "Rollin',
 * Rollin'" docblock precedent: `attachesTo` present needs no scripted attach step, only the fallback a card's own
 * text adds — Haywire has none, and no `when-revealed` ability is registered for it).
 *
 * **Pinpoint (29035)** is exercised on each route a player card takes from play to a discard pile: an ally's defeat
 * (Vivian 29024, defeated by her own consequential damage after attacking), and an upgrade (Propulsion Jets 29013) or a
 * support (Tony Stark A.I. 29011) discarded by Core's Caught Off Guard (01188, Standard set: "Discard an upgrade or
 * support you control"), revealed in the villain phase — so Pinpoint is ready again there, whatever she did on the turn.
 */
const ironheartVsRhino = (seed = 1) =>
  startWave5Game(ironheartScenario("rhino", { seed, modularSetIds: [encounterSetId("zzzax")] }));
const ironheartVsRhinoWithExtras = (seed: number, extraCodes: readonly string[]) =>
  startWave5Game(ironheartScenarioWithExtras("rhino", { seed, extraCodes, modularSetIds: [encounterSetId("zzzax")] }));

/** `toHero` toggles form; only send it when the identity isn't hero already. */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

/**
 * Replaces `player`'s hand with exactly these cards (test-only surgery, `wave5/nova/obligation-nemesis.test.ts`'s
 * own `setHand` precedent, copied): needed for an exact "total printed [energy] resources in hand" count, since a
 * freshly-dealt hand otherwise holds whatever the seeded mulligan kept.
 */
function setHand(state: GameState, player: PlayerId, codes: readonly string[]): GameState {
  const owner = playerOf(state, player);
  const wanted: InstanceId[] = [];
  for (const code of codes) {
    const want = cardId(code);
    const found =
      owner.hand.find((id) => state.instances[id]?.cardId === want && !wanted.includes(id)) ??
      owner.deck.find((id) => state.instances[id]?.cardId === want && !wanted.includes(id)) ??
      owner.discard.find((id) => state.instances[id]?.cardId === want && !wanted.includes(id));
    if (!found) throw new Error(`${player} has no ${code} in hand, deck, or discard`);
    wanted.push(found);
  }
  const displaced = owner.hand.filter((id) => !wanted.includes(id));
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: wanted, deck: [...displaced, ...p.deck] } : p,
    ),
  };
}

/**
 * Non-energy filler (`[mental]`), padding a hand to exactly its printed size: ending a solo player's turn (which
 * every `reveal` does) runs "discard down to hand size" then "draw back up to hand size" (RRG "Player Phase") before
 * the villain phase's own encounter-card reveal, so a hand left short of full size is topped up from the deck with
 * whatever `setHand` displaced there — contaminating an exact "[energy] resources in hand" count. Filling to exactly
 * `handSize` (both deckLimit 3, so 6 covers a hero hand) makes that top-up draw zero cards.
 */
const FILLER_CODES = ["29017", "29020"] as const;
function setHandFull(state: GameState, codes: readonly string[], player: PlayerId = P1): GameState {
  const size = handSize(state, player, WAVE5_DEPS);
  const need = Math.max(0, size - codes.length);
  const fillers = Array.from({ length: need }, (_, i) => FILLER_CODES[i % FILLER_CODES.length]!);
  return setHand(state, player, [...codes, ...fillers]);
}

/** The instance of `code` a player currently holds in hand. */
const inHand = (state: GameState, code: string, player: PlayerId = P1): InstanceId =>
  playerOf(state, player).hand.find((id) => state.instances[id]?.cardId === cardId(code))!;

/**
 * A minion engaged with `player`, in their own `playArea` — not `villainArea`, which the villain phase's own
 * activation step never reads (`nova/armadillo.test.ts`'s own `engagedMinion` precedent, copied).
 */
function engagedMinion(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const placed = encounterCardInVillainArea(state, code);
  return {
    id: placed.id,
    state: {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      players: placed.state.players.map((p) =>
        p.playerId === player ? { ...p, playArea: [...p.playArea, placed.id] } : p,
      ),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...inst(placed.state, placed.id), engagedWith: player },
      },
    },
  };
}

/** Whether `legalActions` offers P1 this ability right now (`sm/modulars/osborn-tech.test.ts`'s own `offers`). */
function offers(state: GameState, abilityId: string): boolean {
  const actions = legalActions(state, P1, WAVE5_DEPS);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === abilityId);
}

/**
 * Reveals `code` (a Zzzax modular card, shuffled into the encounter deck, not a set-aside nemesis card —
 * `revealFromEncounterDeck`/`stageNemesisCardForReveal` is the wrong tool for it): `stackEncounterDeck` with a
 * 0-icon filler ahead of it (`nova/armadillo.test.ts`'s own `stageForReveal` precedent: the villain phase's own
 * boost draw, one per activation, reads the top of the same deck first, and with no minion engaged only the
 * villain's own activation draws one) and `driveEvents`, which also collects the villain phase's own events —
 * including whatever the villain itself does that phase, so a damage assertion must be scoped to this card's own
 * `damageDealt` events (`dealtBy`), not the identity's total damage.
 */
function reveal(
  state: GameState,
  code: string,
): { readonly state: GameState; readonly id: InstanceId; readonly events: readonly GameEvent[] } {
  const stacked = stackEncounterDeck(state, "01186", code);
  // With more than one copy in the pool (Haywire, Zzzap!), `instancesOf(after, code)[0]` after the reveal is not
  // reliably *this* copy — the topmost matching instance in the freshly-stacked deck is the one `endTurn` deals,
  // so it is captured here, before anything moves.
  const deckId = activeEncounterDeckId(stacked);
  const id = stacked.encounterDecks[deckId]!.deck.find(
    (candidate) => stacked.instances[candidate]?.cardId === cardId(code),
  )!;
  const { state: after, events } = driveEvents(WAVE5_DEPS, stacked, endTurn(P1));
  return { state: after, id, events };
}

/** The total `damageDealt` to `targetId` whose `sourceInstanceId` is `sourceId`, from a `reveal`'s own events. */
const dealtBy = (events: readonly GameEvent[], sourceId: InstanceId, targetId: InstanceId): number =>
  events
    .filter(
      (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
        e.type === "damageDealt" && e.sourceInstanceId === sourceId && e.targetInstanceId === targetId,
    )
    .reduce((sum, e) => sum + e.amount, 0);

describe("Bombshell (29033)", () => {
  it("29033.bombshell-constant: grants divideBasicPower, splitting her attack among enemies as evenly as possible", () => {
    const hero = asHero(ironheartVsRhinoWithExtras(1, ["29033"]));
    const played = playFromHand(hero, "29033", 4);
    const villain = activeVillain(played.state).instanceId;
    const zzzax = engagedMinion(played.state, "29037");
    const { state: after } = driveEvents(WAVE5_DEPS, zzzax.state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: played.id,
      targetInstanceId: villain,
      divide: [
        { targetInstanceId: villain, amount: 1 },
        { targetInstanceId: zzzax.id, amount: 2 },
      ],
    });
    expect(inst(after, villain).damage).toBe(1);
    expect(inst(after, zzzax.id).damage).toBe(2);
  });

  it("negative: an ally without the rule (Falcon) cannot divide her attack", () => {
    const hero = asHero(ironheartVsRhino(1));
    const played = playFromHand(hero, "29015", 4);
    const villain = activeVillain(played.state).instanceId;
    const zzzax = engagedMinion(played.state, "29037");
    const result = applyCommand(
      zzzax.state,
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: played.id,
        targetInstanceId: villain,
        divide: [
          { targetInstanceId: villain, amount: 1 },
          { targetInstanceId: zzzax.id, amount: 1 },
        ],
      },
      WAVE5_DEPS,
    );
    expect(result.ok ? null : result.error.message).toMatch(/cannot be divided/);
  });
});

describe("Wasp (29034)", () => {
  it("29034.wasp-constant: ignores guard — attacks the villain past a guard minion engaged with you", () => {
    const hero = asHero(ironheartVsRhinoWithExtras(1, ["29034"]));
    const guarded = engagedMinion(hero, "01101"); // Hydra Mercenary, Guard (rhino's own encounter set).
    const villain = activeVillain(guarded.state).instanceId;
    const identity = identityOf(guarded.state, P1);
    expect(canAttack(guarded.state, identity, villain, WAVE5_DEPS)).toBe(false);
    const played = playFromHand(guarded.state, "29034", 2);
    expect(canAttack(played.state, played.id, villain, WAVE5_DEPS)).toBe(true);
  });
});

describe("Feedback Loop (29036)", () => {
  it("29036.when-revealed: each player places threat equal to total [energy] resources in hand and on cards they control", () => {
    const withFalcon = playFromHand(ironheartVsRhino(1), "29015", 4); // Falcon: 1 [energy] icon, in play.
    const staged = setHandFull(withFalcon.state, ["29006", "29006"]); // Photon Beam x2: 2 [energy] icons, in hand.
    const { state: after, id: sideScheme } = reveal(staged, "29036");
    // Printed startingThreat base 2, +3 (2 hand + 1 controlled) for the total [energy] resources.
    expect(inst(after, sideScheme).threat).toBe(5);
  });

  it("negative: with no [energy] resources in hand or in play, only the printed starting threat is placed", () => {
    const staged = setHandFull(ironheartVsRhino(2), []);
    const { state: after, id: sideScheme } = reveal(staged, "29036");
    expect(inst(after, sideScheme).threat).toBe(2);
  });
});

describe("Zzzax (29037)", () => {
  it("29037.zzzax-constant: gets +X ATK and +X hit points, X the total [energy] resources on cards the engaged player controls", () => {
    const withFalcon = playFromHand(ironheartVsRhino(1), "29015", 4); // Falcon: 1 [energy] icon, in play.
    const zzzax = engagedMinion(withFalcon.state, "29037");
    expect(statBonus(zzzax.state, WAVE5_DEPS, zzzax.id, "atk")).toBe(1);
    expect(statBonus(zzzax.state, WAVE5_DEPS, zzzax.id, "hp")).toBe(1);
  });

  it("negative: with no [energy] resource on a controlled card, no bonus", () => {
    const zzzax = engagedMinion(ironheartVsRhino(2), "29037");
    expect(statBonus(zzzax.state, WAVE5_DEPS, zzzax.id, "atk")).toBe(0);
    expect(statBonus(zzzax.state, WAVE5_DEPS, zzzax.id, "hp")).toBe(0);
  });

  it("29037.boost: with at least 2 [energy] resources in hand, puts Zzzax into play engaged with you", () => {
    const hero = asHero(ironheartVsRhino(1));
    const staged = setHandFull(hero, ["29006", "29006"]); // 2 [energy] icons.
    const stacked = stackEncounterDeck(staged, "29037", "01186", "01186");
    const { state: after } = driveEvents(WAVE5_DEPS, stacked, endTurn(P1));
    const zzzaxId = instancesOf(after, "29037")[0]!;
    expect(playerOf(after, P1).playArea).toContain(zzzaxId);
    expect(inst(after, zzzaxId).engagedWith).toBe(P1);
  });

  it("negative: with fewer than 2 [energy] resources in hand, Zzzax is not put into play", () => {
    const hero = asHero(ironheartVsRhino(2));
    const staged = setHandFull(hero, []);
    const stacked = stackEncounterDeck(staged, "29037", "01186", "01186");
    const { state: after } = driveEvents(WAVE5_DEPS, stacked, endTurn(P1));
    const zzzaxId = instancesOf(after, "29037")[0]!;
    expect(playerOf(after, P1).playArea).not.toContain(zzzaxId);
  });
});

describe("Haywire (29038)", () => {
  it("29038.haywire-constant: treats the printed resource of every hand card as [energy] — proven via Zzzap!'s own reveal", () => {
    const hero = asHero(ironheartVsRhino(1));
    const { state: withHaywire } = reveal(hero, "29038");
    const staged = setHandFull(withHaywire, ["29013"]); // Propulsion Jets (printed [physical]) + non-energy fillers.
    const identity = identityOf(staged, P1);
    const handCount = playerOf(staged, P1).hand.length; // every hand card now counts as 1 [energy] resource.
    const { id: zzzapId, events } = reveal(staged, "29040"); // Zzzap!
    expect(dealtBy(events, zzzapId, identity)).toBe(handCount);
  });

  it("negative: without Haywire in play, none of the same (genuinely non-energy) hand cards are treated as [energy]", () => {
    const hero = asHero(ironheartVsRhino(2));
    const staged = setHandFull(hero, ["29013"]);
    const identity = identityOf(staged, P1);
    const { id: zzzapId, events } = reveal(staged, "29040");
    expect(dealtBy(events, zzzapId, identity)).toBe(0);
  });

  it(
    "retypes a card's printed resource without collapsing its icon count — a [physical][physical] card (Strength, 01090) " +
      "still counts as 2 (April 30, 2026 - Ruling 3, #6: 'Haywire does not affect resource icons; Energy still provides " +
      "2 icons')",
    () => {
      const hero = asHero(ironheartVsRhinoWithExtras(1, ["01090"]));
      const { state: withHaywire } = reveal(hero, "29038");
      const staged = setHandFull(withHaywire, ["01090"]); // Strength: printed [physical][physical], no [energy] of its own.
      const identity = identityOf(staged, P1);
      const { id: zzzapId, events } = reveal(staged, "29040");
      // Every other hand card is filler worth 1 icon each (`setHandFull`'s own `FILLER_CODES`); Strength alone
      // contributes 2 once Haywire retypes both of its printed [physical] icons to [energy], not 1.
      const fillerCount = playerOf(staged, P1).hand.length - 1;
      expect(dealtBy(events, zzzapId, identity)).toBe(fillerCount + 2);
    },
  );

  it("29038.haywire-action: taking 2 indirect damage discards Haywire", () => {
    const hero = asHero(ironheartVsRhino(1));
    const { state, id } = reveal(hero, "29038");
    expect(offers(state, "29038.haywire-action")).toBe(true);
    const identity = identityOf(state, P1);
    const before = inst(state, identity).damage;
    const { state: after } = driveEvents(
      WAVE5_DEPS,
      state,
      use(P1, id, "29038.haywire-action", [], undefined, { branch: 2 }),
    );
    expect(inst(after, identity).damage).toBe(before + 2);
    expect(cardsInPlay(after)).not.toContain(id);
  });
});

describe("Air Static (29039)", () => {
  it("29039.air-static-forced-interrupt: deals 2 indirect damage to a player with an [energy] resource in hand and/or on a card they control, when the villain phase begins", () => {
    const withFalcon = playFromHand(ironheartVsRhino(1), "29015", 4);
    const hero = asHero(withFalcon.state);
    const identity = identityOf(hero, P1);
    // Air Static enters play as part of this reveal, at RRG "Villain Phase" step 4 — too late to hear this same
    // phase's own "villain phase begins" (step 1). A second villain phase (another `endTurn`) is its first chance.
    const { state: withAirStatic, id } = reveal(hero, "29039");
    const { events } = driveEvents(WAVE5_DEPS, withAirStatic, endTurn(P1));
    expect(dealtBy(events, id, identity)).toBe(2);
  });

  it("negative: a player with no [energy] resource anywhere takes none", () => {
    const hero = asHero(ironheartVsRhino(2));
    const staged = setHandFull(hero, []);
    const identity = identityOf(staged, P1);
    const { state: withAirStatic, id } = reveal(staged, "29039");
    // The reveal's own end-of-phase draw (`setHandFull`'s own docblock) may have topped the hand back up with
    // whatever was next in the deck; pin it back to all-filler before the second villain phase this test checks.
    const repinned = setHandFull(withAirStatic, []);
    const { events } = driveEvents(WAVE5_DEPS, repinned, endTurn(P1));
    expect(dealtBy(events, id, identity)).toBe(0);
  });

  it("29039.air-static-action: discards an in-play [energy] card you control, then discards this card", () => {
    const withFalcon = playFromHand(ironheartVsRhino(1), "29015", 4);
    const hero = asHero(withFalcon.state);
    const { state, id } = reveal(hero, "29039");
    const { state: after } = driveEvents(
      WAVE5_DEPS,
      state,
      use(P1, id, "29039.air-static-action", [], { discarded: [withFalcon.id] }, { branch: 1 }),
    );
    expect(playerOf(after, P1).discard).toContain(withFalcon.id);
    expect(cardsInPlay(after)).not.toContain(id);
  });

  it("29039.air-static-action: discards a hand card with a printed [energy] resource, then discards this card", () => {
    const hero = asHero(ironheartVsRhino(1));
    const staged = setHandFull(hero, ["29006"]);
    const { state, id } = reveal(staged, "29039");
    const photonBeam = inHand(state, "29006");
    const { state: after } = driveEvents(
      WAVE5_DEPS,
      state,
      use(P1, id, "29039.air-static-action", [], { discard: [photonBeam] }, { branch: 0 }),
    );
    expect(playerOf(after, P1).discard).toContain(photonBeam);
    expect(cardsInPlay(after)).not.toContain(id);
  });

  it("negative: a hand card without a printed [energy] resource cannot pay the discard-from-hand branch", () => {
    const hero = asHero(ironheartVsRhino(1));
    const staged = setHandFull(hero, ["29013"]); // Propulsion Jets: printed [physical], no Haywire in play here.
    const { state, id } = reveal(staged, "29039");
    const jets = inHand(state, "29013");
    const result = applyCommand(
      state,
      use(P1, id, "29039.air-static-action", [], { discard: [jets] }, { branch: 0 }),
      WAVE5_DEPS,
    );
    expect(result.ok).toBe(false);
  });
});

describe("Zzzap! (29040)", () => {
  it("29040.when-revealed: take indirect damage equal to total [energy] resources in hand; 2 or more dealt does not gain surge", () => {
    const hero = asHero(ironheartVsRhino(1));
    const staged = setHandFull(hero, ["29006", "29006"]);
    const identity = identityOf(staged, P1);
    const { id: zzzapId, events } = reveal(staged, "29040");
    expect(dealtBy(events, zzzapId, identity)).toBe(2);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === zzzapId)).toBe(false);
  });

  it("negative: with no [energy] resources in hand, 0 (1 or fewer) damage is dealt and this card gains surge", () => {
    const hero = asHero(ironheartVsRhino(2));
    const staged = setHandFull(hero, []);
    const identity = identityOf(staged, P1);
    const { id: zzzapId, events } = reveal(staged, "29040");
    expect(dealtBy(events, zzzapId, identity)).toBe(0);
    expect(events.some((e) => e.type === "surgeTriggered" && e.instanceId === zzzapId)).toBe(true);
  });
});

describe("Pinpoint (29035)", () => {
  const PINPOINT = "29035.pinpoint-interrupt";
  /** Uses Pinpoint's interrupt whenever it is offered; otherwise declines like `firstLegal`. */
  const usePinpoint: Picker = (state) => {
    const offered = state.pendingChoice?.options.find((o) => o.optionId.includes(PINPOINT));
    return offered ? [offered.optionId] : firstLegal(state);
  };
  const offeredPinpoint = (events: readonly GameEvent[]) =>
    events.some((e) => e.type === "windowOpened" && e.candidates.some((c) => `${c.abilityId}` === PINPOINT));
  const deckShuffled = (events: readonly GameEvent[], player: PlayerId) =>
    events.some((e) => e.type === "deckShuffled" && e.zone.kind === "deck" && e.zone.playerId === player);

  /** The cards in `player`'s deck after that were not in it before. */
  const gainedDeckCards = (before: GameState, after: GameState, player: PlayerId) => {
    const had = new Set(playerOf(before, player).deck);
    return playerOf(after, player).deck.filter((id) => !had.has(id));
  };

  /** P1 in hero form with Pinpoint in play (and ready), and `extra` codes available to play. */
  function withPinpoint(extra: readonly string[] = [], seed = 1) {
    const hero = asHero(ironheartVsRhinoWithExtras(seed, ["29035", ...extra]));
    const played = playFromHand(hero, "29035", 2);
    return { state: played.state, pinpoint: played.id };
  }

  /** Vivian (29024, 2 hit points) in play with 1 damage: her attack's 1 consequential damage defeats her. */
  function vivianAboutToFall(pinpointExhausted = false) {
    const table = withPinpoint(["29024"]);
    const vivian = playFromHand(table.state, "29024", 2);
    let state = patchInstance(vivian.state, vivian.id, { damage: 1 });
    if (pinpointExhausted) state = patchInstance(state, table.pinpoint, { exhausted: true });
    const attack = {
      type: "basicAttack" as const,
      playerId: P1,
      attackerInstanceId: vivian.id,
      targetInstanceId: activeVillain(state).instanceId,
    };
    return { state, vivian: vivian.id, pinpoint: table.pinpoint, attack };
  }

  it(`${PINPOINT}: a defeated ally is shuffled into its owner's deck instead of the discard pile; Pinpoint exhausts`, () => {
    const t = vivianAboutToFall();
    const deckBefore = playerOf(t.state, P1).deck;
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, t.state, usePinpoint, t.attack);
    expect(offeredPinpoint(events)).toBe(true);
    // Still defeated: only where it goes is replaced.
    expect(
      events.some(
        (e) => e.type === "triggerEvent" && e.event.kind === "characterDefeated" && e.event.instanceId === t.vivian,
      ),
    ).toBe(true);
    expect(cardsInPlay(after)).not.toContain(t.vivian);
    expect([...playerOf(after, P1).deck].sort()).toEqual([...deckBefore, t.vivian].sort());
    expect(playerOf(after, P1).discard).not.toContain(t.vivian);
    expect(deckShuffled(events, P1)).toBe(true);
    expect(inst(after, t.pinpoint).exhausted).toBe(true);
  });

  it("negative: declining sends the defeated ally to the discard pile", () => {
    const t = vivianAboutToFall();
    const deckBefore = playerOf(t.state, P1).deck;
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, t.state, firstLegal, t.attack);
    expect(offeredPinpoint(events)).toBe(true);
    expect(playerOf(after, P1).discard).toContain(t.vivian);
    expect(playerOf(after, P1).deck).toEqual(deckBefore);
    expect(inst(after, t.pinpoint).exhausted).toBe(false);
  });

  it("negative: while Pinpoint is exhausted she can't pay her cost, so the defeated ally is discarded", () => {
    const t = vivianAboutToFall(true);
    const deckBefore = playerOf(t.state, P1).deck;
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, t.state, usePinpoint, t.attack);
    expect(offeredPinpoint(events)).toBe(false);
    expect(playerOf(after, P1).discard).toContain(t.vivian);
    expect(playerOf(after, P1).deck).toEqual(deckBefore);
  });

  // Caught Off Guard (01188) — "Discard an upgrade or support you control": the card under test is the only one.
  for (const [kind, code, cost] of [
    ["upgrade (Propulsion Jets)", "29013", 2],
    ["support (Tony Stark A.I.)", "29011", 2],
  ] as const) {
    it(`${PINPOINT}: a discarded ${kind} is shuffled into its owner's deck instead`, () => {
      const table = withPinpoint([code]);
      const card = playFromHand(table.state, code, cost);
      const stacked = stackEncounterDeck(card.state, "01186", "01188");
      // The villain phase: the ready step readies Pinpoint anyway; the deck is read after the end-of-turn draw.
      const { state: after, events } = driveEventsPicking(WAVE5_DEPS, stacked, usePinpoint, endTurn(P1));
      expect(offeredPinpoint(events)).toBe(true);
      expect(cardsInPlay(after)).not.toContain(card.id);
      expect(playerOf(after, P1).deck).toContain(card.id);
      expect(playerOf(after, P1).discard).not.toContain(card.id);
      // The deck gained exactly this card (the end-of-turn draw only takes cards out), with a shuffle.
      expect(gainedDeckCards(stacked, after, P1)).toEqual([card.id]);
      expect(
        events.some(
          (e) =>
            e.type === "deckShuffled" && e.zone.kind === "deck" && e.zone.playerId === P1 && e.order.includes(card.id),
        ),
      ).toBe(true);
      expect(inst(after, table.pinpoint).exhausted).toBe(true);
    });
  }

  it("negative: an encounter card leaving play (a defeated minion) is not offered", () => {
    const table = withPinpoint();
    const minion = engagedMinion(table.state, "29037");
    const near = patchInstance(minion.state, minion.id, { damage: 99 });
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, near, usePinpoint, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(near, P1),
      targetInstanceId: minion.id,
    });
    expect(cardsInPlay(after)).not.toContain(minion.id);
    expect(offeredPinpoint(events)).toBe(false);
    expect(after.encounterDecks[activeEncounterDeckId(after)]!.discard).toContain(minion.id);
    expect(inst(after, table.pinpoint).exhausted).toBe(false);
  });

  it(`${PINPOINT}: another player's discarded support goes to that owner's deck, not Pinpoint's controller's`, () => {
    const hero = asHero(
      startWave5Game(
        ironheartScenarioWithExtras("rhino", {
          seed: 3,
          extraCodes: ["29035"],
          modularSetIds: [encounterSetId("zzzax")],
          extraPlayers: [{ starterDeckId: "core-spider-man-justice" }],
        }),
      ),
    );
    const pinpoint = playFromHand(hero, "29035", 2);
    const p2Turn = runWave5(pinpoint.state, endTurn(P1));
    const auntMay = playFromHandFor(WAVE5_DEPS, p2Turn, "01006", 1, firstLegal, P2);
    // Two villain activations draw a boost each, then P1 and P2 are each dealt a card: Caught Off Guard is P2's.
    const stacked = stackEncounterDeck(auntMay.state, "01186", "01186", "01101", "01188");
    const { state: after, events } = driveEventsPicking(WAVE5_DEPS, stacked, usePinpoint, endTurn(P2));
    expect(offeredPinpoint(events)).toBe(true);
    expect(inst(after, auntMay.id).ownerId).toBe(P2);
    expect(gainedDeckCards(stacked, after, P2)).toEqual([auntMay.id]);
    expect(playerOf(after, P2).discard).not.toContain(auntMay.id);
    expect(playerOf(after, P1).deck).not.toContain(auntMay.id);
    expect(deckShuffled(events, P2)).toBe(true);
    expect(gainedDeckCards(stacked, after, P1)).toEqual([]);
    expect(inst(after, pinpoint.id).exhausted).toBe(true);
  });
});
