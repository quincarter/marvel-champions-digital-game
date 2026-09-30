import { encounterSetId } from "@mc/content";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  toHero,
} from "../../../testing/harness.js";
import { driveEvents } from "../../../testing/staging.js";
import { WAVE5_CARDS } from "../../index.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

/**
 * Sinister Assault (`sm` 27158–27163, `sinister-assault.ts`) — reached through a `ghostSpiderScenario("venom", …)`
 * game (`osborn-tech.test.ts`'s own precedent for this pack). Every card is dealt as an ordinary encounter card
 * (no scripted When Revealed puts it into play): revealing a minion engages it with the revealer as the plain
 * reveal rule (RRG 1.8 "Reveal", p. 38), so `revealAndEngage` below reaches that with `stackEncounterDeck` plus one
 * `endTurn`, the same 1-filler-then-target shape `osborn-tech.test.ts`/`frost-giants.test.ts` use — one card is
 * spent as the villain's own boost card during that same villain phase's step 2, the second is the step 3 card
 * dealt to P1.
 *
 * Each assertion reads the trigger-scoped `GameEvent`s a driven `endTurn` produces rather than a final hand/deck
 * snapshot: `driveEvents`'s open-ended choice-settling runs past the round under test into the *next* round's own
 * automatic draw step before it stops (no `pendingChoice` remains until the player must actually act — the same
 * caveat `goblin-gear.test.ts`'s own "smoke-bombs … no legal target" negative test documents), which would corrupt
 * a hand-length or deck-length diff taken from the final state.
 */
const game = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("venom", { seed, modularSetIds: [encounterSetId("sinister_assault")] }));

/** `toHero` toggles form, so it must only be sent when the identity isn't hero already. */
const asHero = (state: GameState): GameState =>
  playerOf(state, P1).identity.form === "hero" ? state : runWave5(state, toHero(P1));

const ADVANCE = "01186";

/** Stacks `code` behind one filler, ends P1's turn, and returns the resulting state with `code` now in play,
 * engaged with P1 — the plain "reveal a minion" rule, not a scripted ability. */
function revealAndEngage(
  state: GameState,
  code: string,
): { readonly state: GameState; readonly id: InstanceId; readonly events: readonly GameEvent[] } {
  const { state: revealed, events } = driveEvents(WAVE5_DEPS, stackEncounterDeck(state, ADVANCE, code), endTurn(P1));
  const id = instancesOf(revealed, code).find((candidate) => inst(revealed, candidate).engagedWith === P1);
  if (!id) throw new Error(`${code} never engaged P1`);
  return { state: revealed, id, events };
}

/** Sums `damageDealt` events attributed to `sourceId` against `targetId`. */
const damageFrom = (events: readonly GameEvent[], sourceId: InstanceId, targetId: InstanceId): number =>
  events
    .filter(
      (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
        e.type === "damageDealt" && e.sourceInstanceId === sourceId && e.targetInstanceId === targetId,
    )
    .reduce((sum, e) => sum + e.amount, 0);

const abilityUses = (events: readonly GameEvent[], abilityId: string): number =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "abilityResolved" }> =>
      e.type === "abilityResolved" && e.abilityId === abilityId,
  ).length;

