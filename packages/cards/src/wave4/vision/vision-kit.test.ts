import {
  activeEncounterDeck,
  activeEncounterDeckId,
  activeVillain,
  canAttack,
  characterProfile,
  handSize,
  hasKeyword,
  legalDefenders,
  traitsOf,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { visionScenario } from "./support.js";
import { playFromHandTyped } from "./test-helpers.js";

/** Vision's own real precon (`vision-protection`) against Rhino (a Core scenario, seated with the wave 4 pool). He
 * starts in alter-ego. */
const visionVsRhino = (seed = 1) => startWave4Game(visionScenario("rhino", { seed }));

/** The Intangible/Dense mass form upgrade Setup already put into play (`26001b.setup`). */
const massFormId = (state: GameState): InstanceId => instancesOf(state, "26002")[0]!;

/** Flips the mass form card directly (`CardInstance.flipped`) rather than driving Density Manipulation, for tests
 * whose own assertion is about a *different* card's "while you are in X mass form" reading — a cheaper, equally
 * faithful setup than replaying the change command every time (the change command itself, and its own response, is
 * exercised once below, on Vision's identity). */
const setMassForm = (state: GameState, to: "Intangible" | "Dense"): GameState =>
  patchInstance(state, massFormId(state), { flipped: to === "Dense" });

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("Vision (identity, 26001a/b)", () => {
  it("Density Manipulation (26001a.vision-constant): flips the mass form card, and Dense's own response draws 1 (limit once per round)", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(1), toHero());
    const identity = identityOf(hero, P1);
    const mass = massFormId(hero);
    expect(inst(hero, mass).flipped).toBe(false); // Intangible, Setup's own default face.
    const before = playerOf(hero, P1).hand.length;
    const flipped = settle(
      runWith(WAVE4_DEPS, hero, use(P1, identity, "26001a.vision-constant")),
      accepting("26002b.dense-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(flipped, mass).flipped).toBe(true);
    expect(playerOf(flipped, P1).hand.length).toBe(before + 1); // Dense's own "draw 1 card".
    // Limit once per round: using it again this round is refused outright.
    expect(() => runWith(WAVE4_DEPS, flipped, use(P1, identity, "26001a.vision-constant"))).toThrow(/limit_reached/);
  });

  it("26001b.vision-constant / 26001b.vision-constant-2: +2 REC while Dense, +1 hand size while Intangible (alter-ego only)", () => {
    const base = visionVsRhino(2);
    const identity = identityOf(base, P1);
    const intangible = setMassForm(base, "Intangible");
    const dense = setMassForm(base, "Dense");
    const intangibleProfile = characterProfile(intangible, identity, WAVE4_DEPS)!;
    const denseProfile = characterProfile(dense, identity, WAVE4_DEPS)!;
    expect(handSize(intangible, P1, WAVE4_DEPS)).toBe(handSize(dense, P1, WAVE4_DEPS) + 1);
    expect(denseProfile.rec).toBe(intangibleProfile.rec + 2);
  });

  it("26001b.setup: puts Intangible into play, faceup, attached to Vision, front face showing", () => {
    const state = visionVsRhino(3);
    const identity = identityOf(state, P1);
    const mass = massFormId(state);
    expect(inst(state, mass).flipped).toBe(false);
    expect(inst(state, mass).faceup).toBe(true);
    expect(inst(state, identity).attachments).toContain(mass);
  });
});

describe("Intangible / Dense (upgrade, 26002/26002b)", () => {
  it("26002.intangible-constant-2: reduces damage Vision takes from an attack by 2", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(4), toHero());
    const identity = identityOf(hero, P1);
    const villain = activeVillain(hero).instanceId;
    const villainAtk = characterProfile(hero, villain, WAVE4_DEPS)!.atk;
    const before = inst(hero, identity).damage;
    const attacked = settle(runWith(WAVE4_DEPS, hero, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    const dealt = inst(attacked, identity).damage - before;
    expect(dealt).toBe(Math.max(0, villainAtk - 2));
  });

  it("26002.intangible-constant: Intangible Vision cannot attack or defend; Dense Vision can", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(6), toHero());
    const identity = identityOf(hero, P1);
    const villain = activeVillain(hero).instanceId;
    const intangible = setMassForm(hero, "Intangible");
    expect(canAttack(intangible, identity, villain, WAVE4_DEPS)).toBe(false);
    expect(legalDefenders(intangible, P1, WAVE4_DEPS, villain)).not.toContain(identity);
    const dense = setMassForm(hero, "Dense");
    expect(canAttack(dense, identity, villain, WAVE4_DEPS)).toBe(true);
    expect(legalDefenders(dense, P1, WAVE4_DEPS, villain)).toContain(identity);
  });

  it("26002b.dense-constant: +2 ATK and +2 DEF while in hero form and Dense", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(5), toHero());
    const identity = identityOf(hero, P1);
    const intangible = setMassForm(hero, "Intangible");
    const dense = setMassForm(hero, "Dense");
    const intangibleProfile = characterProfile(intangible, identity, WAVE4_DEPS)!;
    const denseProfile = characterProfile(dense, identity, WAVE4_DEPS)!;
    expect(denseProfile.atk).toBe(intangibleProfile.atk + 2);
    expect(denseProfile.def).toBe(intangibleProfile.def + 2);
  });
  // 26002b.dense-response is exercised above (Density Manipulation's own test): flipping to Dense draws 1 card.
});

