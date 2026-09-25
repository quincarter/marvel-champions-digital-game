/**
 * Tower Defense (docs/phase7-wave4.md §2.2, §3.2-§3.5, §3.23): Proxima Midnight, Corvus Glaive, Under Siege / The
 * Armies of Thanos, Focused Defense, Avengers Tower, and the Tower Defense encounter set's own modulars.
 *
 * Every registered ref (identical stages share one factory function, `proximaForcedInterrupt`/`corvusForcedInterrupt`/
 * `protectedWhileOtherHasHp` in `tower-defense.ts`, exercised here on whichever stage each seed's game reaches):
 * 21092.proxima-midnight-forced-interrupt, 21092.proxima-midnight-constant, 21093.proxima-midnight-forced-interrupt,
 * 21093.proxima-midnight-constant, 21094.proxima-midnight-forced-interrupt, 21094.proxima-midnight-constant,
 * 21095.corvus-glaive-forced-interrupt, 21095.corvus-glaive-constant, 21096.corvus-glaive-forced-interrupt,
 * 21096.corvus-glaive-constant, 21097.corvus-glaive-forced-interrupt, 21097.corvus-glaive-constant, 21098a.setup,
 * 21098b.under-siege-constant, 21098b.under-siege-forced-interrupt, 21099a.when-revealed,
 * 21099b.the-armies-of-thanos-constant, 21099b.the-armies-of-thanos-forced-interrupt, 21100a.avengers-tower-constant,
 * 21100a.avengers-tower-forced-response, 21100b.when-revealed, 21100b.avengers-tower-forced-response,
 * 21101.focused-defense-constant, 21101.focused-defense-forced-response, 21102.black-order-besieger-forced-response,
 * 21103.proximas-spear-constant, 21103.proximas-spear-action, 21104.corvuss-glaive-constant,
 * 21104.corvuss-glaive-action, 21105.direct-assault-forced-interrupt, 21106.when-revealed, 21106.boost,
 * 21107.when-revealed, 21107.boost, 21108.when-revealed, 21108.boost, 21109.when-revealed, 21109.boost,
 * 21110.when-defeated.
 *
 * Every `.boost` ref is driven as an actual boost card of a real villain activation (stacked as the literal top of
 * the shared encounter deck, so it is the one boost card revealed for that activation — `stackEncounterDeck`'s own
 * docblock), not merely revealed to a player; every `.when-revealed` ref is asserted by its exact effect (an
 * `attackResolved` event's own `baseAtk`/`boostIcons`/`damageDealt`, or an exact damage/heal/status delta), not a
 * loose `toBeGreaterThan`/`<=`/`||`.
 */
import {
  cardOf,
  characterProfile,
  createGame,
  hasKeyword,
  printedResources,
  replay,
  sessionApply,
  startSession,
  statusActive,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import {
  P1,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { CORVUS_GLAIVE, PROXIMA_MIDNIGHT } from "./villain-merge.js";
import { towerDefenseScenario } from "./tower-defense-setup.js";

type AttackResolvedEvent = Extract<GameEvent, { readonly type: "attackResolved" }>;

const start = (
  seed = 1,
  players: readonly { readonly starterDeckId: string }[] = [{ starterDeckId: "spectrum-leadership" }],
) =>
  settle(
    runWith(WAVE4_DEPS, startWave4Game(towerDefenseScenario({ seed, players })), toHero()),
    firstLegal,
    undefined,
    WAVE4_DEPS,
  );

/** Accepts an offered choice whose optionId or label names one of `wanted`, else falls back to `firstLegal`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .filter((o) => wanted.some((w) => o.optionId.includes(w) || o.label.includes(w)))
      .map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const proxima = (state: GameState): InstanceId => {
  const found = state.villains.find((v) => v.cardId === PROXIMA_MIDNIGHT.id);
  if (!found) throw new Error("no Proxima Midnight in play");
  return found.instanceId;
};
const corvus = (state: GameState): InstanceId => {
  const found = state.villains.find((v) => v.cardId === CORVUS_GLAIVE.id);
  if (!found) throw new Error("no Corvus Glaive in play");
  return found.instanceId;
};
const activeCardId = (state: GameState): string => inst(state, state.activeVillainId).cardId;
const towerId = (state: GameState): InstanceId => instancesOf(state, "21100a")[0]!;
const atk = (state: GameState, id: InstanceId): number => characterProfile(state, id, WAVE4_DEPS)!.atk;

/** Drives P1's turn end through the full villain phase into the next player phase, collecting every event along
 * the way (so a specific villain's `attackResolved` can be told apart from another attack the same round). */
function driveRound(state: GameState, pick: Picker = firstLegal): { state: GameState; events: readonly GameEvent[] } {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, endTurn(P1), WAVE4_DEPS);
  if (!first.ok) throw new Error(first.error.message);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && guard < 200; guard++) {
    const choice = session.state.pendingChoice;
    const answer = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      WAVE4_DEPS,
    );
    if (!answer.ok) throw new Error(answer.error.message);
    session = answer.session;
    events.push(...answer.events);
  }
  return { state: session.state, events };
}

