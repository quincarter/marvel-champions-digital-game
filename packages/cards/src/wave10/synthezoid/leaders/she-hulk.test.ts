import {
  applyCommand,
  hasKeyword,
  remainingHitPoints,
  villainStage,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { choosing } from "../../../dsl/wave10-caps-shield.testing.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking } from "../../../testing/staging.js";
import { attachToHost } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { attacksBy, codeOf, heroAttacks, heroForm, piles, schemesBy, types } from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, stagedInPlay } from "../../testing.js";
import { ungatedStageGame } from "../testing.js";
import { SYNTHEZOID_LEADERS_SHE_HULK, SYNTHEZOID_LEADERS_SHE_HULK_SKIPPED } from "./she-hulk.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * She-Hulk, the Synthezoid Smackdown registration leader (57001 to 57004) and her set (57007 to 57012), docs/
 * phase7-synthezoid.md sections 2.1, 3 M10 and 7.1. Every test is a real game in the `registration-she-hulk` scenario
 * (the pack is gated, so `ungatedStageGame` builds it) seated with the Tigra precon, and a second seat of the Core
 * Spider-Man deck where a test names two players. The cards under test are staged by surgery or stacked on the
 * encounter deck; Tigra's ally Moon Knight (cost 1, THW 2), Yellowjacket and Two-Gun Kid (cost 3) are the allies.
 */
const REFS = [
  "57001.setup",
  "57001.she-hulk-forced-response",
  "57002.when-revealed",
  "57002.she-hulk-forced-response",
  "57003.setup",
  "57003.she-hulk-forced-response",
  "57004.when-revealed",
  "57004.she-hulk-forced-response",
  "57007.superhuman-strength-forced-interrupt",
  "57007.boost",
  "57008.focused-rage-constant",
  "57008.focused-rage-forced-response",
  "57008.boost",
  "57009.when-revealed-alter-ego",
  "57009.when-revealed-hero",
  "57010.when-revealed",
  "57010.boost",
  "57011.when-revealed",
  "57012.legal-practice-constant",
  "57012.legal-practice-response",
];
const SET = ["57001", "57002", "57003", "57004", "57007", "57008", "57009", "57010", "57011", "57012"];
const STRENGTH = "57007";
const RAGE = "57008";
const PUNCH = "57009";
const STOMP = "57010";
const SLAM = "57011";
const PRACTICE = "57012";
const PRACTICE_RESPONSE = "57012.legal-practice-response";
const BLANK = "01186";
const MOON_KNIGHT = "56002";
const YELLOWJACKET = "56019";
const TWO_GUN_KID = "56010";
const AIR_COVER = "56012";
const SHE_HULK = "57001";

type Options = { readonly twoPlayers?: boolean; readonly expert?: boolean };
const open = (opts: Options = {}): GameState =>
  ungatedStageGame("registration-she-hulk", ["57005b", "57006b"], {
    twoPlayers: opts.twoPlayers ?? false,
    ...(opts.expert ? { difficulty: "expert" } : {}),
  } as never);
const heroGame = (opts: Options = {}): GameState => heroForm(open(opts), P1, ...(opts.twoPlayers ? [P2] : []));

const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p = P1): InstanceId => identityOf(s, p);
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const attachedCodes = (s: GameState): string[] => inst(s, leaderOf(s)).attachments.map((a) => codeOf(s, a));
const discardCodes = (s: GameState): string[] => piles(s).discard.map((i) => codeOf(s, i));
const deckCodes = (s: GameState): string[] => piles(s).deck.map((i) => codeOf(s, i));
const practiceOf = (s: GameState): InstanceId => s.villainArea.find((i) => codeOf(s, i) === PRACTICE)!;
const dataOf = (code: string) =>
  WAVE10_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const tough = (s: GameState, id: InstanceId): number => inst(s, id).statuses.tough;
const bare = (s: GameState): GameState =>
  patchInstance(s, leaderOf(s), { statuses: { ...inst(s, leaderOf(s)).statuses, tough: 0 } });
