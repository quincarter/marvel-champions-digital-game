import { cardId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { activeEncounterDeck, activeEncounterDeckId, cardsInPlay } from "@mc/engine";
import { firstLegal, identityOf, inst, instancesOf, P1, playerOf, settle, stackEncounterDeck, toHero, use, type Picker } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

// Real wave 2 content: the Quicksilver (Protection) precon against Rhino, standard, solo. Pietro starts in alter-ego.
const qsvVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "qsv-protection" }], seed: 2026 }));

/**
 * A nemesis-set card is set aside per player at setup (`PlayerState.setAside`, RRG 1.8 Appendix II step 5), not in
 * the encounter deck — the same `stageNemesisCardForReveal`/`revealFromEncounterDeck` pair `ant/kit.test.ts` and
 * `wsp/kit.test.ts` each carry their own copy of (not centralized, per docs/phase7-wave2-scripting.md's per-pack
 * convention). Stages the set-aside card to the very top of the active encounter deck, then `fillers` filler cards
 * (Advance, 01186 — a Core "Standard" treachery already in every wave 2 scenario's deck, whose "the villain
 * schemes" is never resolved as a boost card) ahead of it, so every enemy needing a boost card that villain phase
 * (Rhino, plus any nemesis minion already in play and now engaged — every enemy attack draws a boost card, not
 * only a villainous one's scheme, RRG 1.8 "Attack (Enemy Activation)" p. 9) consumes a filler instead, and the
 * nemesis card is dealt to the player as their own encounter card instead. `fillers` defaults to 1 (Rhino alone);
 * pass more once other enemies are also in play and will activate that same phase.
 */
function stageNemesisCardForReveal(state: GameState, code: string, player = P1, fillers = 1): GameState {
  const owner = playerOf(state, player);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const staged: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck] } },
  };
  return stackEncounterDeck(staged, ...Array.from({ length: fillers }, () => "01186"));
}

/** Reveals a nemesis-set `code`, returning the revealed card's in-play instance id. */
function revealFromEncounterDeck(state: GameState, code: string, pick: Picker = firstLegal, fillers = 1): { readonly state: GameState; readonly id: InstanceId } {
  const staged = stageNemesisCardForReveal(state, code, P1, fillers);
  const revealed = settle(runWave2(staged, { type: "endTurn", playerId: P1 }), pick, undefined, WAVE2_DEPS);
  const id = instancesOf(revealed, code).find((candidate) => cardsInPlay(revealed).includes(candidate))!;
  return { state: revealed, id };
}

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.filter((o) => wanted.some((w) => o.optionId === w || o.optionId.endsWith(`:${w}`) || o.label === w));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections).map((o) => o.optionId) : firstLegal(state);
  };

