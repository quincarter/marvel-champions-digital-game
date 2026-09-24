/**
 * docs/phase7-wave3.md §3.28–§3.36: the DSL builders for the second `gmw` primitives pass. Each builder emits exactly
 * the plain data the engine tests (`packages/engine/src/gmw-compositions.test.ts` and the per-primitive files) drive,
 * and the compositions docs/phase7-wave3-scripting.md gives the scripter validate.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  alterEgoAction,
  discardTopOfDeckCost,
  eitherCost,
  exhaustThis,
  exhaustYourHero,
  heroAction,
  heroInterrupt,
  heroResponse,
  on,
  oncePerRoundPerPlayer,
  removeCounter,
  removeUpToCounters,
  response,
  spend,
  when,
  whenRevealed,
} from "./abilities.js";
import {
  addCounters,
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  cards,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  discardEncounterCards,
  eachTimeUntil,
  giveTough,
  heal,
  ifThen,
  moveCards,
  option,
  preventDamage,
  putIntoPlay,
  ready,
  reduceNextCardCost,
  scenarioArea,
  thwartAScheme,
  zone,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  chosen,
  chosenPlayer,
  countOf,
  exists,
  firstPlayer,
  FRIENDLY_CHARACTER,
  named,
  ofTeamUpSet,
  perHero,
  query,
  refMatches,
  statOf,
  sum,
  superlativePlayer,
  teamUpCharacters,
  thatPlayer,
  titled,
  varOf,
  you,
  YOUR_IDENTITY,
  yourIdentity,
} from "./values.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

describe("§3.28–§3.31 compositions", () => {
  it("Lashing Vines: after your identity uses a basic power", () => {
    const vines = heroResponse(
      on.basicPowerUsed(YOUR_IDENTITY),
      { cost: [removeCounter("growth", 2, { fromIdentity: true }), exhaustThis] },
      ready(yourIdentity),
    );
    valid(vines);
    expect(vines.trigger).toMatchObject({ kind: "response", form: "hero", on: { on: "basicPowerUsed" } });
  });

  it("Deft Focus: the next superpower card this turn", () => {
    valid(heroAction({ cost: exhaustThis }, reduceNextCardCost(you, 1, "turn", { trait: trait("SUPERPOWER") })));
  });

  it("Schadenfreude: eachTimeUntil + on.youDealDamage", () => {
    const schadenfreude = heroAction(
      eachTimeUntil("endOfTurn", on.youDealDamage(query("enemy")), heal(2, yourIdentity)),
    );
    valid(schadenfreude);
    expect(schadenfreude.effects[0]).toEqual({
      kind: "eachTimeUntil",
      until: "endOfTurn",
      on: {
        on: "dealDamage",
        sourceIs: { controller: "you", categories: ["identity", "event", "resource", "upgrade"] },
        targetIs: { categories: ["enemy"] },
        eventAtLeast: { amount: 1 },
      },
      effects: [{ kind: "heal", target: yourIdentity, amount: { kind: "const", value: 2 } }],
    });
  });

  it("Salvage: after you spend this card", () => {
    valid(
      response(
        on.youSpendThis(),
        chooseCards("tech", zone("discard", you, { filter: query("upgrade", { trait: trait("TECH") }) }), {
          min: 1,
          max: 1,
        }),
        moveCards(cards(chosen("tech")), "deckTop"),
      ),
    );
  });
});

describe("§3.32, §3.33, §3.36 costs", () => {
  it("We Are Groot (16006): remove up to 4 growth counters from Groot, bound for 'that many'", () => {
    const groot = heroAction(
      { cost: removeUpToCounters("growth", 4, { bind: "removed", fromIdentity: true }) },
      chooseTarget("friends", FRIENDLY_CHARACTER, { count: varOf("removed") }),
      giveTough(chosen("friends")),
    );
    valid(groot);
    expect(groot.cost).toEqual({
      spendCounters: { counterType: "growth", amount: 4, upTo: true, bind: "removed", target: "identity" },
    });
  });

  it("Booster Boots (16052): exhaust it and discard the top card of your deck", () => {
    const boots = heroInterrupt(
      when.damage(YOUR_IDENTITY, { fromAttack: true }),
      { cost: [exhaustThis, discardTopOfDeckCost()] },
      preventDamage(1),
    );
    valid(boots);
    expect(boots.cost).toEqual({ exhaustSelf: true, discardFromDeck: 1 });
  });

  it("The Grand Collection 1B (16073b): either exhaust your hero or spend 2 resources, once per round per player", () => {
    const collection = heroAction(
      { cost: eitherCost(exhaustYourHero, spend(2)), limit: oncePerRoundPerPlayer },
      chooseCards("card", scenarioArea("The Collection"), { min: 1, max: 1 }),
      moveCards(cards(chosen("card")), "discard"),
    );
    valid(collection);
    expect(collection.cost).toEqual({ either: [{ exhaustIdentity: true }, { resources: 2 }] });
    expect(collection.limit).toEqual({ count: 1, period: "round", per: "player" });
    // A branch that repeats a component of the rest of the cost is an authoring error.
    expect(validateDefinition(heroAction({ cost: [exhaustThis, eitherCost(exhaustThis, spend(1))] }))).not.toEqual([]);
  });
});

describe("§3.35 a player superlative", () => {
  it("Drang III (16060): each discarded minion engages the player with the fewest minions, ties to the first player", () => {
    const fewestMinions = superlativePlayer("lowest", countOf(query("minion", { engagedWithPlayer: thatPlayer })));
    const drang = whenRevealed(
      discardEncounterCards(perHero(4), {
        forEachDiscarded: {
          slot: "discarded",
          effects: [
            ifThen(refMatches(chosen("discarded"), query("minion"), { anywhere: true }), [
              choosePlayer("fewest", firstPlayer, { among: fewestMinions }),
              putIntoPlay(chosen("discarded"), chosenPlayer("fewest")),
            ]),
          ],
        },
      }),
    );
    valid(drang);
    expect(fewestMinions).toEqual({
      kind: "superlative",
      order: "lowest",
      measure: { kind: "count", query: { categories: ["minion"], engagedWithPlayer: { kind: "scoped" } } },
    });
  });
});

describe("§3.34 Team-Up names", () => {
  it("Flora and Fauna (16020/16048): name 0 is Groot, a card of name 1's set is 'a Rocket Raccoon upgrade'", () => {
    const flora = heroAction(
      chooseOne(
        option(
          "Place 2 growth counters on Groot (to a maximum of 10) and ready him",
          addCounters("growth", 2, teamUpCharacters(0), { upTo: 10 }),
          ready(teamUpCharacters(0)),
        ),
        option(
          "Place 2 charge counters on a Rocket Raccoon upgrade and ready that upgrade",
          { when: exists(query("upgrade", ofTeamUpSet(1))) },
          chooseTarget("upgrade", query("upgrade", ofTeamUpSet(1))),
          addCounters("charge", 2, chosen("upgrade")),
          ready(chosen("upgrade")),
        ),
      ),
    );
    valid(flora);
    expect(teamUpCharacters(0)).toEqual({
      kind: "each",
      query: { categories: ["identity", "ally"], titled: { teamUpOf: { kind: "self" }, index: 0 } },
    });
    expect(query("upgrade", ofTeamUpSet(1))).toEqual({
      categories: ["upgrade"],
      identitySetTitled: { teamUpOf: { kind: "self" }, index: 1 },
    });
  });

  it("composes the other Team-Up wordings (not scripted this wave)", () => {
    // Beauty and the Thief (37019/38020): names nobody in its effect; the keyword alone gates the play.
    valid(heroAction({ label: ["attack", "thwart"] }, attackAnEnemy(4), thwartAScheme(4)));
    // Fastball Special (35023): "X is the total ATK of Colossus and Wolverine. This attack gains overkill and piercing."
    valid(
      heroAction(
        { label: "attack" },
        anAttackableEnemy("enemy"),
        attack(sum(statOf(teamUpCharacters(0), "atk"), statOf(teamUpCharacters(1), "atk")), chosen("enemy"), {
          keywords: ["overkill", "piercing"],
        }),
      ),
    );
    // Young Love (27019/27050): alter-ego titles; each matches only while that side is up (RRG 1.8 p. 23).
    valid(alterEgoAction(heal(3, teamUpCharacters())));
    // Psychic Rapport (33023/34023): "Ready Cyclops and Phoenix. … return a Cyclops card from your discard pile …"
    valid(
      heroAction(
        ready(teamUpCharacters()),
        chooseOne(
          option(
            "Return a Cyclops card from your discard pile to your hand",
            chooseCards("card", zone("discard", you, { filter: ofTeamUpSet(0) }), { min: 1, max: 1 }),
            moveCards(cards(chosen("card")), "hand"),
          ),
          option("Place 2 power counters on Phoenix Force", addCounters("power", 2, named("Phoenix Force"))),
        ),
      ),
    );
    // Super-Soldiers (54022): "Give Captain America and Winter Soldier each a tough status card."
    valid(heroAction({ label: "attack" }, attackAnEnemy(6), giveTough(teamUpCharacters())));
    // Written-out names, for a card that names characters without the keyword.
    expect(titled("Groot")).toEqual({ categories: ["identity", "ally"], titled: { names: ["Groot"] } });
  });
});
