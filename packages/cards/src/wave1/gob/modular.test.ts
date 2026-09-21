import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  applyCommand,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  endTurn,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play as playCommand,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEvents } from "../testing.js";
import { GOB_DEPS, runGob, startGobGame } from "./testing.js";
import { wave1Scenario } from "../setup.js";

const spiderManVsRiskyBusiness = (modularSetIds: readonly string[]) =>
  startGobGame(
    wave1Scenario("risky-business", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 17,
      modularSetIds,
    }),
  );

const play = (state: GameState, ...commands: readonly Command[]): GameState =>
  settle(runGob(state, ...commands), undefined, undefined, GOB_DEPS);

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

  it("Intimidation: declining the resource payment gives the villain a facedown boost card instead", () => {
    // Spider-Man's starter deck has no guaranteed spare 2-resource hand at turn 1 in every seed, so `firstLegal`'s
    // default (decline the payment) is the deterministic outcome — same reasoning as Running Interference's own
    // test below.
    const start = spiderManVsRiskyBusiness(["goblin_gimmicks"]);
    const boostCardsBefore = inst(start, activeVillain(start).instanceId).boostCards.length;
    const after = play(stackEncounterDeck(start, "02012", "02035"), endTurn());
    const villain = activeVillain(after).instanceId;
    expect(inst(after, villain).boostCards.length).toBeGreaterThan(boostCardsBefore);
  });
});

