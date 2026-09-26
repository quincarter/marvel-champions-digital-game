import { allyLimitFor, characterProfile, hasKeyword, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { nebulaScenario } from "./support.js";

const nebulaVsRhino = (seed = 1) => startWave4Game(nebulaScenario("rhino", { seed }));
const mainSchemeId = (state: GameState): InstanceId => state.mainScheme.instanceId;

/** Accepts an offered optional trigger (or a later target/order choice) whose optionId ends with one of `wanted`;
 * falls back to `firstLegal` for anything else — same convention as `nebula-kit.test.ts`. */
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

/** `accepting`, plus paying a `payForCard` prompt (an interrupt/response event played straight from hand, whose
 * cost is offered as its own choice) with whatever hand cards it offers, up to the printed cost — the
 * `wave3/gam/gamora-kit.test.ts` precedent for a "played *as* the trigger" event (Brains Over Brawn's only ability
 * is a Response, so it can only ever be played that way, never via a plain `playCard` command). */
const acceptingAndPaying =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    return accepting(...wanted)(state);
  };

/** A synthetic minion engaged with P1 (the `wave3/drax/drax-pack-cards.test.ts` "Bring It!" convention: an engaged
 * enemy's `home` is the engaged player's `playArea`, not `villainArea`). */
function withSyntheticMinion(state: GameState, id: string): { readonly state: GameState; readonly id: InstanceId } {
  const minionId = id as InstanceId;
  return {
    id: minionId,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minionId] } : p)),
      instances: {
        ...state.instances,
        [minionId]: {
          instanceId: minionId,
          cardId: "01101" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "playArea", playerId: P1 },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 0,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: P1,
          flipped: false,
        } as never,
      },
    },
  };
}

/**
 * Conjures a fresh instance of `code` directly into P1's hand (test surgery): several of this pack's cards
 * (Energy Spear 22032, Guardians of the Galaxy 22033, Defensive Training 22034, Honorary Guardian 22035) are off-
 * aspect pack cards that were never shuffled into Nebula's own `nebula-justice` starter deck, so no instance of
 * them exists anywhere in this game for `moveToHand` to find.
 */
function putInHand(
  state: GameState,
  code: string,
  instanceId: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const id = instanceId as InstanceId;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [...p.hand, id] } : p)),
      instances: {
        ...state.instances,
        [id]: {
          instanceId: id,
          cardId: code as never,
          ownerId: P1,
          controllerId: P1,
          home: { kind: "deck", playerId: P1 },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 0,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    },
  };
}

describe("Eros (ally, 22011)", () => {
  it("22011.eros-response: confuses a minion for each [mental] resource spent paying for him", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(1), toHero());
    const { state: withMinion1, id: minion1 } = withSyntheticMinion(hero, "eros-minion-1");
    const { state: withMinions, id: minion2 } = withSyntheticMinion(withMinion1, "eros-minion-2");
    const given = moveToHand(withMinions, P1, "22011", "22025"); // Eros, Genius (produces [mental][mental])
    const [eros, genius] = given.ids as [InstanceId, InstanceId];
    const after = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, eros, [genius])),
      accepting("22011.eros-response", minion1, minion2),
      undefined,
      WAVE4_DEPS,
    );
    // Genius alone pays Eros' full printed cost of 2, entirely in [mental] — so both minions get confused.
    expect(inst(after, minion1).statuses.confused).toBe(1);
    expect(inst(after, minion2).statuses.confused).toBe(1);
  });
});

describe("Wraith (ally, 22012)", () => {
  it("22012.wraith-interrupt: exhausts Wraith and deals 1 damage to him to cancel a boost card's Boost effect", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(2), toHero());
    const { state: withWraith, id: wraith } = playFromHand(hero, "22012", 3);
    // A boost card is drawn for the *villain's own* activation (RRG 1.8 "Boost", p. 11), not for a player's attack
    // against it — so this test needs the villain phase's own attack, not `basicAttack` the other way around.
    const after = settle(
      runWith(WAVE4_DEPS, withWraith, endTurn()),
      accepting("22012.wraith-interrupt"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, wraith).exhausted).toBe(true);
    expect(inst(after, wraith).damage).toBe(1);
  });
});

