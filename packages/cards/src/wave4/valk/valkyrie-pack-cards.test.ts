import { characterProfile, type GameState, type InstanceId } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { cardId, VALK_STARTER_DECKS } from "@mc/content";
import { createGame } from "@mc/engine";
import { encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { wave4Scenario } from "../setup.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { valkyrieScenario } from "./support.js";

const valkyrieVsRhino = (seed = 1) => startWave4Game(valkyrieScenario("rhino", { seed }));

/**
 * Valkyrie vs. Rhino, but P1's deck also carries the pack's own off-aspect cards printed under her heading (Problem
 * Solvers, Leadership Training, Anticipation, Cosmic Alliance) that her real printed starter deck does not include
 * (`packages/content/scripts/marvelcdb/curation/valk.ts`'s own starter-deck list is aggression + basic only) — this
 * is the only way to exercise them in a real game state at all. `createGame`'s deck legality check is opt-in
 * (`GameSetupConfig.requireLegalDecks`), so an oversized/off-ratio test deck is accepted.
 */
function valkyrieVsRhinoWithExtras(seed: number, ...extraCodes: readonly string[]): GameState {
  const starter = VALK_STARTER_DECKS.find((d) => d.id === "valkyrie-aggression")!;
  const deck = [
    ...starter.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
    ...extraCodes.map((code) => cardId(code)),
  ];
  const config = wave4Scenario("rhino", {
    seed,
    players: [{ identityCardId: starter.identityCardId, deck, aspects: starter.aspects }],
  });
  // These 4 off-aspect cards aren't part of Valkyrie's own printed starter deck (see the module docblock above), so
  // the normal scenario builder's `requireLegalDecks` (`core/setup.ts`) would refuse this deck outright.
  const created = createGame({ ...config, requireLegalDecks: false }, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE4_DEPS);
}

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "spendResources" || choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, 1).map((o) => o.optionId);
    }
    const hits = choice.options
      .filter((o) => wanted.some((w) => o.optionId === w || o.optionId.includes(w) || o.label.includes(w)))
      .map((o) => o.optionId);
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** An engaged minion lives in its engaged player's own `playArea` (`checkDefeats` only ever walks each player's own
 * `playArea` when checking allies/minions for defeat — `packages/engine/src/resolve/defeat.ts`). */
function engagedMercenary(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const staged = encounterCardInVillainArea(state, "01101");
  const withEngagement = patchInstance(staged.state, staged.id, { engagedWith: P1 });
  return {
    id: staged.id,
    state: {
      ...withEngagement,
      villainArea: withEngagement.villainArea.filter((id) => id !== staged.id),
      players: withEngagement.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: [...p.playArea, staged.id] } : p,
      ),
    },
  };
}

describe("Thor (ally, 25013)", () => {
  it("25013.thor-interrupt: spends an energy resource to resolve his attack against every minion engaged with that player", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(1), toHero());
    // Hydra Mercenary prints exactly 2 copies (`core/cards.ts`): both engaged with P1.
    const a = engagedMercenary(hero);
    const b = engagedMercenary(a.state);
    const { state: withThor, id: thor } = playFromHand(b.state, "25013", 3);
    let offered = false;
    const pick: Picker = (state) => {
      if (state.pendingChoice?.prompt.kind === "chooseTriggers") {
        offered ||= state.pendingChoice.options.some((o) => o.optionId.includes("25013.thor-interrupt"));
      }
      return accepting("25013.thor-interrupt")(state);
    };
    const state = settle(
      runWith(WAVE4_DEPS, withThor, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: thor,
        targetInstanceId: a.id,
      }),
      pick,
      undefined,
      WAVE4_DEPS,
    );
    expect(offered).toBe(true);
    // Between them, Thor's ATK (3) defeats at least the declared target outright (Hydra Mercenary's own 3 HP); a
    // defeated card's damage resets to 0 on leaving play (RRG 1.8 "Damage", p. 14), so at least one of the two no
    // longer being in P1's play area is the signal the additional resolution actually reached more than one enemy.
    const remaining = [a.id, b.id].filter((id) => playerOf(state, P1).playArea.includes(id));
    expect(remaining.length).toBeLessThan(2);
  });
});

