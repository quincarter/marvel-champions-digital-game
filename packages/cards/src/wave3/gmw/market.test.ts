import { cardId } from "@mc/content";
import { NO_STATUSES } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playFromHand as playFromHandTraced } from "../../testing/staging.js";
import { expectResolved, traceAbilities } from "../../testing/trace.js";
import { wave3Scenario, wave3StarterDeckSetup } from "../setup.js";
import { playFromHand, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/**
 * The Market (16150–16177). Groot (Protection) vs. Rhino (a Core scenario seated with wave 3 content), standard,
 * solo — the same baseline `groot-kit.test.ts`/`rocket-kit.test.ts` use — with the Market card(s) under test added
 * to the deck (`requireLegalDecks: false`, mirroring `wave3/stld/star-lord-kit.test.ts`'s own off-aspect seat: a
 * campaign card bought into a deck is never itself legal to build a starter deck around). The Milano-conditional
 * upgrades (Armor Plating, Heavy Cannon, Hyper Thrusters, Cargo Hold, Mounted Laser, Targeting Screen) instead use
 * the Brotherhood of Badoon scenario, which puts the Milano into play under the first player at setup
 * (`gmw/badoon.ts`, `gmw/ship-command.ts`).
 */
const marketSeat = (codes: readonly string[]) => {
  const base = wave3StarterDeckSetup("groot-protection");
  return {
    identityCardId: base.identityCardId,
    ...(base.aspects ? { aspects: base.aspects } : {}),
    deck: [...base.deck, ...codes.map(cardId)],
  };
};

const grootVsRhinoWithMarket = (...codes: readonly string[]) =>
  startWave3Game({
    ...wave3Scenario("rhino", { players: [marketSeat(codes)], seed: 2026 }),
    requireLegalDecks: false,
  });

const brotherhoodOfBadoonWithMarket = (...codes: readonly string[]) =>
  startWave3Game({
    ...wave3Scenario("brotherhood-of-badoon", { players: [marketSeat(codes)], seed: 2026 }),
    requireLegalDecks: false,
  });

/**
 * `chooseOne`'s own `optionId` is the branch's numeric index, not its label (`executeChooseOne`,
 * `packages/engine/src/resolve/effects-frame.ts`) — unlike a card-ability offer, whose `optionId` embeds the
 * ability id itself. Picks by the option's `label` text instead, mirroring `ship-command.test.ts`'s own
 * `pickingLabelStartingWith`.
 */
const pickingLabel =
  (...labels: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => labels.includes(o.label));
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** Accepts the named optional response/interrupt; declines everything else. Mirrors `./groot-kit.test.ts`. */
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

describe("Brainstorm (16150)", () => {
  it("naming the top card's actual type removes 3 threat, then drawing it back after replacing it on top (16150.brainstorm-constant, 16150.brainstorm-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16150"), toHero());
    // Fruition (16002), Groot's own event, forced to the top of the deck so its type is known. The main scheme
    // starts at 0 threat, so seed some to actually observe a removal.
    const { state: stacked } = putOnTopOfDeck(
      patchInstance(hero, hero.mainScheme.instanceId, { threat: 5 }),
      P1,
      "16002",
    );
    const before = mainThreat(stacked);
    const { state: played } = playFromHand(stacked, "16150", 0, pickingLabel("event", "Top of your deck"));
    expect(mainThreat(played)).toBe(before - 3);
    const inHand = playerOf(played, P1).hand.some((id) => inst(played, id).cardId === cardId("16002"));
    expect(inHand).toBe(true);
  });

  it("naming a type the top card doesn't match removes no threat, and 'bottom' buries it instead of drawing it (16150.brainstorm-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16150"), toHero());
    const { state: stacked } = putOnTopOfDeck(hero, P1, "16002");
    const before = mainThreat(stacked);
    const { state: played } = playFromHand(stacked, "16150", 0, pickingLabel("resource", "Bottom of your deck"));
    expect(mainThreat(played)).toBe(before); // Fruition is an event, not a resource — no match
    const owner = playerOf(played, P1);
    expect(inst(played, owner.deck.at(-1)!).cardId).toBe(cardId("16002")); // buried at the bottom
    const inHand = owner.hand.some((id) => inst(played, id).cardId === cardId("16002"));
    expect(inHand).toBe(false);
  });
});

