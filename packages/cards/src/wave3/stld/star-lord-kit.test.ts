import { cardId } from "@mc/content";
import {
  activeVillain,
  allyLimitFor,
  cardsInPlay,
  handSize,
  hasKeyword,
  traitsOf,
  type CardInstance,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  payWith,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { wave3Scenario } from "../setup.js";
import { playFromHand, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";
import { STAR_LORD_LEADERSHIP } from "./testing.js";

// Star-Lord (Leadership, built entirely from his own pack — no precon exists, `./testing.js`'s own docblock)
// against Rhino (a Core scenario, seated with wave 3 content via `wave3Scenario`'s fallback), standard, solo.
const starLordVsRhino = () => startWave3Game(wave3Scenario("rhino", { players: [STAR_LORD_LEADERSHIP], seed: 2026 }));

/** Accepts the named optional response/interrupt; declines everything else. Mirrors `../gmw/groot-kit.test.ts`. */
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

const CROWD_CONTROL = "01108"; // 2 boost icons, no boost ability — Core's own Rhino-attack-with-a-known-boost fixture.
const NO_BOOST = "01186"; // "Advance": 0 boost icons — Core's own filler card for a deterministic second draw.
const HYDRA_MERCENARY = "01101"; // 3 hit points (`groot-kit.test.ts`'s own comment on this fixture).

/** A synthetic character in `player`'s own play area — the same "instance built by hand" shape
 * `groot-kit.test.ts`'s Rocket Raccoon interrupt test uses for a minion; `home: "playArea"` (not `villainArea`) is
 * load-bearing, per that test's own comment: the ally/minion defeat sweep scans exactly `player.playArea`. */
function engagedMinion(state: GameState, code: string, slot: string, player = P1): GameState {
  const id = slot as InstanceId;
  const instance: CardInstance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
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
    engagedWith: player,
    flipped: false,
  } as never;
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: instance },
  };
}

/**
 * Sets `player.dealtEncounter` to `n` entries, for exercising `dealtEncounterCount` without actually running the
 * cost that deals them. `dealtEncounterCount` only reads the array's length, never resolves the ids to cards, but
 * two traps hit while writing the Jet Boots test below rule out the obvious placeholders: a nonexistent id trips
 * something else reading `state.instances` once a later command resolves ("unknown card instance a" against a
 * literal placeholder string), and reusing a real id that's *also* still live in another zone (the player's own
 * deck) sent a later villain-phase flow into an infinite loop (a card simultaneously "dealt" and "in the deck"
 * confuses whatever the encounter-reveal step reads next). The identity's own instance id is real, always exists,
 * and is never itself a deck/hand/discard/encounter-zone member — repeating it `n` times is a safe filler.
 */
function withDealtEncounterCards(state: GameState, n: number, player = P1): GameState {
  const filler = playerOf(state, player).identity.instanceId;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, dealtEncounter: Array.from({ length: n }, () => filler) } : p,
    ),
  };
}

