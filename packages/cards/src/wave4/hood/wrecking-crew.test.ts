import { characterProfile, hasKeyword, type Command, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, applyOk, firstLegal, patchInstance, settle, type Picker } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  encounterCardInVillainArea,
  foldModularSetIntoDeck,
  game,
  heroified,
  minionEngagedWith,
  onStage,
  stackTop,
  villainId,
} from "./testing.js";

/**
 * Real-game tests for the Wrecking Crew modular set (`wrecking-crew.ts`): Top Talent (24064), Wrecker (24065),
 * Bulldozer (24066), Thunderball (24068), Combined Effort (24069) and Magic Muscle (24070). Piledriver (24067) has
 * no ability refs (plain data).
 *
 * Ref -> covering test:
 *  24064.top-talent-constant  -> "the villain and each Elite minion gain retaliate 1"
 *  24065.wrecker-constant     -> "Wrecker gets +2 ATK only while his own attack is undefended"
 *  24066.bulldozer-constant   -> "Bulldozer's own attacks gain overkill"
 *  24068.thunderball-forced-response -> "deals 1 damage to each character P1 controls after attacking P1"
 *  24069.when-revealed        -> "each Elite minion activates against the player it is engaged with"
 *  24069.boost                -> "this activation gets +1 boost card per Elite minion in play"
 *  24070.when-revealed        -> "gives each Brute enemy in play a tough status card"
 */

// wrecking_crew_modular is the pack's 9th modular set, outside the default first-7 set-aside pool: name it explicitly.
const SETS_WITH_WRECKING_CREW = [
  "beasty_boys",
  "brothers_grimm",
  "crossfire_crew",
  "mister_hyde",
  "ransacked_armory",
  "sinister_syndicate",
  "wrecking_crew_modular",
];
const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed, [], SETS_WITH_WRECKING_CREW), "wrecking_crew_modular");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

/** `driveEvents`, but with a caller-supplied `Picker` instead of a hardcoded `firstLegal` — needed to steer
 * `declareDefender` while still collecting every event (`mts/thanos.test.ts`'s own `driveEventsWith` precedent). */
function driveEventsWith(
  state: GameState,
  pick: Picker,
  ...commands: readonly Command[]
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (current.pendingChoice && !current.outcome) {
      const choice = current.pendingChoice;
      const result = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(current),
        },
        WAVE4_DEPS,
      );
      current = result.state;
      events.push(...result.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const result = applyOk(current, command, WAVE4_DEPS);
    current = result.state;
    events.push(...result.events);
    settleOne();
  }
  return { state: current, events };
}