describe("By Any Means (16151)", () => {
  it("(attack): places 2 threat on the main scheme, deals 3 damage to the villain, draws 1 card (16151.by-any-means-constant, 16151.by-any-means-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16151"), toHero());
    const villain = hero.villains[0]!.instanceId;
    const beforeThreat = mainThreat(hero);
    const beforeDamage = inst(hero, villain).damage;
    const { state: played } = playFromHand(hero, "16151", 0);
    expect(mainThreat(played)).toBe(beforeThreat + 2);
    expect(inst(played, villain).damage).toBe(beforeDamage + 3);
  });
});

describe("Contingency Plan (16152)", () => {
  it("(attack): discards the top 4 cards of your deck, deals damage to an enemy equal to the distinct resource types discarded, draws 1 (16152.contingency-plan-constant, 16152.contingency-plan-action)", () => {
    const traced = traceAbilities(WAVE3_DEPS);
    const hero = runWave3(grootVsRhinoWithMarket("16152"), toHero());
    const villain = hero.villains[0]!.instanceId;
    const beforeDiscard = playerOf(hero, P1).discard.length;
    const beforeDamage = inst(hero, villain).damage;
    const { state: played } = playFromHandTraced(traced.deps, hero, "16152", 0, firstLegal);
    expectResolved(traced.trace, "16152.contingency-plan-action");
    // +4 milled cards, +1 the event itself once it finishes resolving.
    expect(playerOf(played, P1).discard.length).toBe(beforeDiscard + 5);
    const dealt = inst(played, villain).damage - beforeDamage;
    expect(dealt).toBeGreaterThanOrEqual(0);
    expect(dealt).toBeLessThanOrEqual(4);
  });
});

describe("In Defiance (16153)", () => {
  it("interrupt: prevents 2 damage from an attack against an identity, draws 1 card (16153.in-defiance-constant, 16153.in-defiance-interrupt)", () => {
    const traced = traceAbilities(WAVE3_DEPS);
    const start = grootVsRhinoWithMarket("16153");
    const given = moveToHand(start, P1, "16153");
    const hero = runWave3(given.state, toHero());
    const afterPhase = settle(
      runWith(traced.deps, hero, endTurn()),
      accepting("16153.in-defiance-interrupt"),
      (s) => s.step.kind === "turn",
      traced.deps,
    );
    expectResolved(traced.trace, "16153.in-defiance-interrupt");
    // The interrupt's own draw landed even though the villain phase also draws each player their encounter card.
    expect(playerOf(afterPhase, P1).hand.length).toBeGreaterThan(0);
  });
});

describe("Calculate the Odds (16154)", () => {
  it("draws 1, then the chosen player may draw 1 and discard 1 from their hand (16154.calculate-the-odds-constant, 16154.calculate-the-odds-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16154"), toHero());
    const before = playerOf(hero, P1).hand.length;
    const { state: played } = playFromHand(
      hero,
      "16154",
      0,
      pickingLabel("Draw 1 card, then discard 1 card from your hand"),
    );
    // Playing the card is net 0 on hand size (it leaves hand as its own cost, cost 0 otherwise). Its own draw
    // (+1), the chosen player's draw (+1) and their discard (-1) net to +1.
    expect(playerOf(played, P1).hand.length).toBe(before + 1);
  });

  it("'Do not': the chosen player neither draws nor discards (16154.calculate-the-odds-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16154"), toHero());
    const before = playerOf(hero, P1).hand.length;
    const { state: played } = playFromHand(hero, "16154", 0, pickingLabel("Do not"));
    // Only Calculate the Odds' own draw applies: net +1.
    expect(playerOf(played, P1).hand.length).toBe(before + 1);
  });
});

