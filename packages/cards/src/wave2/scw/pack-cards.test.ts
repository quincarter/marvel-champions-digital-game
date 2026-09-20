import { activeEncounterDeck, type GameState, type InstanceId } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, instancesOf, mainThreat, moveToHand, P1, playerOf, settle, stackEncounterDeck, toHero, type Picker } from "../../testing/harness.js";
import { withDamage } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { playFromHand, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { SCW_PACK_CARDS } from "./pack-cards.js";

// Real wave 2 content: the Scarlet Witch (Justice) precon against Rhino, standard, solo. Wanda starts in alter-ego.
const scwVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "scw-justice" }], seed: 2026 }));

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

function withThreat(state: GameState, threat: number): GameState {
  return { ...state, instances: { ...state.instances, [state.mainScheme.instanceId]: { ...state.instances[state.mainScheme.instanceId]!, threat } } };
}

describe("Scarlet Witch's pack cards (Justice, Basic; Aggression/Leadership/Protection off-aspect)", () => {
  it("Speed: Response, after he thwarts, ready him (limit once per round)", () => {
    const { state } = playFromHand(scwVsRhino(), "15010", 4);
    const speed = instancesOf(state, "15010")[0]!;
    const withThreatOnScheme = withThreat(state, 5);
    const thwarted = settle(
      runWave2(withThreatOnScheme, { type: "basicThwart", playerId: P1, thwarterInstanceId: speed, schemeInstanceId: withThreatOnScheme.mainScheme.instanceId }),
      accepting("15010.speed-response"), // an optional Response — `firstLegal` alone would decline it
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(thwarted, speed).exhausted).toBe(false); // readied by his own Response
  });

  it("Wiccan: Response, after he thwarts, discard the top card of the encounter deck, dealing 1 damage to an enemy per boost icon", () => {
    const { state } = playFromHand(scwVsRhino(), "15011", 2);
    const wiccan = instancesOf(state, "15011")[0]!;
    const villain = state.villains[0]!.instanceId;
    const withThreatOnScheme = withThreat(state, 5);
    const withNoDamage = withDamage(withThreatOnScheme, villain, 0);
    // Hydra Mercenary (01101, "Rhino's own set") prints exactly 1 boost icon.
    const stacked = stackEncounterDeck(withNoDamage, "01101");
    const thwarted = settle(
      runWave2(stacked, { type: "basicThwart", playerId: P1, thwarterInstanceId: wiccan, schemeInstanceId: stacked.mainScheme.instanceId }),
      accepting("15011.wiccan-response", "enemy"),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(thwarted, villain).damage).toBe(1);
  });

  it("Crisis Averted: Hero Action (thwart), removes 6 threat; ignores the crisis icon only if paid with [mental]", () => {
    const hero = withThreat(runWave2(scwVsRhino(), toHero()), 10);
    const { state } = playFromHand(hero, "15012", 3);
    expect(mainThreat(state)).toBe(4); // 10 - 6, regardless of payment type in this test (no crisis icon in play here)
  });

  it("Multitasking: Hero Action (thwart), removes 2 threat from a scheme; a second scheme too if paid with [mental]", () => {
    const hero = withThreat(runWave2(scwVsRhino(), toHero()), 6);
    const { state } = playFromHand(hero, "15013", 1);
    expect(mainThreat(state)).toBe(4); // only one scheme (the main scheme) exists in this scenario, so only one removal applies
  });

  it("Swift Retribution: Hero Action (attack), the villain schemes and then takes 4 damage", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const villain = hero.villains[0]!.instanceId;
    const threatBefore = mainThreat(hero);
    const withNoDamage = withDamage(hero, villain, 0);
    const { state } = playFromHand(withNoDamage, "15014", 1);
    expect(mainThreat(state)).toBeGreaterThan(threatBefore); // Rhino's own scheme activation placed threat
    expect(inst(state, villain).damage).toBe(4);
  });

  it("Turn the Tide: Response (attack), after your hero thwarts and defeats a scheme, deal 3 damage to an enemy", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const villain = hero.villains[0]!.instanceId;
    // The *main* scheme reaching 0 threat only ever advances a stage, never a `schemeDefeated` event (that's a
    // side scheme's own defeat) — a synthetic side scheme (The Next Evolution, 15024, already a real `scw` card in
    // the pool) with 1 threat gives a real side scheme to thwart into actual defeat, the same synthetic-side-scheme
    // surgery `trors/red-skull.test.ts`'s own "gets +1 ATK for each side scheme in play" test uses.
    const sideScheme = "fake-side-scheme" as InstanceId;
    const withSideScheme: GameState = {
      ...withDamage(hero, villain, 0),
      villainArea: [...hero.villainArea, sideScheme],
      instances: {
        ...hero.instances,
        [sideScheme]: {
          instanceId: sideScheme,
          cardId: "15024" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "villainArea" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 1,
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
    };
    const given = moveToHand(withSideScheme, P1, "15015");
    const [turnTheTide] = given.ids as [InstanceId];
    const identity = identityOf(given.state);
    // A reactive event's own printed Response only exists to be played when its trigger condition is met — this
    // basic thwart clears the side scheme's own 1 remaining threat, defeating it, and Turn the Tide is then
    // offered (and accepted) as the reactive play itself, costing 0.
    const thwarted = settle(
      runWave2(given.state, { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: sideScheme }),
      accepting("15015.turn-the-tide-response"),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(thwarted, villain).damage).toBe(3);
    expect(playerOf(thwarted, P1).discard).toContain(turnTheTide);
  });

  it("Order and Chaos: Team-Up, Hero Interrupt cancels a revealed treachery's 'When Revealed' effects and deals 2 damage to the villain", () => {
    // Team-Up (Quicksilver and Scarlet Witch): the Quicksilver ally (15002, her own kit) must be in play — the
    // same "play the matching partner card the deck actually carries" precedent `qsv/pack-cards.test.ts`'s own
    // Order and Chaos test uses for the Scarlet Witch ally (14002) on that side.
    const withQuicksilver = playFromHand(runWave2(scwVsRhino(), toHero()), "15002", 4);
    const given = moveToHand(withQuicksilver.state, P1, "15018");
    const villain = given.state.villains[0]!.instanceId;
    // A filler boost card (Advance, 01186, 0 icons) ahead of a real treachery (Hard to Keep Down, 01104) so
    // Rhino's own activation consumes the filler as its boost and 01104 is dealt to P1 as their own encounter card
    // instead — the same trick `ant/kit.test.ts`'s `stageNemesisCardForReveal` uses.
    const stacked = stackEncounterDeck(given.state, "01186", "01104");
    const acceptAndPay: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "payForCard") return [choice.options[0]!.optionId];
      return accepting("15018.order-and-chaos-interrupt")(state);
    };
    const withNoDamage = withDamage(stacked, villain, 0);
    const revealed = settle(runWave2(withNoDamage, endTurn()), acceptAndPay, undefined, WAVE2_DEPS);
    // Cancelled: the card's own "When Revealed" never applied its effect, but it still went to the discard pile.
    expect(activeEncounterDeck(revealed).discard.some((id) => inst(revealed, id).cardId === "01104")).toBe(true);
    expect(inst(revealed, villain).damage).toBeGreaterThanOrEqual(2);
  });

  it("Spiritual Meditation: Action, draw 2 cards then choose and discard 1 (Mystic identity required, data)", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const handBefore = playerOf(hero, P1).hand.length;
    const { state } = playFromHand(hero, "15019", 0);
    // +1 dealt to hand, -1 played, +2 drawn, -1 discarded: net +1.
    expect(playerOf(state, P1).hand.length).toBe(handBefore + 1);
  });

  // Browbeat (15028, Aggression), Last Stand (15029, Leadership), Bait and Switch (15030, Protection) and
  // Recuperation (15031, Basic — not in the `scw-justice` precon's own curated card list, per its data) are
  // unreachable from Scarlet Witch's own single-aspect Justice precon — the same situation `qsv/pack-cards.test.ts`
  // records for her own off-aspect cards.
  it("Browbeat / Last Stand / Bait and Switch / Recuperation: defined (unreachable from the Justice precon)", () => {
    expect(SCW_PACK_CARDS["15028.browbeat-action"]).toBeDefined();
    expect(SCW_PACK_CARDS["15029.last-stand-interrupt"]).toBeDefined();
    expect(SCW_PACK_CARDS["15030.bait-and-switch-action"]).toBeDefined();
    expect(SCW_PACK_CARDS["15031.recuperation-action"]).toBeDefined();
  });
});