const exhausted = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: true });
const nothingDefends: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
/** Answers a defender prompt with this card, anything else with the first legal option. */
const defendsWith =
  (id: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "declareDefender") return firstLegal(s);
    return [choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === id)?.optionId ?? "decline"];
  };

/** Declines every defender prompt and picks this card where a choice offers it. */
const declinesAndPicks =
  (id: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return ["decline"];
    return [
      choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === id)?.optionId ?? firstLegal(s)[0]!,
    ];
  };

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then the deal). */
const villainPhase = (s: GameState, pick: Picker, ...stack: string[]) =>
  driveEventsPicking(WAVE10_DEPS, stack.length > 0 ? stackEncounterDeck(s, ...stack) : s, pick, endTurn(P1));
const revealed = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "encounterCardRevealed").map((e) => codeOf(s, e.instanceId));

describe("registry", () => {
  it("scripts the twenty refs the data names, each valid, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_LEADERS_SHE_HULK).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_LEADERS_SHE_HULK))
      expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_LEADERS_SHE_HULK_SKIPPED).toEqual({});
    const refs = WAVE10_CARDS.filter((c) => SET.includes(c.id as string)).flatMap(abilityRefIds);
    expect(refs.sort()).toEqual([...REFS].sort());
  });
});

describe("Setup (stages I and III): the enemy team finds a copy of Superhuman Strength and attaches it to She-Hulk", () => {
  it.each([
    ["standard", false],
    ["expert", true],
  ] as const)("%s: one copy is attached with no question, the other stays in the deck", (_mode, expert) => {
    const s = open({ expert });
    expect(s.pendingChoice).toBeNull();
    expect(codeOf(s, leaderOf(s))).toBe(SHE_HULK);
    // The game starts on stage I (standard) or III (expert), and that stage's Setup attached the card.
    expect(villainStage(s).stageNumber).toBe(expert ? 3 : 1);
    expect(attachedCodes(s)).toEqual([STRENGTH]);
    expect(inst(s, inst(s, leaderOf(s)).attachments[0]!).faceup).toBe(true);
    expect(deckCodes(s).filter((c) => c === STRENGTH)).toHaveLength(1);
    expect(deckCodes(s).filter((c) => c === RAGE)).toHaveLength(2);
  });
});

describe("Stages II and IV: When Revealed", () => {
  it.each([
    ["standard", 2, false, 1],
    ["standard", 2, true, 2],
    ["expert", 4, false, 1],
    ["expert", 4, true, 2],
  ] as const)(
    "%s, stage %i, %s two players: each player is dealt an encounter card",
    (_mode, stage, twoPlayers, dealtCount) => {
      const start = heroGame({ expert: stage === 4, twoPlayers });
      const defeated = defeatWithAttack(WAVE10_DEPS, stackEncounterDeck(start, RAGE, STRENGTH), leaderOf(start));
      expect(villainStage(defeated).stageNumber).toBe(stage);
      const dealtTo = defeated.players.filter((p) => p.dealtEncounter.length === 1);
      expect(dealtTo).toHaveLength(dealtCount);
      expect(defeated.players[0]!.dealtEncounter.map((i) => codeOf(defeated, i))).toEqual([RAGE]);
    },
  );

  it.each([
    ["standard", 2],
    ["expert", 4],
  ] as const)("%s, stage %i: she cannot take damage this phase, and can in the next", (mode, stage) => {
    const start = heroGame({ expert: mode === "expert" });
    const v = leaderOf(start);
    const defeated = defeatWithAttack(WAVE10_DEPS, stackEncounterDeck(start, RAGE), v);
    expect(villainStage(defeated).stageNumber).toBe(stage);
    const again = patchInstance(defeated, hero(defeated), { exhausted: false });
    const refused = applyCommand(
      again,
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero(again), targetInstanceId: v },
      WAVE10_DEPS,
    );
    expect(refused).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    const next = villainPhase(again, nothingDefends, BLANK, STRENGTH);
    const full = remainingHitPoints(next.state, v)!;
    const hit = heroAttacks(WAVE10_DEPS, patchInstance(next.state, hero(next.state), { exhausted: false }), v);
    expect(remainingHitPoints(hit.state, v)).toBeLessThan(full);
  });
});