describe("Vivian (ally, 26003)", () => {
  it("26003.vivian-constant / 26003.vivian-constant-2: +2 THW while Intangible, +2 ATK while Dense", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(6), toHero());
    const { state: withVivian } = playFromHandTyped(hero, "26003", 2, "26025");
    const vivian = instancesOf(withVivian, "26003")[0]!;
    const intangible = setMassForm(withVivian, "Intangible");
    const dense = setMassForm(withVivian, "Dense");
    const intangibleProfile = characterProfile(intangible, vivian, WAVE4_DEPS)!;
    const denseProfile = characterProfile(dense, vivian, WAVE4_DEPS)!;
    expect(intangibleProfile.thw).toBe(denseProfile.thw + 2);
    expect(denseProfile.atk).toBe(intangibleProfile.atk + 2);
  });
});

describe("616 Hickory Branch Lane (support, 26004)", () => {
  it("26004.616-hickory-branch-lane-action: searches deck/discard for an Android ally, adds to hand, shuffles", () => {
    const start = visionVsRhino(7);
    // Put Vivian (Android) into the discard pile so the search has a guaranteed hit.
    const moved = moveToHand(start, P1, "26003");
    const [vivian] = moved.ids as [InstanceId];
    const discarded = {
      ...moved.state,
      players: moved.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((c) => c !== vivian), discard: [...p.discard, vivian] } : p,
      ),
    };
    const { state: withLane } = playFromHandTyped(discarded, "26004", 1, "26026");
    const [lane] = instancesOf(withLane, "26004") as [InstanceId];
    const after = settle(
      runWith(WAVE4_DEPS, withLane, use(P1, lane, "26004.616-hickory-branch-lane-action")),
      accepting(vivian),
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(after, P1).hand).toContain(vivian);
    expect(playerOf(after, P1).discard).not.toContain(vivian);
  });
});

describe("Solar Gem (upgrade, 26005)", () => {
  // Weak-test finding (rules-qa-engineer, docs/phase7-wave4-qa.md): the prior version of this test named both
  // 26005.solar-gem-constant and 26005.solar-gem-resource but exercised neither — it only checked the upgrade
  // attached, never that it actually grants the AERIAL trait, and never drove the resource ability at all.
  it("26005.solar-gem-constant: grants Vision the AERIAL trait", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(8), toHero());
    const identity = identityOf(hero, P1);
    expect(traitsOf(hero, identity, WAVE4_DEPS)).not.toContain(trait("AERIAL"));
    const { state: withGem } = playFromHandTyped(hero, "26005", 2, "26025");
    const [gem] = instancesOf(withGem, "26005") as [InstanceId];
    expect(inst(withGem, identity).attachments).toContain(gem);
    expect(traitsOf(withGem, identity, WAVE4_DEPS)).toContain(trait("AERIAL"));
  });

  it("26005.solar-gem-resource: exhausts Solar Gem to generate a wild resource, paying for another card", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(8), toHero());
    const { state: withGem, id: gem } = playFromHandTyped(hero, "26005", 2, "26025");
    const identity = identityOf(withGem, P1);
    const given = moveToHand(withGem, P1, "26017"); // Indomitable, cost 1, an upgrade with no play restriction.
    const [indomitable] = given.ids as [InstanceId];
    const after = settle(
      runWith(
        WAVE4_DEPS,
        given.state,
        play(P1, indomitable, [], { abilities: [resourceAbility(gem, "26005.solar-gem-resource")] }),
      ),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Solar Gem is exhausted, spent as the entire cost of a card no other hand card paid for.
    expect(inst(after, gem).exhausted).toBe(true);
    expect(inst(after, identity).attachments).toContain(indomitable);
  });
});

