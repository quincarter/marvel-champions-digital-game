import {
  activeVillain,
  applyCommand,
  cardsInPlay,
  hasKeyword,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
  mainSchemeStage,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { SABRETOOTH_ABILITIES } from "./sabretooth.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  driveStepwise,
  encounterCardInVillainArea,
  playFromHand as playFromHandWith,
} from "../../testing/staging.js";
import { buildCrossHeroDeck, CORE_HERO_FOR_ASPECT } from "../../testing/cross-hero.js";
import { WAVE6_CARDS } from "../cards.js";
import { attachToHost, engageMinion } from "./project-wideawake-testing.js";
import { handForMixedCost, inPlay, kellyOf, sabretoothGame, senatorOf } from "./sabretooth-testing.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const finish = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, WAVE6_DEPS);
const villain = (state: GameState) => activeVillain(state).instanceId;
const mainScheme = (state: GameState) => state.mainScheme.instanceId;
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;
const bare = (state: GameState, id: InstanceId) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });
const hurt = (state: GameState, id: InstanceId, damage: number) => patchInstance(state, id, { damage });
/** Boost card 01186 (no boost icons), then `rest`, which the encounter step then reveals once the villain has activated. */
const villainPhase = (state: GameState, top: readonly string[], pick: Picker = firstLegal, ...ends: PlayerId[]) =>
  driveEventsPicking(
    WAVE6_DEPS,
    stackEncounterDeck(state, ...top),
    pick,
    ...(ends.length ? ends : [P1]).map((playerId) => ({ type: "endTurn" as const, playerId })),
  );
/**
 * One villain phase's encounter cards: the boost card (Advance), the card Sabretooth's own Forced Response discards
 * (Assault, no boost icons), then the reveal (Medical Emergency, a side scheme that does nothing when revealed).
 */
const FILLER = ["01186", "01187", "32071"] as const;
/** `FILLER` for a game of `players` players: each activation's boost card and discard, then each player's reveal. */
const fillerFor = (players: number): string[] => [
  ...Array.from({ length: players }, () => ["01186", "01187"]).flat(),
  ...Array.from({ length: players }, () => "32071"),
];
const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === id);
const chooseOption =
  (option: string): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "chooseOption" ? [option] : firstLegal(state);
/** Declares `defender` for every attack it is offered as a defender for. */
const defendWith =
  (defender: InstanceId): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "declareDefender" &&
    state.pendingChoice.options.some((o) => o.optionId === defender)
      ? [defender]
      : firstLegal(state);
const thwartSenator = (state: GameState) => {
  const senator = senatorOf(state);
  const ready = patchInstance(state, senator, { threat: 1 });
  return finish(
    run(ready, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(ready),
      schemeInstanceId: senator,
    }),
  );
};
/**
 * Find the Senator defeated and the game at the Injured Senator stage, in hero form. The facedown encounter cards the
 * stage deals are put back in the discard pile (Sabretooth Strikes, say, would otherwise damage Robert Kelly too).
 */
const detached = (options: Parameters<typeof sabretoothGame>[0] = {}) => {
  const state = thwartSenator(run(sabretoothGame(options), toHero(P1)));
  const dealt = state.players.flatMap((p) => p.dealtEncounter);
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, dealtEncounter: [] })),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...dealt] } },
  };
};
/** Hero form, ready for the villain phase. */
const heroGame = (options: Parameters<typeof sabretoothGame>[0] = {}) => run(sabretoothGame(options), toHero(P1));

describe("registry", () => {
  it("registers every ability ref of the Sabretooth scenario set", () => {
    expect(Object.keys(SABRETOOTH_ABILITIES).sort()).toEqual(
      [
        "32060.sabretooth-forced-response",
        "32061.sabretooth-forced-response",
        "32062.sabretooth-forced-response",
        "32063a.setup",
        "32063b.stalked-by-sabretooth-forced-response",
        "32063b.stalked-by-sabretooth-constant",
        "32063b.stalked-by-sabretooth-constant-2",
        "32064a.when-revealed",
        "32064b.when-completed",
        "32064b.the-injured-senator-constant",
        "32065a.find-the-senator-constant",
        "32065a.when-defeated",
        "32065b.protect-the-senator-constant",
        "32065b.protect-the-senator-response",
        "32066.robert-kelly-constant",
        "32066.robert-kelly-forced-interrupt",
        "32067.adamantium-claws-constant",
        "32067.adamantium-claws-action",
        "32067.boost",
        "32068.animal-ferocity-constant",
        "32068.animal-ferocity-action",
        "32068.boost",
        "32069.when-revealed",
        "32069.boost",
        "32070.unrelenting-savage-constant",
        "32070.when-revealed-hero",
        "32071.when-defeated",
        "32072.when-defeated",
      ].sort(),
    );
  });
});