describe("Venom (ally, 22013)", () => {
  it("22013.venom-constant: reduces his consequential damage by 1 while there is no threat on the main scheme", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(3), toHero());
    const { state: withVenom, id: venom } = playFromHand(hero, "22013", 4);
    const zeroThreat = patchInstance(withVenom, mainSchemeId(withVenom), { threat: 0 });
    const villain = zeroThreat.villains[0]!.instanceId;
    const afterNoThreat = settle(
      runWith(WAVE4_DEPS, zeroThreat, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: venom,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Printed consequentialDamage.attack is 2; reduced to 1 while there's no threat on the main scheme.
    expect(inst(afterNoThreat, venom).damage).toBe(1);

    const withThreat = patchInstance(withVenom, mainSchemeId(withVenom), { threat: 3 });
    const afterWithThreat = settle(
      runWith(WAVE4_DEPS, withThreat, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: venom,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(afterWithThreat, venom).damage).toBe(2);
  });
});

describe("Justice Served (upgrade, 22014)", () => {
  it("22014.justice-served-response: after thwarting and removing the last threat from a scheme, discards itself and readies your hero", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(4), toHero());
    const { state: withCard, id: card } = playFromHand(hero, "22014", 1);
    const identity = identityOf(withCard, P1);
    const thwAmount = characterProfile(withCard, identity, WAVE4_DEPS)!.thw;
    const staged = patchInstance(withCard, mainSchemeId(withCard), { threat: thwAmount });
    const after = settle(
      runWith(WAVE4_DEPS, staged, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: mainSchemeId(staged),
      } as never),
      accepting("22014.justice-served-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(card);
    expect(inst(after, identity).exhausted).toBe(false);
  });
});

describe("Determination (resource, 22016)", () => {
  it("22016.determination-response: after you spend this card, remove 1 threat from the main scheme", () => {
    // Determination's own Response is printed "Hero Response:", so she must be in hero form for it to be offered.
    const start = runWith(WAVE4_DEPS, nebulaVsRhino(5), toHero());
    const staged = patchInstance(start, mainSchemeId(start), { threat: 5 });
    const given = moveToHand(staged, P1, "22016", "22019"); // Determination (wild), Heroic Intuition (cost 2, a normal Action-playable upgrade)
    const [determination, heroicIntuition] = given.ids as [InstanceId, InstanceId];
    const after = settle(
      runWith(
        WAVE4_DEPS,
        given.state,
        play(P1, heroicIntuition, [determination, ...payWith(given.state, P1, 1, [determination, heroicIntuition])]),
      ),
      accepting("22016.determination-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, mainSchemeId(after)).threat).toBe(4);
  });
});

describe("The Power of Justice (resource, 22017)", () => {
  it("22017.the-power-of-justice-constant: doubles the resources it generates while paying for a Justice card", () => {
    const start = nebulaVsRhino(6);
    const given = moveToHand(start, P1, "22017", "22019"); // The Power of Justice (wild), Heroic Intuition (justice, cost 2)
    const [powerOfJustice, heroicIntuition] = given.ids as [InstanceId, InstanceId];
    // The Power of Justice alone (doubled to 2 wild) exactly pays Heroic Intuition's printed cost of 2.
    const after = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, heroicIntuition, [powerOfJustice])),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(powerOfJustice);
    expect(playerOf(after, P1).discard).not.toContain(heroicIntuition); // it's an upgrade: stays in play
  });
});

describe("Brains Over Brawn (event, 22018)", () => {
  it("22018.brains-over-brawn-response: after your hero makes a basic thwart, deals damage to an enemy equal to your hero's THW", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(7), toHero());
    // Brains Over Brawn's only printed ability is a Response, so it can only be played *as* that trigger, straight
    // from hand — never via a plain `playCard` command (`acceptingAndPaying`'s own docblock).
    const given = moveToHand(hero, P1, "22018");
    const identity = identityOf(given.state, P1);
    const thwAmount = characterProfile(given.state, identity, WAVE4_DEPS)!.thw;
    const staged = patchInstance(given.state, mainSchemeId(given.state), { threat: thwAmount + 5 });
    const villain = staged.villains[0]!.instanceId;
    const damageBefore = inst(staged, villain).damage;
    const after = settle(
      runWith(WAVE4_DEPS, staged, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: mainSchemeId(staged),
      } as never),
      acceptingAndPaying("22018.brains-over-brawn-response", villain),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, villain).damage).toBe(damageBefore + thwAmount);
  });
});

describe("Heroic Intuition (upgrade, 22019)", () => {
  it("22019.heroic-intuition-constant: your hero gets +1 THW", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(8), toHero());
    const identity = identityOf(hero, P1);
    const before = characterProfile(hero, identity, WAVE4_DEPS)!.thw;
    const { state } = playFromHand(hero, "22019", 2);
    expect(characterProfile(state, identity, WAVE4_DEPS)!.thw).toBe(before + 1);
  });
});