describe("Forced Response: after an alter-ego changes to hero form, deal 1 damage to that hero", () => {
  it("changing to hero form costs the hero 1 damage", () => {
    const s = open();
    const run = driveEventsPicking(WAVE10_DEPS, s, firstLegal, toHero(P1));
    expect(damageOn(run.state, hero(s))).toBe(1);
  });

  it("changing to alter-ego form deals none", () => {
    const run = driveEventsPicking(WAVE10_DEPS, heroGame(), firstLegal, toHero(P1));
    expect(damageOn(run.state, hero(run.state))).toBe(0);
  });

  it("is any player's: the second player's change hurts their hero and no other", () => {
    const s = open({ twoPlayers: true });
    const run = driveEventsPicking(WAVE10_DEPS, s, firstLegal, endTurn(P1), toHero(P2));
    expect([damageOn(run.state, hero(s, P1)), damageOn(run.state, hero(s, P2))]).toEqual([0, 1]);
  });
});

describe("Superhuman Strength (57007)", () => {
  it("is data: +2 ATK, attaches to the villain, a boost star, two copies", () => {
    const card = dataOf(STRENGTH);
    expect([card.statModifiers, card.attachesTo, card.starIcon, card.boostIcons, card.quantityInSet]).toEqual([
      { atk: 2 },
      { kind: "villain" },
      true,
      0,
      2,
    ]);
  });

  /** Moon Knight (3 hit points, 2 damage on him) defends: with overkill 4 damage spills 3 onto Tigra. */
  const defended = () => {
    const ally = stagedInPlay(heroGame(), MOON_KNIGHT);
    return { ally: ally.id, state: patchInstance(ally.state, ally.id, { damage: 2 }) };
  };

  it("when she attacks, the attack has overkill and +2 ATK (2 + 2 = 4), and the card is discarded after it", () => {
    const { ally, state } = defended();
    const run = villainPhase(state, defendsWith(ally), BLANK, RAGE);
    expect(attacksBy(run.state, run.events, SHE_HULK)).toMatchObject([{ baseAtk: 4, damageDealt: 4 }]);
    expect(run.state.players[0]!.discard).toContain(ally);
    expect(damageOn(run.state, hero(run.state))).toBe(3);
    expect(attachedCodes(run.state)).toEqual([RAGE]);
    expect(discardCodes(run.state)).toContain(STRENGTH);
  });

  it("without the card the same attack has no overkill: the excess is lost (control)", () => {
    const { ally, state } = defended();
    const none = patchInstance(state, leaderOf(state), { attachments: [] });
    const run = villainPhase(none, defendsWith(ally), BLANK, RAGE);
    expect(run.state.players[0]!.discard).toContain(ally);
    expect(damageOn(run.state, hero(run.state))).toBe(0);
  });

  it("the card stays on her until she attacks (a scheme does not discard it)", () => {
    const run = villainPhase(open(), firstLegal, BLANK, RAGE);
    expect(schemesBy(run.state, run.events, SHE_HULK)).toHaveLength(1);
    expect(attachedCodes(run.state)).toEqual([STRENGTH, RAGE]);
  });

  it("[star] Boost: revealed from the boost card it attaches to her", () => {
    const run = villainPhase(heroGame(), nothingDefends, STRENGTH, RAGE);
    expect(attacksBy(run.state, run.events, SHE_HULK)).toHaveLength(1);
    expect(attachedCodes(run.state)).toContain(STRENGTH);
  });
});