describe("Stalked by Sabretooth (32063a/b)", () => {
  it("32063a.setup: Find the Senator is in play with Robert Kelly attached to it, under no player's control; neither is in the deck", () => {
    const state = sabretoothGame();
    const senator = senatorOf(state);
    expect(state.instances[senator]!.cardId).toBe("32065a");
    expect(inst(state, senator).threat).toBe(5);
    expect(inPlay(state, "32065a")).toHaveLength(1);
    expect(inPlay(state, "32065b")).toHaveLength(0);
    expect(inst(state, kellyOf(state)).attachedTo).toBe(senator);
    expect(inst(state, kellyOf(state)).controllerId).toBeNull();
    const deck = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!.deck;
    expect(deck.filter((id) => ["32065a", "32065b", "32066"].includes(state.instances[id]!.cardId))).toEqual([]);
    expect(state.encounterSetAside.filter((id) => state.instances[id]!.cardId === "32066")).toEqual([]);
  });

  describe("32063b.stalked-by-sabretooth-forced-response", () => {
    // Step 1 places 1 threat here (a one-player game), so 4 becomes 5 and 5 becomes 6 = 6[per_hero].
    const firstDamage = (state: GameState) => {
      const { events } = villainPhase(state, FILLER, firstLegal, ...state.players.map((p) => p.playerId));
      return damageTo(events, kellyOf(state))[0] as { amount: number };
    };
    it("deals 2 damage to Robert Kelly after step 1 when there are fewer than 6[per_hero] threat here", () => {
      const state = patchInstance(sabretoothGame(), mainScheme(sabretoothGame()), { threat: 4 });
      expect(firstDamage(state).amount).toBe(2);
    });
    it("deals 3 damage instead at 6[per_hero] threat (6 with one player)", () => {
      const state = patchInstance(sabretoothGame(), mainScheme(sabretoothGame()), { threat: 5 });
      expect(firstDamage(state).amount).toBe(3);
    });
    it("scales with the number of players: 12 threat with two", () => {
      const base = sabretoothGame({ players: TWO });
      const at = (threat: number) => firstDamage(patchInstance(base, mainScheme(base), { threat }));
      // Two threat are placed by step 1 with two players (one each).
      expect(at(9).amount).toBe(2);
      expect(at(10).amount).toBe(3);
    });
  });

  it("32063b.stalked-by-sabretooth-constant: while attached, Robert Kelly's text box is blank, so his interrupt does not redirect an undefended attack", () => {
    const state = heroGame();
    const { state: after } = villainPhase(state, FILLER);
    // Sabretooth's undefended attack hit the hero, not Robert Kelly (who only took Stalked's 2).
    expect(inst(after, identityOf(after)).damage).toBeGreaterThan(0);
    expect(inst(after, kellyOf(after)).damage).toBe(2);
  });

  // Attached to Find the Senator he is in no play area, and still an ally in play: lethal damage defeats him (RRG 1.8
  // "Ally", p. 7; docs/phase7-wave6.md §3.75), and leaving play loses the game.
  it("32063b.stalked-by-sabretooth-constant-2: if Robert Kelly leaves play, the players lose (lethal damage while attached)", () => {
    const state = hurt(sabretoothGame(), kellyOf(sabretoothGame()), 8);
    const kelly = kellyOf(state);
    expect(inst(state, kelly).attachedTo).toBe(senatorOf(state));
    const { state: after, events } = villainPhase(state, FILLER);
    expect(events).toContainEqual(expect.objectContaining({ type: "characterDefeated", instanceId: kelly }));
    expect(cardsInPlay(after)).not.toContain(kelly);
    expect(inst(after, senatorOf(after)).attachments).not.toContain(kelly);
    // The outcome names the card whose text lost it (the main scheme) and the card that left play (Robert Kelly),
    // which is what the Game Over screen shows.
    expect(after.outcome).toEqual({
      result: "loss",
      reason: "cardAbility",
      sourceInstanceId: mainScheme(after),
      causeInstanceId: kelly,
    });
    // Stage 1 prints the card's own name: Stalked by Sabretooth.
    expect(
      mainSchemeStage(after).name ?? WAVE6_CARDS.find((c) => c.id === inst(after, mainScheme(after)).cardId)?.name,
    ).toBe("Stalked by Sabretooth");
  });
  it("32063b.stalked-by-sabretooth-constant-2: the rule names Robert Kelly leaving play, unconditionally", () => {
    expect(SABRETOOTH_ABILITIES["32063b.stalked-by-sabretooth-constant-2"]!.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "leavingPlayLoses", target: { categories: ["ally"], name: "Robert Kelly" } }],
    });
  });
});

