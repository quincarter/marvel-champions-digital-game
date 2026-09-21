import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  remainingHitPoints,
  type Command,
  type GameSetupConfig,
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
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  resourceAbility,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { HLK_DEPS, runHlk, startHlkGame } from "./testing.js";

// Real wave 1 content: the Hulk (Aggression) precon against Rhino, standard, solo.
const hulkGame = () =>
  startHlkGame(wave1Scenario("rhino", { players: [{ starterDeckId: "hlk-aggression" }], seed: 17 }));
// A neutral boost card (0 icons, no boost ability) — put on top of a stacked encounter card so the villain phase's
// boost draw consumes it first, leaving the real target on top for the next deal step (matches
// `packages/cards/src/core/heroes/spider-man.test.ts`'s `ADVANCE`, same Rhino encounter pool).
const ADVANCE = "01186";
// Hydra Mercenary (Core "rhino" encounter set), printed 3 hit points — matches `core/scenarios/rhino.test.ts`'s own use.
const HYDRA_MERCENARY = "01101";
const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/**
 * A Hulk (Aggression) game whose deck also contains a few off-aspect filler cards not in the Aggression precon
 * (Beat Cop is justice) purely so their abilities can be exercised in isolation — matches `wave1/thor/pack-
 * cards.test.ts`'s `thorVsRhinoWithExtras`. `requireLegalDecks` is dropped for this one setup (deckbuilding
 * legality is `card-data-pipeline`/`rules-qa-engineer` territory, not what these ability tests are about).
 */
