/**
 * docs/phase7-wave5.md §3: the DSL builders for cycle 4's engine primitives. Each composition below is the one the spec
 * gives the scripter for a printed card; this file proves each validates and emits exactly the plain data the
 * per-primitive engine test drives.
 */

import { trait } from "@mc/content";
import type { Predicate } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  action,
  anyNumberOfToughStatusCards,
  boost,
  cannotBeCanceled,
  constant,
  countsAs,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  heroInterrupt,
  increaseDamageTaken,
  interrupt,
  mainSchemeMarkedBy,
  maxOnePerTriggeringInstance,
  notCountedTowardHandSize,
  on,
  playableAttachments,
  response,
  setup,
  special,
  spendableForAnyPlayer,
  whenDefeated,
  whenRevealed,
} from "./abilities.js";
import {
  addAccelerationToken,
  addCounters,
  addVillain,
  attachCard,
  cancelIt,
  cards,
  chooseCards,
  dealAsEncounterCard,
  dealDamage,
  dealIndirectDamage,
  discardEncounterCards,
  draw,
  encounterCards,
  encounterSetAside,
  forEachPlayer,
  giveBoostCard,
  ifThen,
  moveActiveCounterToNextVillain,
  moveBoostCards,
  moveCardsInto,
  moveCounters,
  placeThreat,
  resolveSpecialsOf,
  selectCards,
  setActiveVillain,
  setVillainAside,
  stun,
  zone,
} from "./effects.js";
import {
  activationOrderOf,
  chosen,
  countAmong,
  countOf,
  countersOn,
  each,
  eachPlayer,
  eventPlayer,
  eventSource,
  eventTarget,
  exists,
  firstAttackThisTurn,
  firstPlayer,
  identityOf,
  inMode,
  named,
  not,
  perHero,
  query,
  paidUsingResourceFrom,
  refMatches,
  resourcesPaidBy,
  self,
  superlative,
  thatPlayer,
  theVillain,
  theMainScheme,
  threatOn,
  valueAtLeast,
  valueAtMost,
  you,
  yourIdentity,
} from "./values.js";
import { validateDefinition } from "./validate.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

describe("§3.1 villains that enter and leave play (The Sinister Six)", () => {
  it("Sinister Synchronization 1A: X = players + 1 random set-aside villains, the lowest activation order active", () => {
    const definition = setup(
      selectCards("starting", encounterSetAside(query("villain"), { random: perHero(1, 1) })),
      addVillain(chosen("starting")),
      setActiveVillain(superlative("lowest", each(query("villain")), activationOrderOf(chosen("candidate")))),
    );
    valid(definition);
    expect(definition.effects[2]).toEqual({
      kind: "setActiveVillain",
      villain: {
        kind: "superlative",
        order: "lowest",
        among: { kind: "each", query: { categories: ["villain"] } },
        measure: { kind: "activationOrder", of: { kind: "slot", slot: "candidate" } },
      },
    });
  });

  it("a Sinister Six villain's When Defeated sets it aside; Ambush! reports what entered", () => {
    valid(whenDefeated(setVillainAside(self)));
    expect(addVillain(chosen("pick"), { bind: "ambush" })).toEqual({
      kind: "addVillain",
      villain: { kind: "slot", slot: "pick" },
      bind: "ambush",
    });
    expect(moveActiveCounterToNextVillain).toEqual({ kind: "moveActiveCounter", to: "nextInActivationOrder" });
  });
});

describe("§3.2 an enemy activation that can be interrupted and canceled", () => {
  it("Web Binding: cancel that activation; 4 damage to a minion whose activation was cancelled", () => {
    const definition = heroInterrupt(
      on.enemyActivating(),
      cancelIt(),
      ifThen(refMatches(eventTarget, query("minion")), dealDamage(4, eventTarget)),
    );
    valid(definition);
    expect(definition.trigger).toMatchObject({ kind: "interrupt", on: { on: "enemyActivating" } });
  });

  it("Sinister Synchronization 1B: if no villain is in play, resolve Ambush! and continue", () => {
    valid(forcedInterrupt(on.enemyActivating(), ifThen(not(exists(query("villain"))), setActiveVillain(self))));
    expect(on.enemyActivating(query("minion"))).toEqual({
      on: "enemyActivating",
      targetIs: { categories: ["minion"] },
    });
  });
});

describe("§3.3 several main schemes, one marked by the glider counter", () => {
  it("the glider rule names the main scheme with the counter; Joy Ride moves it to the most threat", () => {
    expect(mainSchemeMarkedBy("glider")).toEqual({
      kind: "focusedMainScheme",
      scheme: { kind: "each", query: { categories: ["mainScheme"], hasCounter: "glider" } },
      encounterCards: "focused",
    });
    const joyRide = whenRevealed(
      moveCounters(
        each(query("mainScheme", { hasCounter: "glider" })),
        superlative("highest", each(query("mainScheme")), threatOn(chosen("candidate"))),
        "glider",
      ),
      resolveSpecialsOf(each(query("mainScheme", { hasCounter: "glider" }))),
    );
    valid(joyRide);
  });
});