describe("Focused Rage (57008)", () => {
  const withRage = (s: GameState): GameState => attachToHost(s, RAGE, leaderOf(s)).state;

  it("is data: +1 SCH, a boost star, two copies", () => {
    const card = dataOf(RAGE);
    expect([card.statModifiers, card.starIcon, card.boostIcons, card.quantityInSet]).toEqual([{ sch: 1 }, true, 0, 2]);
  });

  it("She-Hulk gains stalwart while it is attached, and not before", () => {
    const s = open();
    expect(hasKeyword(s, leaderOf(s), "stalwart", WAVE10_DEPS)).toBe(false);
    const raged = withRage(s);
    expect(hasKeyword(raged, leaderOf(raged), "stalwart", WAVE10_DEPS)).toBe(true);
  });

  it("after she schemes, the card is discarded (and she loses stalwart)", () => {
    const run = villainPhase(withRage(open()), firstLegal, BLANK, STRENGTH);
    expect(schemesBy(run.state, run.events, SHE_HULK)).toHaveLength(1);
    expect(attachedCodes(run.state)).toEqual([STRENGTH, STRENGTH]);
    expect(discardCodes(run.state)).toContain(RAGE);
    expect(hasKeyword(run.state, leaderOf(run.state), "stalwart", WAVE10_DEPS)).toBe(false);
  });

  it("an attack leaves it attached (control)", () => {
    const run = villainPhase(withRage(heroGame()), nothingDefends, BLANK, STRENGTH);
    expect(attacksBy(run.state, run.events, SHE_HULK)).toHaveLength(1);
    expect(attachedCodes(run.state)).toContain(RAGE);
  });

  it("[star] Boost: revealed from the boost card it attaches to her", () => {
    const run = villainPhase(heroGame(), nothingDefends, RAGE, STRENGTH);
    expect(attachedCodes(run.state)).toContain(RAGE);
  });
});

describe("One-Two Punch (57009)", () => {
  it("alter-ego: She-Hulk schemes again and gets a tough status card", () => {
    const run = villainPhase(bare(open()), firstLegal, BLANK, PUNCH);
    expect(schemesBy(run.state, run.events, SHE_HULK)).toHaveLength(2);
    expect(attacksBy(run.state, run.events, SHE_HULK)).toHaveLength(0);
    expect(tough(run.state, leaderOf(run.state))).toBe(1);
  });

  it("hero: She-Hulk attacks you again and gets a tough status card", () => {
    const run = villainPhase(bare(heroGame()), nothingDefends, BLANK, PUNCH);
    expect(attacksBy(run.state, run.events, SHE_HULK)).toHaveLength(2);
    expect(schemesBy(run.state, run.events, SHE_HULK)).toHaveLength(0);
    expect(tough(run.state, leaderOf(run.state))).toBe(1);
  });
});

describe("One-Two Punch with the She-Hulk hero seated", () => {
  it("it is the leader who schemes and gets the tough card, not the hero of the same name", () => {
    const base = ungatedStageGame("registration-she-hulk", ["57005b", "57006b"], {
      starterDeckId: "core-she-hulk-aggression",
    } as never);
    const run = villainPhase(bare(base), firstLegal, BLANK, PUNCH);
    expect(schemesBy(run.state, run.events, SHE_HULK)).toHaveLength(2);
    expect(tough(run.state, leaderOf(run.state))).toBe(1);
    expect(tough(run.state, hero(run.state))).toBe(0);
  });
});