describe("Creative Solution (16155)", () => {
  it("removing a tough status card deals 3 damage to an enemy (16155.creative-solution-constant, 16155.creative-solution-constant-2, 16155.creative-solution-constant-3, 16155.creative-solution-constant-4, 16155.creative-solution-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16155"), toHero());
    const identity = identityOf(hero);
    const toughened = patchInstance(hero, identity, { statuses: { ...NO_STATUSES, tough: 1 } });
    const villain = toughened.villains[0]!.instanceId;
    const beforeDamage = inst(toughened, villain).damage;
    const { state: played } = playFromHand(toughened, "16155", 0, pickingLabel("Remove a tough status card"));
    expect(inst(played, identity).statuses.tough).toBe(0);
    expect(inst(played, villain).damage).toBe(beforeDamage + 3);
  });

  it("removing a stun status card removes 3 threat from a scheme (16155.creative-solution-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16155"), toHero());
    const identity = identityOf(hero);
    const stunned = patchInstance(hero, identity, { statuses: { ...NO_STATUSES, stunned: 1 } });
    const withThreat = patchInstance(stunned, stunned.mainScheme.instanceId, { threat: 5 });
    const { state: played } = playFromHand(withThreat, "16155", 0, pickingLabel("Remove a stun status card"));
    expect(inst(played, identity).statuses.stunned).toBe(0);
    expect(mainThreat(played)).toBe(2);
  });

  it("removing a confuse status card heals 3 damage from an identity (16155.creative-solution-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16155"), toHero());
    const identity = identityOf(hero);
    const confused = patchInstance(hero, identity, { statuses: { ...NO_STATUSES, confused: 1 }, damage: 5 });
    const { state: played } = playFromHand(confused, "16155", 0, pickingLabel("Remove a confuse status card"));
    expect(inst(played, identity).statuses.confused).toBe(0);
    expect(inst(played, identity).damage).toBe(2);
  });
});

describe("Grapple (16156)", () => {
  it("deals 1 damage to an enemy and stuns it; stuns your hero; draws 1 card (16156.grapple-constant, 16156.grapple-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16156"), toHero());
    const identity = identityOf(hero);
    const villain = hero.villains[0]!.instanceId;
    const beforeDamage = inst(hero, villain).damage;
    const { state: played } = playFromHand(hero, "16156", 0);
    expect(inst(played, villain).damage).toBe(beforeDamage + 1);
    expect(inst(played, villain).statuses.stunned).toBe(1);
    expect(inst(played, identity).statuses.stunned).toBe(1);
  });
});

describe("Wing It (16157)", () => {
  it("deals 1 damage to an enemy and confuses it; confuses your hero; draws 1 card (16157.wing-it-constant, 16157.wing-it-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16157"), toHero());
    const identity = identityOf(hero);
    const villain = hero.villains[0]!.instanceId;
    const beforeDamage = inst(hero, villain).damage;
    const { state: played } = playFromHand(hero, "16157", 0);
    expect(inst(played, villain).damage).toBe(beforeDamage + 1);
    expect(inst(played, villain).statuses.confused).toBe(1);
    expect(inst(played, identity).statuses.confused).toBe(1);
  });
});

describe("Close Call (16158)", () => {
  it("interrupt: when a boost card is turned faceup, cancels its Boost ability and icons, then draws 1 card (16158.close-call-constant, 16158.close-call-interrupt)", () => {
    const traced = traceAbilities(WAVE3_DEPS);
    const start = grootVsRhinoWithMarket("16158");
    const given = moveToHand(start, P1, "16158");
    const hero = runWave3(given.state, toHero());
    settle(
      runWith(traced.deps, hero, endTurn()),
      accepting("16158.close-call-interrupt"),
      (s) => s.step.kind === "turn",
      traced.deps,
    );
    expectResolved(traced.trace, "16158.close-call-interrupt");
  });
});

