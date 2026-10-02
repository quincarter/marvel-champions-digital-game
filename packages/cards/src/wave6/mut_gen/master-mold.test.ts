import {
  activeEncounterDeckId,
  activeVillain,
  cardsInPlay,
  characterProfile,
  hasKeyword,
  keywordTotal,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { MASTER_MOLD_ABILITIES } from "./master-mold.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { attachToHost } from "./project-wideawake-testing.js";
import { inPlay, masterMoldGame } from "./master-mold-testing.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const finish = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, WAVE6_DEPS);
const villain = (state: GameState) => activeVillain(state).instanceId;
const mainScheme = (state: GameState) => state.mainScheme.instanceId;
const deckOf = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!;
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const traitsOf = (state: GameState, id: InstanceId) =>
  ((state.cardPool[state.instances[id]!.cardId] as { traits?: readonly string[] }).traits ?? []).map(String);
/** The Sentinel minions in play (the "minion" category: a Sentinel villain is not one). */
const sentinelMinions = (state: GameState) =>
  cardsInPlay(state).filter((id) => state.cardPool[state.instances[id]!.cardId]!.type === "minion");
const bare = (state: GameState, id: InstanceId) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });
/** The villain's stage (0 = Master Mold I, or II in expert; 1 = II, or III in expert), by state surgery. */
const atVillainStage = (state: GameState, stageIndex: number): GameState => ({
  ...state,
  villains: state.villains.map((v) => (v.instanceId === villain(state) ? { ...v, stageIndex } : v)),
});
/** Takes every minion out of play (to the encounter discard pile), so a test starts with none engaged. */
function withoutMinions(state: GameState): GameState {
  const gone = sentinelMinions(state);
  const deckId = activeEncounterDeckId(state);
  const pile = deckOf(state);
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !gone.includes(i)) })),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...gone] } },
  };
}
const withoutAbilities = (...ids: string[]): EngineDeps => ({
  ...WAVE6_DEPS,
  abilities: Object.fromEntries(Object.entries(WAVE6_DEPS.abilities).filter(([id]) => !ids.includes(id))),
});
/** One villain phase from the end of `ends`' turns, the main scheme kept clear of its target so it does not advance. */
const phase = (state: GameState, top: readonly string[], deps: EngineDeps = WAVE6_DEPS, ...ends: PlayerId[]) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(patchInstance(state, mainScheme(state), { threat: 0 }), ...top),
    firstLegal,
    ...(ends.length ? ends : [P1]).map((playerId) => ({ type: "endTurn" as const, playerId })),
  );
/** Hero form: Master Mold attacks (it takes a boost card, the filler 01186), then `rest` is dealt to the player. */
const heroGame = (options: Parameters<typeof masterMoldGame>[0] = {}) => run(masterMoldGame(options), toHero(P1));
const heroPhase = (state: GameState, ...rest: string[]) => phase(state, ["01186", ...rest]);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const movedTo = (events: readonly GameEvent[], id: InstanceId, kind: string) =>
  of(events, "cardMoved").some((e) => e.instanceId === id && e.to.kind === kind);

describe("registry", () => {
  it("registers every ability ref of the Master Mold scenario set", () => {
    expect(Object.keys(MASTER_MOLD_ABILITIES).sort()).toEqual(
      [
        "32109.master-mold-forced-interrupt",
        "32110.master-mold-forced-interrupt",
        "32111.master-mold-forced-interrupt",
        "32112a.setup",
        "32112b.the-sentinel-factory-constant",
        "32112b.when-revealed",
        "32113a.when-revealed",
        "32113b.master-molds-agenda-constant",
        "32115.unit-upgrade-constant",
        "32115.unit-upgrade-constant-2",
        "32115.boost",
        "32116.stun-beam-constant",
        "32116.stun-beam-forced-response",
        "32117.when-revealed-alter-ego",
        "32117.when-revealed-hero",
        "32118.when-revealed",
        "32118.boost",
        "32119.when-defeated",
        "32120.when-defeated",
      ].sort(),
    );
  });
});