describe("Knowhere (support, 22021)", () => {
  it("22021.knowhere-constant: increases the ally limit by 1", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(9), toHero());
    const before = allyLimitFor(hero, WAVE4_DEPS, P1);
    const { state } = playFromHand(hero, "22021", 2);
    expect(allyLimitFor(state, WAVE4_DEPS, P1)).toBe(before + 1);
  });

  it("22021.knowhere-response: after a player plays a guardian ally, exhausts to draw that player 1 card", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(9), toHero());
    const { state: withKnowhere, id: knowhere } = playFromHand(hero, "22021", 2);
    // Put Gamora in hand first (a no-op if she's already there) so playing her doesn't itself round-trip a card
    // through the deck and mask the response's own draw — the same normalization `nebula-kit.test.ts`'s Cybernetic
    // Upgrades test needs.
    const given = moveToHand(withKnowhere, P1, "22002");
    const [gamora] = given.ids as [InstanceId];
    const before = playerOf(given.state, P1).hand.length;
    const state = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, gamora, payWith(given.state, P1, 3, [gamora]))),
      accepting("22021.knowhere-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(state, knowhere).exhausted).toBe(true);
    // -1 Gamora played, -3 her payment (cost 3), +1 the draw = net -3.
    expect(playerOf(state, P1).hand.length).toBe(before - 1 - 3 + 1);
  });
});

describe("Daughters of Thanos (event, 22022)", () => {
  it("22022.daughters-of-thanos-action: draws 3 cards", () => {
    // Team-Up (Gamora and Nebula) needs Gamora in play too.
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(10), toHero());
    const { state: withGamora } = playFromHand(hero, "22002", 3);
    const given = moveToHand(withGamora, P1, "22022");
    const [card] = given.ids as [InstanceId];
    const before = playerOf(given.state, P1).hand.length;
    const state = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, card, payWith(given.state, P1, 1, [card]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // -1 played, -1 payment, +3 drawn = net +1.
    expect(playerOf(state, P1).hand.length).toBe(before - 1 - 1 + 3);
  });
});

describe("First Aid (event, 22023)", () => {
  it("22023.first-aid-action: heals 2 damage from any character", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(11), toHero());
    const identity = identityOf(hero, P1);
    const damaged = patchInstance(hero, identity, { damage: 3 });
    const { state } = playFromHand(damaged, "22023", 1, accepting(identity));
    expect(inst(state, identity).damage).toBe(1);
  });
});

describe("Energy Spear (upgrade, 22032)", () => {
  it("22032.energy-spear-constant: attached guardian ally gets +2 ATK and gains piercing", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(12), toHero());
    const { state: withAlly, id: ally } = playFromHand(hero, "22002", 3); // Gamora, a guardian ally
    const before = characterProfile(withAlly, ally, WAVE4_DEPS)!.atk;
    const given = putInHand(withAlly, "22032", "energy-spear-1");
    const after = settle(
      runWith(
        WAVE4_DEPS,
        given.state,
        play(P1, given.id, payWith(given.state, P1, 1, [given.id]), { attachToInstanceId: ally }),
      ),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(characterProfile(after, ally, WAVE4_DEPS)!.atk).toBe(before + 2);
    expect(hasKeyword(after, ally, "piercing", WAVE4_DEPS)).toBe(true);
  });
});