describe("The Injured Senator (32064a/b)", () => {
  it("32064a.when-revealed and 32065a.when-defeated: defeating Find the Senator advances the main scheme and deals each player a facedown encounter card", () => {
    const before = run(sabretoothGame({ players: TWO }), toHero(P1));
    const after = thwartSenator(before);
    expect(after.mainScheme.stageIndex).toBe(1);
    for (const player of [P1, P2]) {
      expect(playerOf(after, player).dealtEncounter.length).toBe(playerOf(before, player).dealtEncounter.length + 1);
    }
  });

  it("32065a.when-defeated: the first player detaches Robert Kelly and takes control of him; the card flips into the Protect the Senator environment next to the main scheme", () => {
    const after = detached({ players: TWO });
    const kelly = kellyOf(after);
    expect(inst(after, kelly).attachedTo).toBeNull();
    expect(inst(after, kelly).controllerId).toBe(P1);
    expect(playerOf(after, P1).playArea).toContain(kelly);
    expect(inPlay(after, "32065a")).toHaveLength(0);
    expect(inPlay(after, "32065b")).toHaveLength(1);
    expect(after.outcome).toBeNull();
  });

  it("32064b.the-injured-senator-constant: if Robert Kelly leaves play, the players lose", () => {
    const after = detached();
    const dying = hurt(after, kellyOf(after), 8);
    // No Stalked damage any more at stage 2: it is Sabretooth's own undefended attack redirected to him.
    const { state: end } = villainPhase(dying, FILLER);
    expect(end.outcome).toEqual({
      result: "loss",
      reason: "cardAbility",
      sourceInstanceId: mainScheme(end),
      causeInstanceId: kellyOf(after),
    });
    expect(mainSchemeStage(end).name).toBe("The Injured Senator");
  });

  it("32064b.when-completed (RRG 1.8 'When Completed Abilities', p. 48): the final stage's completion defeats Robert Kelly, and his leaving play is what loses the game", () => {
    const after = detached();
    const kelly = kellyOf(after);
    // 9[per_hero] target threat: step 1 of the villain phase places the ninth.
    const nearly = patchInstance(after, mainScheme(after), { threat: 8 });
    const { state: end, events } = villainPhase(nearly, FILLER);
    const completed = events.findIndex((e) => e.type === "mainSchemeCompleted");
    const defeated = events.findIndex((e) => e.type === "characterDefeated" && e.instanceId === kelly);
    const ended = events.findIndex((e) => e.type === "gameEnded");
    expect(completed).toBeGreaterThan(-1);
    expect(defeated).toBeGreaterThan(completed);
    expect(ended).toBeGreaterThan(defeated);
    // Undamaged, he is defeated by the ability, not by damage.
    expect(damageTo(events, kelly)).toEqual([]);
    expect(cardsInPlay(end)).not.toContain(kelly);
    // "If Robert Kelly leaves play, the players lose the game" (32064b), ahead of the completion's own loss.
    expect(end.outcome).toEqual({
      result: "loss",
      reason: "cardAbility",
      sourceInstanceId: mainScheme(end),
      causeInstanceId: kelly,
    });
  });
});

describe("Sabretooth (32060-32062)", () => {
  const damaged = (state: GameState, damage = 5) => patchInstance(state, villain(state), { damage });
  /** Heal = the boost icons of the card the Forced Response discards: Shadow of the Past (2). */
  const afterPhase = (state: GameState, top: readonly string[], ...ends: PlayerId[]) =>
    villainPhase(state, top, firstLegal, ...ends).state;

  it("32060.sabretooth-forced-response: after he activates against you, discard the top card of the encounter deck and heal damage equal to its boost icons", () => {
    const state = damaged(sabretoothGame());
    expect(inst(afterPhase(state, FILLER), villain(state)).damage).toBe(5);
    // Shadow of the Past has two boost icons.
    const after = afterPhase(state, ["01186", "01190", "32071"]);
    expect(inst(after, villain(after)).damage).toBe(3);
  });

  it("32061.sabretooth-forced-response: Sabretooth (II), the expert mode's first stage, does the same", () => {
    const state = damaged(sabretoothGame({ difficulty: "expert" }));
    expect(activeVillain(state).stageIndex).toBe(1);
    const after = afterPhase(state, ["01186", "01190", "32071"]);
    expect(inst(after, villain(after)).damage).toBe(3);
  });

  it("32062.sabretooth-forced-response: Sabretooth (III) does the same", () => {
    const start = run(sabretoothGame({ difficulty: "expert" }), toHero(P1));
    const advanced = defeatWithAttack(WAVE6_DEPS, bare(start, villain(start)), villain(start));
    expect(activeVillain(advanced).stageIndex).toBe(2);
    const state = damaged(advanced);
    const after = afterPhase(state, ["01186", "01190", "32071"]);
    expect(inst(after, villain(after)).damage).toBe(3);
  });

  it("32060.sabretooth-forced-response: it is each activation against you, so each player's activation heals", () => {
    const state = damaged(sabretoothGame({ players: TWO }));
    // Player one's activation: Advance as the boost card, Shadow of the Past (2 icons) discarded; player two's: Advance,
    // Unrelenting Savage (1 icon) discarded; then two Medical Emergencies revealed.
    const after = afterPhase(state, ["01186", "01190", "01186", "32070", "32071", "32071"], P1, P2);
    expect(inst(after, villain(after)).damage).toBe(2);
  });
});