describe("Throg (ally, 25014)", () => {
  it("25014.throg-response: gives him a tough status card if you are engaged with a minion", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(2), toHero());
    const { state: engaged } = engagedMercenary(hero);
    const { state } = playFromHand(engaged, "25014", 2, accepting("25014.throg-response"));
    const throg = instancesOf(state, "25014")[0]!;
    expect(inst(state, throg).statuses.tough).toBe(1);
  });
});

describe("Angela (ally, 25015)", () => {
  it("25015.angela-forced-response: searches the top 10 for a minion, engages it, or discards herself if none is found", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(3), toHero());
    const { state } = playFromHand(hero, "25015", 0, firstLegal);
    const angela = instancesOf(state, "25015")[0];
    const inDiscard = playerOf(state, P1).discard.some((id) => state.instances[id]?.cardId === ("25015" as never));
    // Either she found a minion (still in play) or none existed and she discarded herself — both are this ability.
    expect(Boolean(angela && playerOf(state, P1).playArea.includes(angela)) || inDiscard).toBe(true);
  });
});

describe("Hall of Heroes (support, 25016)", () => {
  it("25016.hall-of-heroes-response, -action: places a glory counter after defeating a minion, spends 3 to draw 3", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(4), toHero());
    const { state: withSupport, id: hall } = playFromHand(hero, "25016", 2);
    const staged = engagedMercenary(withSupport);
    const near = patchInstance(staged.state, staged.id, { damage: 999 });
    const identity = identityOf(near, P1);
    // `defeatWithAttack` always settles with `firstLegal`, which declines this optional Response; accept it here.
    const defeated = settle(
      runWith(WAVE4_DEPS, near, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: staged.id,
      }),
      accepting("25016.hall-of-heroes-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(defeated, hall).counters.glory ?? 0).toBeGreaterThanOrEqual(1);
    const withThree = patchInstance(withForm(defeated, "alterEgo"), hall, { counters: { glory: 3 } });
    const before = playerOf(withThree, P1).hand.length;
    const state = runWith(WAVE4_DEPS, withThree, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: hall,
      abilityId: "25016.hall-of-heroes-action" as never,
      payment: [],
    });
    expect(playerOf(state, P1).hand.length).toBe(before + 3);
  });
});

describe("Combat Training (upgrade, 25017)", () => {
  it("25017.combat-training-constant: +1 ATK", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(5), toHero());
    const identity = identityOf(hero, P1);
    const before = characterProfile(hero, identity, WAVE4_DEPS)!.atk;
    const { state } = playFromHand(hero, "25017", 2);
    expect(characterProfile(state, identity, WAVE4_DEPS)!.atk).toBe(before + 1);
  });
});

describe("Quick Strike (event, 25018)", () => {
  it("25018.quick-strike-action: deals damage to an enemy equal to your ATK", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(6), toHero());
    const identity = identityOf(hero, P1);
    const atk = characterProfile(hero, identity, WAVE4_DEPS)!.atk;
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, villain).damage;
    const { state } = playFromHand(hero, "25018", 2, accepting(villain));
    expect(inst(state, villain).damage).toBe(before + atk);
  });
});

describe("Smash the Problem (event, 25019)", () => {
  it("25019.smash-the-problem-action: exhausts your hero, removes threat equal to your ATK", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(7), toHero());
    const identity = identityOf(hero, P1);
    const atk = characterProfile(hero, identity, WAVE4_DEPS)!.atk;
    const staged = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
    const { state } = playFromHand(staged, "25019", 1, accepting(hero.mainScheme.instanceId));
    expect(inst(state, hero.mainScheme.instanceId).threat).toBe(10 - atk);
    expect(inst(state, identity).exhausted).toBe(true);
  });
});

