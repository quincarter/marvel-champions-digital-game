import { cardId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { activeEncounterDeckId, applyCommand, cardsInPlay, characterProfile, hasKeyword, traitsOf } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, instancesOf, moveToHand, P1, payWith, play, playerOf, settle, stackEncounterDeck, use, type Picker } from "../../testing/harness.js";
import { stageNemesisCardForReveal, withDamage, withForm } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { playFromHand, revealFromEncounterDeck, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { ANT_MAN_KIT } from "./kit.js";

// Real wave 2 content: the Ant-Man (Leadership) precon against Rhino, standard, solo. Scott Lang starts in alter-ego.
const antManVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "ant-leadership" }], seed: 2026 }));

const TINY = { heroForm: 0 } as const;
const GIANT = { heroForm: 1 } as const;

/**
 * Accepts the named optional responses (a trigger's option id is `<instance>:<ability>`) and picks the named
 * targets; declines everything else.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const changeTo = (state: GameState, to: { heroForm: number } | "alterEgo", pick: Picker) =>
  settle(runWave2(state, { type: "changeForm", playerId: P1, to }), pick, undefined, WAVE2_DEPS);

const traits = (state: GameState) => traitsOf(state, identityOf(state), WAVE2_DEPS).map(String);

describe("Ant-Man kit", () => {
  it("Puny Pest: response, after you change to Tiny hero form, removes 1 threat from a scheme", () => {
    const fresh = antManVsRhino();
    const scheme = fresh.mainScheme.instanceId;
    const start = { ...fresh, instances: { ...fresh.instances, [scheme]: { ...fresh.instances[scheme]!, threat: 3 } } };
    const settled = changeTo(start, TINY, accepting("12001a.puny-pest", scheme));
    expect(inst(settled, scheme).threat).toBe(2);
  });

  it("Time to Unwind: response, after you change to alter-ego, heals 1 damage from Scott Lang", () => {
    const start = withForm(antManVsRhino(), TINY);
    const identity = identityOf(start);
    const settled = changeTo(withDamage(start, identity, 2), "alterEgo", accepting("12001b.time-to-unwind"));
    expect(inst(settled, identity).damage).toBe(1);
  });

  it("Giant Nuisance: response, after you change to Giant hero form, deals 1 damage to an enemy", () => {
    const start = antManVsRhino();
    const villain = start.villains[0]!.instanceId;
    const before = inst(start, villain).damage;
    const settled = changeTo(start, GIANT, accepting("12001c.giant-nuisance", villain));
    expect(traits(settled)).toContain("GIANT");
    expect(inst(settled, villain).damage).toBe(before + 1);
  });

  it("the form responses are optional: declining them changes nothing else", () => {
    const start = antManVsRhino();
    const villain = start.villains[0]!.instanceId;
    const settled = changeTo(start, GIANT, firstLegal);
    expect(inst(settled, villain).damage).toBe(inst(start, villain).damage);
  });

  it("Resize: Hero Action, changes to your other hero form and draws 1 card", () => {
    const hero = withForm(antManVsRhino(), TINY);
    const before = playerOf(hero, P1).hand.length;
    const { state: played } = playFromHand(hero, "12005", 0);
    expect(traits(played)).toContain("GIANT");
    // +1 moved into hand, -1 played, +1 drawn.
    expect(playerOf(played, P1).hand.length).toBe(before + 1);
  });

  it("Pym Particles: after being spent, heals 2 damage from your hero in Giant hero form", () => {
    const giant = withForm(antManVsRhino(), GIANT);
    const given = moveToHand(giant, P1, "12006", "12007");
    const [particles, antsSupport] = given.ids as [InstanceId, InstanceId];
    const identity = identityOf(given.state);
    const damaged = withDamage(given.state, identity, 3);
    const played = settle(runWave2(damaged, play(P1, antsSupport, [particles])), accepting("12006.pym-particles-response"), undefined, WAVE2_DEPS);
    expect(inst(played, identity).damage).toBe(1);
  });

  it("Pym Particles: after being spent, draws 1 card in Tiny hero form", () => {
    const tiny = withForm(antManVsRhino(), TINY);
    const given = moveToHand(tiny, P1, "12006", "12007");
    const [particles, antsSupport] = given.ids as [InstanceId, InstanceId];
    const before = playerOf(given.state, P1).hand.length;
    const played = settle(runWave2(given.state, play(P1, antsSupport, [particles])), accepting("12006.pym-particles-response"), undefined, WAVE2_DEPS);
    // -1 for the support played, -1 for Pym Particles spent as its payment, +1 drawn by the response.
    expect(playerOf(played, P1).hand.length).toBe(before - 2 + 1);
  });

  it("Giant Stomp: cannot be played from Tiny hero form", () => {
    const given = moveToHand(withForm(antManVsRhino(), TINY), P1, "12003");
    const [giantStomp] = given.ids as [InstanceId];
    expect(() => runWave2(given.state, play(P1, giantStomp, payWith(given.state, P1, 3, [giantStomp])))).toThrow(/rejected/);
  });

  it("Giant Stomp: from Giant hero form, deals 8 damage to an enemy as an attack", () => {
    const start = withForm(antManVsRhino(), GIANT);
    const villain = start.villains[0]!.instanceId;
    const before = inst(start, villain).damage;
    const { state: played } = playFromHand(start, "12003", 3, accepting(villain));
    expect(inst(played, villain).damage).toBe(before + 8);
  });

  it("Army of Ants: its action cannot be triggered outside Tiny hero form, and deals 1 damage in it", () => {
    const giant = withForm(antManVsRhino(), GIANT);
    const { state: inPlay, id: ants } = playFromHand(giant, "12007", 1);
    expect(() => runWave2(inPlay, use(P1, ants, "12007.army-of-ants-action"))).toThrow(/cannot be triggered/);
    const tiny = withForm(inPlay, TINY);
    const villain = tiny.villains[0]!.instanceId;
    const used = settle(runWave2(tiny, use(P1, ants, "12007.army-of-ants-action")), accepting(villain), undefined, WAVE2_DEPS);
    expect(inst(used, villain).damage).toBe(inst(tiny, villain).damage + 1);
    expect(inst(used, ants).exhausted).toBe(true);
  });

  it("Giant Strength: +1 ATK until the end of this turn after changing to Giant hero form", () => {
    const tiny = withForm(antManVsRhino(), TINY);
    const { state: withStrength } = playFromHand(tiny, "12009", 1);
    const identity = identityOf(withStrength);
    // Two forks of the same pre-change state: declining vs accepting the response, so the comparison isolates
    // Giant Strength's own +1 rather than the Tiny→Giant form change's own base ATK difference.
    const declined = changeTo(withStrength, GIANT, firstLegal);
    const baseline = characterProfile(declined, identity, WAVE2_DEPS)?.atk;
    const settled = changeTo(withStrength, GIANT, accepting("12009.giant-strength-response"));
    expect(characterProfile(settled, identity, WAVE2_DEPS)?.atk).toBe((baseline ?? 0) + 1);
  });

  it("Giant Strength: no bonus from changing to alter-ego (not Giant hero form)", () => {
    const giant = withForm(antManVsRhino(), GIANT);
    const { state: withStrength } = playFromHand(giant, "12009", 1);
    const before = withStrength.lastingEffects.length;
    const settled = changeTo(withStrength, "alterEgo", firstLegal);
    // No new lasting +1 ATK effect is created (there is no "Giant hero form" response option offered at all).
    expect(settled.lastingEffects.length).toBe(before);
  });

  it("Wrist Gauntlets: each action is usable only in its own hero form", () => {
    const giant = withForm(antManVsRhino(), GIANT);
    const { state: inPlay, id: gauntlets } = playFromHand(giant, "12010", 1);
    expect(() => runWave2(inPlay, use(P1, gauntlets, "12010.wrist-gauntlets-hero-action"))).toThrow(/cannot be triggered/);
    const tiny = withForm(inPlay, TINY);
    expect(() => runWave2(tiny, use(P1, gauntlets, "12010.wrist-gauntlets-action"))).toThrow(/cannot be triggered/);
  });

  it("Ant-Man's Helmet: heals 2 damage from your hero after you change to Giant hero form", () => {
    const { state: withHelmet } = playFromHand(antManVsRhino(), "12008", 3);
    const identity = identityOf(withHelmet);
    const settled = changeTo(withDamage(withHelmet, identity, 3), GIANT, accepting("12008.ant-mans-helmet-response"));
    expect(inst(settled, identity).damage).toBe(1);
  });

  it("Ant-Man's Helmet: draws 1 card after you change to Tiny hero form", () => {
    const { state: withHelmet } = playFromHand(antManVsRhino(), "12008", 3);
    const before = playerOf(withHelmet, P1).hand.length;
    const settled = changeTo(withHelmet, TINY, accepting("12008.ant-mans-helmet-hero-response"));
    expect(playerOf(settled, P1).hand.length).toBe(before + 1);
  });

  it("Swarm Tactics: Team-Up with the Wasp ally in play, changes to your other hero form and readies your hero", () => {
    const tiny = withForm(antManVsRhino(), TINY);
    const { state: withWasp } = playFromHand(tiny, "12002", 3);
    const exhausted = { ...withWasp, instances: { ...withWasp.instances, [identityOf(withWasp)]: { ...withWasp.instances[identityOf(withWasp)]!, exhausted: true } } };
    const { state: played } = playFromHand(exhausted, "12020", 1);
    expect(traits(played)).toContain("GIANT");
    expect(inst(played, identityOf(played)).exhausted).toBe(false);
  });

  it("Swarm Tactics: cannot be played without Wasp in play", () => {
    const given = moveToHand(withForm(antManVsRhino(), TINY), P1, "12020");
    const [swarmTactics] = given.ids as [InstanceId];
    expect(() => runWave2(given.state, play(P1, swarmTactics, payWith(given.state, P1, 1, [swarmTactics])))).toThrow(/Team-Up needs Wasp/);
  });
});

/**
 * Moves a *different* nemesis-set card from `PlayerState.setAside` a few cards down into the shared encounter
 * deck — standing in for "eventually got shuffled in" (a real game only unpacks the rest of a nemesis set via
 * Shadow of the Past, Core 01190) so `discardEncounterUntil(encounterSetOf(self))` (12029's own module docblock)
 * has a real target to find, with real (guaranteed non-nemesis) filler cards ahead of it to actually discard.
 */