describe("§3.4 acceleration tokens on any card", () => {
  it("Hapless Pedestrians 1B hears a token placed on itself; Tracking Prey places one on itself", () => {
    const pedestrians = forcedResponse(on.accelerationTokenPlaced("self"), dealIndirectDamage(firstPlayer, 3));
    valid(pedestrians);
    expect(pedestrians.trigger).toMatchObject({ on: { on: "accelerationTokenPlaced", selfIs: "target" } });
    valid(whenRevealed(addAccelerationToken(self)));
  });
});

describe("§3.5 encounter cards in a player's deck, hand and discard pile (Mysterio)", () => {
  it("Mysterio II shuffles the encounter deck's top card into each player's deck", () => {
    const definition = whenRevealed(
      forEachPlayer(eachPlayer, moveCardsInto(encounterCards(["deck"], undefined, 1), "deckShuffle", thatPlayer)),
    );
    valid(definition);
    expect(moveCardsInto(encounterCards(["deck"], undefined, 1), "deckShuffle", thatPlayer)).toMatchObject({
      kind: "moveCards",
      to: "deckShuffle",
      into: { kind: "scoped" },
    });
  });

  it("Maze of Mirrors deals a drawn or discarded encounter card, then draws one", () => {
    const definition = forcedInterrupt(
      on.encounterCardFromPlayerDeck(),
      dealAsEncounterCard(eventTarget, eventPlayer),
      draw(1, eventPlayer),
    );
    valid(definition);
    expect(definition.trigger).toMatchObject({ on: { on: "encounterCardFromPlayerDeck" } });
    expect(on.encounterCardFromPlayerDeck("draw")).toEqual({
      on: "encounterCardFromPlayerDeck",
      eventIs: { how: "draw" },
    });
  });

  it("Mysterio I places the resolved boost card in your discard pile", () => {
    const definition = forcedResponse(
      on.boostCardResolved("self"),
      moveCardsInto(cards(eventTarget), "discard", eventPlayer),
    );
    valid(definition);
    expect(definition.trigger).toMatchObject({ on: { on: "boostCardResolved", selfIs: "source" } });
  });
});

describe("§3.7 a resolved Special reports the cards it discarded (Sandslide)", () => {
  it("City Streets binds its discard; Sandslide reads it through resolveSpecialsOf's bind", () => {
    const streets = named("City Streets");
    valid(special(addCounters("sand", 1), discardEncounterCards(countersOn(self, "sand"), { bind: "discarded" })));
    const sandslide = whenRevealed(
      addCounters("sand", 2, streets),
      resolveSpecialsOf(streets, undefined, { bind: "sands" }),
      ifThen(valueAtLeast(countAmong(chosen("sands.discarded"), { trait: trait("SANDMAN") }), 1), stun(yourIdentity)),
    );
    valid(sandslide);
    expect(resolveSpecialsOf(streets, undefined, { bind: "sands" })).toEqual({
      kind: "resolveSpecials",
      of: { kind: "named", name: "City Streets" },
      bind: "sands",
    });
  });
});

describe("§3.8 increasing the damage a character takes (Bell Tower, Ringing)", () => {
  it("'Increase all damage Venom takes by 1'", () => {
    const ringing = constant(increaseDamageTaken(query("villain", { name: "Venom" }), 1));
    valid(ringing);
    expect(ringing.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "increaseDamageTaken", target: { categories: ["villain"], name: "Venom" }, amount: 1 }],
    });
  });
});

describe("§3.9 a card that counts as another card type with a trait (Festering Mass)", () => {
  it("'While there are no other [Symbiote] environments in play, this card is considered a [Symbiote] environment'", () => {
    const SYMBIOTE = trait("SYMBIOTE");
    const festering = constant(
      countsAs({ self: true }, ["environment"], {
        traits: [SYMBIOTE],
        while: not(exists(query("environment", { trait: SYMBIOTE, self: false }))),
      }),
    );
    valid(festering);
    expect(festering.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "countsAs", target: { self: true }, categories: ["environment"], traits: [SYMBIOTE] }],
    });
  });
});

describe("§3.11 text that depends on the mode of play", () => {
  it("Surprise!: 'In expert mode, this card gains surge and cannot be canceled'", () => {
    const surprise = constant(
      gainsKeyword({ name: "surge" }, { self: true }, { while: inMode("expert") }),
      cannotBeCanceled({ self: true }, inMode("expert")),
    );
    valid(surprise);
    expect(surprise.trigger).toMatchObject({
      keywordGrants: [
        { keyword: { name: "surge" }, target: { self: true }, while: { kind: "inMode", mode: "expert" } },
      ],
      rules: [{ kind: "cannotBeCanceled", cards: { self: true }, while: { kind: "inMode", mode: "expert" } }],
    });
  });

  it("Coordinated Effort's boost: '(In expert mode, place 1 additional threat on the main scheme)'", () => {
    valid(boost(ifThen(inMode("expert"), placeThreat(1, theMainScheme))));
  });
});