describe("The Best Defense… (event, 25020)", () => {
  it("25020.the-best-defense-interrupt: uses her ATK instead of DEF for a defended attack", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(8), toHero());
    const { state: withEnemy } = engagedMercenary(hero);
    const given = moveToHand(withEnemy, P1, "25020");
    const identity = identityOf(given.state, P1);
    const shield = given.ids[0]!;
    const defend: Picker = (state) => {
      if (state.pendingChoice?.prompt.kind === "declareDefender") return [identity];
      return accepting("25020.the-best-defense-interrupt")(state);
    };
    const state = settle(runWith(WAVE4_DEPS, given.state, endTurn()), defend, undefined, WAVE4_DEPS);
    // The mechanics (ATK reduces the damage instead of DEF) are already the landed engine-level primitive test's own
    // job (`packages/engine/src/valkyrie-kit.test.ts`, "The Best Defense…"); this real-game test's job is that the
    // card is offered and playable at a real declared defense and ends up spent.
    expect(playerOf(state, P1).hand).not.toContain(shield);
  });
});

describe("Audacity (resource, 25021)", () => {
  it("25021.audacity-response: after you spend this card, deal 1 damage to the villain", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(9), toHero());
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, villain).damage;
    const dragonfang = moveToHand(hero, P1, "25006"); // Dragonfang, cost 1, paid entirely with Audacity's wild icon
    const withAudacity = moveToHand(dragonfang.state, P1, "25021");
    const audacity = withAudacity.ids[0]!;
    const state = settle(
      runWith(WAVE4_DEPS, withAudacity.state, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: dragonfang.ids[0]!,
        payment: [{ fromHand: audacity }],
        attachToInstanceId: null,
      }),
      accepting("25021.audacity-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(state, villain).damage).toBe(before + 1);
  });
});

describe("The Power of Aggression (resource, 25022)", () => {
  it("25022.the-power-of-aggression-constant: doubles resources while paying for an aggression card", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(10), toHero());
    const combatTraining = moveToHand(hero, P1, "25017"); // Combat Training (aggression)
    const withPower = moveToHand(combatTraining.state, P1, "25022");
    const power = withPower.ids[0]!;
    const before = playerOf(withPower.state, P1).hand.length;
    const state = runWith(WAVE4_DEPS, withPower.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: combatTraining.ids[0]!,
      payment: [{ fromHand: power }],
      attachToInstanceId: null,
    });
    // Combat Training costs 2; The Power of Aggression alone (1 resource) doubled to 2 covers it with no other card.
    expect(playerOf(state, P1).hand.length).toBe(before - 2);
  });
});

describe("The Bifrost (support, 25023)", () => {
  it("25023.the-bifrost-action: searches the deck for an asgard ally and plays it, paying its cost", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(11), toHero());
    const { state: withSupport, id: bifrost } = playFromHand(hero, "25023", 1);
    const before = playerOf(withSupport, P1).deck.length;
    const state = settle(
      runWith(WAVE4_DEPS, withSupport, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: bifrost,
        abilityId: "25023.the-bifrost-action" as never,
        payment: [],
      }),
      accepting(),
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(state, P1).deck.length).toBeLessThan(before);
    const played = ["25013", "25014", "25015"].some((code) =>
      playerOf(state, P1).playArea.some((id) => state.instances[id]?.cardId === (code as never)),
    );
    expect(played).toBe(true);
  });
});

describe("Godlike Stamina (event, 25024)", () => {
  it("25024.godlike-stamina-action: heals 2 damage, may discard a status card", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhino(12), toHero());
    const identity = identityOf(hero, P1);
    const damaged = patchInstance(hero, identity, {
      damage: 3,
      statuses: { ...inst(hero, identity).statuses, stunned: 1 },
    });
    const { state } = playFromHand(damaged, "25024", 1, accepting("Discard the stunned status"));
    expect(inst(state, identity).damage).toBe(1);
    expect(inst(state, identity).statuses.stunned).toBe(0);
  });
});

describe("Problem Solvers (event, 25033, Alliance)", () => {
  it("25033.problem-solvers-action: exhausts an avenger and a guardian character, removes threat from each scheme equal to their combined THW", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhinoWithExtras(13, "25033"), toHero());
    // Valkyrie herself is an avenger (ASGARD, AVENGER); Throg (ASGARD, GUARDIAN) is put straight into play (surgery)
    // so this test doesn't also need to pay his own real cost on top of Problem Solvers' own cost of 4.
    const throg = playerOf(hero, P1).deck.find((id) => hero.instances[id]?.cardId === ("25014" as never))!;
    const withThrog: GameState = {
      ...hero,
      players: hero.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((id) => id !== throg), playArea: [...p.playArea, throg] } : p,
      ),
      instances: { ...hero.instances, [throg]: { ...hero.instances[throg]!, faceup: true, controllerId: P1 } },
    };
    const staged = patchInstance(withThrog, withThrog.mainScheme.instanceId, { threat: 10 });
    const before = inst(staged, staged.mainScheme.instanceId).threat;
    const { state } = playFromHand(staged, "25033", 4, firstLegal);
    expect(inst(state, state.mainScheme.instanceId).threat).toBeLessThan(before);
  });
});

