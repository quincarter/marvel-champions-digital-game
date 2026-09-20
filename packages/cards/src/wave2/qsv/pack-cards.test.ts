import { activeEncounterDeck, cardsInPlay, characterProfile, type GameState, type InstanceId } from "@mc/engine";
import { answer, endTurn, firstLegal, identityOf, inst, instancesOf, moveToHand, P1, payWith, play, playerOf, settle, stackEncounterDeck, toHero, use, type Picker } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { QSV_PACK_CARDS } from "./pack-cards.js";

// Real wave 2 content: the Quicksilver (Protection) precon against Rhino, standard, solo. Pietro starts in alter-ego.
const qsvVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "qsv-protection" }], seed: 2026 }));

function withDamage(state: GameState, id: InstanceId, damage: number): GameState {
  return { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, damage } } };
}

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/**
 * `chooseCards`'s own options are the candidate instance ids, not slot-keyed — `firstLegal` alone would pick its
 * own `min` (often 0). Takes every offered candidate for that one prompt kind, up to its own max; `firstLegal`
 * otherwise.
 */
const pickAllCards: Picker = (state) => {
  const choice = state.pendingChoice;
  if (!choice) return [];
  return choice.prompt.kind === "chooseCards" ? choice.options.slice(0, choice.maxSelections).map((o) => o.optionId) : firstLegal(state);
};

/** Moves the card into P1's hand and plays it, paying with other hand cards. */
function playFromHand(state: GameState, code: string, cost: number, pick: Picker = firstLegal): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(runWave2(given.state, play(P1, id, payWith(given.state, P1, cost, [id]))), pick, undefined, WAVE2_DEPS);
  return { state: played, id };
}

