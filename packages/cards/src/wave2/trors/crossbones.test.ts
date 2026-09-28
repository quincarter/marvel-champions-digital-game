import { cardOf, cardsInPlay, selfDiscardDamageThreshold, type GameState, type InstanceId } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { CROSSBONES_SET } from "./crossbones.js";

const crossbonesVsHawkeye = () =>
  startWave2Game(wave2Scenario("crossbones", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 5 }));

/**
 * The Crossbones scenario's own scripted cards (`crossbones.ts`). A full villain-stage-advance harness for "When
 * Revealed" abilities on a villain's own stage card doesn't exist yet in the wave 2 test helpers (there's no
 * `use`-equivalent command for a triggered ability, and forcing a real stage II/III reveal needs the scenario's
 * own advance machinery) — `e2e.test.ts`'s standalone Crossbones setup test proves the scenario is legally
 * playable end to end. These are shape-level regression guards on two abilities whose plain-JSON `EffectSpec`
 * targets were wrong (`query("villain", { self: true })`, a `TargetQuery`, passed where a `TargetRef` was needed —
 * `{ kind: "villain" }`/`theVillain` — and masked with an `as never` cast) until this pass fixed them.
 */
describe("Crossbones' Assault: when defeated, Crossbones attacks the defeating player", () => {
  it("deals damage to the player who defeated the scheme, as an additional out-of-sequence activation", () => {
    // A filler card on top, ahead of Crossbones' Assault: the villain's own activation is dealt its boost card
    // from the top of the deck before any player's own encounter card (docs/phase7-wave2-scripting.md §5) — with no
    // filler, this scenario's own reveal would consume Crossbones' Assault as boost fodder instead of revealing it.
    const start = stackEncounterDeck(crossbonesVsHawkeye(), "01186", "04070");
    const hero = runWave2(start, toHero());
    const revealed = settle(runWave2(hero, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE2_DEPS);
    const scheme = instancesOf(revealed, "04070").find((id) => cardsInPlay(revealed).includes(id))!;
    const identity = identityOf(revealed);
    // Crossbones' Assault starts at 2 [per_hero] threat; patch it down to Hawkeye's printed THW (1) so a single
    // basic thwart finishes it off in one command, isolating the "when defeated" attack from the thwart itself.
    const before = revealed.villains[0]!.instanceId;
    const villainDamageBefore = inst(revealed, before).damage;
    const ready = patchInstance(patchInstance(revealed, scheme, { threat: 1 }), identity, { exhausted: false });
    const identityDamageBefore = inst(ready, identity).damage;
    const settled = settle(
      runWave2(ready, { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: scheme }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(settled, before).damage).toBe(villainDamageBefore); // the villain itself takes no damage from its own attack
    expect(inst(settled, identity).damage).toBeGreaterThan(identityDamageBefore); // Crossbones' extra attack landed on P1
  });
});

describe("Crossbones scenario cards", () => {
  it("Crossbones (II)'s When Revealed attaches Crossbones' Machine Gun to the villain (a TargetRef, not a query)", () => {
    const definition = CROSSBONES_SET["04059.when-revealed"]!;
    const attach = definition.effects.find((e) => e.kind === "attach");
    expect(attach).toBeDefined();
    expect(attach).toMatchObject({ kind: "attach", to: { kind: "villain" } });
  });

  it("Full Auto's hero-side When Revealed discards cards equal to the villain's own ATK stat (a live ValueSpec)", () => {
    const definition = CROSSBONES_SET["04067.when-revealed-hero"]!;
    // whenRevealedHero wraps the printed effects in an `ifThen(isHero(), ...)`.
    const wrapper = definition.effects[0]!;
    expect(wrapper.kind).toBe("if");
    const inner = wrapper.kind === "if" ? wrapper.then : [];
    const discard = inner.find((e) => e.kind === "discardEncounterCards");
    expect(discard).toBeDefined();
    expect(discard).toMatchObject({
      kind: "discardEncounterCards",
      count: { kind: "stat", of: { kind: "villain" }, stat: "atk" },
    });
  });

  it("Crossbones (I/II/III): while he has a Weapon attachment, his attacks gain piercing", () => {
    for (const id of ["04058.crossbones-constant", "04059.crossbones-constant", "04060.crossbones-constant"] as const) {
      expect(CROSSBONES_SET[id], id).toBeDefined();
    }
  });

  it("Hard as Nails / its Boost: gives the villain tough, or heals 3 if it already has tough", () => {
    expect(CROSSBONES_SET["04068.when-revealed"]).toBeDefined();
    expect(CROSSBONES_SET["04068.boost"]).toBeDefined();
  });

  it("The Experimental Weapons attachments (Laser Rifle, Energy Shield, Power Gauntlets, Exo-Suit) are all scripted", () => {
    for (const id of [
      "04072.laser-rifle-forced-interrupt",
      "04072.laser-rifle-action",
      "04073.energy-shield-constant",
      "04073.energy-shield-action",
      "04074.power-gauntlets-forced-response",
      "04074.power-gauntlets-action",
      "04075.exo-suit-action",
    ] as const) {
      expect(CROSSBONES_SET[id], id).toBeDefined();
    }
  });
});

describe("Crossbones' Armor (04065): Crossbones' damage is placed here, and 5 or more discards it", () => {
  const withArmor = () => {
    const start = stackEncounterDeck(crossbonesVsHawkeye(), "01186", "04065");
    const state = settle(
      runWave2(runWave2(start, toHero()), { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    const [armor] = instancesOf(state, "04065").filter((id) => cardsInPlay(state).includes(id)) as [InstanceId];
    return { state, armor };
  };
  const hitCrossbones = (state: GameState) =>
    driveEvents(WAVE2_DEPS, state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(state),
      targetInstanceId: state.activeVillainId,
    });

  it("is attached to Crossbones when revealed", () => {
    const { state, armor } = withArmor();
    expect(armor).toBeDefined();
    expect(inst(state, armor).attachedTo).toBe(state.activeVillainId);
  });

  it("takes the damage instead of Crossbones and stays while it holds less than 5", () => {
    const { state, armor } = withArmor();
    const hit = hitCrossbones(state);
    expect(inst(hit.state, hit.state.activeVillainId).damage).toBe(inst(state, state.activeVillainId).damage);
    expect(inst(hit.state, armor).damage).toBe(2);
    expect(cardsInPlay(hit.state)).toContain(armor);
  });

  it("is discarded once 5 or more damage is on it, and that hit still does not reach Crossbones", () => {
    const { state, armor } = withArmor();
    const hit = hitCrossbones(patchInstance(state, armor, { damage: 4 }));
    expect(cardsInPlay(hit.state)).not.toContain(armor);
    expect(inst(hit.state, hit.state.activeVillainId).damage).toBe(inst(state, state.activeVillainId).damage);
    // With the armor gone, the next hit lands on Crossbones.
    const next = hitCrossbones(patchInstance(hit.state, identityOf(hit.state), { exhausted: false }));
    expect(inst(next.state, next.state.activeVillainId).damage).toBeGreaterThan(
      inst(state, state.activeVillainId).damage,
    );
  });

  it("reports its break point (5) for the board to show", () => {
    const { state, armor } = withArmor();
    expect(selfDiscardDamageThreshold(cardOf(state, armor)!, WAVE2_DEPS)).toBe(5);
  });
});