describe("Find the Senator (32065a) and Protect the Senator (32065b)", () => {
  it("32065a.find-the-senator-constant / 32065b.protect-the-senator-constant: Robert Kelly cannot have upgrades attached", () => {
    for (const ref of ["32065a.find-the-senator-constant", "32065b.protect-the-senator-constant"]) {
      expect(SABRETOOTH_ABILITIES[ref as keyof typeof SABRETOOTH_ABILITIES].trigger).toMatchObject({
        kind: "constant",
        rules: expect.arrayContaining([
          { kind: "cannotHaveAttachments", target: { categories: ["ally"], name: "Robert Kelly" }, from: "upgrade" },
        ]),
      });
    }
  });

  describe("cannot be healed by player card effects, but an encounter card's heal heals him", () => {
    const CAP = [buildCrossHeroDeck(WAVE6_CARDS, CORE_HERO_FOR_ASPECT.leadership, "10030")];
    /** Inspiring Presence (Leadership, Avenger): Hero Action: Heal 1 damage from an ally and ready it. */
    const inspire = (state: GameState) => {
      const given = moveToHand(state, P1, "10030");
      return finish(run(given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids))));
    };
    const withKellyHurt = (state: GameState, damage = 3) => patchInstance(state, kellyOf(state), { damage });

    it("while attached, a player card that says 'an ally' can choose him, and heals nothing (Find the Senator prints the rule)", () => {
      const attached = withKellyHurt(heroGame({ players: CAP }));
      const kelly = kellyOf(attached);
      const given = moveToHand(attached, P1, "10030");
      const played = run(given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids)));
      // He is the only ally in play: an ally under no player's control, in play (32063a; RRG 1.8 p. 23).
      expect(played.pendingChoice?.options.map((o) => o.optionId)).toEqual([kelly]);
      const after = finish(played);
      expect(inst(after, kelly).damage).toBe(3);
      expect(inst(after, kelly).attachedTo).toBe(senatorOf(after));
    });

    it("once detached, a player card heals nothing from him (Protect the Senator prints the rule)", () => {
      const after = inspire(withKellyHurt(detached({ players: CAP })));
      expect(inst(after, kellyOf(after)).damage).toBe(3);
    });

    it("control: a player card does heal an ally that has no such rule", () => {
      const control = withKellyHurt(detached({ players: CAP }));
      // Robert Kelly stripped of the rule by removing Protect the Senator's constant: the card heals 1.
      const noRule = { ...WAVE6_DEPS, abilities: { ...WAVE6_DEPS.abilities } };
      delete (noRule.abilities as Record<string, unknown>)["32065b.protect-the-senator-constant"];
      const given = moveToHand(control, P1, "10030");
      const after = settle(
        runWith(noRule, given.state, play(P1, given.ids[0]!, payWith(given.state, P1, 1, given.ids))),
        firstLegal,
        undefined,
        noRule,
      );
      expect(inst(after, kellyOf(after)).damage).toBe(2);
    });
  });
});

describe("Medical Emergency (32071)", () => {
  it("32071.when-defeated: heals 2 damage from Robert Kelly, which an encounter card may do although player cards cannot", () => {
    const base = patchInstance(heroGame(), kellyOf(heroGame()), { damage: 3 });
    const { state, id } = encounterCardInVillainArea(base, "32071", 1);
    const after = finish(
      run(state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state),
        schemeInstanceId: id,
      }),
    );
    expect(inPlay(after, "32071")).toHaveLength(0);
    expect(inst(after, kellyOf(after)).damage).toBe(1);
  });
});

describe("Feral Rage (32072)", () => {
  it("32072.when-defeated: Sabretooth attacks the player who defeated it, even in alter-ego form", () => {
    const base = sabretoothGame({
      players: [buildCrossHeroDeck(WAVE6_CARDS, CORE_HERO_FOR_ASPECT.leadership, "01011")],
    });
    expect(playerOf(base, P1).identity.form).toBe("alterEgo");
    // An alter-ego cannot thwart, so an ally (Spider-Woman) does it for this player.
    const { state: withAlly, id: ally } = playFromHandWith(WAVE6_DEPS, base, "01011", 3);
    const { state, id } = encounterCardInVillainArea(withAlly, "32072", 1);
    const { state: after, events } = driveEventsPicking(
      WAVE6_DEPS,
      stackEncounterDeck(state, "01186", "01187"),
      firstLegal,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: ally, schemeInstanceId: id },
    );
    expect(inPlay(after, "32072")).toHaveLength(0);
    const attacks = events.filter((e) => e.type === "attackResolved");
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({
      enemyInstanceId: villain(after),
      targetInstanceId: identityOf(after),
      baseAtk: 2,
    });
    expect(inst(after, identityOf(after)).damage).toBe(2);
  });
});

