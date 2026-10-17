/**
 * Rules audit chunk 33 (FFG rulings Apr 17 - Jul 25, 2025, post-RRG 1.6). Audit proofs only: each `it.fails` marks a
 * place the engine does something the rulings forbid, and flips to a failure when it is fixed.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EffectSpec } from "../spec.js";
import type { Command } from "../commands.js";
import { applyCommand } from "../engine.js";
import { playerId } from "../ids.js";
import { activeVillain } from "../query.js";
import type { InstanceId } from "../ids.js";
import { mustInstance, mustPlayer } from "../query.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubVillain,
} from "../testing/fixtures.js";
import { giveCard, newGame, RESOURCE, runWith, settle } from "../testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "../testing/wave3.js";

/** "Interrupt: When a character thwarts this side scheme, they may use their ATK instead of their THW" (The Red House). */
const MAY_USE_ATK = stubAbility("optional.constant", {
  trigger: { kind: "constant", rules: [{ kind: "thwartWithAtk", scheme: { self: true } }] },
  effects: [],
});
const HOUSE = stubSideScheme({ id: "house", startingThreat: 10, abilities: [MAY_USE_ATK.ref] });
/** The Hulk ally shape: ATK 4, THW "dash". */
const HULK = stubAlly({ id: "hulk", cost: 0, atk: 4, thw: null, hp: 5 });
const deps = depsOf(MAY_USE_ATK);

describe("audit 33.20: a character with a dash THW cannot thwart The Red House (Ruling 69.62, June 17, 2025)", () => {
  // "Hulk cannot thwart The Red House; a character needs to be able to initiate a thwart against The Red House before
  // triggering its interrupt to use their ATK, and since Hulk has a 'dash' (-) value for his THW, he cannot exhaust to
  // initiate a basic thwart this way." Assault is different (always in effect): a dash-THW character can thwart it.
  // RRG 1.8 p. 44 "Thwart" says a basic thwart needs the character's THW; the RRG does not address this card.
  it("an ally with THW dash and ATK 4 using ATK against the Red House is refused", () => {
    let state = gameAtFirstTurn({
      cards: [HULK, HOUSE],
      deps,
      deck: [HULK.id],
      encounter: [HOUSE.id, ...Array.from({ length: 29 }, () => "treachery" as (typeof HOUSE)["id"])],
    });
    state = playerCardIntoPlay(state, HULK.id).state;
    const hulk = mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === HULK.id) as InstanceId;
    const house = encounterCardInVillainArea(state, HOUSE.id, 10);
    const command: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hulk,
      schemeInstanceId: house.id,
      useAtk: true,
    };
    // Refused (the engine used to let the thwart through, ATK 4 removing 4 threat); the scheme keeps its 10 threat.
    const result = applyCommand(house.state, command, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("cannot initiate a thwart");
    expect(mustInstance(house.state, house.id).threat).toBe(10);
    expect(mustInstance(house.state, hulk).exhausted).toBe(false);
  });
});

describe("audit 33.34: Piercing Strike against a Tough enemy that cannot take damage (Ruling 69.76, July 11, 2025)", () => {
  // "A target that 'cannot take damage' is only an invalid target for an ability that solely deals damage to it;
  // Piercing Strike's alteration effect makes it so that an enemy with Tough can still be its target, even if that same
  // enemy 'cannot take damage,' resulting in the Tough status card being removed."
  // RRG 1.8 p. 43 "Target" matches the first half; p. 32 "Piercing" says the attack discards the tough cards before it
  // deals damage and is silent about a target that cannot take it. The engine (`pierceForDamage`) skips piercing when
  // the damage cannot be taken, so the tough card stays.
  const p1 = playerId("p1");
  const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 1, sch: 1 }] });
  const SCHEME = stubMainScheme({
    id: "scheme",
    stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
  });
  const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 9, boostIcons: 0 });
  const STRIKE_ABILITY = stubAbility("pstrike.action", {
    trigger: { kind: "action" },
    label: ["attack"],
    effects: [
      {
        kind: "chooseTarget",
        slot: "enemy",
        chooser: { kind: "controller" },
        query: {
          categories: ["enemy"],
          attackableBy: { kind: "identityOf", player: { kind: "controller" } },
        },
      },
      {
        kind: "attack",
        target: { kind: "slot", slot: "enemy" },
        amount: { kind: "const", value: 3 },
        keywords: ["piercing"],
      },
    ] satisfies EffectSpec[],
  });
  const STRIKE = stubEvent({ id: "pstrike", cost: 0, abilities: [STRIKE_ABILITY.ref] });
  const SHIELD_ABILITY = stubAbility("shield.constant", {
    trigger: { kind: "constant", rules: [{ kind: "cannotTakeDamage", target: { categories: ["villain"] } }] },
    effects: [],
  });
  const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_ABILITY.ref] });
  const deps = depsOf(STRIKE_ABILITY, SHIELD_ABILITY);

  it("the Tough status card is discarded although the villain cannot take the damage", () => {
    const start = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: [THUG, STRIKE, SHIELD],
      encounterDeck: Array.from({ length: 12 }, () => THUG.id),
      deck: [...Array.from({ length: 18 }, () => RESOURCE.id), STRIKE.id, SHIELD.id],
      deps,
    });
    let state = settle(
      runWith(deps, start, { type: "changeForm", playerId: p1 }, { type: "endTurn", playerId: p1 }),
      undefined,
      deps,
    );
    const shield = giveCard(state, p1, SHIELD.id);
    state = runWith(deps, shield.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: shield.id,
      payment: [],
      attachToInstanceId: null,
    });
    const villain = activeVillain(state).instanceId;
    state = {
      ...state,
      instances: {
        ...state.instances,
        [villain]: { ...mustInstance(state, villain), statuses: { stunned: 0, confused: 0, tough: 1 } },
      },
    };
    const given = giveCard(state, p1, STRIKE.id);
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    // Expected: the event is playable (the enemy with Tough is a valid target through piercing) and, after it resolves,
    // the villain's Tough card is gone. Actual: see the assertions.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const offered = result.state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    expect(offered).toContain(villain); // actual: only the minion is offered
    const after = settle(result.state, () => [villain], deps);
    expect(mustInstance(after, villain).statuses.tough).toBe(0);
  });
});