describe("§3.12 'the first attack this turn' (Venom III)", () => {
  it("1 facedown boost card, 2 instead if this is the first attack this turn", () => {
    const retribution = forcedResponse(
      on.attacks({ categories: ["hero", "ally"] }, { target: { self: true }, damages: true }),
      ifThen(firstAttackThisTurn(), giveBoostCard(yourIdentity, 2), giveBoostCard(yourIdentity)),
    );
    valid(retribution);
    expect(firstAttackThisTurn({ against: { self: true } })).toEqual({
      kind: "firstAttackThisTurn",
      against: { self: true },
    });
  });
});

describe("§3.13 'When/After X leaves play'", () => {
  it("Spider-Man (Hobie Brown)'s interrupt and Web of Life and Destiny's response", () => {
    const WEB_WARRIOR = trait("WEB-WARRIOR");
    const hobie = interrupt(on.leavesPlay("self"), discardEncounterCards(3, { bind: "discarded" }));
    valid(hobie);
    expect(hobie.trigger).toMatchObject({ kind: "interrupt", on: { on: "cardLeavesPlay", selfIs: "target" } });
    const webOfLife = response(on.leavesPlay(query("ally", { trait: WEB_WARRIOR })), draw(1));
    valid(webOfLife);
    expect(webOfLife.trigger).toMatchObject({
      kind: "response",
      on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"], trait: WEB_WARRIOR } },
    });
  });
});

describe("§3.14 '(Max 1 per [instance])'", () => {
  it("Web-Bracelet's '(Max 1 per event.)'", () => {
    const bracelet = response(on.leavesPlay("self"), { limit: maxOnePerTriggeringInstance }, draw(1));
    valid(bracelet);
    expect(bracelet.limit).toEqual({ count: 1, period: "phase", per: "triggeringEvent" });
  });
});

describe("§3.15 facedown attached cards: playable events, a count, a maximum (George Stacy)", () => {
  it("composes from playableAttachments, attachCard facedown, and a count of facedown attachments", () => {
    const attachedFacedown = countOf({ host: self, facedown: true });
    valid(constant(playableAttachments(query("event"))));
    valid(
      action(
        { cost: { exhaustSelf: true } },
        ifThen(valueAtMost(attachedFacedown, 2), [
          chooseCards("event", zone("hand", you, { filter: query("event") }), { min: 1, max: 1 }),
          attachCard(chosen("event"), self, { facedown: true }),
        ]),
      ),
    );
  });
});

describe("§3.16 how a card was paid for, by source (VEN#m, Rapid Deployment)", () => {
  it("reads the resources a named resource ability generated toward this card", () => {
    valid(whenRevealed(dealDamage(resourcesPaidBy("31001b.sync-ratio"), theVillain)));
    expect(resourcesPaidBy("31001b.sync-ratio")).toEqual({ kind: "var", name: "paid.ability.31001b.sync-ratio" });
    valid(whenRevealed(ifThen(paidUsingResourceFrom("31001b.sync-ratio"), draw(1))));
  });
});

describe("§3.17 a resource card spent for another player (Everyday Hero)", () => {
  it("spendable for any player while a condition holds, and its response names that player", () => {
    const whileAlterEgo: Predicate = { kind: "form", player: you, form: "alterEgo" };
    const everyday = constant(spendableForAnyPlayer(whileAlterEgo));
    valid(everyday);
    expect(everyday.trigger).toMatchObject({ kind: "constant", spendableForAnyPlayer: { while: whileAlterEgo } });
    expect(constant(spendableForAnyPlayer()).trigger).toMatchObject({ spendableForAnyPlayer: {} });
  });
});

describe("§3.18 a card that does not count toward hand size (Connection to the Worldmind)", () => {
  it("is a constant part", () => {
    const worldmind = constant(notCountedTowardHandSize);
    valid(worldmind);
    expect(worldmind.trigger).toEqual({ kind: "constant", notCountedTowardHandSize: true });
  });
});

describe("§3.19 any number of tough status cards (Armadillo)", () => {
  it("is a constant rule on the character", () => {
    const armadillo = constant(anyNumberOfToughStatusCards({ self: true }));
    valid(armadillo);
    expect(armadillo.trigger).toMatchObject({
      rules: [{ kind: "statusLimit", target: { self: true }, status: "tough", max: "unlimited" }],
    });
  });
});

describe("§3.6 boost cards held on an identity, then moved to an enemy (Venom)", () => {
  it("Venom I places one on your identity; 'Leave Us Alone!' 1B moves them to Venom as he activates against you", () => {
    valid(forcedResponse(on.enemyAttacks("self", { damages: true }), giveBoostCard(yourIdentity)));
    const leave = forcedInterrupt(
      on.enemyActivating(query("villain")),
      moveBoostCards(identityOf(eventPlayer), eventSource),
    );
    valid(leave);
    expect(leave.effects).toEqual([
      {
        kind: "moveBoostCards",
        from: { kind: "identityOf", player: { kind: "eventPlayer" } },
        to: { kind: "eventSource" },
      },
    ]);
  });
});