function hulkGameWithExtras(...extraCodes: readonly string[]) {
  const config = wave1Scenario("rhino", { players: [{ starterDeckId: "hlk-aggression" }], seed: 17 });
  const patched: GameSetupConfig = {
    ...config,
    requireLegalDecks: false,
    players: config.players.map((p, i) =>
      i === 0 ? { ...p, deck: [...p.deck, ...extraCodes.map((c) => cardId(c))] } : p,
    ),
  };
  const created = createGame(patched, HLK_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", HLK_DEPS);
}

describe("Hulk / Bruce Banner kit", () => {
  it('"Enraged": Forced Interrupt — discards your hand when your turn ends, in hero form', () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const handBefore = playerOf(hero, P1).hand;
    expect(handBefore.length).toBeGreaterThan(0);
    // `discardFromHand` (non-random) asks which cards to discard (`effects-frame.ts`'s "chooseTarget slot: discard"
    // path) — min = max = the full hand, so the only legal answer is all of it.
    const afterEndTurn = runHlk(hero, endTurn());
    expect(afterEndTurn.pendingChoice?.prompt).toMatchObject({ kind: "chooseTarget", slot: "discard" });
    expect(afterEndTurn.pendingChoice?.minSelections).toBe(handBefore.length);
    // Answering it cascades straight through the rest of the "turnEnding" event and the End of Player Phase step
    // (which redraws a fresh hand up to hand size) to the villain phase's own next real choice, so the hand isn't
    // observably empty afterward — check the discard pile (which only grows) and that none of the original hand
    // survived, instead of a momentary state the command-based API can't pause on.
    const after = answer(afterEndTurn, [...handBefore], HLK_DEPS);
    expect(playerOf(after, P1).discard).toEqual(expect.arrayContaining([...handBefore]));
    expect(playerOf(after, P1).hand.some((id) => handBefore.includes(id))).toBe(false);
  });

  it('"Enraged" does not fire in alter-ego form (the ability belongs to the hero face only)', () => {
    const start = hulkGame(); // starts in alter-ego form
    const handBefore = playerOf(start, P1).hand.length;
    // No command mutates the hand until a pending choice is answered, so this is a robust check regardless of what
    // (if anything) the villain phase later prompts.
    const afterEndTurn = runHlk(start, endTurn());
    expect(playerOf(afterEndTurn, P1).hand.length).toBe(handBefore);
  });

  it("Experimental Research: draws 1, then chooses and discards 1 from hand — once per round", () => {
    const start = hulkGame();
    const given = moveToHand(start, P1, "10019"); // a spare card to choose as the discard
    const [spare] = given.ids as [never];
    const identity = identityOf(given.state);
    const handBefore = playerOf(given.state, P1).hand.length;
    const after = settle(
      runHlk(given.state, use(P1, identity, "10001b.experimental-research")),
      picking(spare),
      undefined,
      HLK_DEPS,
    );
    // +1 draw, -1 chosen discard: net hand size unchanged.
    expect(playerOf(after, P1).hand.length).toBe(handBefore);
    expect(playerOf(after, P1).discard).toContain(spare);

    // Limit once per round: a second use this round is rejected even with cards left to draw and discard.
    const rejected = applyCommand(after, use(P1, identity, "10001b.experimental-research"), HLK_DEPS);
    expect(rejected.ok).toBe(false);
  });

  it("Crushing Blow: deals damage equal to your ATK, and can only be paid with [physical] resources", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    // Crushing Blow (physical only), Genius (a [mental]-only resource — an illegal payment), Strength (physical x2).
    const given = moveToHand(hero, P1, "10002", "10021", "10022");
    const [crushingBlow, genius, strength] = given.ids as [never, never, never];
    const rejected = applyCommand(given.state, play(P1, crushingBlow, [genius]), HLK_DEPS);
    expect(rejected.ok).toBe(false);

    const villain = activeVillain(given.state).instanceId;
    const hpBefore = remainingHitPoints(given.state, villain, HLK_DEPS)!;
    // "An enemy" is a mandatory `chooseTarget` (only the villain is a legal target here) — settle it (RRG "Choose
    // (Game Element)": still a real choice even with one option).
    const after = settle(runHlk(given.state, play(P1, crushingBlow, [strength])), firstLegal, undefined, HLK_DEPS);
    // Hulk's printed ATK is 3 (packages/content/src/data/hlk/cards.ts, 10001a).
    expect(remainingHitPoints(after, villain, HLK_DEPS)).toBe(hpBefore - 3);
  });

  it("Hulk Smash: +10 ATK on a basic attack, but no overkill when not paid using only [physical] resources", () => {
    // Hydra Mercenary (01101, Core "rhino" encounter set), 3 hit points: attacking it for 13 (3 printed ATK + 10)
    // without overkill defeats it but wastes the excess — the villain's own HP must stay untouched, proving the
    // ATK bonus applied without also granting overkill.
    const stacked = stackEncounterDeck(hulkGame(), ADVANCE, HYDRA_MERCENARY);
    const hero = runHlk(stacked, toHero());
    const revealed = settle(runHlk(hero, endTurn()), firstLegal, undefined, HLK_DEPS);
    // Rhino's encounter set prints 2 copies of Hydra Mercenary; only the one actually engaged (in P1's own play
    // area — a minion "in play" lives there, not in `villainArea`) is the one this attack targets.
    const mercenary = playerOf(revealed, P1).playArea.find((id) => inst(revealed, id).cardId === "01101")!;
    const villain = activeVillain(revealed).instanceId;
    const hpBefore = remainingHitPoints(revealed, villain, HLK_DEPS)!;
    const given = moveToHand(revealed, P1, "10003", "10021", "10014"); // Hulk Smash, Genius (mental x2), Drop Kick (physical x1) — mixed payment
    const [hulkSmash, genius, dropKick] = given.ids as [never, never, never];
    const identity = identityOf(given.state);
    const option = `${hulkSmash}:10003.hulk-smash-interrupt`;
    const after = settle(
      runHlk(given.state, basicAttack(identity, mercenary)),
      (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (prompt?.kind === "chooseTriggers") return picking(option)(s);
        if (prompt?.kind === "payForCard" && prompt.instanceId === hulkSmash)
          return [`hand:${genius}`, `hand:${dropKick}`];
        return firstLegal(s);
      },
      undefined,
      HLK_DEPS,
    );
    expect(playerOf(after, P1).playArea).not.toContain(mercenary); // defeated (13 damage into 3 hit points)
    expect(remainingHitPoints(after, villain, HLK_DEPS)).toBe(hpBefore); // no overkill: nothing spilled to the villain
  });

  it("Hulk Smash: gains overkill when paid using only [physical] resources, spilling the excess to the villain", () => {
    const stacked = stackEncounterDeck(hulkGame(), ADVANCE, HYDRA_MERCENARY);
    const hero = runHlk(stacked, toHero());
    const revealed = settle(runHlk(hero, endTurn()), firstLegal, undefined, HLK_DEPS);
    const mercenary = playerOf(revealed, P1).playArea.find((id) => inst(revealed, id).cardId === "01101")!;
    const villain = activeVillain(revealed).instanceId;
    const hpBefore = remainingHitPoints(revealed, villain, HLK_DEPS)!;
    const given = moveToHand(revealed, P1, "10003", "10022", "10014"); // Hulk Smash, Strength (physical x2), Drop Kick (physical x1) — all-physical payment
    const [hulkSmash, strength, dropKick] = given.ids as [never, never, never];
    const identity = identityOf(given.state);
    const option = `${hulkSmash}:10003.hulk-smash-interrupt`;
    const after = settle(
      runHlk(given.state, basicAttack(identity, mercenary)),
      (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (prompt?.kind === "chooseTriggers") return picking(option)(s);
        if (prompt?.kind === "payForCard" && prompt.instanceId === hulkSmash)
          return [`hand:${strength}`, `hand:${dropKick}`];
        return firstLegal(s);
      },
      undefined,
      HLK_DEPS,
    );
    expect(playerOf(after, P1).playArea).not.toContain(mercenary); // defeated
    // 13 damage into 3 hit points: 10 excess, overkill (RRG "Overkill") spills it to the active villain (the
    // target's own recipient, since Hydra Mercenary is a minion — `packages/engine/src/resolve/event.ts`
    // `overkillRecipient`).
    expect(remainingHitPoints(after, villain, HLK_DEPS)).toBe(hpBefore - 10);
  });

  it("Sub-Orbital Leap: removes 3 threat (5 instead if paid using only [physical] resources)", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const given = moveToHand(hero, P1, "10004", "10004", "10021", "10002", "10002", "10022");
    const [leapA, leapB, genius, blowA, blowB, strength] = given.ids as [never, never, never, never, never, never];
    const mainScheme = start.mainScheme.instanceId;
    // The main scheme starts at 0 threat round 1 (it accrues from the villain phase) — state surgery gives it
    // enough to actually remove, matching `patchInstance`'s use elsewhere for test-only setup.
    const staged = patchInstance(given.state, mainScheme, { threat: 20 });

    // Mixed payment ([mental] 2 + [physical] 1 = 3, not all-physical): 3 threat.
    const threatBefore = inst(staged, mainScheme).threat;
    const settled1 = settle(runHlk(staged, play(P1, leapA, [genius, blowA])), firstLegal, undefined, HLK_DEPS);
    expect(inst(settled1, mainScheme).threat).toBe(threatBefore - 3);

    // All-[physical] payment (2 + 1 = 3): 5 threat.
    const threatBefore2 = inst(settled1, mainScheme).threat;
    const settled2 = settle(runHlk(settled1, play(P1, leapB, [strength, blowB])), firstLegal, undefined, HLK_DEPS);
    expect(inst(settled2, mainScheme).threat).toBe(threatBefore2 - 5);
  });

  it("Thunderclap: deals 3 damage to up to 3 chosen enemies (the villain, with none else in play)", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const given = moveToHand(hero, P1, "10005", "10022", "10002");
    const [thunderclap, strength, blow] = given.ids as [never, never, never];
    const villain = activeVillain(given.state).instanceId;
    const hpBefore = remainingHitPoints(given.state, villain, HLK_DEPS)!;
    const midPlay = runHlk(given.state, play(P1, thunderclap, [strength, blow]));
    const after = answer(midPlay, [villain], HLK_DEPS);
    expect(remainingHitPoints(after, villain, HLK_DEPS)).toBe(hpBefore - 3);
  });

  it("Unstoppable Force: readies Hulk, and draws 1 card only if paid using only [physical] resources", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const given = moveToHand(hero, P1, "10006", "10006", "10021", "10022");
    const [forceA, forceB, genius, strength] = given.ids as [never, never, never, never];
    const identity = identityOf(given.state);
    const exhausted = patchInstance(given.state, identity, { exhausted: true });

    // All-[mental] payment (not all-physical): readies, no draw. Both the played card and the resource card used to
    // pay for it leave the hand (RRG "Cost": spent resource cards are discarded).
    const handBefore = playerOf(exhausted, P1).hand.length;
    const afterMental = runHlk(exhausted, play(P1, forceA, [genius]));
    expect(inst(afterMental, identity).exhausted).toBe(false);
    expect(playerOf(afterMental, P1).hand.length).toBe(handBefore - 2);

    // All-[physical] payment: readies (again, after re-exhausting) and draws 1.
    const exhaustedAgain = patchInstance(afterMental, identity, { exhausted: true });
    const handBefore2 = playerOf(exhaustedAgain, P1).hand.length;
    const afterPhysical = runHlk(exhaustedAgain, play(P1, forceB, [strength]));
    expect(inst(afterPhysical, identity).exhausted).toBe(false);
    expect(playerOf(afterPhysical, P1).hand.length).toBe(handBefore2 - 2 + 1); // -1 played, -1 spent as payment, +1 drawn
  });

  it("Limitless Strength: generates [physical] resources, spendable only in hero form", () => {
    const start = hulkGame(); // alter-ego by default
    const given = moveToHand(start, P1, "10007", "10008"); // Limitless Strength, Banner's Laboratory (cost 2)
    const [limitless, lab] = given.ids as [never, never];
    const rejected = applyCommand(given.state, play(P1, lab, [limitless]), HLK_DEPS);
    expect(rejected.ok).toBe(false);

    const hero = runHlk(given.state, toHero());
    const after = runHlk(hero, play(P1, lab, [limitless]));
    expect(playerOf(after, P1).playArea).toContain(lab);
  });

  it("Banner's Laboratory: gets Bruce Banner +2 REC, and its Alter-Ego Resource exhausts it for a [mental] resource", () => {
    const start = hulkGame(); // alter-ego by default
    // Banner's Laboratory (cost 2), Martial Prowess (upgrade, cost 2, no form restriction — the pack's justice/
    // leadership/protection/basic filler cards like Resourceful aren't in this precon at all).
    const given = moveToHand(start, P1, "10008", "10018");
    const [lab, prowess] = given.ids as [never, never];
    const withLab = runHlk(given.state, play(P1, lab, payWith(given.state, P1, 2, [lab, prowess])));
    expect(playerOf(withLab, P1).playArea).toContain(lab);
    // Bruce Banner's printed REC is 4 (packages/content/src/data/hlk/cards.ts, 10001b); +2 here.
    expect(characterProfile(withLab, identityOf(withLab), HLK_DEPS)?.rec).toBe(6);

    // The [mental] resource from exhausting the lab, plus 1 more hand card, pays Martial Prowess's cost 2.
    const other = payWith(withLab, P1, 1, [lab, prowess]);
    const after = settle(
      runHlk(
        withLab,
        play(P1, prowess, other, { abilities: [resourceAbility(lab, "10008.banners-laboratory-resource")] }),
      ),
      firstLegal,
      undefined,
      HLK_DEPS,
    );
    expect(inst(after, prowess).attachedTo).toBe(identityOf(after)); // no printed `attachesTo`: auto-attaches to the identity
    expect(inst(after, lab).exhausted).toBe(true);
  });

  it("Boundless Rage: Hulk gets +1 ATK; discarded after any change of form", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const given = moveToHand(hero, P1, "10009");
    const [rage] = given.ids as [never];
    const withRage = runHlk(given.state, play(P1, rage, payWith(given.state, P1, 1, [rage])));
    const villain = activeVillain(withRage).instanceId;
    const hpBefore = remainingHitPoints(withRage, villain, HLK_DEPS)!;
    const given2 = moveToHand(withRage, P1, "10002", "10022");
    const [blow, strength] = given2.ids as [never, never];
    const attacked = settle(runHlk(given2.state, play(P1, blow, [strength])), firstLegal, undefined, HLK_DEPS);
    // ATK 3 + 1 (Boundless Rage) = 4.
    expect(remainingHitPoints(attacked, villain, HLK_DEPS)).toBe(hpBefore - 4);

    // Forced Response: After you change form, discard this card. Changing form is once per round
    // (`changedFormThisRound`), already spent this round by the earlier `toHero()`, so end the round first, then
    // flip in round 2.
    const nextRound = settle(runHlk(attacked, endTurn()), firstLegal, undefined, HLK_DEPS);
    const flipped = settle(runHlk(nextRound, toHero()), firstLegal, undefined, HLK_DEPS);
    expect(playerOf(flipped, P1).discard).toContain(rage);
  });

  it("Immovable Object: +4 hit points, and Hulk gains retaliate 1", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const given = moveToHand(hero, P1, "10010");
    const [immovable] = given.ids as [never];
    const identity = identityOf(given.state);
    const hpBefore = remainingHitPoints(given.state, identity, HLK_DEPS)!;
    const after = runHlk(given.state, play(P1, immovable, payWith(given.state, P1, 3, [immovable])));
    expect(remainingHitPoints(after, identity, HLK_DEPS)).toBe(hpBefore + 4);

    // Retaliate 1: defending the villain's attack with Hulk deals 1 damage back (RRG "Retaliate X").
    const villain = activeVillain(after).instanceId;
    const villainHpBefore = remainingHitPoints(after, villain, HLK_DEPS)!;
    const defendWithHulk = (s: GameState) =>
      s.pendingChoice?.prompt.kind === "declareDefender" ? [identity] : firstLegal(s);
    const defended = settle(runHlk(after, endTurn()), defendWithHulk, undefined, HLK_DEPS);
    expect(remainingHitPoints(defended, villain, HLK_DEPS)).toBe(villainHpBefore - 1);
  });
});

