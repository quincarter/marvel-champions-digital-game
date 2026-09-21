import { applyCommand, activeVillain, remainingHitPoints, type GameState } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
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
  type Picker,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { BKW_DEPS, runBkw, startBkwGame } from "./testing.js";

// Real wave 1 content: the Black Widow (Justice) precon against Rhino, standard, solo.
const bkwVsRhino = (seed = 2101) =>
  startBkwGame(wave1Scenario("rhino", { players: [{ starterDeckId: "bkw-justice" }], seed }));

// A neutral boost card (0 icons, no boost ability): "Advance", the same card msm/thor/cap/hlk tests use as `ADVANCE`
// to soak up the villain's own enemy-activation boost draw before a stacked card reaches the per-player reveal.
const ADVANCE = "01186";

/** Picks any offered Response/Interrupt whose option id contains one of `fragments` (an ability-id suffix or a raw
 * instance id), else defers to `firstLegal` — mirrors `msm/ms-marvel.test.ts`'s `protecting` but generalized across
 * every prompt kind (`chooseTriggers`, `chooseTarget`, `chooseCards`), since bkw's own tests need both. */
const preferring =
  (...fragments: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.filter((o) => fragments.some((f) => o.optionId.includes(f)));
    if (hits.length > 0) return hits.map((o) => o.optionId).slice(0, choice.maxSelections);
    return firstLegal(state);
  };