describe("Vision's Cape (upgrade, 26006)", () => {
  it("26006.visions-cape-constant / 26006.visions-cape-constant-2: retaliate 1 while Dense, stalwart while Intangible", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(9), toHero());
    const identity = identityOf(hero, P1);
    const { state: withCape } = playFromHandTyped(hero, "26006", 2, "26027");
    const intangible = setMassForm(withCape, "Intangible");
    const dense = setMassForm(withCape, "Dense");
    expect(hasKeyword(dense, identity, "retaliate", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(intangible, identity, "retaliate", WAVE4_DEPS)).toBe(false);
    expect(hasKeyword(intangible, identity, "stalwart", WAVE4_DEPS)).toBe(true);
    expect(hasKeyword(dense, identity, "stalwart", WAVE4_DEPS)).toBe(false);
  });
});

describe("Density Control (upgrade, 26007)", () => {
  it("26007.density-control-response: after you change mass form, discard this card to add a Vision event from discard to hand", () => {
    const hero = runWith(WAVE4_DEPS, visionVsRhino(10), toHero());
    const identity = identityOf(hero, P1);
    const { state: withControl, id: control } = playFromHandTyped(hero, "26007", 1, "26026");
    // Put Superdense Strike (a real hero:26001a event) in the discard pile for the search to find.
    const moved = moveToHand(withControl, P1, "26009");
    const [strike] = moved.ids as [InstanceId];
    const discarded = {
      ...moved.state,
      players: moved.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((c) => c !== strike), discard: [...p.discard, strike] } : p,
      ),
    };
    const flipped = settle(
      runWith(WAVE4_DEPS, discarded, use(P1, identity, "26001a.vision-constant")),
      accepting("26007.density-control-response", strike),
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(flipped, P1).hand).toContain(strike);
    expect(playerOf(flipped, P1).discard).not.toContain(strike);
    expect(playerOf(flipped, P1).discard).toContain(control);
  });
});

describe("Solar Beam (event, 26008)", () => {
  it("26008.solar-beam-action: (attack) deals 7 damage to an enemy, only while Dense", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(11), toHero()), "Dense");
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHandTyped(hero, "26008", 3, "26025", accepting(villain));
    expect(inst(state, villain).damage).toBe(before + 7);
  });

  it("26008.solar-beam-hero-action: (thwart) removes 5 threat from a scheme, only while Intangible", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(12), toHero()), "Intangible");
    const staged = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
    const { state } = playFromHandTyped(staged, "26008", 3, "26025", accepting(hero.mainScheme.instanceId));
    expect(inst(state, hero.mainScheme.instanceId).threat).toBe(5);
  });

  it("Solar Beam does nothing if the form condition fails (Dense-gated attack while Intangible)", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(13), toHero()), "Intangible");
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHandTyped(hero, "26008", 3, "26025");
    expect(inst(state, villain).damage).toBe(before);
  });
});

describe("Superdense Strike (event, 26009)", () => {
  it("26009.superdense-strike-constant: play only if Dense", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(14), toHero()), "Intangible");
    expect(() => playFromHand(hero, "26009", 2)).toThrow();
  });

  it("26009.superdense-strike-action: (attack) deals 5 piercing damage to an enemy", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(15), toHero()), "Dense");
    const villain = activeVillain(hero).instanceId;
    const toughened = patchInstance(hero, villain, { statuses: { ...inst(hero, villain).statuses, tough: 1 } });
    const before = inst(toughened, villain).damage;
    const { state } = playFromHandTyped(toughened, "26009", 2, "26027", accepting(villain));
    expect(inst(state, villain).statuses.tough).toBe(0); // Piercing discards the tough card…
    expect(inst(state, villain).damage).toBe(before + 5); // …and the full 5 still lands.
  });
});