describe("The Sentinel Factory (32112a/b) and Master Mold's Agenda (32113a/b)", () => {
  it("32112a.setup: Magneto (172B) is in play under the first player's control and no longer set aside", () => {
    const state = masterMoldGame();
    const [magneto] = inPlay(state, "32172b");
    expect(magneto).toBeDefined();
    expect(inst(state, magneto!).controllerId).toBe(P1);
    expect(state.encounterSetAside.filter((id) => codeOf(state, id) === "32172b")).toEqual([]);
  });

  it("32112b.when-revealed: each player puts one Sentinel minion into play engaged with them, from the encounter deck", () => {
    const one = masterMoldGame();
    expect(sentinelMinions(one)).toHaveLength(1);
    expect(traitsOf(one, sentinelMinions(one)[0]!)).toContain("SENTINEL");
    expect(inst(one, sentinelMinions(one)[0]!).engagedWith).toBe(P1);
    const two = masterMoldGame({ players: TWO });
    const engaged = sentinelMinions(two).map((id) => inst(two, id).engagedWith);
    expect(engaged.sort()).toEqual([P1, P2]);
  });

  it("32112b.the-sentinel-factory-constant: each Sentinel minion gains guard (a Sentinel villain is not a minion)", () => {
    const state = masterMoldGame();
    expect(hasKeyword(state, sentinelMinions(state)[0]!, "guard", WAVE6_DEPS)).toBe(true);
    expect(hasKeyword(state, villain(state), "guard", WAVE6_DEPS)).toBe(false);
  });

  describe("stage 2 (Master Mold's Agenda)", () => {
    // The villain phase's own threat placement (1 per player) takes the scheme from one short of its target (6 per player) to it.
    const advanced = (state: GameState, discardFirst: readonly string[] = []) => {
      const deckId = activeEncounterDeckId(state);
      const pile = deckOf(state);
      const moved = discardFirst.flatMap((code) => pile.deck.filter((id) => codeOf(state, id) === code).slice(0, 1));
      const staged: GameState = {
        ...state,
        encounterDecks: {
          ...state.encounterDecks,
          [deckId]: { deck: pile.deck.filter((id) => !moved.includes(id)), discard: [...pile.discard, ...moved] },
        },
      };
      // Alter-ego form and without Master Mold's own interrupt, so the Sentinel minions the stage deals are the only change.
      return driveEventsPicking(
        withoutAbilities("32109.master-mold-forced-interrupt"),
        patchInstance(staged, mainScheme(staged), { threat: 6 * staged.players.length - 1 }),
        firstLegal,
        ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })),
      );
    };

    it("32113a.when-revealed: shuffles the encounter discard pile into the deck, then each player puts a Sentinel minion into play engaged with them", () => {
      const state = masterMoldGame({ players: TWO });
      const before = sentinelMinions(state).length;
      // Both Mark V (32105) are in the deck; one sits in the discard pile, so only the shuffle can bring it back.
      const { state: after, events } = advanced(state, ["32105"]);
      expect(inst(after, mainScheme(after)).cardId).toBe(cardId("32112a"));
      expect(after.mainScheme.stageIndex).toBe(1);
      const discarded = of(events, "cardMoved").find(
        (e) => codeOf(state, e.instanceId) === "32105" && e.from.kind === "encounterDiscard",
      );
      expect(discarded?.to.kind).toBe("encounterDeck");
      expect(sentinelMinions(after)).toHaveLength(before + 2);
      for (const player of [P1, P2]) {
        const engagedWith = (s: GameState) => sentinelMinions(s).filter((id) => inst(s, id).engagedWith === player);
        expect(engagedWith(after)).toHaveLength(engagedWith(state).length + 1);
      }
    });

    it("32113b.master-molds-agenda-constant: each Sentinel minion still gains guard at stage 2", () => {
      const { state: after } = advanced(masterMoldGame());
      expect(after.mainScheme.stageIndex).toBe(1);
      for (const id of sentinelMinions(after)) expect(hasKeyword(after, id, "guard", WAVE6_DEPS)).toBe(true);
    });
  });
});