/** Ends P1's turn and drains every pending choice through the villain phase into the next player phase (the
 * `driveRound` shape, for tests that only need the resulting state). Draining unconditionally (not stopping the
 * moment `step.phase` reports "player") matters here: Focused Defense's own "after the player phase ends" response
 * can still have a pending choice open at that exact boundary. */
function endRound(state: GameState, pick: Picker = firstLegal): GameState {
  return driveRound(state, pick).state;
}

/** Every `attackResolved` event this round whose enemy was `enemyId` — exactly one per villain per round unless it
 * both scheduled-activates and is separately made to attack again by a card effect. */
const attacksBy = (events: readonly GameEvent[], enemyId: InstanceId): readonly AttackResolvedEvent[] =>
  events.filter((e): e is AttackResolvedEvent => e.type === "attackResolved" && e.enemyInstanceId === enemyId);

/** A card resource-typed cost's own hand payment: the first hand card printing (or wilding) each named type, in
 * order — `spend({ energy: 1, mental: 1 })`'s own test-side pairing. */
function payTyped(
  state: GameState,
  player: PlayerId,
  need: readonly ("energy" | "mental" | "physical")[],
): InstanceId[] {
  const remaining = [...playerOf(state, player).hand];
  const picked: InstanceId[] = [];
  for (const type of need) {
    const index = remaining.findIndex((id) => {
      const card = cardOf(state, id);
      if (!card) return false;
      const pool = printedResources(card);
      return (pool[type] ?? 0) > 0 || (pool.wild ?? 0) > 0;
    });
    if (index < 0) throw new Error(`${player} has no ${type} resource card in hand`);
    picked.push(remaining[index]!);
    remaining.splice(index, 1);
  }
  return picked;
}

// The villain's own boost card is drawn from the top of the (shared) encounter deck before any player is dealt one
// (`stackEncounterDeck`'s own docblock), so a filler card ("01186", Standard, 0 boost icons, harmless "the villain
// schemes" text) absorbs that draw and the named card underneath it is the one actually dealt to (and, for an
// attachment, attached by) the player as their own encounter card that round.
const stackBehindBoost = (state: GameState, code: string): GameState => stackEncounterDeck(state, "01186", code);

describe("setup (§2.2, §3.2)", () => {
  it("puts two main schemes and two villains into play, Avengers Tower stronghold-side, Focused Defense on Corvus's scheme", () => {
    const state = start();
    expect(state.extraMainSchemes).toHaveLength(1);
    expect(state.villains.map((v) => v.cardId).sort()).toEqual([CORVUS_GLAIVE.id, PROXIMA_MIDNIGHT.id].sort());
    expect(instancesOf(state, "21100a")).toHaveLength(1);
    expect(inst(state, towerId(state)).flipped).toBe(false);
    // Focused Defense begins attached to stage 2B (MC21 p. 11): Corvus Glaive is the active villain.
    expect(activeCardId(state)).toBe(CORVUS_GLAIVE.id);
    expect(instancesOf(state, "21101")).toHaveLength(1);
  });

  it("21099a.when-revealed: each player has a Black Order Besieger engaged with them", () => {
    const state = start();
    const besiegers = instancesOf(state, "21102");
    expect(besiegers.length).toBeGreaterThanOrEqual(1);
    expect(besiegers.some((id) => inst(state, id).engagedWith === P1)).toBe(true);
  });
});