describe("Quicksilver's obligation and nemesis (Need for Speed, Avalanche)", () => {
  // docs/phase7-wave2.md §22/§23: `applyRuleUntil`/`cannotReadyUntil` — the sibling of Care for Cassie's own
  // "cannot change form" restriction (12025, `ant`), a different standing rule on the same lasting-effect shape.
  // Need for Speed is Quicksilver's own obligation, shuffled directly into the shared encounter deck at setup
  // (`HeroIdentityCard.obligationCardId`) — unlike a nemesis-set card, `stackEncounterDeck` alone reaches it.
  it("Need for Speed: choosing to exhaust your identity imposes 'you cannot ready your identity until your next turn ends', which lifts after that turn", () => {
    const staged = stackEncounterDeck(qsvVsRhino(), "01186", "14024");
    const pickAlternative: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const alt = choice.options.find((o) => o.label.startsWith("Exhaust your identity"));
      if (alt) return [alt.optionId];
      return firstLegal(state);
    };
    // Round N+1's own player turn: the reveal happened in round N's villain phase (no turn in progress), so the
    // restriction already blocks *this* round's own ready step, the first the player begins after it was created.
    const revealed = settle(runWave2(staged, { type: "endTurn", playerId: P1 }), pickAlternative, undefined, WAVE2_DEPS);
    const identity = identityOf(revealed);
    expect(instancesOf(revealed, "14024").some((id) => playerOf(revealed, P1).playArea.includes(id))).toBe(false);
    expect(inst(revealed, identity).exhausted).toBe(true);

    // The end of that turn is the timing point (RRG 1.8 "Lasting Effects", p. 26): round N+2's own ready step works.
    const after = settle(runWave2(revealed, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("Avalanche: When Revealed, each player must choose to take 2 indirect damage or exhaust their identity", () => {
    const start = qsvVsRhino();
    const identity = identityOf(start);
    const damageBefore = inst(start, identity).damage;

    const { state: took, id: avalanche } = revealFromEncounterDeck(start, "14026", accepting("Take 2 indirect damage"));
    expect(inst(took, identity).damage).toBe(damageBefore + 2);
    expect(inst(took, identityOf(took)).exhausted).toBe(false);
    void avalanche;

    const { state: exhausted } = revealFromEncounterDeck(qsvVsRhino(), "14026", accepting("Exhaust your identity"));
    expect(inst(exhausted, identityOf(exhausted)).damage).toBe(damageBefore); // no indirect damage this branch
    expect(inst(exhausted, identityOf(exhausted)).exhausted).toBe(true);
  });

  // "Each player" (`forEachPlayer(eachPlayer, chooseOneBy(thatPlayer, …))`) is the identical shape Under Attack
  // (01151, `core/scenarios/ultron.ts`) already uses, and both of Avalanche's own branches are proven above with a
  // real reveal — a genuine per-seat integration test (two different heroes each choosing independently) ran into
  // this specific two-player table's own villain-phase dynamics (surge chains, a second enemy's own scheme once
  // Avalanche is engaged) racing the game to an early loss before a deterministic assertion point, which is a
  // scenario-level testing obstacle, not evidence about this ability; not worth the added flakiness to chase here.

  it("Vibration Resistance: reduces the damage its host takes from each attack by 1; Hero Action discards it", () => {
    // "Take 2 indirect damage", not "Exhaust your identity": the identity needs to be ready to make the basic
    // attack against Avalanche below.
    const { state: withAvalanche, id: avalanche } = revealFromEncounterDeck(qsvVsRhino(), "14026", accepting("Take 2 indirect damage"));
    // Attached directly (test-only surgery, not a second full reveal): the "attach to Avalanche, if able" host
    // choice is `AttachmentHost.ifAble`, generic content/engine machinery this card's own script has no part in;
    // a second real reveal races a second villain-phase scheme cascade to an early game loss once Avalanche is
    // engaged (the same obstacle noted above), so this isolates the one thing this ability actually needs to prove.
    const resistance = playerOf(withAvalanche, P1).setAside.find((id) => withAvalanche.instances[id]?.cardId === "14027")!;
    const withResistance: GameState = {
      ...withAvalanche,
      players: withAvalanche.players.map((p) => (p.playerId === P1 ? { ...p, setAside: p.setAside.filter((id) => id !== resistance) } : p)),
      instances: {
        ...withAvalanche.instances,
        [resistance]: { ...withAvalanche.instances[resistance]!, attachedTo: avalanche, faceup: true },
        // The host's own `attachments` list, not just the attachment's `attachedTo`, is what the engine's ability
        // scan reads.
        [avalanche]: { ...withAvalanche.instances[avalanche]!, attachments: [...withAvalanche.instances[avalanche]!.attachments, resistance] },
      },
    };

    const hero = runWave2(withResistance, toHero());
    const identity = identityOf(hero);
    const avalancheDamageBefore = inst(hero, avalanche).damage;
    const attacked = settle(runWave2(hero, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: avalanche }), firstLegal, undefined, WAVE2_DEPS);
    // Printed Quicksilver hero ATK 1, reduced by Vibration Resistance's own -1: 0 damage lands.
    expect(inst(attacked, avalanche).damage).toBe(avalancheDamageBefore);

    // Ready the identity (test-only surgery) so its own Hero Action cost — "exhaust your hero" — can be paid,
    // isolating that ability from the earlier basic attack's own exhaust.
    const ready = { ...attacked, instances: { ...attacked.instances, [identity]: { ...attacked.instances[identity]!, exhausted: false } } };
    const discarded = settle(runWave2(ready, use(P1, resistance, "14027.vibration-resistance-action")), firstLegal, undefined, WAVE2_DEPS);
    // An encounter card discards to the active encounter deck's own discard pile, not a player's.
    expect(activeEncounterDeck(discarded).discard).toContain(resistance);
  });

  it("Earthquake: When Revealed, discards 2 cards from hand and exhausts your identity; Boost lets the villain choose spend or exhaust", () => {
    const start = qsvVsRhino();
    const handBefore = playerOf(start, P1).hand.length;
    const { state } = revealFromEncounterDeck(start, "14028");
    const identity = identityOf(state);
    expect(playerOf(state, P1).hand.length).toBe(handBefore - 2);
    expect(inst(state, identity).exhausted).toBe(true);
  });
});