describe("Protect the Senator's response (32065b)", () => {
  /** Answers the defender prompt with `defender`, takes the response and pays for it with the first two hand cards. */
  const respondingWith =
    (defender: InstanceId, respond = true): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "declareDefender" && choice.options.some((o) => o.optionId === defender))
        return [defender];
      if (choice?.prompt.kind === "chooseTriggers" && choice.prompt.timing === "response" && respond)
        return [choice.options[0]!.optionId];
      if (choice?.prompt.kind === "payForAbility") return choice.options.slice(0, 2).map((o) => o.optionId);
      return firstLegal(state);
    };
  const responsePrompts = (state: GameState, pick: Picker) => {
    const offered: string[] = [];
    const result = driveStepwise(WAVE6_DEPS, state, (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers" && choice.prompt.timing === "response")
        offered.push(...choice.options.map((o) => o.optionId));
      return pick(s);
    });
    return { ...result, offered };
  };
  const toVillainPhase = (state: GameState, ...ends: PlayerId[]) =>
    ends.reduce(
      (s, playerId) => run(stackEncounterDeck(s, ...fillerFor(state.players.length)), { type: "endTurn", playerId }),
      state,
    );

  it("32065b.protect-the-senator-response: after your hero defends against Sabretooth, spend 2 resources to ready your hero", () => {
    const state = toVillainPhase(detached(), P1);
    const me = identityOf(state);
    const { events, offered } = responsePrompts(state, respondingWith(me));
    expect(offered).toEqual([expect.stringContaining("32065b.protect-the-senator-response")]);
    const declared = events.findIndex((e) => e.type === "defenderDeclared");
    const resolved = events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "32065b.protect-the-senator-response",
    );
    expect(declared).toBeGreaterThan(-1);
    expect(resolved).toBeGreaterThan(declared);
    // Defending exhausted the hero, the response was paid for with two hand cards, and then readied the hero.
    const between = events.slice(declared, resolved);
    expect(between.filter((e) => e.type === "cardExhausted" && e.instanceId === me)).toHaveLength(1);
    expect(between.filter((e) => e.type === "cardDiscardedFromHand")).toHaveLength(2);
    const readied = events.findIndex((e, i) => i > resolved && e.type === "cardReadied");
    expect(events[readied]).toMatchObject({ type: "cardReadied", instanceId: me });
    expect(events.slice(resolved, readied).filter((e) => e.type === "cardMoved" || e.type === "damageDealt")).toEqual(
      [],
    );
  });

  it("is not offered when its 2 resources cannot be paid: one hand card printing 1 resource (RRG 1.8 p. 24, Initiating Abilities)", () => {
    const base = detached();
    const me = identityOf(base);
    const owner = playerOf(base, P1);
    // No deck or discard pile, so the end of the hero turn draws nothing back up to hand size.
    const single = [...owner.hand, ...owner.deck].find((i) => {
      const card = base.cardPool[base.instances[i]!.cardId]!;
      const icons = "resourceIcons" in card ? Object.values(card.resourceIcons ?? {}) : [];
      return icons.reduce((sum, n) => sum + (n ?? 0), 0) === 1;
    })!;
    const poor = {
      ...base,
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, hand: [single], deck: [], discard: [] } : p)),
    };
    const { offered, events } = responsePrompts(toVillainPhase(poor, P1), respondingWith(me));
    expect(events.filter((e) => e.type === "defenderDeclared")).toHaveLength(1);
    expect(offered).toEqual([]);
  });

  it("one hand card printing 2 resources is enough: offered, and paying with it resolves the response", () => {
    const base = detached();
    const me = identityOf(base);
    const card = Object.values(base.cardPool).find(
      (c) =>
        (c.type === "event" || c.type === "support" || c.type === "upgrade") &&
        "resourceIcons" in c &&
        Object.values(c.resourceIcons ?? {}).reduce((sum, n) => sum + (n ?? 0), 0) === 2,
    )!;
    const single = playerOf(base, P1).hand[0]!;
    const patched = patchInstance(base, single, { cardId: card.id });
    const rich = {
      ...patched,
      players: patched.players.map((p) => (p.playerId === P1 ? { ...p, hand: [single], deck: [], discard: [] } : p)),
    };
    const { offered, events } = responsePrompts(toVillainPhase(rich, P1), respondingWith(me));
    expect(offered).toEqual([expect.stringContaining("32065b.protect-the-senator-response")]);
    expect(
      events.some((e) => e.type === "abilityResolved" && e.abilityId === "32065b.protect-the-senator-response"),
    ).toBe(true);
  });

  it("declining the response leaves the hero exhausted", () => {
    const state = toVillainPhase(detached(), P1);
    const me = identityOf(state);
    const { events } = responsePrompts(state, respondingWith(me, false));
    const declared = events.findIndex((e) => e.type === "defenderDeclared");
    const ended = events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "32060.sabretooth-forced-response",
    );
    expect(events.slice(declared, ended).some((e) => e.type === "cardReadied")).toBe(false);
  });

  it("is not offered after a defense against an attack from another enemy", () => {
    const base = detached({ modularSetIds: ["brotherhood"] });
    const { state: engaged } = engageMinion(base, "32073", P1);
    const me = identityOf(engaged);
    // Sabretooth's own attack is declined (undefended: Robert Kelly takes it), then the hero defends Avalanche.
    const declineFirst: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "declareDefender" && choice.prompt.attack.enemyInstanceId === villain(s))
        return ["decline"];
      return respondingWith(me)(s);
    };
    const { offered, events } = responsePrompts(toVillainPhase(engaged, P1), declineFirst);
    expect(events.filter((e) => e.type === "defenderDeclared")).toHaveLength(1);
    expect(offered).toEqual([]);
  });

  it("only the player who controls Robert Kelly can trigger it: another player defending against Sabretooth is not offered it", () => {
    // Player one (first player, controls Robert Kelly) stays in alter-ego form, so Sabretooth schemes against them;
    // player two is in hero form and defends Sabretooth's attack.
    const base = run(detached({ players: TWO }), { type: "endTurn", playerId: P1 }, toHero(P2));
    expect(inst(base, kellyOf(base)).controllerId).toBe(P1);
    const second = identityOf(base, P2);
    const { offered, events } = responsePrompts(toVillainPhase(base, P2), respondingWith(second));
    expect(events.filter((e) => e.type === "defenderDeclared" && e.defenderInstanceId === second)).toHaveLength(1);
    expect(offered).toEqual([]);
  });
});