describe("Black Widow / Natasha Romanoff kit", () => {
  it("Widowmaker: after resolving a Preparation card's ability, deals 1 damage to an enemy; Synth-Suit readies her", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08009", "08008", "08015", "08016", "08019"); // Synth-Suit, Grappling Hook (both Preparation), + filler to pay both costs
    const [suit, hook] = given.ids as [never, never];
    const hero = runBkw(given.state, toHero());
    const withSuit = settle(
      runBkw(hero, play(P1, suit, payWith(hero, P1, 3, [suit, hook]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    const withHook = settle(
      runBkw(withSuit, play(P1, hook, payWith(withSuit, P1, 2, [hook]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    const stacked = stackEncounterDeck(withHook, ADVANCE, "01188"); // Advance soaks Rhino's own boost; Caught Off Guard is the real reveal, cancelled below
    const exhausted = patchInstance(stacked, identityOf(stacked), { exhausted: true }); // so Synth-Suit's "ready" is observable
    const villain = activeVillain(exhausted).instanceId;
    const hpBefore = remainingHitPoints(exhausted, villain);
    // Stop right after the reveal step (before the round ends): the *next* round's own "turn" step readies every
    // card automatically (RRG "start of turn"), which would make Synth-Suit's own exhaust-cost unobservable.
    const after = settle(
      runBkw(exhausted, endTurn()),
      preferring("grappling-hook-interrupt", "widowmaker", "synth-suit-response"),
      (s) => s.step.kind === "passFirstPlayer",
      BKW_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(hook); // discarded by Grappling Hook's own interrupt cost
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 1); // Widowmaker's 1 damage
    expect(inst(after, identityOf(after)).exhausted).toBe(false); // Synth-Suit readied her
    expect(inst(after, suit).exhausted).toBe(true); // Synth-Suit's own cost
  });

  it("Mission Prep: draws 1 card after playing a Preparation card, limit once per phase", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08008", "08010"); // Grappling Hook (cost 2), Widow's Bite (cost 1) — both Preparation
    const [hook, bite] = given.ids as [never, never];
    const deckBefore1 = playerOf(given.state, P1).deck.length;
    const withHook = settle(
      runBkw(given.state, play(P1, hook, payWith(given.state, P1, 2, [hook, bite]))),
      preferring("mission-prep"),
      undefined,
      BKW_DEPS,
    );
    expect(playerOf(withHook, P1).deck.length).toBe(deckBefore1 - 1); // Mission Prep's own draw
    const deckBefore2 = playerOf(withHook, P1).deck.length;
    const withBite = settle(
      runBkw(withHook, play(P1, bite, payWith(withHook, P1, 1, [bite]))),
      preferring("mission-prep"),
      undefined,
      BKW_DEPS,
    );
    expect(playerOf(withBite, P1).deck.length).toBe(deckBefore2); // limit once per phase: no second draw
  });

  it("Winter Soldier: cost reduced by 1 for each Preparation card controlled", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08002", "08008"); // Winter Soldier (printed cost 4), Grappling Hook (Preparation)
    const [winterSoldier, hook] = given.ids as [never, never];
    const hero = runBkw(given.state, toHero());
    const withHook = settle(
      runBkw(hero, play(P1, hook, payWith(hero, P1, 2, [hook, winterSoldier]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    // 4 - 1 (one Preparation card controlled) = 3.
    const after = settle(
      runBkw(withHook, play(P1, winterSoldier, payWith(withHook, P1, 3, [winterSoldier]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(winterSoldier);
  });

  it('Covert Ops: Action (thwart) — playable in alter-ego form, since the printed text omits "Hero"', () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08003");
    const [ops] = given.ids as [never];
    const before = mainThreat(given.state);
    const after = settle(
      runBkw(given.state, play(P1, ops, payWith(given.state, P1, 3, [ops]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    expect(mainThreat(after)).toBe(Math.max(0, before - 4));
    const villain = activeVillain(after).instanceId;
    expect(inst(after, villain).statuses.confused).toBeGreaterThan(0);
  });

  it("Dance of Death: three separate attacks; a stun cancels only the first (FAQ 'Dance of Death (#4)')", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08004");
    const [dance] = given.ids as [never];
    const hero = runBkw(given.state, toHero());
    const villain = activeVillain(hero).instanceId;
    const stunned = patchInstance(hero, identityOf(hero), {
      statuses: { ...inst(hero, identityOf(hero)).statuses, stunned: 1 },
    });
    const hpBefore = remainingHitPoints(stunned, villain);
    const after = settle(
      runBkw(stunned, play(P1, dance, payWith(stunned, P1, 3, [dance]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    // First attack (1 damage) cancelled by the stun; second (2) and third (3) go through: 5 total.
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 5);
    expect(inst(after, identityOf(after)).statuses.stunned).toBe(0);
  });

  it("Safe House #29: exhausts, then adds a chosen Preparation card from the discard pile to hand", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08005", "08008"); // Safe House #29, Grappling Hook (Preparation)
    const [safeHouse, hook] = given.ids as [never, never];
    const withSafeHouse = settle(runBkw(given.state, play(P1, safeHouse, [hook])), firstLegal, undefined, BKW_DEPS); // hook itself pays the 1-cost, landing in discard
    expect(playerOf(withSafeHouse, P1).discard).toContain(hook);
    const after = settle(
      runBkw(withSafeHouse, use(P1, safeHouse, "08005.safe-house-29-action")),
      picking(hook),
      undefined,
      BKW_DEPS,
    );
    expect(playerOf(after, P1).hand).toContain(hook);
    expect(playerOf(after, P1).discard).not.toContain(hook);
    expect(inst(after, safeHouse).exhausted).toBe(true);
  });

  it("Black Widow's Gauntlet: generates a [wild] resource only for a Preparation card", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08007", "08008", "08003"); // Gauntlet, Grappling Hook (Preparation), Covert Ops (not Preparation)
    const [gauntlet, hook, ops] = given.ids as [never, never, never];
    const withGauntlet = settle(
      runBkw(given.state, play(P1, gauntlet, payWith(given.state, P1, 1, [gauntlet, hook, ops]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    const withHook = settle(
      runBkw(
        withGauntlet,
        play(P1, hook, payWith(withGauntlet, P1, 1, [hook, ops]), {
          abilities: [resourceAbility(gauntlet, "08007.black-widows-gauntlet-resource")],
        }),
      ),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    expect(inst(withHook, hook).attachedTo).not.toBeNull(); // Grappling Hook is an upgrade: it attaches to Black Widow rather than sitting in playArea
    expect(inst(withHook, gauntlet).exhausted).toBe(true);

    // Negative: the same generated resource cannot pay for Covert Ops (no Preparation trait) — the play is illegal.
    const readied = patchInstance(withHook, gauntlet, { exhausted: false });
    const attempt = applyCommand(
      readied,
      play(P1, ops, payWith(readied, P1, 2, [ops]), {
        abilities: [resourceAbility(gauntlet, "08007.black-widows-gauntlet-resource")],
      }),
      BKW_DEPS,
    );
    expect(attempt.ok).toBe(false);
  });

  it("Widow's Bite: after a minion enters play, deals 2 damage to it and stuns it", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08010");
    const [bite] = given.ids as [never];
    const withBite = settle(
      runBkw(given.state, play(P1, bite, payWith(given.state, P1, 1, [bite]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    const hero = runBkw(withBite, toHero());
    const stacked = stackEncounterDeck(hero, ADVANCE, "01101"); // Hydra Mercenary: printed 1 ATK / 3 HP
    const after = settle(
      runBkw(stacked, endTurn()),
      preferring("widows-bite-response"),
      (s) => s.step.kind === "turn",
      BKW_DEPS,
    );
    // "01101" (Hydra Mercenary) has 2 copies in Rhino's own encounter set; only the one revealed and engaged with P1
    // matters here (`instancesOf` alone can return either copy, including the still-facedown one left in the deck).
    const minion = instancesOf(after, "01101").find((id) => after.instances[id]?.engagedWith === P1)!;
    expect(inst(after, minion).damage).toBe(2);
    expect(inst(after, minion).statuses.stunned).toBeGreaterThan(0);
    expect(playerOf(after, P1).discard).toContain(bite);
  });
});

describe("Black Widow pack cards", () => {
  it("Agent Coulson: searches deck and discard for a Preparation card, adds it to hand, shuffles the deck", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08011", "08008"); // Agent Coulson, Grappling Hook (a Preparation card)
    const [coulson, hook] = given.ids as [never, never];
    // Test surgery (matching msm's `moveToDiscard`): put Grappling Hook straight in the discard pile.
    const inDiscard: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== hook), discard: [...p.discard, hook] } : p,
      ),
    };
    const after = settle(
      runBkw(inDiscard, play(P1, coulson, payWith(inDiscard, P1, 3, [coulson]))),
      preferring("agent-coulson-response", hook),
      undefined,
      BKW_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(coulson);
    expect(playerOf(after, P1).hand).toContain(hook);
    expect(playerOf(after, P1).discard).not.toContain(hook);
  });

  it("Quake: after an engaged minion schemes (alter-ego form), exhausts to deal 2 damage to it", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08012");
    const [quake] = given.ids as [never];
    const withQuake = settle(
      runBkw(given.state, play(P1, quake, payWith(given.state, P1, 2, [quake]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    // Stay in alter-ego form: this engine's "Activation" ties attack-vs-scheme to the engaged player's current form
    // (`packages/engine/src/villain/phase.ts`'s `activateEnemy`), so an alter-ego-form Black Widow makes her engaged
    // minion scheme instead of attack.
    const stacked = stackEncounterDeck(withQuake, ADVANCE, "01101"); // Hydra Mercenary, printed 3 HP
    // Villain-phase step order is enemy activations *then* dealing/revealing encounter cards
    // (`packages/engine/src/villain/phase.ts`), so a minion revealed this round only gets engaged — it doesn't
    // activate (and so can't scheme) until the *next* villain phase. Round 1 just gets it into play.
    const roundTwo = settle(runBkw(stacked, endTurn()), firstLegal, (s) => s.step.kind === "turn", BKW_DEPS);
    const after = settle(
      runBkw(roundTwo, endTurn()),
      preferring("quake-response"),
      (s) => s.step.kind === "turn",
      BKW_DEPS,
    );
    const minion = instancesOf(after, "01101").find((id) => after.instances[id]?.engagedWith === P1)!;
    expect(inst(after, minion).damage).toBe(2);
    expect(inst(after, quake).exhausted).toBe(true);
  });

  it("Stealth Strike: deals 4 damage to an enemy; defeating it removes 2 threat from a scheme", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08013");
    const [strike] = given.ids as [never];
    const hero = runBkw(given.state, toHero());
    const stacked = stackEncounterDeck(hero, ADVANCE, "01101"); // Hydra Mercenary: printed 3 HP, killable by 4 damage
    const revealed = settle(runBkw(stacked, endTurn()), firstLegal, (s) => s.step.kind === "turn", BKW_DEPS);
    // "01101" (Hydra Mercenary) has 2 copies in Rhino's own encounter set; only the one revealed and engaged with P1
    // is a legal attack target (the other is still facedown in the deck).
    const minion = instancesOf(revealed, "01101").find((id) => revealed.instances[id]?.engagedWith === P1)!;
    const before = mainThreat(revealed);
    const after = settle(
      runBkw(revealed, play(P1, strike, payWith(revealed, P1, 3, [strike]))),
      picking(minion),
      undefined,
      BKW_DEPS,
    );
    expect(playerOf(after, P1).playArea).not.toContain(minion); // defeated
    expect(mainThreat(after)).toBe(Math.max(0, before - 2));
  });

  it("Grappling Hook: cancels a revealed treachery's effects and discards it", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08008", "08010"); // Grappling Hook; Widow's Bite as a canary upgrade
    const [hook, bite] = given.ids as [never, never];
    const hero = runBkw(given.state, toHero()); // "Hero Interrupt": only usable in hero form
    const withBite = settle(
      runBkw(hero, play(P1, bite, payWith(hero, P1, 1, [bite, hook]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    const withHook = settle(
      runBkw(withBite, play(P1, hook, payWith(withBite, P1, 2, [hook]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    const stacked = stackEncounterDeck(withHook, ADVANCE, "01188"); // Caught Off Guard: "discard an upgrade you control"
    const after = settle(
      runBkw(stacked, endTurn()),
      preferring("grappling-hook-interrupt"),
      (s) => s.step.kind === "turn",
      BKW_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(hook); // discarded by Grappling Hook's own interrupt cost
    expect(inst(after, bite).attachedTo).not.toBeNull(); // the canary upgrade survives (still attached) — 01188 never resolved
    expect(playerOf(after, P1).discard).not.toContain(bite);
  });

  it("Spycraft: cancels a revealed encounter card, then reveals another from the encounter deck", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08018");
    const [spycraft] = given.ids as [never];
    const hero = runBkw(given.state, toHero()); // "control a Spy character": only Black Widow's hero face has SPY
    const withSpycraft = settle(
      runBkw(hero, play(P1, spycraft, payWith(hero, P1, 1, [spycraft]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    const before = mainThreat(withSpycraft);
    // Advance (Rhino's attack boost); Caught Off Guard (cancelled); Advance again ("the villain schemes"); Hard to Keep
    // Down (01104, that scheme's 0-icon boost card; Core has only two Advances).
    const stacked = stackEncounterDeck(withSpycraft, ADVANCE, "01188", "01186", "01104");
    const after = settle(
      runBkw(stacked, endTurn()),
      preferring("spycraft-interrupt"),
      (s) => s.step.kind === "turn",
      BKW_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(spycraft);
    // +1 from The Break-In's acceleration (step 1), +1 from Rhino's SCH when the second reveal's "the villain
    // schemes" resolves: proof the chain (cancel → reveal another) actually ran.
    expect(mainThreat(after)).toBe(before + 2);
  });

  it("Quincarrier: a [wild] Resource ability, playable only with an Avenger identity", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08023", "08003"); // Quincarrier; Covert Ops (cost 3, to pay with the generated resource)
    const [carrier, ops] = given.ids as [never, never];
    const hero = runBkw(given.state, toHero()); // AVENGER is on Black Widow's hero face only
    const withCarrier = settle(
      runBkw(hero, play(P1, carrier, payWith(hero, P1, 3, [carrier, ops]))),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    const after = settle(
      runBkw(
        withCarrier,
        play(P1, ops, payWith(withCarrier, P1, 2, [ops]), {
          abilities: [resourceAbility(carrier, "08023.quincarrier-resource")],
        }),
      ),
      firstLegal,
      undefined,
      BKW_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(ops); // Covert Ops resolved and discarded
    expect(inst(after, carrier).exhausted).toBe(true);
  });

  it("Counterintelligence: prevents threat that would be placed on the main scheme, once", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08017");
    const [ci] = given.ids as [never];
    const hero = runBkw(given.state, toHero()); // hero form: Rhino attacks rather than schemes during activation
    const withCI = settle(runBkw(hero, play(P1, ci, payWith(hero, P1, 2, [ci]))), firstLegal, undefined, BKW_DEPS);
    const before = mainThreat(withCI);
    // Advance (Rhino's attack boost); Advance dealt to Black Widow ("the villain schemes"); Hard to Keep Down (01104,
    // that scheme's 0-icon boost card; Core has only two Advances).
    const stacked = stackEncounterDeck(withCI, ADVANCE, ADVANCE, "01104");
    const after = settle(
      runBkw(stacked, endTurn()),
      preferring("counterintelligence-interrupt"),
      (s) => s.step.kind === "turn",
      BKW_DEPS,
    );
    // The first placement is The Break-In's 1 acceleration threat in step 1, fully prevented. Counterintelligence is
    // then discarded, so the dealt Advance's scheme (Rhino's SCH 1) lands.
    expect(mainThreat(after)).toBe(before + 1);
    expect(playerOf(after, P1).discard).toContain(ci);
  });

  /**
   * Counterattack (08030, aggression), Rapid Response (08031, leadership), Defensive Stance (08032, protection) and
   * Espionage (08033, basic) are bundled in the Black Widow pack but are **not** part of the 40-card "Black Widow
   * (Justice)" precon `bkw-justice` (`packages/content/src/data/bkw/starterDecks.ts` lists only up to card 08024) —
   * they're pool cards for a differently-built Black Widow deck (a different secondary aspect, or a generic/basic
   * card usable by any deck). Reaching them through a *real game* the way the tests above do would need a second,
   * fully-built 40-card legal deck of a different aspect, which is disproportionate for four cards whose shapes are
   * already proven elsewhere in this exact test file (Counterattack mirrors Counter-Punch's own Core shape; Rapid
   * Response mirrors nothing new — `putIntoPlay` + `dealDamage`; Defensive Stance/Espionage mirror Wiggle
   * Room's/Attacrobatics' own prevent/cancel shapes). This matches `msm`'s own precedent: its four analogous
   * off-precon pack cards (Melee, Concussive Blow, Morale Boost, Down Time — `wave1/msm/pack-cards.test.ts`'s own
   * doc comment) have no dedicated tests either. They're still scripted (not a "record and skip" gap) and exercised
   * structurally by `coverage.test.ts` and `defineAbilities`'s own validation at import time.
   */
});