describe("Inner Demons (Hulk's obligation)", () => {
  it("in alter-ego form: change form (mandatory) flips to hero and exhausts the hero", () => {
    const start = stackEncounterDeck(hulkGame(), ADVANCE, "10025"); // starts alter-ego by default
    const afterTurn = settle(runHlk(start, endTurn()), firstLegal, undefined, HLK_DEPS);
    expect(playerOf(afterTurn, P1).identity.form).toBe("hero");
    expect(inst(afterTurn, identityOf(afterTurn)).exhausted).toBe(true);
    const obligation = instancesOf(afterTurn, "10025")[0]!;
    // An obligation (`home` is the encounter deck) discards to the active villain's encounter discard, not the
    // player's own discard pile (`packages/cards/src/core/heroes/spider-man.test.ts`'s Eviction Notice tests).
    expect(activeEncounterDeck(afterTurn).discard).toContain(obligation);
  });

  it("in hero form: change form (mandatory) flips to alter-ego and discards 2 cards from hand", () => {
    const start = stackEncounterDeck(hulkGame(), ADVANCE, "10025");
    const hero = runHlk(start, toHero());
    const afterTurn = settle(runHlk(hero, endTurn()), firstLegal, undefined, HLK_DEPS);
    expect(playerOf(afterTurn, P1).identity.form).toBe("alterEgo");
    // "Enraged" (Forced Interrupt on the same `turnEnding` event) discards the whole hand first, then the End of
    // Player Phase step redraws to hero hand size (4) before Inner Demons reveals in the villain phase and
    // discards 2 more — hero hand size 4, minus 2, however the original hand was made up.
    expect(playerOf(afterTurn, P1).hand.length).toBe(2);
    const obligation = instancesOf(afterTurn, "10025")[0]!;
    expect(activeEncounterDeck(afterTurn).discard).toContain(obligation);
  });
});