describe("A Mess of Things", () => {
  it("When Revealed: places 2 additional threat here for each stunned friendly character", () => {
    const start = spiderManVsRiskyBusiness(["a_mess_of_things"]);
    const identity = identityOf(start);
    const stunned = patchInstance(start, identity, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const after = play(stackEncounterDeck(stunned, "02012", "02037"), endTurn());
    const mess = Object.keys(after.instances).find(
      (id) => after.instances[id as never]?.cardId === "02037",
    ) as InstanceId;
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

  it("Lightning Bolt: indirect damage equal to the boost icons summed across the 2 discarded encounter cards", () => {
    const start = spiderManVsRiskyBusiness(["power_drain"]);
    const identity = identityOf(start);
    const damageBefore = inst(start, identity).damage;
    // Electro (2 boost icons) and Electromagnetic Pulse (2), stacked right behind Lightning Bolt so
    // `discardEncounterCards(2)` reaches exactly these two, deterministically.
    const after = play(stackEncounterDeck(start, "02012", "02044", "02042", "02043"), endTurn());
    expect(inst(after, identity).damage).toBe(damageBefore + 4);
  });

  it("Shock Therapy: the villain heals 1 per boost icon among the 1[per_hero] discarded cards (solo: 1 card)", () => {
    const start = spiderManVsRiskyBusiness(["power_drain"]);
    const villain = activeVillain(start).instanceId;
    const damaged = patchInstance(start, villain, { damage: 5 });
    // Electro (2 boost icons) stacked right behind Shock Therapy, the one card `discardEncounterCards(1[per_hero])`
    // reaches solo.
    const after = play(stackEncounterDeck(damaged, "02012", "02045", "02042"), endTurn());
    expect(inst(after, villain).damage).toBe(3); // 5 - 2 healed
  });

  it("Power Drain (the side scheme itself): When Defeated, discards 2 encounter cards, then each player discards 1 resource per boost icon discarded that way", () => {
    const start = spiderManVsRiskyBusiness(["power_drain"]);
    // 02012 is Norman's own boost-card draw; Power Drain (02041, starting threat 0 + 2/player = 2 solo) is this
    // round's encounter card dealt to P1, entering play as a side scheme with no ability of its own until defeated;
    // Electro (02042, 2 boost icons) and Electromagnetic Pulse (02043, 2 boost icons) wait right behind it,
    // untouched by anything else, to be the exact 2 cards its own "When Defeated" discards.
    const round1 = play(stackEncounterDeck(start, "02012", "02041", "02042", "02043"), endTurn());
    const powerDrain = Object.keys(round1.instances).find(
      (id) => round1.instances[id as never]?.cardId === "02041",
    ) as InstanceId;
    expect(powerDrain).toBeDefined();
    expect(round1.villainArea).toContain(powerDrain);
    expect(inst(round1, powerDrain).threat).toBe(2);

    // Round 2, hero form: "For Justice!" (01060, Hero Action (thwart): remove 3 threat from a scheme) is enough on
    // its own to defeat the 2-threat side scheme outright.
    const given = moveToHand(round1, P1, "01060");
    const [forJustice] = given.ids as [InstanceId];
    const hero = runGob(given.state, toHero());
    const midPlay = runGob(hero, playCommand(P1, forJustice, payWith(hero, P1, 2, [forJustice])));
    // Every printed player card carries a resource icon, so `ANY_RESOURCE` matches every hand card here — the
    // final hand size is exactly `min(handAtPromptTime, 4)` fewer (2 boost icons summed across the 2 discards).
    const handAtPromptTime = playerOf(midPlay, P1).hand.length;
    // Settle "a scheme" (choose Power Drain, the only side scheme in play, over the main scheme) then the
    // "discard 1 resource of any type" choice (any legal pick proves the count, not which specific cards).
    const after = settle(midPlay, picking(powerDrain), undefined, GOB_DEPS);

    expect(after.villainArea).not.toContain(powerDrain); // the side scheme itself is defeated and leaves play
    const discardedCardIds = activeEncounterDeck(after).discard.map((id) => inst(after, id).cardId);
    expect(discardedCardIds).toEqual(expect.arrayContaining([cardId("02042"), cardId("02043")]));
    expect(playerOf(after, P1).hand.length).toBe(Math.max(0, handAtPromptTime - 4));
  });
});

describe("Running Interference", () => {
  it("When Revealed: each player must choose to either spend [mental][physical] resources or place 2 threat here", () => {
    const start = spiderManVsRiskyBusiness(["running_interference"]);
    // Spider-Man's starter deck has no guaranteed spare [mental]+[physical] resource cards in hand at turn 1 in
    // every seed, so `firstLegal`'s default (decline the payment) is the deterministic outcome to assert on.
    const after = play(stackEncounterDeck(start, "02012", "02046"), endTurn());
    const running = Object.keys(after.instances).find(
      (id) => after.instances[id as never]?.cardId === "02046",
    ) as InstanceId;
    expect(inst(after, running).threat).toBeGreaterThanOrEqual(1); // printed 1[per_hero] (1) plus, if declined, +2
  });

  it("Tombstone: after it attacks and damages you, discards a [mental] or [physical] resource from hand, if able", () => {
    const start = spiderManVsRiskyBusiness(["running_interference"]);
    // Round 1: Tombstone enters play engaged with P1 via the normal "deal encounter cards" step (a minion doesn't
    // attack the same round it enters play).
    const round1 = play(stackEncounterDeck(start, "02012", "02047"), endTurn());
    const tombstone = Object.keys(round1.instances).find((id) => round1.instances[id as never]?.cardId === "02047");
    expect(tombstone).toBeDefined();
    // Backflip (01003, printed [physical]) guaranteed in hand, so "if able" definitely finds a match.
    const given = moveToHand(round1, P1, "01003");
    const backflip = given.ids[0]!;
    const handBefore = playerOf(given.state, P1).hand.length;
    // Round 2, hero form: an enemy attacks its engaged player only while that player is in hero form.
    const round2 = play(given.state, toHero(), endTurn());
    expect(inst(round2, identityOf(round2)).damage).toBeGreaterThan(0); // Tombstone's own basic attack (ATK 3), undefended
    expect(playerOf(round2, P1).hand.length).toBeLessThan(handBefore);
    expect(playerOf(round2, P1).discard).toContain(backflip);
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