describe("Quicksilver pack cards", () => {
  it("Multiple Man: after entering play, searches your deck and hand for a copy and puts it into play (RRG 'Search', p. 39 — always shuffles)", () => {
    // Accepts the optional Response, then takes every offered candidate at the (slot-less) `chooseCards` step.
    const acceptThenPickAll: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseCards") return pickAllCards(state);
      return accepting("14012.multiple-man-response")(state);
    };
    const hero = runWave2(qsvVsRhino(), toHero());
    const { state } = playFromHand(hero, "14012", 4, acceptThenPickAll);
    const copiesInPlay = playerOf(state, P1).playArea.filter((id) => inst(state, id).cardId === "14012");
    // The precon carries 3 copies: the played one, plus its own Response finding a second, which (still in play,
    // "after Multiple Man enters play") triggers its own Response and finds the third.
    expect(copiesInPlay).toHaveLength(3);
  });

  it("Warlock: spends a [mental] resource to heal up to 2 damage from Warlock (a heal can never exceed the damage present)", () => {
    const { state: withWarlock } = playFromHand(runWave2(qsvVsRhino(), toHero()), "14013", 3);
    const warlock = instancesOf(withWarlock, "14013")[0]!;
    // Serval Industries (14007) prints a [mental] icon, satisfying the ability's own "spend a [mental] resource" cost.
    const given = moveToHand(withWarlock, P1, "14007");
    const [mentalCard] = given.ids as [InstanceId];
    const damaged = withDamage(given.state, warlock, 1);
    const healed = settle(runWave2(damaged, use(P1, warlock, "14013.warlock-action", [{ fromHand: mentalCard }])), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(healed, warlock).damage).toBe(0); // healed only the 1 present, not 2
  });

  it("Never Back Down: Hero Interrupt (defense), gets +2 DEF for the attack; with the attack fully prevented, stuns the attacking enemy", () => {
    // Rhino (ATK 2) vs Quicksilver (printed DEF 1): 2 - (1 + 2) <= 0, so Never Back Down's own DEF bonus alone
    // prevents the whole attack — no boost card needed to make the arithmetic land, so the encounter deck's top is
    // stacked with a 0-boost-icon Standard card (Advance, 01186) to keep this deterministic. Declaring the
    // defender also opens Quicksilver's own Super Speed response (`basicPowerUsed`, "defense") — the stack
    // resolves it *before* the deferred `defended` interrupt (LIFO: `basicPowerUsing`/`basicPowerUsed` are pushed
    // after `defended`, so they're on top), so this uses one picker that accepts Never Back Down whenever it's
    // offered rather than asserting an exact prompt order.
    const acceptNeverBackDown: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "payForCard") return [choice.options[0]!.optionId];
      return accepting("14014.never-back-down-interrupt")(state);
    };
    const given = moveToHand(runWave2(qsvVsRhino(), toHero()), P1, "14014");
    const villain = given.state.villains[0]!.instanceId;
    const stacked = stackEncounterDeck(given.state, "01186");
    const reached = settle(runWave2(stacked, endTurn()), firstLegal, (s) => s.pendingChoice?.prompt.kind === "declareDefender", WAVE2_DEPS);
    expect(reached.pendingChoice?.prompt.kind).toBe("declareDefender");
    const hero = identityOf(reached);
    const damageBefore = inst(reached, hero).damage;

    const offered = answer(reached, [hero], WAVE2_DEPS); // declares Quicksilver as the defender
    const after = settle(offered, acceptNeverBackDown, undefined, WAVE2_DEPS);
    expect(inst(after, hero).damage).toBe(damageBefore); // fully prevented
    expect(inst(after, villain).statuses.stunned).toBeGreaterThan(0); // "if you take no damage … stun the attacking enemy"
  });

  it("Side Step: Hero Interrupt (defense), prevents 3 damage; deals 1 to the attacker only if paid with [energy]", () => {
    const given = moveToHand(runWave2(qsvVsRhino(), toHero()), P1, "14015", "14008"); // Side Step + an [energy]-cost card to pay with
    const [, energyCard] = given.ids as [InstanceId, InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const stacked = stackEncounterDeck(given.state, "01186");
    const reached = settle(runWave2(stacked, endTurn()), firstLegal, (s) => s.pendingChoice?.prompt.kind === "declareDefender", WAVE2_DEPS);
    const hero = identityOf(reached);
    const damageBefore = inst(reached, hero).damage;
    const villainDamageBefore = inst(reached, villain).damage;

    // Undefended (`firstLegal` declines the formal defender step with "decline"): Side Step's own defense label
    // still lets it interrupt "when you would take damage" and defend the attack reactively. Pays specifically
    // with the [energy]-printing card once offered, to exercise "if you paid … using [energy]".
    const paySpecifically: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "payForCard") return [`hand:${energyCard}`];
      return accepting("14015.side-step-interrupt")(state);
    };
    const after = settle(reached, paySpecifically, undefined, WAVE2_DEPS);
    expect(inst(after, hero).damage).toBe(damageBefore); // all 2 of Rhino's ATK prevented (3 prevention > 2 damage)
    expect(inst(after, villain).damage).toBe(villainDamageBefore + 1); // paid with [energy]: 1 damage back
  });

  it("Nerves of Steel: Resource, exhaust it to generate a [energy] resource for a Defense event", () => {
    const { state } = playFromHand(runWave2(qsvVsRhino(), toHero()), "14017", 2);
    // An upgrade attaches (to the identity, here) rather than sitting loose in `playArea` — `cardsInPlay` covers
    // both. The precon carries 3 copies of Nerves of Steel, so this also picks out the one actually in play.
    const nerves = cardsInPlay(state).find((id) => inst(state, id).cardId === "14017")!;
    // Side Step (14015, a Defense-trait event) is reactive-only — playable only inside its own trigger window, so
    // this drives the same real villain-attack flow the Side Step test above does, but pays with Nerves of Steel's
    // own resource ability instead of a hand card.
    const given = moveToHand(state, P1, "14015");
    const stacked = stackEncounterDeck(given.state, "01186");
    const reached = settle(runWave2(stacked, endTurn()), firstLegal, (s) => s.pendingChoice?.prompt.kind === "declareDefender", WAVE2_DEPS);
    const payWithNerves: Picker = (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "payForCard") return [`ability:${nerves}:14017.nerves-of-steel-resource`];
      return accepting("14015.side-step-interrupt")(s);
    };
    const after = settle(reached, payWithNerves, undefined, WAVE2_DEPS);
    expect(inst(after, nerves).exhausted).toBe(true);
    expect(playerOf(after, P1).discard.some((id) => inst(after, id).cardId === "14015")).toBe(true); // Side Step is a played event, discarded once resolved
  });

  it("Order and Chaos: Team-Up, Hero Interrupt cancels a revealed treachery's 'When Revealed' effects and deals 2 damage to the villain", () => {
    const withWitch = playFromHand(runWave2(qsvVsRhino(), toHero()), "14002", 3);
    const given = moveToHand(withWitch.state, P1, "14018");
    const villain = given.state.villains[0]!.instanceId;
    // A filler boost card (Advance, 01186, 0 icons) ahead of the real treachery ("Hard to Keep Down", 01104) so
    // Rhino's own activation consumes the filler as its boost and 01104 is dealt to P1 as their own encounter card
    // instead — the same trick `ant/kit.test.ts`'s `stageNemesisCardForReveal` uses.
    const stacked = stackEncounterDeck(given.state, "01186", "01104");
    // `payForCard`'s own `minSelections` can be 0 even for a real cost (docs/phase7-wave2-scripting.md §5) —
    // `firstLegal` alone declines the payment, silently leaving the card in hand unplayed. Pay with the first
    // offered card explicitly.
    const acceptAndPay: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "payForCard") return [choice.options[0]!.optionId];
      return accepting("14018.order-and-chaos-interrupt")(state);
    };
    const revealed = settle(runWave2(withDamage(stacked, villain, 0), endTurn()), acceptAndPay, undefined, WAVE2_DEPS);
    // Cancelled: the card's own "When Revealed" never applied its effect, but it still went to the discard pile.
    expect(activeEncounterDeck(revealed).discard.some((id) => inst(revealed, id).cardId === "01104")).toBe(true);
    expect(inst(revealed, villain).damage).toBeGreaterThanOrEqual(2);
  });

  it("Adrenaline Rush: Hero Action, discards itself for +1 ATK until the end of the phase", () => {
    const hero = runWave2(qsvVsRhino(), toHero());
    const identity = identityOf(hero);
    const before = characterProfile(hero, identity, WAVE2_DEPS)!;
    const { state: withCard, id } = playFromHand(hero, "14022", 1);
    const used = settle(runWave2(withCard, use(P1, id, "14022.adrenaline-rush-action")), firstLegal, undefined, WAVE2_DEPS);
    expect(characterProfile(used, identity, WAVE2_DEPS)?.atk).toBe(before.atk + 1);
    expect(playerOf(used, P1).discard).toContain(id);
  });

  it("Civic Duty: Hero Action, discards itself for +1 THW until the end of the phase", () => {
    const hero = runWave2(qsvVsRhino(), toHero());
    const identity = identityOf(hero);
    const before = characterProfile(hero, identity, WAVE2_DEPS)!;
    const { state: withCard, id } = playFromHand(hero, "14023", 1);
    const used = settle(runWave2(withCard, use(P1, id, "14023.civic-duty-action")), firstLegal, undefined, WAVE2_DEPS);
    expect(characterProfile(used, identity, WAVE2_DEPS)?.thw).toBe(before.thw + 1);
    expect(playerOf(used, P1).discard).toContain(id);
  });

  // Brute Force (14029, Aggression), Sense of Justice (14030, Justice), United We Stand (14031, Leadership) and
  // Beat 'Em Up (14032, Basic — not in the qsv-protection precon's own curated card list) are unreachable from
  // Quicksilver's single-aspect Protection precon — the same situation Wasp's own `pack-cards.test.ts` docblock
  // records for her Justice/Leadership/Basic-aspect cards.
  it("Brute Force / Sense of Justice / United We Stand / Beat 'Em Up: defined (unreachable from the Protection precon)", () => {
    expect(QSV_PACK_CARDS["14029.brute-force-constant"]).toBeDefined();
    expect(QSV_PACK_CARDS["14029.brute-force-forced-response"]).toBeDefined();
    expect(QSV_PACK_CARDS["14030.sense-of-justice-resource"]).toBeDefined();
    expect(QSV_PACK_CARDS["14031.united-we-stand-action"]).toBeDefined();
    expect(QSV_PACK_CARDS["14032.beat-em-up-action"]).toBeDefined();
  });
});
