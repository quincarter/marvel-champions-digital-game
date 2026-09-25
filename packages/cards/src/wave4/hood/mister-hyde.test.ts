import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  deckId,
  encounterCardInVillainArea,
  foldModularSetIntoDeck,
  game,
  heroified,
  minionEngagedWith,
  onStage,
  patchInstance,
  stackTop,
} from "./testing.js";

/**
 * Real-game tests for the Mister Hyde modular set (`mister-hyde.ts`): Self-Experimentation (24033), Calvin Zabo
 * (24034), Mister Hyde (24035) and Hyde Formula (24036).
 *
 * Ref -> covering test:
 *  24033.when-revealed -> "searches for and reveals Mister Hyde"
 *  24033.self-experimentation-forced-interrupt -> "prevents a Brute's damage and removes that much threat instead"
 *  24034.when-revealed -> "Mister Hyde attacks with +2 ATK and overkill when he is in play"
 *  24034.when-defeated -> "searches for and puts Mister Hyde into play engaged with Calvin Zabo's own player"
 *  24035.when-revealed -> "discards Calvin Zabo, gives Mister Hyde tough, damages each hero/ally"
 *  24036.when-revealed -> "Calvin Zabo schemes +3 SCH then takes 4 damage" / (Mister Hyde/neither branches, via events)
 */

const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed), "mister_hyde");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

describe("Mister Hyde (24033-24036)", () => {
  it("24033.when-revealed: searches the encounter deck/discard for Mister Hyde and reveals him", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24033");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24033.when-revealed")).toBe(true);
    expect(events.some((e) => e.type === "encounterCardRevealed")).toBe(true);
  });

  it("24033.self-experimentation-forced-interrupt: prevents a Brute's damage and removes that much threat instead", () => {
    const base = onStage(withSet(), 0);
    const staged = encounterCardInVillainArea(base, "24033", 2);
    const brute = minionEngagedWith(staged.state, "24035", P1); // Mister Hyde: BRUTE trait.
    const before = brute.state.instances[staged.id]!.threat;
    const attacked = settle(
      runWave4(heroified(brute.state, P1), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: brute.state.players[0]!.identity.instanceId,
        targetInstanceId: brute.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(attacked.instances[brute.id]!.damage).toBe(0); // damage prevented.
    expect(attacked.instances[staged.id]!.threat).toBeLessThan(before);
  });

  it("24034.when-revealed: Mister Hyde attacks with +2 ATK and overkill when he is in play", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withHyde = minionEngagedWith(base, "24035", P1);
    // Unengaged, so she does not also activate this round (avoiding a second enemy's own boost draw eating the
    // staged reveal) — she still exists in play, which is all Calvin Zabo's own condition checks.
    const unengaged = patchInstance(withHyde.state, withHyde.id, { engagedWith: null });
    const staged = stackTop(unengaged, "01186", "24034");
    const identity = staged.players[0]!.identity.instanceId;
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24034.when-revealed")).toBe(true);
    // Mister Hyde's printed ATK is 3 (packages/content/src/data/hood/cards.ts, 24035): confirmed live below, that's
    // exactly what his own ordinary villain-phase activation deals (undefended, unengaged, no boost). +2 from Calvin
    // Zabo's own text should make a *second*, distinct attack from him this same phase deal 5 — isolated from his
    // ordinary activation by amount, since both are sourced from the same physical instance. Weak-test finding
    // (rules-qa-engineer, docs/phase7-wave4-qa.md): the prior version of this test only asserted the ability
    // *fired*, the same "fired but never took effect" shape §3.51 found for this exact card's overkill/ATK-bonus
    // keywords before the fix landed.
    const dealtToIdentity = events.filter(
      (e): e is Extract<(typeof events)[number], { type: "damageDealt" }> =>
        e.type === "damageDealt" && e.targetInstanceId === identity && e.sourceInstanceId === withHyde.id,
    );
    expect(dealtToIdentity.map((e) => e.amount).sort()).toEqual([3, 5]);
  });

  it("24034.when-defeated: searches for and puts Mister Hyde into play engaged with Calvin Zabo's own player", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24034", P1);
    const near = patchInstance(staged.state, staged.id, { damage: 999 });
    const defeated = settle(
      runWave4(near, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: near.players[0]!.identity.instanceId,
        targetInstanceId: staged.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(defeated.players[0]!.playArea.some((id) => defeated.instances[id]?.cardId === ("24035" as never))).toBe(
      true,
    );
  });

  it("24035.when-revealed: discards Calvin Zabo, gives Mister Hyde tough, and damages each hero/ally", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withZabo = minionEngagedWith(base, "24034", P1);
    const staged = stackTop(withZabo.state, "01186", "24035");
    const identity = staged.players[0]!.identity.instanceId;
    const damageBefore = staged.instances[identity]!.damage;
    const { state: activated, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24035.when-revealed")).toBe(true);
    expect(activated.instances[identity]!.damage).toBeGreaterThan(damageBefore);
    expect(activated.players[0]!.playArea.some((id) => activated.instances[id]?.cardId === ("24034" as never))).toBe(
      false,
    );
  });

  it("24036.when-revealed: neither Calvin Zabo nor Mister Hyde in play -> this card gains surge (discards itself, an extra card is revealed)", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24036");
    const deckBefore = staged.encounterDecks[deckId(staged)]!.deck.length;
    const { state: activated, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24036.when-revealed")).toBe(true);
    // Surge draws one more card than a plain reveal would: the deck shrank by at least 2 (filler + Hyde Formula
    // itself + its own surge draw) across the villain phase's own reveal step.
    expect(activated.encounterDecks[deckId(activated)]!.deck.length).toBeLessThan(deckBefore - 1);
  });
});