describe("Master Mold (32109-32111)", () => {
  /** Alter-ego form: Master Mold schemes against P1. The deck's top card is the Sentinel the interrupt finds. */
  const schemes = (state: GameState, ...top: string[]) => phase(state, ["32105", ...top]);
  const forVillainStage = (stageIndex: number, ability: string, options: Parameters<typeof masterMoldGame>[0] = {}) =>
    it(`${ability}: discards until a Sentinel minion, puts it into play engaged with you and gives Master Mold no boost card`, () => {
      // No minion at the start (so nothing but Master Mold and the new minion places threat and the scheme stays at stage 1).
      const base = atVillainStage(withoutMinions(masterMoldGame(options)), stageIndex);
      // Two Sentinel-free cards sit above the Sentinel: both are discarded, the card after it is what the player is dealt.
      const { state, events } = phase(base, ["01187", "01188", "32105", "01189"]);
      const mm = villain(base);
      expect(of(events, "abilityResolved").some((e) => e.instanceId === mm && e.abilityId === ability)).toBe(true);
      const mark = sentinelMinions(state).find((id) => codeOf(state, id) === "32105")!;
      expect(mark).toBeDefined();
      expect(inst(state, mark).engagedWith).toBe(P1);
      expect(movedTo(events, mark, "encounterDiscard")).toBe(true);
      // No boost card for the activation: withheld, nothing dealt to Master Mold, no boost icons on its scheme.
      expect(of(events, "boostWithheld")).toEqual([
        { type: "boostWithheld", enemyInstanceId: mm, activation: "scheme" },
      ]);
      expect(of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === mm)).toEqual([]);
      expect(of(events, "schemeResolved").find((e) => e.enemyInstanceId === mm)!.boostIcons).toBe(0);
      // The encounter deck is otherwise unchanged: 01187 and 01188 were discarded by the interrupt, 01189 is dealt.
      const dealt = of(events, "cardMoved").find((e) => e.to.kind === "dealtEncounter")!;
      expect(codeOf(state, dealt.instanceId)).toBe("01189");
      expect(movedTo(events, dealt.instanceId, "boost")).toBe(false);
    });
  forVillainStage(0, "32109.master-mold-forced-interrupt");
  forVillainStage(1, "32110.master-mold-forced-interrupt");
  forVillainStage(2, "32111.master-mold-forced-interrupt");
  // Expert mode starts at Master Mold (II): 32110 is the stage the villain is already on.
  forVillainStage(1, "32110.master-mold-forced-interrupt", { difficulty: "expert" });
  it("expert mode starts on Master Mold (II), and standard mode on (I)", () => {
    expect(activeVillain(masterMoldGame({ difficulty: "expert" })).stageIndex).toBe(1);
    expect(activeVillain(masterMoldGame()).stageIndex).toBe(0);
  });

  it("the minion that enters play activates as normal after Master Mold (MC32 p. 12)", () => {
    const { events } = schemes(masterMoldGame());
    const activated = of(events, "enemyActivated").map((e) => e.enemyInstanceId);
    const mm = activated[0]!;
    expect(activated.length).toBeGreaterThanOrEqual(3);
    expect(activated.slice(1).every((id) => id !== mm)).toBe(true);
  });

  it("is a Sentinel interrupt against the player it schemes against: with two players each gets their own minion", () => {
    const base = masterMoldGame({ players: TWO });
    const before = sentinelMinions(base);
    const { state, events } = phase(base, ["32105", "32106", "01187", "01188", "01189"], WAVE6_DEPS, P1, P2);
    const entered = sentinelMinions(state).filter((id) => !before.includes(id));
    const owners = entered.map((id) => [codeOf(state, id), inst(state, id).engagedWith] as const);
    expect(owners).toContainEqual(["32105", P1]);
    expect(owners).toContainEqual(["32106", P2]);
    expect(of(events, "boostWithheld")).toHaveLength(2);
  });

  it("does nothing when Master Mold attacks (a hero in hero form): no Sentinel enters play and it is dealt its boost card", () => {
    const base = heroGame();
    const before = sentinelMinions(base);
    const { state, events } = heroPhase(base, "32120", "01187");
    const mm = villain(base);
    expect(sentinelMinions(state)).toEqual(before);
    expect(of(events, "boostWithheld")).toEqual([]);
    expect(of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === mm)).toHaveLength(1);
    expect(of(events, "abilityResolved").some((e) => e.abilityId === "32109.master-mold-forced-interrupt")).toBe(false);
  });
});

