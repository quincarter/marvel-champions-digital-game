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
  identityOf,
  inst,
  instancesOf,
  P1,
  playerOf,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea } from "../../testing/staging.js";
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
 * **29035 Pinpoint is not scripted** (`zzzax.ts`'s own docblock: an engine gap, not a special case) and has no
 * tests here.
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