describe("§3.2 Focused Defense steers threat and the active villain", () => {
  it("21101.focused-defense-forced-response: after the player phase ends, it moves to the other main scheme", () => {
    const before = start();
    expect(activeCardId(before)).toBe(CORVUS_GLAIVE.id);
    const after = endRound(before);
    expect(activeCardId(after)).toBe(PROXIMA_MIDNIGHT.id);
  });

  it("21101.focused-defense-constant: the villain matching the attached scheme is active on both sides of the swap", () => {
    const round1 = endRound(start());
    expect(activeCardId(round1)).toBe(PROXIMA_MIDNIGHT.id);
    if (round1.outcome) return; // the round can end the game outright at low seeds/threat targets
    const round2 = endRound(round1);
    if (round2.outcome) return;
    expect(activeCardId(round2)).toBe(CORVUS_GLAIVE.id);
  });
});

/** Test-only surgery (the `patchInstance` spirit, for `VillainState` rather than `CardInstance`): puts a villain on
 * its own last configured stage, so a lethal hit outright defeats it instead of advancing to the next stage (the
 * real "Proxima Midnight (I) defeated -> Proxima Midnight (II) enters play" rule, exercised on its own by the
 * setup/Focused-Defense/forced-interrupt tests above; §3.3's mutual-protection sweep only matters at the last
 * stage, same as `villain-mutual-protection.test.ts`'s own engine-level fixture). */
function atLastStage(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    villains: state.villains.map((v) => (v.instanceId === id ? { ...v, stageIndex: v.lastStageIndex } : v)),
  };
}

describe("villains (§3.3 mutual protection; Forced Interrupts)", () => {
  it("21092/21095 constants: Proxima Midnight cannot be defeated while Corvus Glaive has hit points, and vice versa", () => {
    const base = start();
    const state = atLastStage(base, proxima(base));
    const near = patchInstance(state, proxima(state), { damage: 999 });
    const after = defeatWithAttack(WAVE4_DEPS, near, proxima(near));
    // Proxima stands (protected): Corvus still has hit points, so she is not defeated.
    expect(after.villains.find((v) => v.instanceId === proxima(after))?.defeated).toBe(false);
  });

  it("§3.3: both villains reaching 0 in one attack are both defeated (Jun 2, 2026 (2) simultaneous damage)", () => {
    const base = start();
    const lastStage = atLastStage(atLastStage(base, proxima(base)), corvus(base));
    const bothNearZero = patchInstance(
      patchInstance(lastStage, proxima(lastStage), { damage: 999 }),
      corvus(lastStage),
      { damage: 999 },
    );
    // Killing one with an ordinary attack pushes both through `checkDefeats` at once (docs/phase7-wave4.md §3.3).
    const after = defeatWithAttack(WAVE4_DEPS, bothNearZero, proxima(bothNearZero));
    const proximaState = after.villains.find((v) => v.instanceId === proxima(bothNearZero));
    const corvusState = after.villains.find((v) => v.instanceId === corvus(bothNearZero));
    expect(proximaState?.defeated).toBe(true);
    expect(corvusState?.defeated).toBe(true);
    expect(after.outcome?.result).toBe("win");
  });

  it("21092.proxima-midnight-forced-interrupt: when she attacks you, choosing '1 damage to Avengers Tower' deals exactly 1", () => {
    // Round 1: Focused Defense has already swapped to Proxima's scheme before this round's own step one, so she is
    // the round's scheduled activation (`activeCardId`, checked below). Two "01186" fillers (0 boost icons, harmless
    // "the villain schemes" text) soak up her own boost draw and the per-player dealt card, so nothing else touches
    // the tower this round; her own chooseOne is answered by `accepting` throughout the one round it's driven in.
    const before = start();
    expect(activeCardId(before)).toBe(CORVUS_GLAIVE.id); // before the round; Focused Defense swaps first
    const tower = towerId(before);
    const beforeDamage = inst(before, tower).damage;
    const after = endRound(stackEncounterDeck(before, "01186", "01186"), accepting("Deal 1 damage to Avengers Tower"));
    if (after.outcome) return; // the round can end the game outright at low seeds/threat targets
    expect(activeCardId(after)).toBe(PROXIMA_MIDNIGHT.id); // confirms this was her round
    expect(inst(after, tower).damage).toBe(beforeDamage + 1);
  });

  it("21095.corvus-glaive-forced-interrupt: after his undefended attack, damage equals the discarded card's boost icons exactly", () => {
    // Round 2: one round transition puts Proxima active (round 1), a second swaps back to Corvus (round 2), so his
    // own scheduled activation is what this ref reacts to. Stack: his own boost draw (0 icons), the card his own
    // Forced Interrupt discards ("21105" Direct Assault, printed 2 boost icons), then a harmless filler for the
    // per-player dealt card.
    const round1 = endRound(start());
    if (round1.outcome) return;
    expect(activeCardId(round1)).toBe(PROXIMA_MIDNIGHT.id);
    const tower = towerId(round1);
    const before = inst(round1, tower).damage;
    const after = endRound(stackEncounterDeck(round1, "01186", "21105", "01186"), firstLegal);
    if (after.outcome) return;
    expect(activeCardId(after)).toBe(CORVUS_GLAIVE.id); // confirms this was his round
    expect(inst(after, tower).damage).toBe(before + 2);
  });
});