describe("Unit Upgrade (32115)", () => {
  it("32115.unit-upgrade-constant-2: attached to a Sentinel minion it gets +2 hit points and gains retaliate 1 (+1 ATK/+1 SCH are data)", () => {
    const base = heroGame();
    const [minion] = sentinelMinions(base);
    const plain = characterProfile(base, minion!, WAVE6_DEPS)!;
    expect(keywordTotal(base, minion!, "retaliate", WAVE6_DEPS)).toBe(0);
    const { state: armed } = attachToHost(base, "32115", minion!);
    const upgraded = characterProfile(armed, minion!, WAVE6_DEPS)!;
    expect(upgraded.maxHp).toBe(plain.maxHp + 2);
    expect(upgraded.atk).toBe(plain.atk! + 1);
    expect(upgraded.sch).toBe(plain.sch! + 1);
    expect(keywordTotal(armed, minion!, "retaliate", WAVE6_DEPS)).toBe(1);
  });

  it("32115.unit-upgrade-constant: revealed, it attaches to the Sentinel minion engaged with you and does not surge", () => {
    const { state, events } = heroPhase(heroGame(), "32115", "32120");
    const attached = sentinelMinions(state)
      .flatMap((id) => inst(state, id).attachments)
      .filter((id) => codeOf(state, id) === "32115");
    expect(attached).toHaveLength(1);
    // No surge: the card after it (Insert Virus Program) stays in the deck, not revealed.
    expect(inPlay(state, "32120")).toEqual([]);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32115"]);
  });

  it("32115.unit-upgrade-constant: with no Sentinel minion to attach to, this card gains surge", () => {
    const base = withoutMinions(heroGame());
    const { state, events } = heroPhase(base, "32115", "32120");
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32115", "32120"]);
    expect(inPlay(state, "32115")).toEqual([]);
    expect(inPlay(state, "32120")).toHaveLength(1);
  });

  it("32115.boost: a boost card attaches to a Sentinel minion, not the discard pile", () => {
    const base = heroGame();
    const { state } = phase(base, ["32115", "01187"]);
    const attached = sentinelMinions(state)
      .flatMap((id) => inst(state, id).attachments)
      .filter((id) => codeOf(state, id) === "32115");
    expect(attached).toHaveLength(1);
    expect(deckOf(state).discard.filter((id) => codeOf(state, id) === "32115")).toEqual([]);
  });
});

describe("Stun Beam (32116)", () => {
  it("32116.stun-beam-constant: attaches to a Sentinel minion without Stun Beam (+1 ATK is data)", () => {
    const base = heroGame();
    const [minion] = sentinelMinions(base);
    const plain = characterProfile(base, minion!, WAVE6_DEPS)!;
    const { state, events } = heroPhase(base, "32116", "32120");
    const host = sentinelMinions(state).find((id) =>
      inst(state, id).attachments.some((a) => codeOf(state, a) === "32116"),
    )!;
    expect(host).toBe(minion);
    expect(characterProfile(state, host, WAVE6_DEPS)!.atk).toBe(plain.atk! + 1);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32116"]);
  });

  it("32116.stun-beam-constant: when every Sentinel minion already has a Stun Beam, the new one gains surge", () => {
    const base = heroGame();
    const { state: armed } = attachToHost(base, "32116", sentinelMinions(base)[0]!);
    const { state, events } = heroPhase(armed, "32116", "32120");
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32116", "32120"]);
    // Only the Stun Beam that was already attached is in play; the revealed one went to the discard pile.
    expect(inPlay(state, "32116")).toHaveLength(1);
    expect(deckOf(state).discard.filter((id) => codeOf(state, id) === "32116")).toHaveLength(1);
    expect(inPlay(state, "32120")).toHaveLength(1);
  });

  it("32116.stun-beam-forced-response: after the attached minion attacks and damages a character, stun that character", () => {
    const base = heroGame();
    const { state: armed } = attachToHost(base, "32116", sentinelMinions(base)[0]!);
    const { state } = phase(armed, ["01186", "01187", "32120"]);
    // Master Mold also attacked and damaged Spider-Man, but only the minion's attack carries a Stun Beam.
    expect(inst(state, identityOf(state)).statuses.stunned).toBe(1);
    expect(inst(state, identityOf(state)).damage).toBeGreaterThan(0);
  });

  it("32116.stun-beam-forced-response: a minion without Stun Beam stuns nobody", () => {
    const { state } = phase(heroGame(), ["01186", "01187", "32120"]);
    expect(inst(state, identityOf(state)).damage).toBeGreaterThan(0);
    expect(inst(state, identityOf(state)).statuses.stunned).toBe(0);
  });
});

