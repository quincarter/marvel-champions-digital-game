import {
  firstLegal,
  inst,
  instancesOf,
  moveToHand,
  P1,
  play,
  payWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { wave3Scenario } from "../setup.js";
import { encounterCardInVillainArea, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/** Ship Command (16142–16148), reached through the Brotherhood of Badoon scenario, which requires it. */
const brotherhoodOfBadoon = () =>
  startWave3Game(
    wave3Scenario("brotherhood-of-badoon", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }),
  );

const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Milano (16142)", () => {
  it("is controlled by the first player at setup (16142.milano-constant)", () => {
    const state = brotherhoodOfBadoon();
    const [milano] = instancesOf(state, "16142");
    expect(inst(state, milano!).controllerId).toBe(P1);
  });

  it("Piloting — Resource: exhausting the Milano generates a wild resource for any player, paying for a card (16142.milano-constant-2)", () => {
    const state = brotherhoodOfBadoon();
    const [milano] = instancesOf(state, "16142");
    // Vine Shield (16010), Groot's own 1-cost upgrade: the Milano's single wild resource alone covers it.
    const given = moveToHand(state, P1, "16010");
    const [upgrade] = given.ids;
    const played = settle(
      runWave3(
        given.state,
        play(P1, upgrade!, [], {
          abilities: [{ ability: { instanceId: milano!, abilityId: "16142.milano-constant-2" as never } }],
        }),
      ),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(played, milano!).exhausted).toBe(true);
    // Vine Shield auto-attaches to Groot's identity (an upgrade, not a separate play-area card), so its own
    // instance existing with a host is the evidence the play committed.
    expect(inst(played, upgrade!).attachedTo).not.toBeNull();
  });
});

describe("Rogue Vessel (16143)", () => {
  it("Forced Interrupt: when the villain phase ends, deal 1 damage to each player (16143.rogue-vessel-forced-interrupt)", () => {
    const state = brotherhoodOfBadoon();
    const { state: withVessel } = encounterCardInVillainArea(state, "16143");
    const identity = state.players[0]!.identity.instanceId;
    const before = inst(withVessel, identity).damage;
    const afterPhase = settle(
      runWave3(withVessel, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(afterPhase, identity).damage).toBeGreaterThanOrEqual(before + 1);
  });

  it("First Player Action: exhaust the Milano and spend 2 resources of any type → discard this card (16143.rogue-vessel-constant)", () => {
    const state = brotherhoodOfBadoon();
    const [milano] = instancesOf(state, "16142");
    const { state: withVessel, id: vessel } = encounterCardInVillainArea(state, "16143");
    const cards = payWith(withVessel, P1, 2);
    const used = runWave3(
      withVessel,
      use(
        P1,
        vessel,
        "16143.rogue-vessel-constant",
        cards.map((fromHand) => ({ fromHand })),
        {
          exhausted: [milano!],
        },
      ),
    );
    expect(used.villainArea).not.toContain(vessel);
  });
});

describe("Cannonade (16144.cannonade-constant)", () => {
  it("First Player Action: exhaust the Milano → remove 3 threat from this scheme", () => {
    const state = brotherhoodOfBadoon();
    const [milano] = instancesOf(state, "16142");
    const { state: staged, id: cannonade } = encounterCardInVillainArea(state, "16144", 5);
    const used = runWave3(staged, use(P1, cannonade, "16144.cannonade-constant", [], { exhausted: [milano!] }));
    expect(inst(used, cannonade).threat).toBe(2);
  });
});

describe("Blind Side, Hull Breach, Power Siphon — When Revealed: Choose one (16145–16147)", () => {
  it("Blind Side: choosing to exhaust the Milano leaves it exhausted", () => {
    const state = brotherhoodOfBadoon();
    const staged = stackEncounterDeck(state, "01186", "16145");
    const [milano] = instancesOf(staged, "16142");
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(revealed, milano!).exhausted).toBe(true);
  });

  it("Hull Breach: choosing to deal 3 damage to the first player deals it", () => {
    const state = brotherhoodOfBadoon();
    const staged = stackEncounterDeck(state, "01186", "16146");
    const identity = state.players[0]!.identity.instanceId;
    const before = inst(staged, identity).damage;
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Deal 3 damage"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(revealed, identity).damage).toBeGreaterThanOrEqual(before + 3);
  });

  it("Power Siphon: choosing to discard 1 card at random from the first player's hand discards one", () => {
    const state = brotherhoodOfBadoon();
    const staged = stackEncounterDeck(state, "01186", "16147");
    const handBefore = state.players[0]!.hand.length;
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Discard 1 card at random"),
      undefined,
      WAVE3_DEPS,
    );
    expect(revealed.players[0]!.hand.length).toBeLessThan(handBefore);
  });
});

describe("Special Delivery (16148)", () => {
  it("When Revealed (Alter-Ego): exhausting the Milano avoids the villain scheming with +1 SCH", () => {
    const state = brotherhoodOfBadoon();
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    const staged = stackEncounterDeck(state, "01186", "16148");
    const [milano] = instancesOf(staged, "16142");
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(revealed, milano!).exhausted).toBe(true);
  });

  it("When Revealed (Hero): declining to exhaust the Milano lets the villain attack with +1 ATK", () => {
    const base = brotherhoodOfBadoon();
    const state = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const staged = stackEncounterDeck(state, "01186", "16148");
    const identity = state.players[0]!.identity.instanceId;
    const before = inst(staged, identity).damage;
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("The villain attacks"),
      undefined,
      WAVE3_DEPS,
    );
    // The villain's base ATK (Drang I: 2) plus the +1 bonus, at minimum.
    expect(inst(revealed, identity).damage).toBeGreaterThan(before);
  });
});