describe("Guardians of the Galaxy (support, 22033)", () => {
  // 22033.guardians-of-the-galaxy-constant-2 is `partOf("22033.guardians-of-the-galaxy-constant")` — the same
  // parser artifact `nebula-pack-cards.ts`'s own docblock names (a bulleted-clause split of one printed ability),
  // fully exercised by the one test below.
  it("22033.guardians-of-the-galaxy-constant: draws 1 after playing an upgrade on an ally, once every one of your characters has the guardian trait", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(13), toHero());
    const team = putInHand(hero, "22033", "gotg-1");
    const withTeam = settle(
      runWith(WAVE4_DEPS, team.state, play(P1, team.id, payWith(team.state, P1, 2, [team.id]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Gamora — a guardian ally; Nebula herself is a guardian too. Pre-fetched into hand (a no-op if already there)
    // so playing her doesn't itself round-trip a card through the deck and mask this test's own draw count.
    const givenGamora = moveToHand(withTeam, P1, "22002");
    const [gamora] = givenGamora.ids as [InstanceId];
    const withAlly = settle(
      runWith(WAVE4_DEPS, givenGamora.state, play(P1, gamora, payWith(givenGamora.state, P1, 3, [gamora]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    const spear = putInHand(withAlly, "22032", "gotg-spear-1"); // a guardian-ally-only upgrade
    const before = playerOf(spear.state, P1).hand.length;
    const after = settle(
      runWith(
        WAVE4_DEPS,
        spear.state,
        play(P1, spear.id, payWith(spear.state, P1, 1, [spear.id]), { attachToInstanceId: gamora }),
      ),
      accepting("22033.guardians-of-the-galaxy-constant"),
      undefined,
      WAVE4_DEPS,
    );
    // -1 the played spear, -1 its payment, +1 the draw = net -1.
    expect(playerOf(after, P1).hand.length).toBe(before - 1 - 1 + 1);
  });
});

describe("Defensive Training (support, 22034)", () => {
  it("22034.defensive-training-action: exhausts and removes a training counter to shuffle a Protection event from discard into deck", () => {
    const start = nebulaVsRhino(14);
    const given = putInHand(start, "22034", "defensive-training-1");
    const withCard = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, given.id, payWith(given.state, P1, 1, [given.id]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // Get Behind Me! (Core Protection event) — also never shuffled into Nebula's own deck, so it's conjured
    // straight into the discard pile the same way `putInHand` conjures an off-deck card into hand.
    const withEvent = putInDiscard(withCard, "01078", "get-behind-me-1").state;
    const beforeDeck = playerOf(withEvent, P1).deck.length;
    const after = settle(
      runWith(WAVE4_DEPS, withEvent, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: given.id,
        abilityId: "22034.defensive-training-action" as never,
        payment: [],
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, given.id).exhausted).toBe(true);
    expect(inst(after, given.id).counters.training).toBe(1);
    expect(playerOf(after, P1).deck.length).toBe(beforeDeck + 1);
  });
});

describe("Honorary Guardian (upgrade, 22035)", () => {
  it("22035.honorary-guardian-constant: attached character gets +1 hit point and gains the guardian trait", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(15), toHero());
    const identity = identityOf(hero, P1);
    const given = putInHand(hero, "22035", "honorary-guardian-1");
    const after = settle(
      runWith(WAVE4_DEPS, given.state, play(P1, given.id, [], { attachToInstanceId: identity })),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(characterProfile(after, identity, WAVE4_DEPS)!.maxHp).toBe(
      characterProfile(hero, identity, WAVE4_DEPS)!.maxHp + 1,
    );
  });
});

describe("One Way or Another (event, 22015)", () => {
  it("22015.one-way-or-another-action: searches the encounter deck for a side scheme, reveals it, and draws 3", () => {
    const given = moveToHand(runWith(WAVE4_DEPS, nebulaVsRhino(16), toHero()), P1, "22015");
    const [card] = given.ids as [InstanceId];
    const before = playerOf(given.state, P1).hand.length;
    const state = settle(runWith(WAVE4_DEPS, given.state, play(P1, card, [])), firstLegal, undefined, WAVE4_DEPS);
    // -1 played (0-cost, no payment), +3 drawn = net +2.
    expect(playerOf(state, P1).hand.length).toBe(before - 1 + 3);
  });
});

describe("Cosmo (ally, 22020)", () => {
  it("22020.cosmo-interrupt: names a card type and discards the top card of a chosen deck; the ability resolves without error", () => {
    const hero = runWith(WAVE4_DEPS, nebulaVsRhino(17), toHero());
    const { state: withCosmo, id: cosmo } = playFromHand(hero, "22020", 2);
    // Cosmo names a card type from a player's deck or the encounter deck. This test only needs the ability to
    // *resolve* without erroring and to register a real choice tree — `wave3/stld/star-lord-kit.test.ts`'s own
    // Cosmo tests already exercise the exact same shape's actual damage-cancellation math (this card reuses that
    // script verbatim).
    const villain = withCosmo.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE4_DEPS, withCosmo, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: cosmo,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(after, cosmo)).toBeDefined();
  });
});

/** `putInHand`, but conjured straight into the discard pile. */
function putInDiscard(
  state: GameState,
  code: string,
  instanceId: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const id = instanceId as InstanceId;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, discard: [...p.discard, id] } : p)),
      instances: {
        ...state.instances,
        [id]: {
          instanceId: id,
          cardId: code as never,
          ownerId: P1,
          controllerId: P1,
          home: { kind: "deck", playerId: P1 },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 0,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    },
  };
}