describe("Master Mold's Children (32117)", () => {
  /** Counts the scheme/attack activations that happen after the Children is revealed. */
  const activationsAfterReveal = (events: readonly GameEvent[], kind: "scheme" | "attack") => {
    const revealedAt = events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === "32117");
    expect(revealedAt).toBeGreaterThan(-1);
    const after = events.slice(revealedAt);
    return kind === "scheme" ? of(after, "schemeResolved") : of(after, "attackResolved");
  };

  it("32117.when-revealed-alter-ego: each minion engaged with you schemes", () => {
    // Without the Master Mold interrupt, so the only minion engaged is the one the Sentinel Factory put into play.
    const deps = withoutAbilities("32109.master-mold-forced-interrupt");
    const base = masterMoldGame();
    const [minion] = sentinelMinions(base);
    const { events } = phase(base, ["01186", "32117"], deps);
    const schemes = activationsAfterReveal(events, "scheme");
    expect(schemes.map((e) => e.enemyInstanceId)).toEqual([minion]);
  });

  it("32117.when-revealed-alter-ego: with no minion engaged with you, Master Mold schemes", () => {
    const deps = withoutAbilities("32109.master-mold-forced-interrupt");
    const { events } = phase(withoutMinions(masterMoldGame()), ["01186", "32117"], deps);
    const schemes = activationsAfterReveal(events, "scheme");
    expect(schemes).toHaveLength(1);
    expect(schemes[0]!.enemyInstanceId).toBe(villain(masterMoldGame()));
  });

  it("32117.when-revealed-hero: each minion engaged with you attacks you", () => {
    const base = heroGame();
    const [minion] = sentinelMinions(base);
    const { events } = heroPhase(base, "32117");
    const attacks = activationsAfterReveal(events, "attack");
    expect(attacks.map((e) => e.enemyInstanceId)).toEqual([minion]);
  });

  it("32117.when-revealed-hero: with no minion engaged with you, Master Mold attacks you", () => {
    const base = withoutMinions(heroGame());
    const { events } = heroPhase(base, "32117");
    const attacks = activationsAfterReveal(events, "attack");
    expect(attacks.map((e) => e.enemyInstanceId)).toEqual([villain(base)]);
  });
});

describe("Shields Up (32118)", () => {
  it("32118.when-revealed: gives each Sentinel minion engaged with you a tough status card, and does not surge", () => {
    const base = heroGame();
    const [minion] = sentinelMinions(base);
    expect(inst(base, minion!).statuses.tough).toBe(0);
    const { state, events } = heroPhase(base, "32118", "32120");
    expect(inst(state, minion!).statuses.tough).toBe(1);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32118"]);
  });

  it("32118.when-revealed: otherwise (no Sentinel minion engaged with you) this card gains surge", () => {
    const { state, events } = heroPhase(withoutMinions(heroGame()), "32118", "32120");
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32118", "32120"]);
    expect(inPlay(state, "32120")).toHaveLength(1);
  });

  it("32118.when-revealed: a minion that already has a tough status card is given none, so it gains surge", () => {
    const base = heroGame();
    const [minion] = sentinelMinions(base);
    const tough = patchInstance(base, minion!, { statuses: { ...inst(base, minion!).statuses, tough: 1 } });
    const { state, events } = heroPhase(tough, "32118", "32120");
    expect(inst(state, minion!).statuses.tough).toBe(1);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(["32118", "32120"]);
  });

  it("32118.boost: the villain is given a tough status card", () => {
    const base = bare(heroGame(), villain(heroGame()));
    expect(inst(base, villain(base)).statuses.tough).toBe(0);
    const { state } = phase(base, ["32118", "01187"]);
    expect(inst(state, villain(state)).statuses.tough).toBe(1);
  });
});

describe("Intruder Alert! (32119)", () => {
  it("32119.when-defeated: the player who defeated it discards until a Sentinel minion and puts it into play engaged with them", () => {
    const base = heroGame({ players: TWO });
    const staged = encounterCardInVillainArea(base, "32119", 1);
    const before = sentinelMinions(staged.state);
    const top = stackEncounterDeck(staged.state, "01187", "32106");
    const after = finish(
      run(top, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(top),
        schemeInstanceId: staged.id,
      }),
    );
    expect(inPlay(after, "32119")).toEqual([]);
    const entered = sentinelMinions(after).filter((id) => !before.includes(id));
    expect(entered.map((id) => codeOf(after, id))).toEqual(["32106"]);
    expect(inst(after, entered[0]!).engagedWith).toBe(P1);
  });
});

describe("Insert Virus Program (32120)", () => {
  it("32120.when-defeated: deals 2 damage to each Sentinel enemy (Master Mold and the minions), and no one else", () => {
    const base = bare(heroGame(), villain(heroGame()));
    const staged = encounterCardInVillainArea(base, "32120", 1);
    const after = finish(
      run(staged.state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(staged.state),
        schemeInstanceId: staged.id,
      }),
    );
    expect(inst(after, villain(after)).damage).toBe(2);
    for (const id of sentinelMinions(after)) expect(inst(after, id).damage).toBe(2);
    expect(inst(after, identityOf(after)).damage).toBe(0);
  });
});