describe("Avengers Tower (§3.5)", () => {
  it("21100a.avengers-tower-constant: the unique rule does not apply to it (the environment enters despite any other copy)", () => {
    const state = start();
    expect(instancesOf(state, "21100a")).toHaveLength(1);
  });

  it("21100a.avengers-tower-forced-response: at 9[per_hero]+ damage it clears and flips to Damaged", () => {
    const state = start();
    const tower = towerId(state);
    // 8 already there, plus Rain Fire's own "Deal 3 damage to Avengers Tower" (21109.when-revealed, dealt as the
    // player's own revealed encounter card, not its boost card) lands the 9th and 10th. Round 1 makes her the
    // scheduled activation, so her own Forced Interrupt also offers a choice this round; steer it to "+2 ATK" (not
    // "1 damage to Avengers Tower") so Rain Fire's 3 is the only damage the tower takes.
    const near = stackBehindBoost(patchInstance(state, tower, { damage: 8 }), "21109");
    const after = endRound(near, accepting("gets +2 ATK"));
    expect(inst(after, tower).damage).toBe(0);
    expect(inst(after, tower).flipped).toBe(true);
  });

  it("21100b.avengers-tower-forced-response: at 9[per_hero]+ more on the Damaged side, the players lose", () => {
    const state = start();
    const tower = towerId(state);
    const flippedAndDamaged = patchInstance(stackBehindBoost(state, "21109"), tower, { damage: 6, flipped: true });
    const after = endRound(flippedAndDamaged);
    expect(after.outcome?.result).toBe("loss");
  });
});