describe("Robert Kelly (32066)", () => {
  const attackPhase = (state: GameState, pick: Picker = firstLegal, ...ends: PlayerId[]) =>
    villainPhase(state, FILLER, pick, ...ends);
  const attacks = (events: readonly GameEvent[]) => events.filter((e) => e.type === "attackResolved");

  it("32066.robert-kelly-constant: the first player controls him once he is detached, and control follows the first player token", () => {
    const after = detached({ players: TWO });
    expect(inst(after, kellyOf(after)).controllerId).toBe(P1);
    // Round end: the first player token passes to player two, and so does Robert Kelly.
    const next = finish(run(villainPhase(after, FILLER, firstLegal, P1, P2).state));
    expect(next.firstPlayerId).toBe(P2);
    expect(inst(next, kellyOf(next)).controllerId).toBe(P2);
    expect(playerOf(next, P2).playArea).toContain(kellyOf(next));
  });

  it("32066.robert-kelly-forced-interrupt: an undefended attack against his controller is dealt to Robert Kelly instead", () => {
    const after = detached();
    const { state, events } = attackPhase(after);
    const [attack] = attacks(events);
    expect(attack).toMatchObject({ enemyInstanceId: villain(state), baseAtk: 2, boostIcons: 0 });
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, kellyOf(state)).damage).toBe(2);
    // The redirected damage is Sabretooth's, not Robert Kelly's own ("Robert Kelly took 2 damage from Robert Kelly").
    const dealt = events.find((e) => e.type === "damageDealt" && e.targetInstanceId === kellyOf(state));
    expect(dealt).toMatchObject({ sourceInstanceId: villain(state) });
  });

  it("a defended attack is not redirected: the defender takes it", () => {
    const after = detached();
    const me = identityOf(after);
    const { state } = attackPhase(after, defendWith(me));
    expect(inst(state, kellyOf(state)).damage).toBe(0);
    // Spider-Man's DEF 3 absorbs the whole 2 ATK: nothing was dealt to him either.
    expect(inst(state, me).damage).toBe(0);
    // Control: undefended, the same attack goes to Robert Kelly.
    expect(inst(attackPhase(after).state, kellyOf(after)).damage).toBe(2);
  });

  it("Q4: an undefended attack against another player is not redirected, only his controller's is", () => {
    // Both players are in hero form and decline to defend: player one controls Robert Kelly, so only that attack goes
    // to him; player two's hits player two.
    const base = run(detached({ players: TWO }), { type: "endTurn", playerId: P1 }, toHero(P2));
    const first = identityOf(base, P1);
    const second = identityOf(base, P2);
    const { state, events } = villainPhase(base, fillerFor(2), firstLegal, P2);
    expect(attacks(events)).toMatchObject([
      { targetInstanceId: first, baseAtk: 2 },
      { targetInstanceId: second, baseAtk: 2 },
    ]);
    expect(inst(state, first).damage).toBe(0);
    expect(inst(state, second).damage).toBe(2);
    expect(inst(state, kellyOf(state)).damage).toBe(2);
  });

  it("while attached to Find the Senator his text box is blank: the same attack hits the player", () => {
    const base = heroGame();
    const { state } = attackPhase(base);
    expect(inst(state, identityOf(state)).damage).toBe(2);
    // Robert Kelly took only Stalked by Sabretooth's own 2.
    expect(inst(state, kellyOf(state)).damage).toBe(2);
  });

  describe("32066.robert-kelly-constant: 'cannot have player cards attached'", () => {
    const CAP = [buildCrossHeroDeck(WAVE6_CARDS, CORE_HERO_FOR_ASPECT.leadership, "10030")];
    /** Inspired (01074, Leadership upgrade): "Attach to an ally." Played onto Robert Kelly. */
    const inspiredOn = (state: GameState, deps = WAVE6_DEPS) => {
      const given = moveToHand(state, P1, "01074");
      const [card] = given.ids as [InstanceId];
      const command = play(P1, card, payWith(given.state, P1, 1, given.ids), { attachToInstanceId: kellyOf(state) });
      return applyCommand(given.state, command, deps);
    };

    it("the rule covers every player card, not upgrades alone", () => {
      expect(SABRETOOTH_ABILITIES["32066.robert-kelly-constant"].trigger).toMatchObject({
        kind: "constant",
        rules: expect.arrayContaining([{ kind: "cannotHaveAttachments", target: { self: true }, from: "playerCard" }]),
      });
    });

    it("detached and under the first player's control, a player's upgrade cannot be attached to him", () => {
      const state = detached({ players: CAP });
      expect(playerOf(state, P1).playArea).toContain(kellyOf(state));
      expect(inspiredOn(state).ok).toBe(false);
    });

    it("control: without his rule and Protect the Senator's, the same upgrade attaches", () => {
      const noRules = { ...WAVE6_DEPS, abilities: { ...WAVE6_DEPS.abilities } };
      for (const ref of ["32066.robert-kelly-constant", "32065b.protect-the-senator-constant"])
        delete (noRules.abilities as Record<string, unknown>)[ref];
      const state = detached({ players: CAP });
      const result = inspiredOn(state, noRules);
      expect(result.ok).toBe(true);
      if (result.ok) expect(inst(result.state, kellyOf(state)).attachments).toHaveLength(1);
    });

    it("attached to Find the Senator, he is no host for a player's upgrade either (32065a)", () => {
      expect(inspiredOn(heroGame({ players: CAP })).ok).toBe(false);
    });
  });
});