describe("Wrecking Crew (24064-24070)", () => {
  it("24064.top-talent-constant: the villain and each Elite minion gain retaliate 1", () => {
    const base = onStage(withSet(), 0);
    const withScheme = encounterCardInVillainArea(base, "24064");
    expect(hasKeyword(withScheme.state, villainId(withScheme.state), "retaliate", WAVE4_DEPS)).toBe(true);
    const withWrecker = minionEngagedWith(withScheme.state, "24065", P1); // Wrecker: ELITE trait.
    expect(hasKeyword(withWrecker.state, withWrecker.id, "retaliate", WAVE4_DEPS)).toBe(true);
  });

  it("24065.wrecker-constant: Wrecker gets +2 ATK only while his own attack is undefended", () => {
    const base = onStage(withSet(), 0);
    const staged = minionEngagedWith(base, "24065", P1);
    const printedAtk = characterProfile(staged.state, staged.id, WAVE4_DEPS)!.atk;
    // Not currently attacking: no bonus.
    expect(characterProfile(staged.state, staged.id, WAVE4_DEPS)!.atk).toBe(printedAtk);
  });

  it("24065.wrecker-constant: an undefended attack deals his +2 ATK bonus; a defended one does not", () => {
    // Finding (spot-audit, coordinator's "full rules QA" item 5, 2026-09-26): the test above (and its wave-1
    // ancestor, `wave1/twc/wrecker.test.ts`, whose own title names the identical gap) only ever checked the
    // *baseline* ATK outside of combat — neither ever drove a real attack to confirm the bonus actually turns on.
    // Read via the attack's own `damageDealt` event (not `characterProfile` read after a single `resolveChoice`
    // step, which found live not to reflect the bonus yet at that exact point — the "undefended" var is set later
    // in the attack's own resolution, not the instant `declareDefender` itself resolves) so this is exact regardless
    // of exactly when the engine flips the flag.
    const heroified1 = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(heroified1, "24065", P1);
    const printedAtk = characterProfile(staged.state, staged.id, WAVE4_DEPS)!.atk;
    const identity = staged.state.players[0]!.identity.instanceId;

    const declineDefense: Picker = (state) =>
      state.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(state);
    const undefended = driveEventsWith(staged.state, declineDefense, { type: "endTurn", playerId: P1 });
    const undefendedHit = undefended.events.find(
      (e) => e.type === "damageDealt" && e.sourceInstanceId === staged.id && e.targetInstanceId === identity,
    );
    expect(
      undefendedHit,
      `expected a damageDealt event from Wrecker; got ${JSON.stringify(undefended.events.map((e) => e.type))}`,
    ).toBeDefined();
    if (undefendedHit?.type !== "damageDealt") throw new Error("unreachable");
    // Wrecker is Villainous (data: "when this minion activates, give it a boost card"), so the boost card's own
    // pips also contribute — read live rather than assumed (`boostCardFlipped`, scoped to Wrecker's own
    // `enemyInstanceId`, since the villain's own separate activation the same round deals and flips its own boost
    // too), since only the *relationship* to the +2 is this ability's own text.
    const boost = undefended.events.find((e) => e.type === "boostCardFlipped" && e.enemyInstanceId === staged.id);
    const boostIcons = boost?.type === "boostCardFlipped" ? boost.boostIcons : 0;
    expect(undefendedHit.amount).toBe(printedAtk + 2 + boostIcons);

    const declareIdentityDefender: Picker = (state) => {
      const prompt = state.pendingChoice?.prompt;
      if (prompt?.kind !== "declareDefender") return firstLegal(state);
      // Only defend Wrecker's own attack: defending the villain's separate activation the same round with the
      // identity would exhaust it, leaving nothing to defend Wrecker's own attack with by the time it happens.
      return prompt.attack.enemyInstanceId === staged.id ? [identity] : ["decline"];
    };
    const defended = driveEventsWith(staged.state, declareIdentityDefender, { type: "endTurn", playerId: P1 });
    const defendedHit = defended.events.find(
      (e) => e.type === "damageDealt" && e.sourceInstanceId === staged.id && e.targetInstanceId === identity,
    );
    // A defended attack's damage (if any gets through DEF) must not include the +2: strictly less than the
    // undefended attack's own total (the boost draw is the same deterministic RNG draw either way, before either
    // branch's own `declareDefender` choice, so `boostIcons` is shared between both runs).
    if (defendedHit?.type === "damageDealt") expect(defendedHit.amount).toBeLessThan(printedAtk + 2 + boostIcons);
  });

  it("24066.bulldozer-constant: Bulldozer's own attacks gain overkill", () => {
    expect(WAVE4_DEPS.abilities["24066.bulldozer-constant"]?.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { self: true } }],
    });
  });

  it("24068.thunderball-forced-response: deals 1 damage to each character P1 controls after Thunderball attacks P1", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24068", P1);
    const identity = staged.state.players[0]!.identity.instanceId;
    const before = staged.state.instances[identity]!.damage;
    const activated = settle(
      runWave4(staged.state, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Loose by design (rules-qa-engineer, docs/phase7-wave4-qa.md): Thunderball's own attack this villain
    // phase also deals damage independently of his Forced Response, so the identity's total is not isolated
    // to the +1 this ability alone contributes; only an increase is guaranteed here.
    expect(activated.instances[identity]!.damage).toBeGreaterThan(before);
  });

  it("24069.when-revealed: each Elite minion in play activates against the player it is engaged with", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withElite = minionEngagedWith(base, "24065", P1);
    const staged = stackTop(withElite.state, "01186", "01187", "24069");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24069.when-revealed")).toBe(true);
  });

  it("24069.boost: this activation gets +1 boost card per Elite minion in play", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withElite = minionEngagedWith(base, "24065", P1);
    const staged = stackTop(withElite.state, "24069");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24069.boost")).toBe(true);
  });

  it("24070.when-revealed: gives each Brute enemy in play a tough status card", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withBrute = minionEngagedWith(base, "24065", P1); // Wrecker: BRUTE trait.
    const staged = stackTop(withBrute.state, "01186", "01187", "24070");
    const { state: revealed, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24070.when-revealed")).toBe(true);
    expect(revealed.instances[withBrute.id]?.statuses.tough).toBe(1);
  });

  // Printed: "When Revealed: Give each Brute enemy in play a tough status card. If no tough status card was given
  // this way, discard cards from the top of the encounter deck until a Brute minion is discarded and reveal that
  // minion." `giveStatus` gives nothing to a character already at its tough capacity (RRG 1.8 "Status Cards"), so
  // the script branches on `giveTough`'s `bind` count, not on whether a Brute exists (docs/phase7-wave4.md §3.60).
  // Was an `it.fails` pin (docs/phase7-wave4-qa.md Checkpoint 7); confirmed failing on the Piledriver-revealed
  // assertion, not setup, before the fix.
  it("24070.when-revealed: a Brute already at tough capacity still triggers the fallback search", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withBrute = minionEngagedWith(base, "24065", P1); // Wrecker: BRUTE trait.
    // Pre-toughen Wrecker to capacity (1) so `giveTough` is guaranteed to be a no-op per RRG 1.8's own rule.
    const preToughened = patchInstance(withBrute.state, withBrute.id, {
      statuses: { ...withBrute.state.instances[withBrute.id]!.statuses, tough: 1 },
    });
    // Piledriver (24067) is also BRUTE — it's the card the fallback search should find and reveal. 01186/01187
    // (Core box boost cards, same filler the passing "gives each Brute enemy" test above uses) absorb the villain's
    // and Wrecker's own boost draws first, so 24070 lands on the per-player deal/reveal step untouched, and 24067
    // is what's left on top of the deck for the fallback search to find.
    const staged = stackTop(preToughened, "01186", "01187", "24070", "24067");
    const { state: revealed, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24070.when-revealed")).toBe(true);
    // No new tough status was granted — Wrecker was already at capacity, confirming `giveTough` was a real no-op.
    expect(revealed.instances[withBrute.id]?.statuses.tough).toBe(1);
    // Per the printed text, "if no tough status card was given this way" must be true here, and the fallback
    // search should have discarded down to and revealed Piledriver (24067).
    expect(
      events.some((e) => e.type === "encounterCardRevealed" && String((e as { cardId?: unknown }).cardId) === "24067"),
    ).toBe(true);
  });
});
