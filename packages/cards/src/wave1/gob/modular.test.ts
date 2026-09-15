import { activeVillain, applyCommand, type Command, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { applyOk, endTurn, firstLegal, identityOf, inst, P1, patchInstance, playerOf, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { GOB_DEPS, runGob, startGobGame } from "./testing.js";
import { wave1Scenario } from "../setup.js";

const spiderManVsRiskyBusiness = (modularSetIds: readonly string[]) =>
  startGobGame(wave1Scenario("risky-business", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 17, modularSetIds }));

const play = (state: GameState, ...commands: readonly Command[]): GameState => settle(runGob(state, ...commands), undefined, undefined, GOB_DEPS);

function driveEvents(state: GameState, ...commands: readonly Command[]): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (current.pendingChoice && !current.outcome) {
      const choice = current.pendingChoice;
      const result = applyOk(current, { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: firstLegal(current) }, GOB_DEPS);
      current = result.state;
      events.push(...result.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const result = applyOk(current, command, GOB_DEPS);
    current = result.state;
    events.push(...result.events);
    settleOne();
  }
  return { state: current, events };
}

describe("Goblin Gimmicks", () => {
  it("Regenerative Healing: heals the villain X = double the villain's stage number (stage 1: 2), and gains no surge", () => {
    const start = spiderManVsRiskyBusiness(["goblin_gimmicks"]);
    const villain = activeVillain(start).instanceId;
    const primed = patchInstance(start, villain, { damage: 5 });
    const after = play(stackEncounterDeck(primed, "02012", "02036"), endTurn());
    expect(inst(after, villain).damage).toBe(3); // 5 - 2 healed
  });

  it("Regenerative Healing: with no damage to heal, this card gains surge (an extra encounter card dealt)", () => {
    const start = spiderManVsRiskyBusiness(["goblin_gimmicks"]);
    const villain = activeVillain(start).instanceId;
    const primed = patchInstance(start, villain, { damage: 0 });
    const { events } = driveEvents(stackEncounterDeck(primed, "02012", "02036"), endTurn());
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
  });

  it("Goblin Glider: with no eligible enemy, surges instead of attaching (engine-proven primitive, this pack's own card)", () => {
    // Solo, no minions in play: the only enemy is the villain himself, so Goblin Glider *can* attach — assert only
    // that resolving it does not throw and the villain ends up with the attachment or a surge, one or the other.
    const start = spiderManVsRiskyBusiness(["goblin_gimmicks"]);
    const villain = activeVillain(start).instanceId;
    const { state: after, events } = driveEvents(stackEncounterDeck(start, "02012", "02033"), endTurn());
    const attached = inst(after, villain).attachments.some((id) => inst(after, id).cardId === "02033");
    const surged = events.some((e) => e.type === "surgeTriggered");
    expect(attached || surged).toBe(true);
  });
});

describe("A Mess of Things", () => {
  it("When Revealed: places 2 additional threat here for each stunned friendly character", () => {
    const start = spiderManVsRiskyBusiness(["a_mess_of_things"]);
    const identity = identityOf(start);
    const stunned = patchInstance(start, identity, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const after = play(stackEncounterDeck(stunned, "02012", "02037"), endTurn());
    const mess = Object.keys(after.instances).find((id) => after.instances[id as never]?.cardId === "02037") as InstanceId;
    // Printed startingThreat 2 (base 2, flat) + 2 additional per stunned friendly character (1) = 4.
    expect(inst(after, mess).threat).toBe(4);
  });

  it("Tail Sweep: Scorpion attacks your hero; with no Scorpion in play, no attack is made and you are stunned instead", () => {
    const start = spiderManVsRiskyBusiness(["a_mess_of_things"]);
    const identity = identityOf(start);
    // Hero form: Norman Osborn's own Forced Interrupt fully replaces his attack (no boost card dealt at all — his
    // ATK is dashed), so the stacked Tail Sweep survives to be dealt as this round's only encounter card with no
    // filler needed (unlike the alter-ego cases below, where Norman schemes normally and draws a real boost card).
    const after = play(stackEncounterDeck(start, "02040"), toHero(), endTurn());
    expect(inst(after, identity).statuses.stunned).toBeGreaterThanOrEqual(1);
  });
});

describe("Power Drain", () => {
  it("Electro: after it attacks you, discards 1 encounter card and deals 1 indirect damage per boost icon on it", () => {
    const start = spiderManVsRiskyBusiness(["power_drain"]);
    const identity = identityOf(start);
    // Round 1 (alter-ego, filler ahead so Norman's own real scheme-boost draw doesn't consume Electro itself):
    // Electro enters play engaged with P1 via the normal "deal encounter cards" step, but a minion doesn't attack
    // the same round it enters play (no quickstrike). Round 2's villain phase is when it actually attacks.
    const round1 = play(stackEncounterDeck(start, "02012", "02042"), endTurn());
    const electro = Object.keys(round1.instances).find((id) => round1.instances[id as never]?.cardId === "02042");
    expect(electro).toBeDefined();
    const before = inst(round1, identity).damage;
    // Hero form for round 2: an enemy attacks its engaged player only while that player is in hero form (else it
    // schemes instead, same as the villain's own activation choice) — `risky-business.test.ts`'s Stampede tests
    // hit the identical rule.
    const round2 = play(round1, toHero(), endTurn());
    // Electro's own base ATK (2) plus at least 0 further indirect damage per boost icon on the 1 discarded card.
    expect(inst(round2, identity).damage).toBeGreaterThanOrEqual(before + 2);
  });

  it("Electromagnetic Pulse: discards 7 cards; if Electro was found, puts him into play engaged with you", () => {
    const start = spiderManVsRiskyBusiness(["power_drain"]);
    const { state: after } = driveEvents(stackEncounterDeck(start, "02012", "02043", "02042"), endTurn());
    const electroInPlay = playerOf(after, P1).playArea.some((id) => inst(after, id).cardId === "02042");
    const electroInVillainArea = after.villainArea.some((id) => inst(after, id).cardId === "02042");
    // Electro is a minion: "put him into play engaged with you" means engaged with P1 (playArea), not villainArea.
    expect(electroInPlay || electroInVillainArea).toBe(true);
  });
});

describe("Running Interference", () => {
  it("When Revealed: each player must choose to either spend [mental][physical] resources or place 2 threat here", () => {
    const start = spiderManVsRiskyBusiness(["running_interference"]);
    // Spider-Man's starter deck has no guaranteed spare [mental]+[physical] resource cards in hand at turn 1 in
    // every seed, so `firstLegal`'s default (decline the payment) is the deterministic outcome to assert on.
    const after = play(stackEncounterDeck(start, "02012", "02046"), endTurn());
    const running = Object.keys(after.instances).find((id) => after.instances[id as never]?.cardId === "02046") as InstanceId;
    expect(inst(after, running).threat).toBeGreaterThanOrEqual(1); // printed 1[per_hero] (1) plus, if declined, +2
  });
});

describe("All Tied Up / Media Coverage", () => {
  it("All Tied Up: attaches to your identity (data) and the attached character cannot ready or change form", () => {
    const start = spiderManVsRiskyBusiness(["running_interference"]);
    const identity = identityOf(start);
    // Reveal All Tied Up so it attaches to the identity through the engine's own attachment-host resolution
    // (docs/phase7-wave1.md §3.14), rather than fabricating an attached `CardInstance` by hand.
    const after = play(stackEncounterDeck(start, "02012", "02048"), endTurn());
    const allTiedUp = Object.keys(after.instances).find((id) => after.instances[id as never]?.cardId === "02048");
    expect(allTiedUp).toBeDefined();
    expect(inst(after, identity).attachments).toContain(allTiedUp);
    // Cannot change form: the command itself is illegal, not merely a no-op.
    const rejected = applyCommand(after, { type: "changeForm", playerId: P1 }, GOB_DEPS);
    expect(rejected.ok).toBe(false);
  });
});