describe("Robert Kelly attached to Find the Senator: in play, under no player's control (32063a; docs/phase7-wave6.md §3.75)", () => {
  // RRG 1.8 "In Play and Out of Play" (p. 23): attached to a scheme in play he is in play; "Ownership and Control"
  // (p. 31): no player controls him, so he is no player's ally. Ruling Jun 25, 2026 (4) #5: "Characters not under
  // player control are not friendly characters."
  it("he is in no player's play area and has no controller", () => {
    const state = heroGame({ players: TWO });
    const kelly = kellyOf(state);
    expect(cardsInPlay(state)).toContain(kelly);
    expect(state.players.some((p) => p.playArea.includes(kelly))).toBe(false);
    expect(inst(state, kelly).controllerId).toBeNull();
    expect(inst(state, senatorOf(state)).attachments).toContain(kelly);
  });

  it("no player can attack or thwart with him", () => {
    const state = heroGame();
    const kelly = kellyOf(state);
    const attack = applyCommand(
      state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: kelly, targetInstanceId: villain(state) },
      WAVE6_DEPS,
    );
    expect(attack.ok).toBe(false);
    const thwart = applyCommand(
      state,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: kelly, schemeInstanceId: mainScheme(state) },
      WAVE6_DEPS,
    );
    expect(thwart.ok).toBe(false);
  });

  it("he is never offered as a defender", () => {
    const state = heroGame();
    const offered: string[] = [];
    const recording: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "declareDefender")
        offered.push(...s.pendingChoice.options.map((o) => o.optionId));
      return firstLegal(s);
    };
    villainPhase(state, FILLER, recording);
    expect(offered).toContain(identityOf(state));
    expect(offered).not.toContain(kellyOf(state));
  });

  it("an encounter card that names him reaches him: Stalked by Sabretooth deals him 2 damage and Sabretooth Strikes 1", () => {
    const state = hurt(sabretoothGame(), kellyOf(sabretoothGame()), 4);
    const kelly = kellyOf(state);
    // Alter-ego form: no attack, and no hero to exhaust against Sabretooth Strikes. Stalked by Sabretooth deals 2 first.
    const { state: struck } = villainPhase(state, ["01186", "01187", "32069"]);
    expect(inst(struck, kelly).damage).toBe(4 + 2 + 1);
    expect(inst(struck, kelly).attachedTo).toBe(senatorOf(struck));
  });
});