// Hulk's nemesis set (Abomination 10026, Total Destruction 10027) is not unit-tested here: RRG 1.8 Appendix II step
// 5 (docs/phase7-wave1.md §2.1) sets a nemesis set aside at setup, not into the shared encounter deck — a generic
// Rhino game (this file's `hulkGame()`) never reveals it without a scenario-specific "reveal your nemesis set"
// trigger Rhino doesn't print, so there's no natural, non-invasive way to get Abomination engaged and attacking
// through the command-level API this file otherwise uses throughout. `packages/cards/src/wave1/cap/
// captain-america.test.ts` (the reference pack) doesn't unit-test its own nemesis set's cards for the same reason;
// coverage is `e2e.test.ts` (a full game) plus this pack's own coverage check.

describe("hlk pack-cards (aggression filler, in the precon)", () => {
  it("Brawn: Response — after it attacks, removes 1 threat from a scheme", () => {
    const start = hulkGame();
    const given = moveToHand(start, P1, "10011");
    const [brawn] = given.ids as [never];
    const withBrawn = runHlk(given.state, play(P1, brawn, payWith(given.state, P1, 3, [brawn])));
    const villain = activeVillain(withBrawn).instanceId;
    const mainScheme = start.mainScheme.instanceId;
    const staged = patchInstance(withBrawn, mainScheme, { threat: 5 });
    const option = `${brawn}:10011.brawn-response`;
    const after = settle(runHlk(staged, basicAttack(brawn, villain)), picking(option), undefined, HLK_DEPS);
    expect(inst(after, mainScheme).threat).toBe(4);
  });

  it("Sentry: Forced Response — after it enters play under your control, deals yourself 1 encounter card", () => {
    const start = hulkGame();
    const given = moveToHand(start, P1, "10012");
    const [sentry] = given.ids as [never];
    const deckSizeBefore = activeEncounterDeck(given.state).deck.length;
    const after = settle(
      runHlk(given.state, play(P1, sentry, payWith(given.state, P1, 4, [sentry]))),
      firstLegal,
      undefined,
      HLK_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(sentry);
    expect(activeEncounterDeck(after).deck.length).toBe(deckSizeBefore - 1);
  });

  it("She-Hulk: [star] gets +1 ATK for each damage token here", () => {
    const start = hulkGame();
    const given = moveToHand(start, P1, "10013");
    const [sheHulk] = given.ids as [never];
    const withSheHulk = runHlk(given.state, play(P1, sheHulk, payWith(given.state, P1, 4, [sheHulk])));
    // She-Hulk's own printed ATK is 1 (packages/content/src/data/hlk/cards.ts, 10013).
    expect(characterProfile(withSheHulk, sheHulk, HLK_DEPS)?.atk).toBe(1);
    const damaged = patchInstance(withSheHulk, sheHulk, { damage: 3 });
    expect(characterProfile(damaged, sheHulk, HLK_DEPS)?.atk).toBe(4);
  });

  it("Drop Kick: deals 4 damage to an enemy; only-[physical] payment also stuns it and draws 1", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const given = moveToHand(hero, P1, "10014", "10022", "10002");
    const [dropKick, strength, blow] = given.ids as [never, never, never];
    const villain = activeVillain(given.state).instanceId;
    const hpBefore = remainingHitPoints(given.state, villain, HLK_DEPS)!;
    const handBefore = playerOf(given.state, P1).hand.length;
    const after = settle(runHlk(given.state, play(P1, dropKick, [strength, blow])), firstLegal, undefined, HLK_DEPS);
    expect(remainingHitPoints(after, villain, HLK_DEPS)).toBe(hpBefore - 4);
    expect(inst(after, villain).statuses.stunned).toBe(1);
    // Drop Kick, Strength and Crushing Blow all left the hand (-3), a card was drawn (+1).
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 3 + 1);
  });

  it("Toe to Toe: that enemy attacks you, then it takes 5 damage", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const given = moveToHand(hero, P1, "10015");
    const [toeToToe] = given.ids as [never];
    const villain = activeVillain(given.state).instanceId;
    const identity = identityOf(given.state);
    const hpBefore = remainingHitPoints(given.state, villain, HLK_DEPS)!;
    const damageBefore = inst(given.state, identity).damage;
    // Toe to Toe costs 1: pay with itself excluded; the villain's own attack against Hulk needs a defend decision.
    const defendNone = (s: GameState) =>
      s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
    const after = settle(
      runHlk(given.state, play(P1, toeToToe, payWith(given.state, P1, 1, [toeToToe]))),
      defendNone,
      undefined,
      HLK_DEPS,
    );
    expect(remainingHitPoints(after, villain, HLK_DEPS)).toBe(hpBefore - 5);
    expect(inst(after, identity).damage).toBeGreaterThan(damageBefore); // undefended villain attack landed
  });

  it("\"You'll Pay for That!\": removes threat equal to damage taken from the villain's attack (max 5)", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    // Toe to Toe forces the villain to attack Hulk within the same hero turn (`{ against: you }`) — this reaches
    // the same "the villain attacks you" event this card's Response listens for, without ending the turn (and so
    // without Hulk's own Enraged discarding this card from hand first: RRG "Forced Interrupt", "when your turn
    // ends" never fires mid-turn).
    const given = moveToHand(hero, P1, "10016", "10015", "10022", "10002");
    const [card, toeToToe, strength, blow] = given.ids as [never, never, never, never];
    const mainScheme = start.mainScheme.instanceId;
    const staged = patchInstance(given.state, mainScheme, { threat: 20 });
    const identity = identityOf(staged);

    const midPlay = runHlk(staged, play(P1, toeToToe, payWith(staged, P1, 1, [card, toeToToe, strength, blow])));
    // Toe to Toe: "Choose an enemy" (mandatory, only the villain is legal) — settled by `firstLegal` inside `settle`.
    const atDefend = settle(midPlay, firstLegal, (s) => s.pendingChoice?.prompt.kind === "declareDefender", HLK_DEPS);
    const declined = answer(atDefend, ["decline"], HLK_DEPS); // undefended: the attack actually deals damage
    const threatBeforeResponse = inst(declined, mainScheme).threat;
    const damageTaken = inst(declined, identity).damage;

    const option = `${card}:10016.youll-pay-for-that-response`;
    const triggered = answer(declined, [option], HLK_DEPS);
    const paid = answer(triggered, [`hand:${strength}`], HLK_DEPS); // cost 1, paid from hand (not `firstLegal`, which declines a `payForCard`'s 0-minimum by backing out)
    const after = settle(paid, firstLegal, undefined, HLK_DEPS);

    expect(inst(after, mainScheme).threat).toBe(threatBeforeResponse - Math.min(damageTaken, 5));
  });

  it("Martial Prowess: generates a [physical] resource, usable only for an Attack event", () => {
    const start = hulkGame();
    const hero = runHlk(start, toHero());
    const given = moveToHand(hero, P1, "10018", "10014"); // Martial Prowess (upgrade), Drop Kick (Attack event, Hero Action)
    const [prowess, dropKick] = given.ids as [never, never];
    const withProwess = runHlk(given.state, play(P1, prowess, payWith(given.state, P1, 2, [prowess, dropKick])));
    // Drop Kick (traits: Attack) is a legal card for Martial Prowess's resource to pay toward.
    const other = payWith(withProwess, P1, 2, [prowess, dropKick]);
    const after = settle(
      runHlk(
        withProwess,
        play(P1, dropKick, other, { abilities: [resourceAbility(prowess, "10018.martial-prowess-resource")] }),
      ),
      firstLegal,
      undefined,
      HLK_DEPS,
    );
    expect(inst(after, prowess).exhausted).toBe(true);
  });

  it("Beat Cop: exhausts and discards itself to deal damage to a minion equal to threat here", () => {
    const stacked = stackEncounterDeck(hulkGameWithExtras("10029"), ADVANCE, HYDRA_MERCENARY);
    const hero = runHlk(stacked, toHero());
    const revealed = settle(runHlk(hero, endTurn()), firstLegal, undefined, HLK_DEPS);
    const mercenary = instancesOf(revealed, HYDRA_MERCENARY)[0]!;
    const given = moveToHand(revealed, P1, "10029");
    const [beatCop] = given.ids as [never];
    const played = settle(
      runHlk(given.state, play(P1, beatCop, payWith(given.state, P1, 3, [beatCop]))),
      firstLegal,
      undefined,
      HLK_DEPS,
    );
    // Test-only surgery for "threat here": a real game builds this up over several activations of Beat Cop's own
    // first action ("move 1 threat from a scheme to here"), matching `patchInstance`'s use elsewhere in this file.
    const staged = patchInstance(played, beatCop, { threat: 3 });
    const after = settle(
      runHlk(staged, use(P1, beatCop, "10029.beat-cop-action-2")),
      picking(mercenary),
      undefined,
      HLK_DEPS,
    );
    // `discardSelf` snapshots `self.threat` before `leavePlay` clears it, so the exhaust-and-discard cost doesn't
    // erase the very count "for each threat here" is about to read (docs/phase7-wave1-scripting.md §6).
    expect(playerOf(after, P1).discard).toContain(beatCop);
    expect(after.villainArea).not.toContain(mercenary); // 3 damage into 3 hit points — defeated
  });
});