describe("Ground Stomp (57010)", () => {
  it("exhausts each character you control (the hero and the ally) and gains no surge", () => {
    const ally = stagedInPlay(heroGame(), MOON_KNIGHT);
    const run = villainPhase(ally.state, nothingDefends, BLANK, STOMP, RAGE);
    const exhaustedIds = types(run.events, "cardExhausted").map((e) => e.instanceId);
    expect(exhaustedIds).toEqual(expect.arrayContaining([hero(run.state), ally.id]));
    expect(revealed(run.state, run.events)).toEqual([STOMP]);
  });

  it("with no character left to exhaust it gains surge: the next card is revealed", () => {
    // Players ready at the end of the player phase, so the boost card's own Stomp exhausts the hero first.
    const run = villainPhase(heroGame(), nothingDefends, STOMP, STOMP, RAGE);
    expect(revealed(run.state, run.events)).toEqual([STOMP, RAGE]);
  });

  it("[star] Boost: only a ready character can be chosen (the defending hero is already exhausted)", () => {
    const ally = stagedInPlay(heroGame(), MOON_KNIGHT);
    const offered: string[][] = [];
    let defended = false;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") {
        const mine = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === hero(s));
        if (!defended && mine) {
          defended = true;
          return [mine.optionId];
        }
        return ["decline"];
      }
      if (choice.options.some((o) => o.ref.kind === "card" && o.ref.instanceId === ally.id)) {
        offered.push(choice.options.map((o) => (o.ref.kind === "card" ? o.ref.instanceId : "")));
      }
      return firstLegal(s);
    };
    // Her first attack is defended by the hero (exhausting it); One-Two Punch attacks again with Ground Stomp as boost.
    const run = villainPhase(bare(ally.state), pick, BLANK, PUNCH, STOMP);
    expect(offered).toHaveLength(1);
    expect(offered[0]).toContain(ally.id);
    expect(offered[0]).not.toContain(hero(run.state));
    expect(types(run.events, "cardExhausted").map((e) => e.instanceId)).toContain(ally.id);
  });

  it("[star] Boost: exhausts a character you control", () => {
    const run = villainPhase(heroGame(), nothingDefends, STOMP, STRENGTH);
    expect(types(run.events, "cardExhausted").map((e) => e.instanceId)).toContain(hero(run.state));
  });
});

describe("Gamma Slam (57011)", () => {
  const dealt = (s: GameState, card: string, pick: Picker = firstLegal) => villainPhase(s, pick, BLANK, card, RAGE);
  /** The threat Gamma Slam added: the main scheme after it against the same phase with a blank card instead. */
  const added = (s: GameState, pick: Picker = firstLegal): number =>
    mainThreat(dealt(s, SLAM, pick).state) - mainThreat(dealt(s, STRENGTH).state);

  it("discards the highest-cost ally or support you control and places that much threat on the main scheme", () => {
    const low = stagedInPlay(heroGame(), MOON_KNIGHT);
    const both = stagedInPlay(low.state, YELLOWJACKET);
    const run = dealt(both.state, SLAM);
    expect(run.state.players[0]!.discard).toContain(both.id);
    expect(run.state.players[0]!.playArea).toContain(low.id);
    expect(added(both.state)).toBe(3);
    expect(revealed(run.state, run.events)).toEqual([SLAM]);
  });

  it("a support counts and the cost is its own (Air Cover, cost 1, alone)", () => {
    const support = stagedInPlay(heroGame(), AIR_COVER);
    const run = dealt(support.state, SLAM);
    expect(run.state.players[0]!.discard).toContain(support.id);
    expect(added(support.state)).toBe(1);
  });

  it("a tie for highest cost is the player's to break", () => {
    const a = stagedInPlay(heroGame(), YELLOWJACKET);
    const b = stagedInPlay(a.state, TWO_GUN_KID);
    const run = dealt(b.state, SLAM, declinesAndPicks(b.id));
    expect(run.state.players[0]!.discard).toContain(b.id);
    expect(run.state.players[0]!.playArea).toContain(a.id);
    expect(added(b.state, declinesAndPicks(b.id))).toBe(3);
  });

  it("with P2 revealing it, the tie is broken by the first player (P1), not by P2 (RRG 1.8 'First Player', p. 19)", () => {
    const a = stagedInPlay(heroGame({ twoPlayers: true }), YELLOWJACKET);
    const b = stagedInPlay(a.state, TWO_GUN_KID);
    // Both allies handed to P2's play area and control, so P2 reveals Gamma Slam with two tied candidates.
    const moved = [a.id, b.id].reduce(
      (acc, id) =>
        patchInstance(
          {
            ...acc,
            players: acc.players.map((p) =>
              p.playerId === P1
                ? { ...p, playArea: p.playArea.filter((i) => i !== id) }
                : { ...p, playArea: [...p.playArea, id] },
            ),
          },
          id,
          { controllerId: P2, home: { kind: "playArea", playerId: P2 } } as never,
        ),
      b.state,
    );
    const askedBy: string[] = [];
    const pick: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "declareDefender") return ["decline"];
      const wanted = s.pendingChoice!.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === b.id);
      if (wanted) askedBy.push(s.pendingChoice!.playerId as string);
      return wanted ? [wanted.optionId] : firstLegal(s);
    };
    // P1 is dealt the first card, P2 the Slam.
    const run = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(moved, BLANK, BLANK, RAGE, SLAM),
      pick,
      endTurn(P1),
      endTurn(P2),
    );
    expect(askedBy).toEqual([P1]);
    expect(types(run.events, "cardDiscardedFromPlay").map((e) => e.instanceId)).toContain(b.id);
    expect(run.state.players[1]!.playArea).toContain(a.id);
  });

  it("with no ally or support it places nothing and gains surge", () => {
    const run = dealt(heroGame(), SLAM);
    expect(revealed(run.state, run.events)).toEqual([SLAM, RAGE]);
    expect(added(heroGame())).toBe(0);
  });
});

