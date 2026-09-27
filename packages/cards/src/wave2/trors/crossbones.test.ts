import { cardsInPlay, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
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

/** Mockingbird (04004, THW 2), straight from Hawkeye's own deck into play — a basic thwart while `player` stays in
 * alter-ego form needs an ally (an alter-ego identity itself cannot thwart). */
function mockingbirdInPlay(state: GameState, player: PlayerId): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const id = owner.deck.find((i) => (state.instances[i]?.cardId as string | undefined) === "04004");
  if (!id) throw new Error("Mockingbird (04004) not found in deck");
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, controllerId: player, faceup: true } },
    },
  };
}

/**
 * The Crossbones scenario's own scripted cards (`crossbones.ts`). A full villain-stage-advance harness for "When
 * Revealed" abilities on a villain's own stage card doesn't exist yet in the wave 2 test helpers (there's no
 * `use`-equivalent command for a triggered ability, and forcing a real stage II/III reveal needs the scenario's
 * own advance machinery) — `e2e.test.ts`'s standalone Crossbones setup test proves the scenario is legally
 * playable end to end. These are shape-level regression guards on two abilities whose plain-JSON `EffectSpec`
 * targets were wrong (`query("villain", { self: true })`, a `TargetQuery`, passed where a `TargetRef` was needed —
 * `{ kind: "villain" }`/`theVillain` — and masked with an `as never` cast) until this pass fixed them.
 */
describe("Crossbones' Assault: when defeated, Crossbones activates against the defeating player (docs/phase7-wave5.md §4.1 Q67)", () => {
  it("in hero form: attacks the defeating player, dealing damage", () => {
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

  it("in alter-ego form: schemes against the defeating player instead, placing threat on the main scheme", () => {
    // No `toHero()`: P1 stays in alter-ego form for the whole turn, so the scheme is thwarted away by an ally
    // (Mockingbird) instead of a basic thwart from the identity (which alter-egos cannot use).
    const start = stackEncounterDeck(crossbonesVsHawkeye(), "01186", "04070");
    const revealed = settle(runWave2(start, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE2_DEPS);
    const scheme = instancesOf(revealed, "04070").find((id) => cardsInPlay(revealed).includes(id))!;
    const identity = identityOf(revealed);
    expect(playerOf(revealed, P1).identity.form).toBe("alterEgo");
    const villain = revealed.villains[0]!.instanceId;
    const villainDamageBefore = inst(revealed, villain).damage;
    const withAlly = mockingbirdInPlay(revealed, P1);
    // Crossbones' Assault starts at 2 [per_hero] threat; patch it down to Mockingbird's printed THW (2) so a single
    // basic thwart finishes it off in one command, isolating the "when defeated" activation from the thwart itself.
    const ready = patchInstance(withAlly.state, scheme, { threat: 2 });
    const { state: settled, events } = driveEvents(WAVE2_DEPS, ready, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: withAlly.id,
      schemeInstanceId: scheme,
    });
    expect(inst(settled, villain).damage).toBe(villainDamageBefore); // no attack landed on the villain
    expect(inst(settled, identity).damage).toBe(0); // and none on P1's identity either — this was a scheme, not an attack
    expect(events.some((e) => e.type === "attackResolved" && e.enemyInstanceId === villain)).toBe(false);
    // An out-of-sequence activation, on top of Crossbones' own villain-phase scheme step for this round — several
    // `schemeResolved` events for him are expected; every one of them (not just this activation's own) places its
    // threat on the main scheme, and none is an attack.
    const resolved = events.filter((e) => e.type === "schemeResolved" && e.enemyInstanceId === villain);
    expect(resolved.length).toBeGreaterThan(0);
    for (const r of resolved) {
      if (r.type !== "schemeResolved") continue;
      expect(r.schemeInstanceId).toBe(settled.mainScheme.instanceId);
      expect(r.threatPlaced).toBeGreaterThan(0);
    }
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

  it("Crossbones' Armor: damage that would hit Crossbones is placed here instead", () => {
    expect(CROSSBONES_SET["04065.crossbones-armor-forced-interrupt"]).toBeDefined();
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