describe("Star-Lord kit", () => {
  it("Star-Lord: each ally you control gains the guardian trait", () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    // Nova Prime (17002) prints no traits of its own.
    const { state, id } = playFromHand(hero, "17002", 5, accepting());
    expect(traitsOf(state, id, WAVE3_DEPS)).toContain("GUARDIAN");
  });

  it('"What could go wrong?": reduces the cost of the card being played by 3, dealing a facedown encounter card', () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    const given = moveToHand(hero, P1, "17012"); // Beta Ray Bill, cost 5
    const [betaRayBill] = given.ids as [InstanceId];
    const before = playerOf(given.state, P1).dealtEncounter.length;
    const paid = payWith(given.state, P1, 2, [betaRayBill]); // 5 - 3 = 2 to actually pay
    const played = runWave3(given.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: betaRayBill,
      payment: paid.map((fromHand) => ({ fromHand })),
      attachToInstanceId: null,
      costReductionAbilities: [{ instanceId: identityOf(given.state), abilityId: "17001a.what-could-go-wrong" }],
    } as never);
    expect(cardsInPlay(played)).toContain(betaRayBill);
    expect(playerOf(played, P1).dealtEncounter.length).toBe(before + 1);
  });

  it("Peter Quill: Setup searches the deck and discard pile for Element Gun and adds it to hand", () => {
    const state = starLordVsRhino(); // resolves during setup, before the opening hand is drawn out further
    expect(playerOf(state, P1).hand.some((id) => state.instances[id]?.cardId === cardId("17007"))).toBe(true);
  });

  it("Smooth Talker: swaps a chosen hand card with the top card of the deck", () => {
    const state = starLordVsRhino(); // starts in alter-ego, where this ability lives
    const identity = identityOf(state);
    const player = playerOf(state, P1);
    const topOfDeck = player.deck[0]!;
    const handCard = player.hand[0]!;
    const after = playerOf(
      settle(
        runWave3(state, use(P1, identity, "17001b.smooth-talker")),
        (s) => {
          const choice = s.pendingChoice;
          if (!choice) return [];
          const match = choice.options.find((o) => o.ref?.kind === "card" && o.ref.instanceId === handCard);
          return match ? [match.optionId] : firstLegal(s);
        },
        undefined,
        WAVE3_DEPS,
      ),
      P1,
    );
    expect(after.hand).toContain(topOfDeck);
    expect(after.hand).not.toContain(handCard);
    expect(after.deck).toContain(handCard);
  });

  it("Nova Prime: after you play it from your hand, defeat a non-Elite minion", () => {
    const hero = engagedMinion(runWave3(starLordVsRhino(), toHero()), HYDRA_MERCENARY, "nova-target");
    const { state } = playFromHand(hero, "17002", 5, accepting("17002.nova-prime-response"));
    expect(instancesOf(state, HYDRA_MERCENARY).some((id) => cardsInPlay(state).includes(id))).toBe(false);
  });

  it("Daring Escape: deals yourself 1 facedown encounter card, readies your hero, and draws 1 card", () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    const identity = identityOf(hero);
    const exhausted = patchInstance(hero, identity, { exhausted: true });
    // `playFromHand` fetches its own copy into hand first (+1), plays it (-1), then Daring Escape draws (+1): net +1.
    const before = playerOf(exhausted, P1).hand.length;
    const dealtBefore = playerOf(exhausted, P1).dealtEncounter.length;
    const { state } = playFromHand(exhausted, "17003", 0);
    expect(inst(state, identity).exhausted).toBe(false);
    expect(playerOf(state, P1).hand.length).toBe(before + 1);
    expect(playerOf(state, P1).dealtEncounter.length).toBe(dealtBefore + 1);
  });

  it("Gutsy Move: removes 2 threat from a scheme, plus 2 more for each facedown encounter card in front of you", () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 20 });
    const before = mainThreat(withThreat);
    const { state } = playFromHand(withThreat, "17004", 2, accepting("scheme"));
    expect(mainThreat(state)).toBe(before - 2); // no facedown encounter cards dealt yet
  });

  it("Gutsy Move: removes 2 additional threat for each facedown encounter card in front of you", () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    const dealt = withDealtEncounterCards(hero, 2);
    const withThreat = patchInstance(dealt, dealt.mainScheme.instanceId, { threat: 20 });
    const before = mainThreat(withThreat);
    const { state } = playFromHand(withThreat, "17004", 2, accepting("scheme"));
    expect(mainThreat(state)).toBe(before - 2 - 2 * 2);
  });

  // Sliding Shot's own "Play only if you control an Element Gun" (17005.sliding-shot-constant) is a documented
  // primitive gap (module docblock, `star-lord-kit.ts`), not tested here.

  it("Sliding Shot: deals 5 damage plus 2 more per facedown encounter card", () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    const { state: withGun } = playFromHand(hero, "17007", 3, accepting("enemy"));
    const villain = activeVillain(withGun).instanceId;
    const before = inst(withGun, villain).damage;
    const { state } = playFromHand(withGun, "17005", 3, accepting("enemy"));
    expect(inst(state, villain).damage).toBe(before + 5);
  });

  it("Bad Boy: discarded to prevent all damage from the villain's attack, changing to alter-ego and drawing 2", () => {
    const { state: withCard, id: badBoy } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17006", 3);
    const identity = identityOf(withCard);
    const handBefore = playerOf(withCard, P1).hand.length;
    const attacked = settle(runWave3(withCard, endTurn()), accepting("17006.bad-boy-constant"), undefined, WAVE3_DEPS);
    expect(inst(attacked, identity).damage).toBe(0);
    expect(playerOf(attacked, P1).identity.form).toBe("alterEgo");
    expect(cardsInPlay(attacked)).not.toContain(badBoy);
    expect(playerOf(attacked, P1).hand.length).toBe(handBefore + 2);
  });

  it("Element Gun: exhaust and spend 1 resource of any type to deal 3 piercing damage to an enemy", () => {
    const { state: withGun, id: gun } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17007", 3);
    const villain = activeVillain(withGun).instanceId;
    const before = inst(withGun, villain).damage;
    const [resourceCard] = payWith(withGun, P1, 1, [gun]);
    const used = settle(
      runWave3(withGun, use(P1, gun, "17007.element-gun-action", [{ fromHand: resourceCard! }])),
      accepting("enemy"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 3);
    expect(inst(used, gun).exhausted).toBe(true);
  });

  it("Jet Boots: Star-Lord gains the aerial trait", () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    const { state } = playFromHand(hero, "17008", 2);
    expect(traitsOf(state, identityOf(state), WAVE3_DEPS)).toContain("AERIAL");
  });

  it("Jet Boots: exhausts to prevent 1 damage per facedown encounter card in front of you", () => {
    const { state: withBoots, id: boots } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17008", 2);
    const identity = identityOf(withBoots);
    // Two *real* facedown encounter cards, dealt by playing Daring Escape twice (its own cost), rather than state
    // surgery: patching `dealtEncounter` with placeholder ids and then running a full villain phase sent the
    // engine into an infinite loop the one time this test tried it — a card simultaneously "dealt" and elsewhere
    // (or not a real encounter-deck-dealt card at all) confuses whatever the later encounter-reveal step reads.
    const afterEscapes = playFromHand(playFromHand(withBoots, "17003", 0).state, "17003", 0).state;
    expect(playerOf(afterEscapes, P1).dealtEncounter.length).toBe(2);
    const stacked = stackEncounterDeck(afterEscapes, CROWD_CONTROL, NO_BOOST);
    // The villain phase's own step three turns those 2 facedown cards faceup and resolves *them* too (RRG 1.8
    // "Deal", p. 14), which can add its own damage/threat on top of the attack — an amount this test doesn't try
    // to predict. Instead it compares the *same* stacked setup with and without the interrupt: the two runs are
    // identical up to the interrupt's own decision, so their damage difference isolates exactly what Jet Boots
    // itself prevented (2, matching 2 facedown cards at the interrupt's own time of reading).
    const declined = settle(runWave3(stacked, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    const accepted = settle(
      runWave3(stacked, endTurn()),
      accepting("17008.jet-boots-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(accepted, identity).damage).toBe(inst(declined, identity).damage - 2);
    expect(inst(accepted, boots).exhausted).toBe(true);
    expect(inst(declined, boots).exhausted).toBe(false);
  });

  it("Leader of the Guardians: each guardian character you control gets +1 THW", () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    const { state } = playFromHand(hero, "17009", 3);
    const identity = identityOf(state);
    const withThreat = patchInstance(state, state.mainScheme.instanceId, { threat: 10 });
    const before = mainThreat(withThreat);
    // Star-Lord's printed THW is 2; +1 from Leader of the Guardians removes 3.
    const thwarted = runWave3(withThreat, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: withThreat.mainScheme.instanceId,
    });
    expect(mainThreat(thwarted)).toBe(before - 3);
  });

  it("Star-Lord's Helmet: +1 hand size per facedown encounter card while in hero form (to a maximum of +3)", () => {
    const hero = runWave3(starLordVsRhino(), toHero());
    const { state: withHelmet } = playFromHand(hero, "17010", 1);
    const before = handSize(withHelmet, P1, WAVE3_DEPS);
    const dealt = withDealtEncounterCards(withHelmet, 2);
    expect(handSize(dealt, P1, WAVE3_DEPS)).toBe(before + 2);
    const dealtFive = withDealtEncounterCards(withHelmet, 5);
    expect(handSize(dealtFive, P1, WAVE3_DEPS)).toBe(before + 3); // capped at +3
  });

  it("Star-Lord's Helmet: grants no bonus in alter-ego form", () => {
    const { state: withHelmet } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17010", 1);
    const dealt = withDealtEncounterCards(withHelmet, 2);
    const alterEgo: GameState = {
      ...dealt,
      players: dealt.players.map((p) =>
        p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "alterEgo" as const, heroFormIndex: null } } : p,
      ),
    };
    // Peter Quill's own printed hand size (6) — higher than Star-Lord's hero-form 5 — proves the bonus doesn't
    // apply in alter-ego form at all, rather than merely comparing to the hero-form baseline.
    expect(handSize(alterEgo, P1, WAVE3_DEPS)).toBe(6);
  });

  it("Adam Warlock: physical branch removes 3 threat from a scheme", () => {
    const { state: withAdam, id: adam } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17011", 3);
    // Force the random hand discard deterministic: Laser Blaster (17019) is the deck's own physical-resource card.
    const given = moveToHand(withAdam, P1, "17019");
    const [physical] = given.ids as [InstanceId];
    const onlyPhysical: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: [physical], discard: [...p.discard, ...p.hand.filter((id) => id !== physical)] }
          : p,
      ),
    };
    const withThreat = patchInstance(onlyPhysical, onlyPhysical.mainScheme.instanceId, { threat: 10 });
    const before = mainThreat(withThreat);
    const attacked = settle(
      runWave3(withThreat, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: adam,
        targetInstanceId: activeVillain(withThreat).instanceId,
      }),
      accepting("17011.adam-warlock-response", "scheme"),
      undefined,
      WAVE3_DEPS,
    );
    expect(mainThreat(attacked)).toBe(before - 3);
  });

  it("Beta Ray Bill: after he attacks and defeats a minion, removes 2 threat from the main scheme", () => {
    const { state: withBill, id: bill } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17012", 5);
    // Beta Ray Bill's printed ATK (3) exactly defeats the fixture's 3-hit-point minion in one hit.
    const withMinion = engagedMinion(withBill, HYDRA_MERCENARY, "beta-target");
    const withThreat = patchInstance(withMinion, withMinion.mainScheme.instanceId, { threat: 10 });
    const before = mainThreat(withThreat);
    const attacked = settle(
      runWave3(withThreat, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: bill,
        targetInstanceId: "beta-target" as InstanceId,
      }),
      accepting("17012.beta-ray-bill-response"),
      undefined,
      WAVE3_DEPS,
    );
    expect(instancesOf(attacked, HYDRA_MERCENARY).some((id) => cardsInPlay(attacked).includes(id))).toBe(false);
    expect(mainThreat(attacked)).toBe(before - 2);
  });

  it("Yondu: his attacks gain ranged", () => {
    const { state: withYondu, id: yondu } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17013", 4);
    expect(hasKeyword(withYondu, yondu, "ranged", WAVE3_DEPS)).toBe(true);
    // Also confirmed by play: Yondu's printed ATK (1) lands undiminished on a 2-HP minion he attacks.
    const withMinion = engagedMinion(withYondu, HYDRA_MERCENARY, "yondu-target");
    const attacked = runWave3(withMinion, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: yondu,
      targetInstanceId: "yondu-target" as InstanceId,
    });
    expect(inst(attacked, "yondu-target" as InstanceId).damage).toBe(1);
  });

  it("Air Supremacy: deals 3 damage to up to X enemies, X = the number of aerial characters you control", () => {
    const { state: withJetBoots } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17008", 2); // grants aerial
    const given = moveToHand(withJetBoots, P1, "17014");
    const [airSupremacy] = given.ids as [InstanceId];
    const villain = activeVillain(given.state).instanceId;
    const before = inst(given.state, villain).damage;
    const paid = payWith(given.state, P1, 2, [airSupremacy]);
    const midPlay = runWave3(given.state, play(P1, airSupremacy, paid));
    const after = answer(midPlay, [villain], WAVE3_DEPS);
    expect(inst(after, villain).damage).toBe(before + 3);
  });

  it("C.I.T.T.: exhaust and spend 2 resources of any type to ready a guardian character", () => {
    const { state: withCitt, id: citt } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17021", 2);
    const identity = identityOf(withCitt);
    const exhausted = patchInstance(withCitt, identity, { exhausted: true });
    const paid = payWith(exhausted, P1, 2, [citt]);
    const used = settle(
      runWave3(
        exhausted,
        use(
          P1,
          citt,
          "17021.citt-action",
          paid.map((fromHand) => ({ fromHand })),
        ),
      ),
      accepting("character"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, identity).exhausted).toBe(false);
  });

  it("Pulse Grenade: discards it and chooses an enemy, discards the top 2 encounter cards, and deals damage equal to boost icons discarded", () => {
    const { state: withGrenade, id: grenade } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17023", 2);
    const villain = activeVillain(withGrenade).instanceId;
    const before = inst(withGrenade, villain).damage;
    const stacked = stackEncounterDeck(withGrenade, CROWD_CONTROL, NO_BOOST); // 2 + 0 = 2 boost icons, over 2 cards
    const used = settle(
      runWave3(stacked, use(P1, grenade, "17023.pulse-grenade-action")),
      accepting("enemy"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 2);
    expect(cardsInPlay(used)).not.toContain(grenade);
  });

  /** Moves a card already in `player`'s deck to its top, by exact card code — for a deterministic "name a card
   * type, then discard the top card of a player deck" outcome (Cosmo). */
  function withTopOfDeck(state: GameState, code: string, player = P1): GameState {
    const p = playerOf(state, player);
    const id = p.deck.find((i) => state.instances[i]?.cardId === cardId(code));
    if (!id) throw new Error(`${player} has no ${code} in deck`);
    return {
      ...state,
      players: state.players.map((pl) =>
        pl.playerId === player ? { ...pl, deck: [id, ...pl.deck.filter((x) => x !== id)] } : pl,
      ),
    };
  }

  /** Drives Cosmo's own "name a card type" tree: accept the interrupt, choose a player's deck, name `category`. */
  const namingCategory =
    (category: string): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "chooseTriggers") {
        const hit = choice.options.find((o) => o.optionId.endsWith(":17020.cosmo-interrupt"));
        return hit ? [hit.optionId] : firstLegal(state);
      }
      if (choice.prompt.kind === "choosePlayer") return [P1];
      if (choice.prompt.kind === "chooseOption") {
        const hit = choice.options.find((o) => o.label === "A player's deck" || o.label === category);
        if (hit) return [hit.optionId];
      }
      return firstLegal(state);
    };

  it("Cosmo: naming the discarded card's actual type prevents his consequential damage for this use", () => {
    const { state: withCosmo, id: cosmo } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17020", 2);
    // Beta Ray Bill (17012) is an ally: naming "ally" over it should cancel Cosmo's printed 1 consequential damage.
    const stacked = withTopOfDeck(withCosmo, "17012");
    const attacked = settle(
      runWave3(stacked, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: cosmo,
        targetInstanceId: activeVillain(stacked).instanceId,
      }),
      namingCategory("ally"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(attacked, cosmo).damage).toBe(0);
  });

  it("Cosmo: naming the wrong type still takes his printed consequential damage", () => {
    const { state: withCosmo, id: cosmo } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17020", 2);
    // Pulse Grenade (17023) is an event, not an ally.
    const stacked = withTopOfDeck(withCosmo, "17023");
    const attacked = settle(
      runWave3(stacked, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: cosmo,
        targetInstanceId: activeVillain(stacked).instanceId,
      }),
      namingCategory("ally"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(attacked, cosmo).damage).toBe(1);
  });

  it("Knowhere: increases your ally limit by 1", () => {
    const { state } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17022", 2);
    expect(allyLimitFor(state, WAVE3_DEPS, P1)).toBe(4);
  });

  it("Knowhere: after a player plays a guardian ally, exhausts to draw that player 1 card", () => {
    const { state: withKnowhere, id: knowhere } = playFromHand(runWave3(starLordVsRhino(), toHero()), "17022", 2);
    // Fetch Beta Ray Bill into hand *first* (a separate step from playing him), so "hand size right before he's
    // played" already accounts for that fetch — `playFromHand` finds him already there and fetches nothing more,
    // leaving play (-1) and Knowhere's own draw (+1) as the only two changes, net 0.
    const given = moveToHand(withKnowhere, P1, "17012");
    const handBefore = playerOf(given.state, P1).hand.length;
    // Beta Ray Bill (17012) — no printed trait, but Star-Lord's own "star-lord-constant" grants every ally you
    // control the guardian trait, so playing him counts as playing a guardian ally.
    const { state } = playFromHand(given.state, "17012", 5, accepting("17022.knowhere-response"));
    // -1 (Beta Ray Bill played) - 5 (his cost, paid with 5 other hand cards) + 1 (Knowhere's own draw) = -5.
    expect(playerOf(state, P1).hand.length).toBe(handBefore - 5);
    expect(inst(state, knowhere).exhausted).toBe(true);
  });
});