describe("Legal Practice (57012): M10", () => {
  it("is data: 3 threat per player, acceleration, and the Setup reveals it", () => {
    const card = dataOf(PRACTICE);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons]).toEqual([
      "side_scheme",
      { base: 0, perPlayer: 3 },
      ["acceleration"],
      3,
    ]);
    const s = open({ twoPlayers: true });
    expect(inst(s, practiceOf(s)).threat).toBe(6);
  });

  const thwart = (s: GameState, thwarter: InstanceId) =>
    applyCommand(
      s,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: thwarter, schemeInstanceId: practiceOf(s) },
      WAVE10_DEPS,
    );

  it("heroes and allies cannot remove its threat, and the alter-ego response does, together", () => {
    // Hero form: Tigra's basic thwart is refused, and so is Moon Knight's (THW 2).
    const ally = stagedInPlay(heroGame(), MOON_KNIGHT);
    expect(thwart(ally.state, hero(ally.state)).ok).toBe(false);
    expect(thwart(ally.state, ally.id).ok).toBe(false);
    expect(inst(ally.state, practiceOf(ally.state)).threat).toBe(3);

    // Changing to alter-ego form offers the response: exhaust the identity, remove 3 threat.
    const run = driveEventsPicking(WAVE10_DEPS, ally.state, choosing({ accept: [PRACTICE_RESPONSE] }), toHero(P1));
    expect(types(run.events, "threatRemoved").map((e) => e.amount)).toEqual([3]);
    expect(inst(run.state, hero(run.state)).exhausted).toBe(true);
    expect(run.state.players[0]!.identity.form).toBe("alterEgo");
  });

  it("the response removes exactly 3 from a larger pile and leaves the rest", () => {
    const s = heroGame();
    const run = driveEventsPicking(
      WAVE10_DEPS,
      patchInstance(s, practiceOf(s), { threat: 5 }),
      choosing({ accept: [PRACTICE_RESPONSE] }),
      toHero(P1),
    );
    expect(inst(run.state, practiceOf(run.state)).threat).toBe(2);
  });

  it("the response is not offered with the identity exhausted, nor after changing to hero form", () => {
    const s = heroGame();
    const tired = driveEventsPicking(
      WAVE10_DEPS,
      exhausted(s, hero(s)),
      choosing({ accept: [PRACTICE_RESPONSE] }),
      toHero(P1),
    );
    expect(inst(tired.state, practiceOf(tired.state)).threat).toBe(3);
    const toHeroForm = driveEventsPicking(WAVE10_DEPS, open(), choosing({ accept: [PRACTICE_RESPONSE] }), toHero(P1));
    expect(inst(toHeroForm.state, practiceOf(toHeroForm.state)).threat).toBe(3);
  });
});