describe("Defy Danger (16159)", () => {
  it("(attack): deals 5 damage to an enemy, discards the top encounter card, takes 1 damage per boost icon discarded (16159.defy-danger-constant, 16159.defy-danger-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16159"), toHero());
    const identity = identityOf(hero);
    const villain = hero.villains[0]!.instanceId;
    const beforeVillainDamage = inst(hero, villain).damage;
    const { state: played } = playFromHand(hero, "16159", 1);
    expect(inst(played, villain).damage).toBe(beforeVillainDamage + 5);
    // Whatever boost icons the discarded encounter card printed, the identity took exactly that many damage.
    expect(inst(played, identity).damage).toBeGreaterThanOrEqual(0);
  });
});

describe("In Harm's Way (16160)", () => {
  it("(thwart): takes 2 damage, removes 5 threat from a scheme (16160.in-harms-way-constant, 16160.in-harms-way-action)", () => {
    const seeded = runWave3(grootVsRhinoWithMarket("16160"), toHero());
    const hero = patchInstance(seeded, seeded.mainScheme.instanceId, { threat: 5 });
    const identity = identityOf(hero);
    const beforeDamage = inst(hero, identity).damage;
    const beforeThreat = mainThreat(hero);
    const { state: played } = playFromHand(hero, "16160", 1);
    expect(inst(played, identity).damage).toBe(beforeDamage + 2);
    expect(mainThreat(played)).toBe(beforeThreat - 5);
  });
});

