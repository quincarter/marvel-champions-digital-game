/**
 * Rules audit chunk 07 (Glossary: ENEMY ACTIVATION ... "GAINS"). Audit proofs only: each `it.fails` marks a place the
 * engine does something the RRG forbids, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Form, Change Form" (p. 20) and "Play, Put into Play" (p. 32): "Cards with the text '[type] form only' can only
 * be played or put into play by a player whose identity is in the specified form." The engine checks the form in
 * `playCard` (`actions.ts` ~4486) and in "play a card" effects (`playFromEffectRestrictionFault`), but the `putIntoPlay`
 * effect (`resolve/apply-effect.ts` "putIntoPlay") never reads `playRestrictions.form`.
 *
 * Ruling January 11, 2026 (2) (`marvel-champions-rulings-post-rrg-1-7.md`): "if Jigsaw attacks with overkill and damages
 * both an ally and an identity, his Forced Response triggers twice" (and Captain Marvel's "attacks and defeats" for an
 * ally and an identity). The engine resolves "after [enemy] attacks and damages ..." once per attack.
 */
import { flat, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { startSession } from "../engine.js";
import { playerId } from "../ids.js";
import type { InstanceId } from "../ids.js";
import { mustInstance, mustPlayer } from "../query.js";
import type { EffectSpec, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { driveSession } from "../testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "../testing/fixtures.js";
import { defaultPick, giveCard, newGame, payFor, RESOURCE, runWith, settleUntil } from "../testing/scenario.js";
import { runCommandsPicking } from "../testing/drive.js";
import type { AbilityDefinition } from "../abilities.js";
import { gameAtFirstTurn, P1 } from "../testing/wave3.js";

const you = { kind: "controller" } as const;
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });

/** "Hero form only." (Boundless Rage's shape; no "attach to" text, so it goes on its controller's identity.) */
const RAGE: UpgradeCard = { ...stubUpgrade({ id: "rage", cost: 1 }), playRestrictions: { form: "hero" } };
const FETCH_EFFECTS: readonly EffectSpec[] = [
  {
    kind: "chooseCards",
    slot: "found",
    from: { kind: "zone", zone: ["deck", "discard", "hand"], player: you, filter: { name: RAGE.name } },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "putIntoPlay", card: slot("found"), controller: you },
];
const FETCH_ABILITY = stubAbility("fetch.action", { trigger: { kind: "action" }, effects: [...FETCH_EFFECTS] });
const FETCH = stubEvent({ id: "fetch", cost: 0, abilities: [FETCH_ABILITY.ref] });
const deps: EngineDeps = depsOf(FETCH_ABILITY);

function fetchWith(form: "hero" | "alter_ego"): { state: GameState; rage: InstanceId; hostIdentityId: InstanceId } {
  const base = gameAtFirstTurn({ cards: [RAGE, FETCH], deps, deck: [RAGE.id, FETCH.id] });
  const seat = mustPlayer(base, P1);
  const patched: GameState = {
    ...base,
    players: base.players.map((p) =>
      p.playerId === P1 ? ({ ...p, identity: { ...p.identity, form } } as typeof p) : p,
    ),
  };
  const rage = [...seat.deck, ...seat.hand, ...seat.discard].find((i) => base.instances[i]?.cardId === RAGE.id)!;
  const given = giveCard(patched, P1, FETCH.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session } = driveSession(startSession(given.state), deps, [command], (s) => defaultPick(s));
  return { state: session.state, rage, hostIdentityId: seat.identity.instanceId };
}

describe("a 'Hero form only' card put into play by an effect (RRG 1.8 pp. 20, 32)", () => {
  it("control: in hero form the effect puts it into play on the identity", () => {
    const { state, rage, hostIdentityId } = fetchWith("hero");
    expect(mustInstance(state, hostIdentityId).attachments).toEqual([rage]);
  });

  it.fails("in alter-ego form it cannot be put into play: it stays where it was", () => {
    const { state, rage, hostIdentityId } = fetchWith("alter_ego");
    // Actual: the upgrade is attached to the alter-ego identity.
    expect(mustInstance(state, hostIdentityId).attachments).toEqual([]);
    expect(mustInstance(state, rage).attachedTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// "After [enemy] attacks and damages a character you control" with overkill: an ally and the identity are both damaged.

const p1 = playerId("p1");
const OK_VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(200), atk: 4, sch: 1 }] });
const OK_SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const OK_BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** 3 hit points against the villain's 4 ATK: defending defeats it with 1 damage beyond its hit points. */
const BUDDY = stubAlly({ id: "buddy", cost: 2, atk: 1, thw: 1, hp: 3, resources: 1 });
const GRANT = stubAbility("western.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { categories: ["enemy"] } }],
  },
  effects: [],
});
/** Toad's shape (32076): "Forced Response: After [this enemy] attacks and damages a character you control, ..." */
const TOAD = stubAbility("toad.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "enemyAttack", requireResults: { damage: 1 } },
  },
  effects: [
    { kind: "addCounters", target: { kind: "mainScheme" }, counterType: "toad", amount: { kind: "const", value: 1 } },
  ],
} as AbilityDefinition);
/** One support carries both: the overkill grant (Wild Wild Mojo's shape) and the response, which listens to any enemy's attack. */
const WESTERN = stubSupport({ id: "western", cost: 0, abilities: [GRANT.ref, TOAD.ref] });
const toadDeps: EngineDeps = depsOf(GRANT, TOAD);

describe("'After [enemy] attacks and damages ...' with overkill damaging an ally and the identity (ruling Jan 11, 2026 (2))", () => {
  function overkillAttack(): number {
    const start = newGame({
      villain: OK_VILLAIN,
      mainScheme: OK_SCHEME,
      extraCards: [OK_BLANK, BUDDY, WESTERN],
      encounterDeck: Array.from({ length: 12 }, () => OK_BLANK.id),
      deck: [...Array.from({ length: 18 }, () => RESOURCE.id), BUDDY.id, WESTERN.id],
      deps: toadDeps,
    });
    const ally = giveCard(start, p1, BUDDY.id);
    let state = runWith(
      toadDeps,
      ally.state,
      { type: "changeForm", playerId: p1 },
      {
        type: "playCard",
        playerId: p1,
        cardInstanceId: ally.id,
        payment: payFor(ally.state, p1, 2),
        attachToInstanceId: null,
      },
    );
    const rule = giveCard(state, p1, WESTERN.id);
    state = runWith(toadDeps, rule.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: rule.id,
      payment: [],
      attachToInstanceId: null,
    });
    state = settleUntil(runWith(toadDeps, state, { type: "endTurn", playerId: p1 }), "declareDefender", toadDeps);
    const pick = (s: GameState): readonly string[] =>
      s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === ally.id)
        ? [ally.id as string]
        : defaultPick(s);
    const { state: after } = runCommandsPicking(state, toadDeps, pick);
    return mustInstance(after, after.mainScheme.instanceId).counters["toad"] ?? 0;
  }

  it.fails("the villain's attack damages the ally (3) and, by overkill, the identity (1): the response resolves twice", () => {
    // Actual: once (the attack event is announced once, whoever it damaged).
    expect(overkillAttack()).toBe(2);
  });
});