describe("Adamantium Claws (32067)", () => {
  const panther = () =>
    run(sabretoothGame({ players: [{ starterDeckId: CORE_HERO_FOR_ASPECT.protection }] }), toHero(P1));
  const toughHero = (state: GameState) =>
    patchInstance(bare(state, villain(state)), identityOf(state), {
      statuses: { ...inst(state, identityOf(state)).statuses, tough: 1 },
    });
  /** Stage 2's Robert Kelly redirect is out of the way: the attached state blanks it. */
  it("32067.adamantium-claws-constant: Sabretooth's attacks gain piercing (tough is discarded, damage dealt), and it has +1 ATK", () => {
    const base = toughHero(panther());
    const control = villainPhase(base, FILLER).state;
    expect(inst(control, identityOf(control)).damage).toBe(0);
    expect(inst(control, identityOf(control)).statuses.tough).toBe(0);
    const { state: armed } = attachToHost(base, "32067", villain(base));
    const after = villainPhase(armed, FILLER).state;
    expect(inst(after, identityOf(after)).damage).toBe(3);
    expect(inst(after, identityOf(after)).statuses.tough).toBe(0);
  });

  it("32067.adamantium-claws-action: Hero Action, spend [energy][mental][physical] -> discard this card", () => {
    const base = run(sabretoothGame(), toHero(P1));
    const { state: armed, id } = attachToHost(base, "32067", villain(base));
    const { state: stocked, ids } = handForMixedCost(armed, P1, ["energy", "mental", "physical"]);
    const after = finish(
      run(
        stocked,
        use(
          P1,
          id,
          "32067.adamantium-claws-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    );
    expect(inst(after, villain(after)).attachments).not.toContain(id);
    for (const spent of ids) expect(playerOf(after, P1).discard).toContain(spent);
  });

  it("32067.boost: as a boost card it is attached to Sabretooth", () => {
    const base = heroGame();
    const { state: after } = villainPhase(base, ["32067", "01187", "32071"]);
    const attached = inst(after, villain(after)).attachments.filter((i) => after.instances[i]!.cardId === "32067");
    expect(attached).toHaveLength(1);
  });
});

describe("Animal Ferocity (32068)", () => {
  it("32068.animal-ferocity-constant: Sabretooth gains stalwart", () => {
    const base = heroGame();
    expect(hasKeyword(base, villain(base), "stalwart", WAVE6_DEPS)).toBe(false);
    const { state: armed } = attachToHost(base, "32068", villain(base));
    expect(hasKeyword(armed, villain(armed), "stalwart", WAVE6_DEPS)).toBe(true);
  });

  it("32068.animal-ferocity-action: Hero Action, spend [energy][mental][physical] -> discard this card", () => {
    const base = heroGame();
    const { state: armed, id } = attachToHost(base, "32068", villain(base));
    const { state: stocked, ids } = handForMixedCost(armed, P1, ["energy", "mental", "physical"]);
    const after = finish(
      run(
        stocked,
        use(
          P1,
          id,
          "32068.animal-ferocity-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    );
    expect(inst(after, villain(after)).attachments).not.toContain(id);
  });

  it("32068.boost: as a boost card it is attached to Sabretooth", () => {
    const { state: after } = villainPhase(heroGame(), ["32068", "01187", "32071"]);
    const attached = inst(after, villain(after)).attachments.filter((i) => after.instances[i]!.cardId === "32068");
    expect(attached).toHaveLength(1);
  });
});

describe("Sabretooth Strikes (32069)", () => {
  const strikes = (state: GameState, pick: Picker = firstLegal) =>
    villainPhase(state, ["01186", "01187", "32069"], pick).state;
  const kellyDamage = (state: GameState) => inst(state, kellyOf(state)).damage;
  /** Stalked by Sabretooth's own 2 damage after step 1 is the baseline. */
  const STALKED = 2;

  it("32069.when-revealed: deals 1 damage to Robert Kelly (in alter-ego form there is no hero to exhaust)", () => {
    const base = sabretoothGame();
    expect(playerOf(base, P1).identity.form).toBe("alterEgo");
    expect(kellyDamage(strikes(base))).toBe(STALKED + 1);
  });

  it("32069.when-revealed: you may exhaust your hero to prevent the damage", () => {
    const base = heroGame();
    const after = strikes(base, chooseOption("0"));
    expect(kellyDamage(after)).toBe(STALKED);
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
  });

  it("32069.when-revealed: or not, and Robert Kelly takes the 1 damage with the hero left ready", () => {
    const base = heroGame();
    const after = strikes(base, chooseOption("1"));
    expect(kellyDamage(after)).toBe(STALKED + 1);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
  });

  it("32069.when-revealed: a hero already exhausted (by defending Sabretooth's attack) cannot be exhausted, so the damage is dealt", () => {
    const base = heroGame();
    const me = identityOf(base);
    const defendAndChoose: Picker = (state) =>
      state.pendingChoice?.prompt.kind === "chooseOption" ? ["0"] : defendWith(me)(state);
    expect(kellyDamage(strikes(base, defendAndChoose))).toBe(STALKED + 1);
  });

  describe("32069.boost: if this attack defeats an ally, place 2 threat on the main scheme", () => {
    const withAlly = () => {
      const base = sabretoothGame({
        players: [buildCrossHeroDeck(WAVE6_CARDS, CORE_HERO_FOR_ASPECT.leadership, "01011")],
      });
      const hero = run(base, toHero(P1));
      return playFromHandWith(WAVE6_DEPS, hero, "01011", 3);
    };
    const threatAfter = (boostCard: string) => {
      const { state, id } = withAlly();
      // Spider-Woman (HP 2) defends Sabretooth's 2 ATK and is defeated; the boost card is the only difference.
      const after = villainPhase(state, [boostCard, "01187", "32071"], defendWith(id)).state;
      expect(cardsInPlay(after)).not.toContain(id);
      return inst(after, mainScheme(after)).threat;
    };
    it("places 2 threat when the ally is defeated", () => {
      expect(threatAfter("32069")).toBe(threatAfter("01186") + 2);
    });
    it("places none when the attack defeats nothing", () => {
      const { state } = withAlly();
      const play = (boostCard: string) =>
        inst(villainPhase(state, [boostCard, "01187", "32071"]).state, mainScheme(state)).threat;
      expect(play("32069")).toBe(play("01186"));
    });
  });
});

describe("Unrelenting Savage (32070)", () => {
  const phase = (state: GameState) => villainPhase(state, ["01186", "01187", "32070", "01186", "01187"]).events;
  const schemes = (events: readonly GameEvent[]) => events.filter((e) => e.type === "schemeResolved");
  const attacks = (events: readonly GameEvent[]) => events.filter((e) => e.type === "attackResolved");

  it("32070.unrelenting-savage-constant: When Revealed (Alter-Ego): Sabretooth schemes, with +1 SCH for this activation if he has no sustained damage", () => {
    const base = sabretoothGame();
    const [, savage] = schemes(phase(base));
    expect(savage).toMatchObject({ baseSch: 2 });
    const hurtVillain = patchInstance(base, villain(base), { damage: 1 });
    expect(schemes(phase(hurtVillain))[1]).toMatchObject({ baseSch: 1 });
    // The phase's own activation is the same either way, so the bonus is for the revealed card's activation alone.
    expect(schemes(phase(hurtVillain))[0]).toMatchObject({ baseSch: 1 });
  });

  it("32070.when-revealed-hero: When Revealed (Hero): Sabretooth attacks you, with +1 ATK for this activation if he has no sustained damage", () => {
    const base = heroGame();
    const [first, savage] = attacks(phase(base));
    expect(first).toMatchObject({ baseAtk: 2 });
    expect(savage).toMatchObject({ baseAtk: 3 });
    const hurtVillain = patchInstance(base, villain(base), { damage: 1 });
    expect(attacks(phase(hurtVillain))[1]).toMatchObject({ baseAtk: 2 });
  });
});