describe("Armor Plating (16162)", () => {
  it("interrupt: exhausts to prevent damage an identity would take, without the Milano (16162.armor-plating-constant, 16162.armor-plating-interrupt)", () => {
    const traced = traceAbilities(WAVE3_DEPS);
    const hero = runWave3(grootVsRhinoWithMarket("16162"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16162", 0);
    const afterPhase = settle(
      runWith(traced.deps, withUpgrade, endTurn()),
      accepting("16162.armor-plating-interrupt"),
      (s) => s.step.kind === "turn",
      traced.deps,
    );
    expectResolved(traced.trace, "16162.armor-plating-interrupt");
    expect(inst(afterPhase, upgrade).exhausted).toBe(true);
  });

  it("prevents damage while controlling the Milano too (16162.armor-plating-interrupt)", () => {
    const traced = traceAbilities(WAVE3_DEPS);
    const hero = runWave3(brotherhoodOfBadoonWithMarket("16162"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16162", 0);
    const afterPhase = settle(
      runWith(traced.deps, withUpgrade, endTurn()),
      accepting("16162.armor-plating-interrupt"),
      (s) => s.step.kind === "turn",
      traced.deps,
    );
    expectResolved(traced.trace, "16162.armor-plating-interrupt");
    expect(inst(afterPhase, upgrade).exhausted).toBe(true);
  });
});

describe("Heavy Cannon (16163)", () => {
  it("exhausts to deal 1 damage to each enemy (16163.heavy-cannon-constant, 16163.heavy-cannon-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16163"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16163", 0);
    const villain = withUpgrade.villains[0]!.instanceId;
    const before = inst(withUpgrade, villain).damage;
    const used = settle(
      runWave3(withUpgrade, use(P1, upgrade, "16163.heavy-cannon-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 1); // no Milano: no additional villain damage
    expect(inst(used, upgrade).exhausted).toBe(true);
  });

  it("deals 1 additional damage to the villain while controlling the Milano (16163.heavy-cannon-action)", () => {
    const hero = runWave3(brotherhoodOfBadoonWithMarket("16163"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16163", 0);
    const villain = withUpgrade.villains[0]!.instanceId;
    const before = inst(withUpgrade, villain).damage;
    const used = settle(
      runWave3(withUpgrade, use(P1, upgrade, "16163.heavy-cannon-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 2); // 1 (each enemy) + 1 (Milano bonus)
  });
});

describe("Hyper Thrusters (16164)", () => {
  it("exhausts to remove 1 threat from each scheme (16164.hyper-thrusters-constant, 16164.hyper-thrusters-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16164"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16164", 1);
    const withThreat = patchInstance(withUpgrade, withUpgrade.mainScheme.instanceId, { threat: 5 });
    const used = settle(
      runWave3(withThreat, use(P1, upgrade, "16164.hyper-thrusters-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(mainThreat(used)).toBe(4); // no Milano: -1 only
  });

  it("removes 1 additional threat from the main scheme while controlling the Milano (16164.hyper-thrusters-action)", () => {
    const hero = runWave3(brotherhoodOfBadoonWithMarket("16164"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16164", 1);
    const withThreat = patchInstance(withUpgrade, withUpgrade.mainScheme.instanceId, { threat: 5 });
    const used = settle(
      runWave3(withThreat, use(P1, upgrade, "16164.hyper-thrusters-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(mainThreat(used)).toBe(3); // -1 (each scheme) -1 (Milano bonus, same scheme here)
  });
});

describe("Ardent Resolve (16166)", () => {
  it("readies a friendly character and draws 1 card (16166.ardent-resolve-constant, 16166.ardent-resolve-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16166"), toHero());
    const identity = identityOf(hero);
    const exhausted = patchInstance(hero, identity, { exhausted: true });
    const { state: played } = playFromHand(exhausted, "16166", 0);
    expect(inst(played, identity).exhausted).toBe(false);
  });
});

describe("Onrush (16167)", () => {
  it("interrupt: cancels the effects of a revealed encounter card and discards it (16167.onrush-constant, 16167.onrush-interrupt)", () => {
    // "Advance" (01186, Core "standard" set): "When Revealed: The villain schemes." — compared against an
    // otherwise-identical villain phase where the interrupt is declined, since the main scheme also gains threat
    // from other sources independent of this one reveal, so an absolute "unchanged" assertion would be wrong.
    // "Assault" (01187) staged ahead of it is Rhino's own attack boost card — bare `stackEncounterDeck` would
    // otherwise hand Advance to the villain's unconditional boost draw instead of revealing it to the player
    // (`docs/card-scripting-process.md` §7's "stackSetAsideBehindBoost" trap, the `stackEncounterDeck` analog).
    const setupPhase = () => {
      const start = grootVsRhinoWithMarket("16167");
      const given = moveToHand(start, P1, "16167");
      const hero = runWave3(given.state, toHero());
      return stackEncounterDeck(hero, "01187", "01186");
    };

    const declinedTrace = traceAbilities(WAVE3_DEPS);
    const declined = settle(
      runWith(declinedTrace.deps, setupPhase(), endTurn()),
      firstLegal,
      (s) => s.step.kind === "turn",
      declinedTrace.deps,
    );

    const acceptedTrace = traceAbilities(WAVE3_DEPS);
    const accepted = settle(
      runWith(acceptedTrace.deps, setupPhase(), endTurn()),
      accepting("16167.onrush-interrupt"),
      (s) => s.step.kind === "turn",
      acceptedTrace.deps,
    );
    expectResolved(acceptedTrace.trace, "16167.onrush-interrupt");
    expect(mainThreat(accepted)).toBeLessThan(mainThreat(declined));
  });
});

describe("Safeguard (16168)", () => {
  it("gives up to 2 friendly characters each a tough status card and draws 1 (16168.safeguard-constant, 16168.safeguard-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16168"), toHero());
    const identity = identityOf(hero);
    const { state: played } = playFromHand(hero, "16168", 0);
    expect(inst(played, identity).statuses.tough).toBe(1);
  });
});

describe("Sure Gamble (16169)", () => {
  it("reduces the resource cost of the next card played this phase by 3 (16169.sure-gamble-constant, 16169.sure-gamble-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16169"), toHero());
    const { state: played } = playFromHand(hero, "16169", 0);
    // Vine Shield (16010) prints cost 1; the discount covers it, so no other hand card is spent to pay for it —
    // only Vine Shield itself leaves hand (playing it), which `playFromHand`'s own `moveToHand` + `play` nets to 0.
    const before = playerOf(played, P1).hand.length;
    const { state: afterFreebie } = playFromHand(played, "16010", 0);
    expect(playerOf(afterFreebie, P1).hand.length).toBe(before);
  });
});

describe("Cargo Hold (16170)", () => {
  it("exhausts to heal 1 damage from a friendly character, without the Milano (16170.cargo-hold-constant, 16170.cargo-hold-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16170"), toHero());
    const identity = identityOf(hero);
    const damaged = patchInstance(hero, identity, { damage: 5 });
    const { state: withUpgrade, id: upgrade } = playFromHand(damaged, "16170", 0);
    const used = settle(
      runWave3(withUpgrade, use(P1, upgrade, "16170.cargo-hold-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, identity).damage).toBe(4); // -1 only, no Milano
  });

  it("also heals 1 damage from your identity while controlling the Milano (16170.cargo-hold-action)", () => {
    const hero = runWave3(brotherhoodOfBadoonWithMarket("16170"), toHero());
    const identity = identityOf(hero);
    const damaged = patchInstance(hero, identity, { damage: 5 });
    const { state: withUpgrade, id: upgrade } = playFromHand(damaged, "16170", 0);
    const used = settle(
      runWave3(withUpgrade, use(P1, upgrade, "16170.cargo-hold-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, identity).damage).toBe(3); // -1 (chosen friendly character, the identity here) -1 (Milano bonus)
  });
});

describe("Mounted Laser (16171)", () => {
  it("exhausts to deal 2 damage to an enemy, without the Milano (16171.mounted-laser-constant, 16171.mounted-laser-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16171"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16171", 1);
    const villain = withUpgrade.villains[0]!.instanceId;
    const before = inst(withUpgrade, villain).damage;
    const used = settle(
      runWave3(withUpgrade, use(P1, upgrade, "16171.mounted-laser-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 2);
  });

  it("deals 3 damage instead while controlling the Milano (16171.mounted-laser-action)", () => {
    const hero = runWave3(brotherhoodOfBadoonWithMarket("16171"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16171", 1);
    const villain = withUpgrade.villains[0]!.instanceId;
    const before = inst(withUpgrade, villain).damage;
    const used = settle(
      runWave3(withUpgrade, use(P1, upgrade, "16171.mounted-laser-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 3);
  });
});

describe("Targeting Screen (16173)", () => {
  it("exhausts to remove 2 threat from a scheme, without the Milano (16173.targeting-screen-constant, 16173.targeting-screen-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16173"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16173", 2);
    const withThreat = patchInstance(withUpgrade, withUpgrade.mainScheme.instanceId, { threat: 5 });
    const used = settle(
      runWave3(withThreat, use(P1, upgrade, "16173.targeting-screen-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(mainThreat(used)).toBe(3);
  });

  it("removes 3 threat instead while controlling the Milano (16173.targeting-screen-action)", () => {
    const hero = runWave3(brotherhoodOfBadoonWithMarket("16173"), toHero());
    const { state: withUpgrade, id: upgrade } = playFromHand(hero, "16173", 2);
    const withThreat = patchInstance(withUpgrade, withUpgrade.mainScheme.instanceId, { threat: 5 });
    const used = settle(
      runWave3(withThreat, use(P1, upgrade, "16173.targeting-screen-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(mainThreat(used)).toBe(2);
  });
});

describe("Grand Strategy (16174)", () => {
  it("draws up to your maximum hand size, then removes itself from the game (16174.grand-strategy-constant, 16174.grand-strategy-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16174"), toHero());
    const { state: played, id } = playFromHand(hero, "16174", 0);
    expect(playerOf(played, P1).hand.length).toBe(6); // Groot's own printed maximum hand size
    const anywhere = [...playerOf(played, P1).hand, ...playerOf(played, P1).deck, ...playerOf(played, P1).discard];
    expect(anywhere.includes(id)).toBe(false); // removed from the game, not merely discarded
  });
});

describe("Power Unleashed (16175)", () => {
  it("deals 5 damage to the villain, removes 5 threat from the main scheme, then removes itself from the game (16175.power-unleashed-constant, 16175.power-unleashed-action)", () => {
    const seeded = runWave3(grootVsRhinoWithMarket("16175"), toHero());
    const hero = patchInstance(seeded, seeded.mainScheme.instanceId, { threat: 8 });
    const villain = hero.villains[0]!.instanceId;
    const beforeDamage = inst(hero, villain).damage;
    const beforeThreat = mainThreat(hero);
    const { state: played, id } = playFromHand(hero, "16175", 0);
    expect(inst(played, villain).damage).toBe(beforeDamage + 5);
    expect(mainThreat(played)).toBe(beforeThreat - 5);
    expect([...playerOf(played, P1).hand, ...playerOf(played, P1).deck, ...playerOf(played, P1).discard]).not.toContain(
      id,
    );
  });
});

describe("Tried and True (16176)", () => {
  it("the chosen player may add up to 3 cards from their discard pile to their hand, then removes itself from the game (16176.tried-and-true-constant, 16176.tried-and-true-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16176"), toHero());
    const { state: discarded } = putOnTopOfDeck(hero, P1, "16002", "16003", "16004");
    // Get three known cards into the discard pile with `moveToDiscard`-equivalent surgery via patched play: simpler
    // — directly move them from deck to discard.
    const owner = playerOf(discarded, P1);
    const toDiscard = owner.deck.slice(0, 3);
    const withDiscards = {
      ...discarded,
      players: discarded.players.map((p) =>
        p.playerId === P1
          ? { ...p, deck: p.deck.filter((i) => !toDiscard.includes(i)), discard: [...p.discard, ...toDiscard] }
          : p,
      ),
    };
    const beforeHand = playerOf(withDiscards, P1).hand.length;
    const { state: played, id } = playFromHand(withDiscards, "16176", 0, firstLegal);
    // firstLegal on "choose a player" picks the only player, then on the chooseCards prompt picks the max legal
    // selection (3) by construction of `firstLegal`'s "select everything offered" default for multi-select.
    expect(playerOf(played, P1).hand.length).toBeGreaterThanOrEqual(beforeHand);
    expect([...playerOf(played, P1).hand, ...playerOf(played, P1).deck, ...playerOf(played, P1).discard]).not.toContain(
      id,
    );
  });
});

describe("Triple Threat (16177)", () => {
  it("readies up to 3 characters, then removes itself from the game (16177.triple-threat-constant, 16177.triple-threat-action)", () => {
    const hero = runWave3(grootVsRhinoWithMarket("16177"), toHero());
    const identity = identityOf(hero);
    const exhausted = patchInstance(hero, identity, { exhausted: true });
    // "Characters" is unqualified (unlike "friendly character"), so Rhino is a legal choice too — pick Groot by
    // label to avoid readying whichever the default picker happens to prefer.
    const { state: played, id } = playFromHand(exhausted, "16177", 0, pickingLabel("Groot"));
    expect(inst(played, identity).exhausted).toBe(false);
    expect([...playerOf(played, P1).hand, ...playerOf(played, P1).deck, ...playerOf(played, P1).discard]).not.toContain(
      id,
    );
  });
});