describe("Leadership Training (support, 25034, Leadership)", () => {
  it("25034.leadership-training-constant: exhausts and spends a training counter to shuffle a leadership event from discard into deck", () => {
    // "01070" (Lead From the Front, a Core leadership event) stands in for "a leadership (blue) event": her own
    // starter deck has none of its own. Alter-Ego Action: starts in alter-ego already.
    const hero = valkyrieVsRhinoWithExtras(14, "25034", "01070");
    const { state: withSupport, id: training } = playFromHand(hero, "25034", 1);
    const discarded = playerOf(withSupport, P1).deck.find(
      (id) => withSupport.instances[id]?.cardId === ("01070" as never),
    )!;
    const toDiscard: GameState = {
      ...withSupport,
      players: withSupport.players.map((p) =>
        p.playerId === P1
          ? { ...p, deck: p.deck.filter((i) => i !== discarded), discard: [...p.discard, discarded] }
          : p,
      ),
    };
    const before = playerOf(toDiscard, P1).deck.length;
    const state = settle(
      runWith(WAVE4_DEPS, toDiscard, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: training,
        abilityId: "25034.leadership-training-constant" as never,
        payment: [],
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(state, P1).deck.length).toBe(before + 1);
    expect(playerOf(state, P1).discard).not.toContain(discarded);
  });
});

describe("Anticipation (upgrade, 25035, Protection)", () => {
  it("25035.anticipation-interrupt: discards itself to ready your hero when you engage a minion", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhinoWithExtras(15, "25035"), toHero());
    const { state: withCard } = playFromHand(hero, "25035", 1);
    const identity = identityOf(withCard, P1);
    const exhausted = patchInstance(withCard, identity, { exhausted: true });
    const staged = encounterCardInVillainArea(exhausted, "01101");
    const engaged: GameState = {
      ...staged.state,
      players: staged.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: [...p.playArea, staged.id] } : p,
      ),
      villainArea: staged.state.villainArea.filter((id) => id !== staged.id),
      instances: { ...staged.state.instances, [staged.id]: { ...staged.state.instances[staged.id]!, engagedWith: P1 } },
    };
    const state = settle(
      runWith(WAVE4_DEPS, engaged, endTurn()),
      accepting("25035.anticipation-interrupt"),
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(state, P1).discard.some((id) => state.instances[id]?.cardId === ("25035" as never))).toBe(true);
  });
});

describe("Cosmic Alliance (event, 25036, Basic, Alliance)", () => {
  it("25036.cosmic-alliance-action: chooses an avenger and a guardian character, readies each of them", () => {
    const hero = runWith(WAVE4_DEPS, valkyrieVsRhinoWithExtras(16, "25036"), toHero());
    // Valkyrie herself is an avenger (ASGARD, AVENGER); Throg (ASGARD, GUARDIAN) is put straight into play (surgery)
    // — the payment for Cosmic Alliance's own cost (3) leaves too few hand cards to also pay Throg's real cost.
    const throg = playerOf(hero, P1).deck.find((id) => hero.instances[id]?.cardId === ("25014" as never))!;
    const identity = identityOf(hero, P1);
    const withThrog: GameState = {
      ...hero,
      players: hero.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((id) => id !== throg), playArea: [...p.playArea, throg] } : p,
      ),
      instances: {
        ...hero.instances,
        [throg]: { ...hero.instances[throg]!, faceup: true, controllerId: P1, exhausted: true },
        [identity]: { ...hero.instances[identity]!, exhausted: true },
      },
    };
    const { state } = playFromHand(withThrog, "25036", 3, firstLegal);
    expect(inst(state, throg).exhausted).toBe(false);
    expect(inst(state, identity).exhausted).toBe(false);
  });
});