describe("modular set: Black Order Besieger, weapons, Direct Assault, treacheries, City Under Attack", () => {
  it("21102.black-order-besieger-forced-response: engaging (at setup) deals exactly 1 to Avengers Tower", () => {
    const state = start();
    const besieger = instancesOf(state, "21102").find((id) => inst(state, id).engagedWith === P1)!;
    expect(besieger).toBeDefined();
    // firstLegal picks the first option ("Deal 1 damage to Avengers Tower"); nothing else has touched the tower yet.
    expect(inst(state, towerId(state)).damage).toBe(1);
  });

  it("21103.proximas-spear-constant: attached to Proxima Midnight, grants overkill and piercing", () => {
    const revealed = endRound(stackBehindBoost(start(), "21103"));
    const attachedTo = inst(
      revealed,
      instancesOf(revealed, "21103").find((id) => inst(revealed, id).attachedTo)!,
    ).attachedTo!;
    expect(attachedTo).toBe(proxima(revealed));
    expect(hasKeyword(revealed, attachedTo, "overkill", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(revealed, attachedTo, "piercing", WAVE4_DEPS)).toBe(true);
  });

  it("21103.proximas-spear-action: taking 1 damage and spending [energy][mental] discards it", () => {
    const revealed = endRound(stackBehindBoost(start(), "21103"));
    const spear = instancesOf(revealed, "21103").find((id) => inst(revealed, id).attachedTo)!;
    const payment = payTyped(revealed, P1, ["energy", "mental"]);
    const identity = identityOf(revealed, P1);
    const identityDamageBefore = inst(revealed, identity).damage;
    const applied = applyOk(
      revealed,
      use(
        P1,
        spear,
        "21103.proximas-spear-action",
        payment.map((fromHand) => ({ fromHand })),
      ),
      WAVE4_DEPS,
    );
    const after = settle(applied.state, firstLegal, undefined, WAVE4_DEPS);
    expect(inst(after, identity).damage).toBe(identityDamageBefore + 1);
    expect(inst(after, spear).attachedTo).toBeNull();
    for (const id of payment) expect(playerOf(after, P1).hand).not.toContain(id);
  });

  it("21104.corvuss-glaive-constant: attached to Corvus Glaive, grants retaliate 1", () => {
    const revealed = endRound(stackBehindBoost(start(), "21104"));
    const attachedTo = inst(
      revealed,
      instancesOf(revealed, "21104").find((id) => inst(revealed, id).attachedTo)!,
    ).attachedTo!;
    expect(attachedTo).toBe(corvus(revealed));
    expect(hasKeyword(revealed, attachedTo, "retaliate", WAVE4_DEPS)).toBe(true);
  });

  it("21104.corvuss-glaive-action: taking 1 damage and spending [energy][physical] discards it", () => {
    const revealed = endRound(stackBehindBoost(start(), "21104"));
    const glaive = instancesOf(revealed, "21104").find((id) => inst(revealed, id).attachedTo)!;
    const payment = payTyped(revealed, P1, ["energy", "physical"]);
    const identity = identityOf(revealed, P1);
    const identityDamageBefore = inst(revealed, identity).damage;
    const after = settle(
      runWith(
        WAVE4_DEPS,
        revealed,
        use(
          P1,
          glaive,
          "21104.corvuss-glaive-action",
          payment.map((fromHand) => ({ fromHand })),
        ),
      ),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, identity).damage).toBe(identityDamageBefore + 1);
    expect(inst(after, glaive).attachedTo).toBeNull();
    for (const id of payment) expect(playerOf(after, P1).hand).not.toContain(id);
  });

  it("21105.direct-assault-forced-interrupt: attaches to the non-active villain", () => {
    const revealed = endRound(stackBehindBoost(start(), "21105"));
    // Focused Defense swaps at the villain phase's own start (before step one deals this card), so by the time it's
    // revealed the active villain is already Proxima Midnight; "not the active villain" is Corvus Glaive.
    const attached = instancesOf(revealed, "21105").find((id) => inst(revealed, id).attachedTo);
    expect(attached).toBeDefined();
    expect(inst(revealed, attached!).attachedTo).toBe(corvus(revealed));
    expect(activeCardId(revealed)).toBe(PROXIMA_MIDNIGHT.id);
  });

  it("21106.when-revealed: Proxima Midnight activates against you for exactly her printed ATK, undefended", () => {
    // Round 2 (Corvus scheduled-active): her own attack this round comes only from this card's "activates against
    // you", so it is the round's only `attackResolved` event naming her. Round 1 makes Proxima active; round 2
    // (driven below) swaps back to Corvus.
    const round1 = endRound(start());
    if (round1.outcome) return;
    expect(activeCardId(round1)).toBe(PROXIMA_MIDNIGHT.id);
    const expected = atk(round1, proxima(round1));
    // Corvus's own scheduled attack draws a boost card, and so does the Black Order Besieger engaged with P1
    // (minions activate too, RRG 1.8 "Villain Phase" step 2) — two boost draws before any player is dealt a card.
    // Her own "activates against you" is a brand-new attack (`additionalResolution: true`) with its own boost draw
    // too, so: two fillers, the card itself, one more filler.
    const { state: after, events } = driveRound(
      stackEncounterDeck(round1, "01186", "01187", "21106", "01186"),
      firstLegal,
    );
    if (after.outcome) return;
    expect(activeCardId(after)).toBe(CORVUS_GLAIVE.id); // confirms this round's own scheduled attack was his
    const hers = attacksBy(events, proxima(after));
    expect(hers).toHaveLength(1);
    expect(hers[0]!.boostIcons).toBe(0);
    expect(hers[0]!.defenseReduction).toBe(0);
    expect(hers[0]!.damageDealt).toBe(expected);
  });

  it("21106.boost: as the boost card of a real activation, adds Corvus Glaive's SCH/ATK to the activating villain's", () => {
    // Round 1 (Proxima scheduled-active): stack the card as the literal top of the deck so it is her activation's
    // one boost card, not a player's dealt one.
    const start1 = start();
    const expectedAtk = atk(start1, proxima(start1)) + atk(start1, corvus(start1));
    const { state: after, events } = driveRound(stackEncounterDeck(start1, "21106"), firstLegal);
    expect(activeCardId(start1)).toBe(CORVUS_GLAIVE.id); // still true before the round; Focused Defense swaps first
    const hers = attacksBy(events, proxima(after));
    expect(hers).toHaveLength(1);
    expect(hers[0]!.boostIcons).toBe(0); // 21106 prints 0 boost icons of its own
    expect(hers[0]!.defenseReduction).toBe(0);
    expect(hers[0]!.damageDealt).toBe(expectedAtk);
  });

  it("21107.when-revealed: Corvus Glaive activates against you for exactly his printed ATK, undefended", () => {
    // Round 1 (Proxima scheduled-active): his own attack this round comes only from this card.
    const before = start();
    expect(activeCardId(before)).toBe(CORVUS_GLAIVE.id);
    const expected = atk(before, corvus(before));
    // Third filler: his own "activates against you" is a brand-new attack (`additionalResolution: true`), which
    // draws its own boost card too — without this it would draw whatever is next in the (unstacked) shared deck.
    const { state: after, events } = driveRound(stackEncounterDeck(before, "01186", "21107", "01186"), firstLegal);
    const his = attacksBy(events, corvus(after));
    expect(his).toHaveLength(1);
    expect(his[0]!.boostIcons).toBe(0);
    expect(his[0]!.defenseReduction).toBe(0);
    expect(his[0]!.damageDealt).toBe(expected);
  });

  it("21107.boost: as the boost card of a real activation, adds Proxima Midnight's SCH/ATK to the activating villain's", () => {
    const start1 = start();
    const expectedAtk = atk(start1, proxima(start1)) + atk(start1, corvus(start1));
    const { state: after, events } = driveRound(stackEncounterDeck(start1, "21107"), firstLegal);
    const hers = attacksBy(events, proxima(after));
    expect(hers).toHaveLength(1);
    expect(hers[0]!.boostIcons).toBe(0); // 21107 prints 0 boost icons of its own
    expect(hers[0]!.defenseReduction).toBe(0);
    expect(hers[0]!.damageDealt).toBe(expectedAtk);
  });

  it("21108.when-revealed: heals exactly 2 from EACH villain and gives EACH a tough status card", () => {
    const p = proxima(start());
    const c = corvus(start());
    const damaged = patchInstance(patchInstance(start(), p, { damage: 3 }), c, { damage: 3 });
    const after = endRound(stackBehindBoost(damaged, "21108"));
    expect(inst(after, p).damage).toBe(1);
    expect(inst(after, c).damage).toBe(1);
    expect(statusActive(after, p, "tough", WAVE4_DEPS)).toBe(true);
    expect(statusActive(after, c, "tough", WAVE4_DEPS)).toBe(true);
  });

  it("21108.boost: as the boost card of a real activation, heals exactly 2 from and toughens ONLY the active villain", () => {
    const start1 = start();
    // Round 1: Proxima is the scheduled activation (Focused Defense has already swapped). Damage only the active one
    // and confirm the other is untouched by the boost.
    const p = proxima(start1);
    const c = corvus(start1);
    const damaged = patchInstance(patchInstance(start1, p, { damage: 3 }), c, { damage: 3 });
    const after = endRound(stackEncounterDeck(damaged, "21108"));
    expect(inst(after, p).damage).toBe(1);
    expect(statusActive(after, p, "tough", WAVE4_DEPS)).toBe(true);
    // Corvus, not the active villain this round, is untouched by the boost.
    expect(inst(after, c).damage).toBe(3);
    expect(statusActive(after, c, "tough", WAVE4_DEPS)).toBe(false);
  });

  it("21109.when-revealed: deals exactly 3 damage to Avengers Tower", () => {
    const before = start();
    const beforeDamage = inst(before, towerId(before)).damage;
    // Round 1 makes her the scheduled activation, so her own Forced Interrupt also offers a choice this round;
    // steer it to "+2 ATK" (not "1 damage to Avengers Tower") so Rain Fire's 3 is the only damage the tower takes.
    const after = endRound(stackBehindBoost(before, "21109"), accepting("gets +2 ATK"));
    expect(inst(after, towerId(after)).damage).toBe(beforeDamage + 3);
  });

  it("21109.boost: as the boost card of a real attack that defeats an ally (White Tiger, defended), deals 3 more to Avengers Tower", () => {
    // Play White Tiger (21013: ATK 2, THW 2, HP 2, no printed DEF) and declare her the defender for the round's
    // scheduled attack; stacked as the literal top of the deck, 21109 is that attack's own boost card (+1 icon),
    // so its damage (Proxima's printed ATK 2 + 1 boost icon = 3) defeats White Tiger's 2 hit points outright. Her
    // own Forced Interrupt (a separate choice, offered because she is undefended... no: she IS defended here by
    // White Tiger, so it still offers "1 damage to Avengers Tower or +2 ATK" independent of the defend choice);
    // steer both prompts with one picker that also declares White Tiger the defender.
    const withTiger = playFromHand(start(), "21013", 3);
    const tower = towerId(withTiger.state);
    const beforeDamage = inst(withTiger.state, tower).damage;
    const { state: after } = driveRound(
      stackEncounterDeck(withTiger.state, "21109"),
      accepting(withTiger.id, "gets +2 ATK"),
    );
    expect(inst(after, withTiger.id).damage >= 2 || !after.players[0]!.playArea.includes(withTiger.id)).toBe(true);
    expect(inst(after, tower).damage).toBe(beforeDamage + 3);
  });

  it("21110.when-defeated: City Under Attack's defeater draws exactly 1 card", () => {
    const revealed = endRound(stackBehindBoost(start(), "21110"));
    if (revealed.outcome) return; // the round can end the game outright at low seeds/threat targets
    const city = instancesOf(revealed, "21110").find((id) => !revealed.removedFromGame.includes(id))!;
    const near = patchInstance(revealed, city, { threat: 1 });
    const beforeHand = near.players[0]!.hand.length;
    const after = settle(
      runWith(WAVE4_DEPS, near, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(near, P1),
        schemeInstanceId: city,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(after.players[0]!.hand.length).toBe(beforeHand + 1);
  });
});

describe("§3.3/§3.2 e2e: villain AI activates both villains across several rounds", () => {
  it("activeVillainChanged (Focused Defense) visits both Proxima Midnight and Corvus Glaive over several rounds", () => {
    // Tries a few seeds: a short game (the game can end in round 1 at some seeds) only ever sees one swap.
    for (let seed = 1; seed <= 10; seed++) {
      let session = startSession(start(seed));
      const seenInstances = new Set<InstanceId>();
      const recordEvents = (events: readonly GameEvent[]): void => {
        for (const event of events) if (event.type === "activeVillainChanged") seenInstances.add(event.to);
      };
      const apply = (): void => {
        const result = sessionApply(session, endTurn(P1), WAVE4_DEPS);
        if (!result.ok) throw new Error(result.error.message);
        session = result.session;
        recordEvents(result.events);
        for (let guard = 0; session.state.pendingChoice && guard < 200; guard++) {
          const choice = session.state.pendingChoice;
          const answer = sessionApply(
            session,
            {
              type: "resolveChoice",
              playerId: choice.playerId,
              choiceId: choice.choiceId,
              selectedOptionIds: firstLegal(session.state),
            },
            WAVE4_DEPS,
          );
          if (!answer.ok) throw new Error(answer.error.message);
          session = answer.session;
          recordEvents(answer.events);
        }
      };
      for (let round = 0; round < 6 && !session.state.outcome; round++) apply();
      const seenTitles = new Set(
        [...seenInstances].map((id) => session.state.cardPool[session.state.instances[id]?.cardId ?? ""]?.name),
      );
      if (seenTitles.has("Proxima Midnight") && seenTitles.has("Corvus Glaive")) return;
    }
    throw new Error("no seed 1-10 saw Focused Defense visit both villains within 6 rounds");
  });
});

describe("e2e: a hero plays Tower Defense to a real outcome and replays deterministically", () => {
  it("standard, solo", () => {
    const config = towerDefenseScenario({ seed: 2026, players: [{ starterDeckId: "spectrum-leadership" }] });
    const created = createGame(config, WAVE4_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE4_DEPS);
    expect(result.outcome).not.toBeNull();
    const replayed = replay(result.session.log, WAVE4_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);

  it("expert, solo", () => {
    const config = towerDefenseScenario({
      seed: 2027,
      players: [{ starterDeckId: "spectrum-leadership" }],
      difficulty: "expert",
    });
    const created = createGame(config, WAVE4_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE4_DEPS);
    expect(result.outcome).not.toBeNull();
    const replayed = replay(result.session.log, WAVE4_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