describe("Doctor Octopus (27158)", () => {
  it("27158.doctor-octopus-forced-response: after it activates against you as an attack (hero form), places 1 threat on each scheme", () => {
    const { state: revealed, id } = revealAndEngage(game(), "27158");
    const { events } = driveEvents(WAVE5_DEPS, asHero(revealed), endTurn(P1));
    const activated = events.filter(
      (e): e is Extract<GameEvent, { type: "enemyActivated" }> =>
        e.type === "enemyActivated" && e.enemyInstanceId === id,
    );
    expect(activated).toHaveLength(1);
    expect(activated[0]!.activation).toBe("attack");
    const placements = events.filter(
      (e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced" && e.sourceInstanceId === id,
    );
    expect(placements).toHaveLength(1);
    expect(placements[0]!.amount).toBe(1);
  });

  it("also fires from a scheme activation (alter-ego form) — Q67: 'activates against you' covers both", () => {
    const { state: revealed, id } = revealAndEngage(game(), "27158");
    // Stays in alter-ego form (the scenario's own starting form) — no `asHero` this time. The main scheme is reset
    // to 0 threat first: in alter-ego form the villain also schemes (rather than attacks) this round, and its own
    // placement plus step one's own would otherwise complete — and end — the scheme before Doctor Octopus's own
    // activation is reached at all.
    const reset = patchInstance(revealed, revealed.mainScheme.instanceId, { threat: 0 });
    const { events } = driveEvents(WAVE5_DEPS, reset, endTurn(P1));
    const activated = events.filter(
      (e): e is Extract<GameEvent, { type: "enemyActivated" }> =>
        e.type === "enemyActivated" && e.enemyInstanceId === id,
    );
    expect(activated).toHaveLength(1);
    expect(activated[0]!.activation).toBe("scheme");
    // The scheme activation's own ordinary threat placement (its printed SCH, 2) shares the same
    // `sourceInstanceId` (the schemer) as this ability's own separate +1 — distinguished here by amount, since
    // this card's own placement is always exactly 1.
    const placements = events.filter(
      (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
        e.type === "threatPlaced" && e.sourceInstanceId === id && e.amount === 1,
    );
    expect(placements).toHaveLength(1);
    const naturalScheme = events.filter(
      (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
        e.type === "threatPlaced" && e.sourceInstanceId === id && e.amount === 2,
    );
    expect(naturalScheme).toHaveLength(1); // its own SCH 2, confirming this really was a scheme activation.
  });
});

describe("Electro (27159)", () => {
  it("27159.electro-forced-response: after it engages you (the plain reveal-a-minion rule, not a 'when revealed'), mills your deck until an [energy] or [wild] resource", () => {
    const { state: revealed, id, events } = revealAndEngage(game(), "27159");
    expect(abilityUses(events, "27159.electro-forced-response")).toBe(1);
    const moved = events.filter(
      (e): e is Extract<GameEvent, { type: "cardMoved" }> =>
        e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard" && e.to.playerId === P1,
    );
    expect(moved.length).toBeGreaterThanOrEqual(1);
    // Every discarded card but the last has neither icon (the mill would have stopped there); the last does.
    const cardOf = (id2: InstanceId) =>
      WAVE5_CARDS.find((c: (typeof WAVE5_CARDS)[number]) => c.id === inst(revealed, id2).cardId);
    const hasEnergyOrWild = (id2: InstanceId) => {
      const card = cardOf(id2);
      const icons = card && "resourceIcons" in card ? card.resourceIcons : undefined;
      return (icons?.energy ?? 0) > 0 || (icons?.wild ?? 0) > 0;
    };
    const last = moved[moved.length - 1]!;
    expect(hasEnergyOrWild(last.instanceId)).toBe(true);
    for (const m of moved.slice(0, -1)) expect(hasEnergyOrWild(m.instanceId)).toBe(false);
    expect(inst(revealed, id).engagedWith).toBe(P1);
  });
});

describe("Hobgoblin (27160)", () => {
  it("27160.hobgoblin-forced-response: after it attacks you (hero form, undefended), deals 2 indirect damage on top of its own 2 ATK", () => {
    const { state: revealed, id } = revealAndEngage(game(), "27160");
    const identity = identityOf(revealed, P1);
    const { events } = driveEvents(WAVE5_DEPS, asHero(revealed), endTurn(P1));
    expect(abilityUses(events, "27160.hobgoblin-forced-response")).toBe(1);
    // Its own attack (ATK 2, undefended) plus this card's own 2 indirect damage — both attributed to Hobgoblin as
    // `damageDealt`'s own source, isolating it from the villain's own separate, unrelated attack the same phase.
    expect(damageFrom(events, id, identity)).toBe(2 + 2);
  });
});

describe("Kraven the Hunter (27161)", () => {
  it("27161.kraven-the-hunter-forced-response: after it attacks and damages a character you control, discards 1 upgrade or support you control", () => {
    const withUpgrade = playFromHand(game(), "27009", 2); // Web-Bracelet, an upgrade.
    const { state: revealed } = revealAndEngage(withUpgrade.state, "27161");
    const { state: after, events } = driveEvents(WAVE5_DEPS, asHero(revealed), endTurn(P1));
    expect(abilityUses(events, "27161.kraven-the-hunter-forced-response")).toBe(1);
    expect(playerOf(after, P1).playArea).not.toContain(withUpgrade.id);
    expect(playerOf(after, P1).discard).toContain(withUpgrade.id);
  });

  it("with no upgrade or support you control, still resolves without crashing (no legal target)", () => {
    const { state: revealed } = revealAndEngage(game(), "27161");
    const { events } = driveEvents(WAVE5_DEPS, asHero(revealed), endTurn(P1));
    expect(abilityUses(events, "27161.kraven-the-hunter-forced-response")).toBe(1);
  });
});

describe("Scorpion (27162)", () => {
  it("27162.scorpion-forced-response: after it attacks and damages a character (not already stunned), stuns that character instead of dealing extra damage", () => {
    const { state: revealed, id } = revealAndEngage(game(), "27162");
    const identity = identityOf(revealed, P1);
    const { state: after, events } = driveEvents(WAVE5_DEPS, asHero(revealed), endTurn(P1));
    expect(abilityUses(events, "27162.scorpion-forced-response")).toBe(1);
    expect(inst(after, identity).statuses.stunned ?? 0).toBeGreaterThanOrEqual(1);
    // Only its own 3 ATK — the "already stunned" branch's extra 2 damage never fires here.
    expect(damageFrom(events, id, identity)).toBe(3);
  });

  it("negative: if the damaged character is already stunned, deals 2 damage instead of stunning it again", () => {
    const { state: revealed, id } = revealAndEngage(game(), "27162");
    const identity = identityOf(revealed, P1);
    const preStunned = patchInstance(revealed, identity, {
      statuses: { ...inst(revealed, identity).statuses, stunned: 1 },
    });
    const { state: after, events } = driveEvents(WAVE5_DEPS, asHero(preStunned), endTurn(P1));
    expect(abilityUses(events, "27162.scorpion-forced-response")).toBe(1);
    // Its own 3 ATK plus this card's own extra 2 damage for the "already stunned" branch.
    expect(damageFrom(events, id, identity)).toBe(3 + 2);
    expect(inst(after, identity).statuses.stunned ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("Vulture (27163)", () => {
  it("27163.vulture-forced-response: after it activates against you as an attack (hero form), discards 1 random card from your hand", () => {
    const { state: revealed } = revealAndEngage(game(), "27163");
    const { events } = driveEvents(WAVE5_DEPS, asHero(revealed), endTurn(P1));
    expect(abilityUses(events, "27163.vulture-forced-response")).toBe(1);
    // Only the `cardDiscardedFromHand` after Vulture's own ability resolved is this card's doing — round 2's own
    // "discard down to hand size" step (an ordinary end-of-turn step, unrelated to Vulture) can also discard a card
    // from hand earlier in the same event stream.
    const vultureIndex = events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "27163.vulture-forced-response",
    );
    const discardedAfter = events
      .slice(vultureIndex + 1)
      .filter(
        (e): e is Extract<GameEvent, { type: "cardDiscardedFromHand" }> =>
          e.type === "cardDiscardedFromHand" && e.playerId === P1,
      );
    expect(discardedAfter.length).toBeGreaterThanOrEqual(1);
  });
});