function stageNemesisCardIntoDeck(state: GameState, code: string, depth: number, player = P1): GameState {
  const owner = playerOf(state, player);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [...pile.deck.slice(0, depth), id, ...pile.deck.slice(depth)] } },
  };
}

describe("Ant-Man's obligation and nemesis (Care for Cassie, Yellowjacket)", () => {
  it("Tech Theft: treats the printed text box of each Tech player card as if it were blank", () => {
    // Reinforced Suit (12018, TECH) attached to Wasp (12002) grants +2 hit points constantly.
    const withWasp = playFromHand(withForm(antManVsRhino(), TINY), "12002", 3);
    const wasp = withWasp.id;
    const given = moveToHand(withWasp.state, P1, "12018");
    const [suit] = given.ids as [InstanceId];
    const withSuit = settle(
      runWave2(given.state, play(P1, suit, payWith(given.state, P1, 1, [suit]), { attachToInstanceId: wasp })),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(characterProfile(withSuit, wasp, WAVE2_DEPS)?.maxHp).toBe(5); // printed 3 + Reinforced Suit's +2

    const { state: withTechTheft } = revealFromEncounterDeck(withSuit, "12026");
    // Reinforced Suit's own text box (its "+2 hit points" constant) is now blank, so Wasp is back to her printed 3.
    expect(characterProfile(withTechTheft, wasp, WAVE2_DEPS)?.maxHp).toBe(3);
  });

  it("Yellowjacket: gains the Giant trait and retaliate 1 while the engaged player is in Giant hero form; the Tiny trait and +1 ATK while Tiny (docs/phase7-wave2.md §17.5 — the shape that used to crash the engine, now proven safe with a real reveal-then-read-traits test, not just re-added on faith)", () => {
    const giant = withForm(antManVsRhino(), GIANT);
    const { state, id: yellowjacket } = revealFromEncounterDeck(giant, "12027");
    expect(traitsOf(state, yellowjacket, WAVE2_DEPS).map(String)).toContain("GIANT");
    expect(hasKeyword(state, yellowjacket, "retaliate", WAVE2_DEPS)).toBe(true);
    expect(characterProfile(state, yellowjacket, WAVE2_DEPS)?.atk).toBe(2); // printed 2, no Tiny bonus in Giant form

    const tiny = withForm(state, TINY);
    expect(traitsOf(tiny, yellowjacket, WAVE2_DEPS).map(String)).toContain("TINY");
    expect(traitsOf(tiny, yellowjacket, WAVE2_DEPS).map(String)).not.toContain("GIANT");
    expect(hasKeyword(tiny, yellowjacket, "retaliate", WAVE2_DEPS)).toBe(false);
    expect(characterProfile(tiny, yellowjacket, WAVE2_DEPS)?.atk).toBe(3); // printed 2 + 1
  });

  // docs/phase7-wave2.md §22/§23: `applyRuleUntil`/`cannotChangeFormUntil` — a `RuleSpec` restriction that outlives
  // the obligation discarding itself in the same breath that imposes it. Care for Cassie (12025) is Ant-Man's own
  // obligation, shuffled directly into the shared encounter deck at setup (`HeroIdentityCard.obligationCardId`) —
  // unlike a nemesis-set card, `stackEncounterDeck` alone reaches it. Revealed during the villain phase (no turn in
  // progress), so both readings of "your next turn" agree: it covers the very next turn the player takes.
  it("Care for Cassie: choosing to discard a card imposes 'you cannot change form until your next turn ends', which lifts after that turn", () => {
    const staged = stackEncounterDeck(antManVsRhino(), "01186", "12025");
    const pickAlternative: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const alt = choice.options.find((o) => o.label.startsWith("Choose and discard"));
      if (alt) return [alt.optionId];
      return firstLegal(state);
    };
    // Round N+1's own player turn: the reveal happened in round N's villain phase (no turn in progress), so the
    // restriction already covers *this* turn, the first the player begins after it was created.
    const revealed = settle(runWave2(staged, endTurn()), pickAlternative, undefined, WAVE2_DEPS);
    expect(instancesOf(revealed, "12025").some((id) => playerOf(revealed, P1).playArea.includes(id))).toBe(false);
    expect(applyCommand(revealed, { type: "changeForm", playerId: P1, to: TINY }, WAVE2_DEPS).ok).toBe(false);

    // The end of that turn is the timing point (RRG 1.8 "Lasting Effects", p. 26): round N+2 is free again.
    const after = settle(runWave2(revealed, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(applyCommand(after, { type: "changeForm", playerId: P1, to: TINY }, WAVE2_DEPS).ok).toBe(true);
  });

  // docs/phase7-wave2.md §20.2/§23: `TargetQuery.encounterSetOf`. Tech Theft (12026), Yellowjacket's Plan's own
  // nemesis-set sibling, is planted a few cards down in the shared deck (module docblock, `stageNemesisCardIntoDeck`)
  // so the search genuinely discards real filler cards before finding — and revealing — it.
  it("Yellowjacket's Plan: When Revealed, discards cards from the encounter deck until a card from the Ant-Man Nemesis set is discarded, then reveals it", () => {
    const withTechTheft = stageNemesisCardIntoDeck(antManVsRhino(), "12026", 3);
    const staged = stageNemesisCardForReveal(withTechTheft, "12029");
    const deckId = activeEncounterDeckId(staged);
    const discardBefore = staged.encounterDecks[deckId]!.discard.length;
    const revealed = settle(runWave2(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE2_DEPS);
    // Tech Theft is now in play (revealed), not sitting discarded — its own constant ability is live.
    const techTheft = instancesOf(revealed, "12026").find((id) => cardsInPlay(revealed).includes(id));
    expect(techTheft).toBeDefined();
    // At least the filler cards planted ahead of it were genuinely discarded along the way.
    expect(revealed.encounterDecks[deckId]!.discard.length).toBeGreaterThan(discardBefore);
  });
});