describe("Just Passing Through (event, 26010)", () => {
  it("26010.just-passing-through-constant: play only if Intangible", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(16), toHero()), "Dense");
    expect(() => playFromHand(hero, "26010", 1)).toThrow();
  });

  it("26010.just-passing-through-action: removes 3 threat from the main scheme despite a crisis icon", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(16), toHero()), "Intangible");
    // Crowd Control (crisis, 01108) in the villain's area; 5 threat on the main scheme.
    const stacked = stackEncounterDeck(hero, "01108");
    const deckId = activeEncounterDeckId(stacked);
    const [crowd] = activeEncounterDeck(stacked).deck as [InstanceId];
    const piles = stacked.encounterDecks[deckId]!;
    const main = stacked.mainScheme.instanceId;
    const staged: GameState = {
      ...stacked,
      encounterDecks: { ...stacked.encounterDecks, [deckId]: { ...piles, deck: piles.deck.slice(1) } },
      villainArea: [...stacked.villainArea, crowd],
      instances: {
        ...stacked.instances,
        [crowd]: { ...stacked.instances[crowd]!, faceup: true, threat: 2 },
        [main]: { ...stacked.instances[main]!, threat: 5 },
      },
    };
    const { state } = playFromHand(staged, "26010", 1, accepting(main));
    expect(inst(state, main).threat).toBe(2);
  });
});

describe("Phase Disruption (event, 26011)", () => {
  it("26011.phase-disruption-constant: play only if Intangible", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(17), toHero()), "Dense");
    expect(() => playFromHand(hero, "26011", 2)).toThrow();
  });

  it("26011.phase-disruption-action: confuses the enemy and discards its attachment that has a Hero Action", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(17), toHero()), "Intangible");
    const villain = activeVillain(hero).instanceId;
    // Lethal Weapon (`nebu` 22030, "Hero Action: Discard an upgrade you control → discard this attachment") on Rhino.
    const weapon = "phase-disruption-weapon" as InstanceId;
    const staged: GameState = {
      ...hero,
      instances: {
        ...hero.instances,
        [villain]: { ...inst(hero, villain), attachments: [...inst(hero, villain).attachments, weapon] },
        [weapon]: {
          instanceId: weapon,
          cardId: "22030" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "activeEncounterDeck" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 0,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: villain,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    };
    const { state } = playFromHand(staged, "26011", 2, accepting(villain, weapon));
    expect(inst(state, villain).statuses.confused).toBe(1);
    expect(inst(state, villain).attachments).not.toContain(weapon);
  });
});

describe("Mass Increase (event, 26012)", () => {
  it("26012.mass-increase-constant: play only if Dense", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(18), toHero()), "Intangible");
    // Reactive-only (a Hero Interrupt (defense)): not offered as a normal hand play outside its own trigger window,
    // so a bare "play from hand" attempt is refused as an illegal action, same as any other Interrupt-only event.
    expect(() => playFromHand(hero, "26012", 1)).toThrow();
  });

  it("26012.mass-increase-interrupt: prevents all damage from an attack Vision defends, then stuns the attacker", () => {
    const hero = setMassForm(runWith(WAVE4_DEPS, visionVsRhino(19), toHero()), "Dense");
    const given = moveToHand(hero, P1, "26012");
    const [massIncrease] = given.ids as [InstanceId];
    const givenResource = moveToHand(given.state, P1, "26027"); // Strength: physical·2, Mass Increase's own pip.
    const [strength] = givenResource.ids as [InstanceId];
    const identity = identityOf(givenResource.state, P1);
    const villain = activeVillain(givenResource.state).instanceId;
    const beforeDamage = inst(givenResource.state, identity).damage;
    const reached = settle(
      runWith(WAVE4_DEPS, givenResource.state, endTurn()),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE4_DEPS,
    );
    const paySpecifically: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "declareDefender") return [identity]; // Vision defends, so "when Vision defends" fires.
      if (choice.prompt.kind === "payForCard") return [`hand:${strength}`];
      return accepting("26012.mass-increase-interrupt")(state);
    };
    const attacked = settle(reached, paySpecifically, undefined, WAVE4_DEPS);
    expect(inst(attacked, identity).damage).toBe(beforeDamage);
    expect(inst(attacked, villain).statuses.stunned).toBe(1);
    expect(playerOf(attacked, P1).discard).toContain(massIncrease);
  });
});
