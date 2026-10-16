import { HERCULES_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  characterProfile,
  createGame,
  keywordTotal,
  locateCard,
  separateDeckOf,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { GIFT, drive } from "../../../dsl/wave10-labor.testing.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { codeOf } from "../../../wave9/testing.js";
import {
  CORE_SPIDER_MAN,
  HERCULES_DECK,
  HERO_PACK_CARDS,
  WAVE10_DEPS,
  engageMinion,
  heroPackSeat,
  herculesHeroGame,
  stagedInPlay,
} from "../../testing.js";
import {
  HERCULES_SUPPORT_UPGRADES_ALLIES,
  HERCULES_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Hercules's ally, support and upgrades (59008 Amadeus Cho, 59012 Olympus, 59013 Gauntlets of Hercules, 59014 Golden
 * Mace, 59015 Herc's Helm, 59016 Lion of Olympus, 59017 Prince of Power), docs/phase7-wave10-hero-packs.md H3.8, H3.9,
 * H3.21 and H8.4 line HS12, in real games against Core's Rhino with the hand-built Leadership deck `HERCULES_DECK`.
 *
 * Sources: February 8, 2026 - Ruling 2 (Golden Mace and Prince of Power against a 3-hit-point minion that reduces damage
 * taken by 1, with three Gift cards: 6 dealt, 5 taken, 2 overkill to the villain, 3 healed; the test uses Thumbelina and
 * the ruling's numbers, but heals 2: RRG 1.8 p. 31 supersedes the heal under the user's order of rules authority); RRG 1.8 "Attacks Against Allies" (p. 10), "Defend, Defense" (p. 15), "Keywords" (p. 25), "Overkill"
 * (p. 31), "Retaliate".
 *
 * How a game gets its Gift cards: they are arranged with the staging the Gift and Labor tests use (`withGift`: the card
 * taken out of the Gift deck and attached to the identity under the player's control), since each count (1 to 3) would
 * need that many Labor cards finished, one per phase; Atonement and the real route are proved in `identity.test.ts`
 * and `gift-labor.test.ts`. The upgrades and the ally are staged straight into play (`stagedInPlay`), their ability
 * is then used for real. Enemy attacks happen in a real villain phase (`endTurn`) with the encounter deck's top
 * replaced by harmless boost-less treacheries so only the attack under test happens.
 */
const REFS = [
  "59008.amadeus-cho-forced-interrupt",
  "59008.amadeus-cho-action",
  "59012.olympus-resource",
  "59013.gauntlets-of-hercules-interrupt",
  "59014.golden-mace-interrupt",
  "59015.hercs-helm-interrupt",
  "59016.lion-of-olympus-constant",
  "59017.prince-of-power-response",
];
const R = HERCULES_SUPPORT_UPGRADES_ALLIES;
const CHO = "59008";
const OLYMPUS = "59012";
const GAUNTLETS = "59013";
const MACE = "59014";
const HELM = "59015";
const LION = "59016";
const PRINCE = "59017";
const DEATHCRY = "59018"; // Leadership ally, cost 3, ATK 3
const FOLLOW_THROUGH = "16045"; // Aggression upgrade: +1 to the excess damage of your hero's attack
const NEMEAN = "59005";
const SHIELD = "59006";
const SWORD = "59007";
const APPEAL = "59035";
const MODOK = "01184"; // Core minion: ATK 2, SCH 2, 8 hit points
const THUMBELINA = "40182"; // minion, 3 hit points, reduces the damage it takes from each attack by 1
const ADVANCE = "01186";
const CHO_ACTION = "59008.amadeus-cho-action";
const OLYMPUS_REF = "59012.olympus-resource";
const GAUNTLETS_REF = "59013.gauntlets-of-hercules-interrupt";
const MACE_REF = "59014.golden-mace-interrupt";
const HELM_REF = "59015.hercs-helm-interrupt";
const PRINCE_REF = "59017.prince-of-power-response";
const MINION = "minion" as InstanceId;

const run = (s: GameState, command: Command, pick: Picker = firstLegal) => drive(s, command, pick, WAVE10_DEPS);
const accepted = (s: GameState, command: Command): boolean => applyCommand(s, command, WAVE10_DEPS).ok;
const giftDeck = (s: GameState): readonly InstanceId[] => separateDeckOf(s, P1, GIFT).deck;
const data = (code: string) => HERCULES_CARDS.find((c) => (c.id as string) === code)! as AnyCard;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** Surgery: the Gift `code` taken out of Hercules's (P1's) Gift deck and attached to `player`'s identity, under their control. */
function withGift(state: GameState, code: string, player = P1): GameState {
  const id = giftDeck(state).find((i) => codeOf(state, i) === code)!;
  const host = identityOf(state, player);
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            separateDecks: {
              ...p.separateDecks,
              [GIFT]: { ...p.separateDecks[GIFT]!, deck: p.separateDecks[GIFT]!.deck.filter((i) => i !== id) },
            },
          }
        : p,
    ),
  };
  const placed = patchInstance(moved, id, { faceup: true, controllerId: player, attachedTo: host });
  return patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] });
}
const withGifts = (state: GameState, codes: readonly string[], player = P1): GameState =>
  codes.reduce((s, code) => withGift(s, code, player), state);

/** Surgery: Appeal to Athena (an obligation from the encounter deck) in P1's play area. */
function withAppeal(state: GameState): GameState {
  const deck = activeEncounterDeck(state);
  const id =
    deck.deck.find((i) => codeOf(state, i) === APPEAL) ??
    playerOf(state, P1).setAside.find((i) => codeOf(state, i) === APPEAL);
  if (!id) throw new Error("no Appeal to Athena");
  const key = Object.keys(state.encounterDecks).find((k) => state.encounterDecks[k] === deck)!;
  const placed: GameState = {
    ...state,
    encounterDecks: { ...state.encounterDecks, [key]: { ...deck, deck: deck.deck.filter((i) => i !== id) } },
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
  };
  return patchInstance(placed, id, { faceup: true, controllerId: null });
}

/** The encounter deck's top twelve (but no Hercules card) retagged to Advance, a treachery with no boost icons. */
function quiet(state: GameState): GameState {
  return activeEncounterDeck(state)
    .deck.slice(0, 12)
    .filter((id) => !codeOf(state, id).startsWith("59"))
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
}
/** Retags the villain's next boost card (the top of the encounter deck) to a harmless treachery with `icons` boost icons. */
function withBoostIcons(state: GameState, icons: number): GameState {
  const top = activeEncounterDeck(state).deck[0]!;
  const harmless = Object.values(state.cardPool).find(
    (c) =>
      c.type === "treachery" &&
      (c as { boostIcons?: number }).boostIcons === icons &&
      !(c.id as string).startsWith("59") &&
      !c.abilities.some((a) => (a.id as string).includes("boost")) &&
      !/Boost:/.test(c.text.current),
  );
  if (!harmless) throw new Error("no treachery to retag");
  return patchInstance(state, top, { cardId: harmless.id });
}

interface Policy {
  /** Who defends: an instance, or nobody. */
  readonly defender?: InstanceId | "none" | readonly (InstanceId | "none")[];
  /** The abilities taken when offered (a forced one is always taken). */
  readonly take?: readonly string[];
  /** The target chosen when a card is asked for. */
  readonly target?: InstanceId;
}
/** A picker that records the abilities offered in each trigger window. */
function policy(opts: Policy = {}, offered: string[] = []): Picker {
  const defenders = Array.isArray(opts.defender) ? [...opts.defender] : [opts.defender ?? "none"];
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const abilities = choice.options.flatMap((o) =>
        o.ref.kind === "ability" ? [{ o, id: o.ref.abilityId as string }] : [],
      );
      for (const a of abilities) offered.push(a.id);
      const wanted = abilities.filter((a) => opts.take?.includes(a.id));
      if (wanted.length > 0) return wanted.map((a) => a.o.optionId);
      return choice.minSelections > 0 ? [choice.options[0]!.optionId] : [];
    }
    if (choice?.prompt.kind === "declareDefender") {
      const next = defenders.length > 1 ? defenders.shift()! : defenders[0]!;
      return [next === "none" ? "decline" : next];
    }
    const hit = opts.target
      ? choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === opts.target)
      : undefined;
    return hit ? [hit.optionId] : firstLegal(state);
  };
}

const basicAttack = (attacker: InstanceId, target: InstanceId, player = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const herc = (s: GameState): InstanceId => identityOf(s, P1);

/** Hercules, hero form, and Core's Spider-Man (P2) against Rhino. */
function twoPlayerGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: CORE_SPIDER_MAN }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: HERO_PACK_CARDS,
  } as never);
  const created = createGame({ ...config, players: [heroPackSeat(HERCULES_DECK), ...config.players] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return withForm(
    settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS),
    { heroForm: 0 },
  );
}

describe("Hercules support, upgrades and ally registry", () => {
  it("every ability validates, with the printed timing", () => {
    expect(HERCULES_SUPPORT_UPGRADES_ALLIES_SKIPPED).toEqual({});
    for (const id of REFS) expect(validateDefinition(R[id]!), id).toEqual([]);
    expect(R[REFS[0]!]!.trigger).toMatchObject({ kind: "interrupt", forced: true });
    expect(R[CHO_ACTION]!.trigger).toMatchObject({ kind: "action" });
    expect(R[OLYMPUS_REF]!.trigger).toMatchObject({ kind: "resource" });
    for (const id of [GAUNTLETS_REF, MACE_REF, HELM_REF])
      expect(R[id]!.trigger, id).toMatchObject({ kind: "interrupt", form: "hero" });
    expect(R["59016.lion-of-olympus-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(R[PRINCE_REF]!.trigger).toMatchObject({ kind: "response", form: "hero" });
  });

  it("the eight printed refs are registered, none is skipped, and the registry holds exactly them", () => {
    const printed = [CHO, OLYMPUS, GAUNTLETS, MACE, HELM, LION, PRINCE].flatMap((c) =>
      (data(c) as unknown as { abilities: { id: string }[] }).abilities.map((a) => a.id as string),
    );
    expect(printed.sort()).toEqual([...REFS].sort());
    expect(Object.keys(R).sort()).toEqual([...REFS].sort());
  });

  it("data: Golden Mace is Restricted, Lion of Olympus is Temporary (two copies), Cho is a unique 2-cost ally", () => {
    expect((data(MACE) as unknown as { keywords: unknown[] }).keywords).toContainEqual({ name: "restricted" });
    expect((data(LION) as unknown as { keywords: unknown[] }).keywords).toContainEqual({ name: "temporary" });
    expect(data(LION)).toMatchObject({ type: "upgrade", quantityInSet: 2 });
    expect(data(CHO)).toMatchObject({ type: "ally", cost: 2, unique: true, hp: 2 });
  });
});

describe("59008 Amadeus Cho", () => {
  /** Cho in play under Hercules (hero form), a quiet deck, and M.O.D.O.K. (ATK 2) engaged with Hercules. */
  function withMinion(): { state: GameState; cho: InstanceId } {
    const staged = stagedInPlay(quiet(herculesHeroGame()), CHO);
    return { state: engageMinion(staged.state, MODOK, MINION, P1), cho: staged.id };
  }
  const attacksBy = (events: readonly GameEvent[], enemy: InstanceId) =>
    ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === enemy);

  it("a minion that would attack Hercules attacks Cho instead: Cho (2 hit points) takes the 2 damage and is defeated, Hercules none", () => {
    const { state, cho } = withMinion();
    const { state: after, events } = run(state, endTurn(P1), policy({ defender: "none" }));
    expect(ofType(events, "attackRetargeted").filter((e) => e.enemyInstanceId === MINION)).toEqual([
      { type: "attackRetargeted", enemyInstanceId: MINION, targetInstanceId: cho, playerId: P1 },
    ]);
    expect(attacksBy(events, MINION).map((e) => [e.targetInstanceId, e.damageDealt])).toEqual([[cho, 2]]);
    expect(locateCard(after, cho)?.kind).not.toBe("playArea");
  });

  it("Hercules may defend the redirected attack as normal: DEF 2 stops all 2 damage, so Cho is unharmed", () => {
    const { state, cho } = withMinion();
    const { state: after, events } = run(state, endTurn(P1), policy({ defender: ["none", herc(state)] }));
    expect(attacksBy(events, MINION).map((e) => [e.targetInstanceId, e.damageDealt])).toEqual([[herc(state), 0]]);
    expect(inst(after, cho).damage).toBe(0);
    expect(inst(after, herc(after)).exhausted).toBe(true);
  });

  it("without Cho in play the same minion attacks Hercules (the control)", () => {
    const { state } = withMinion();
    const bare = patchInstance(
      state,
      state.players[0]!.playArea.find((i) => codeOf(state, i) === CHO)!,
      {},
    );
    const away: GameState = {
      ...bare,
      players: bare.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => codeOf(bare, i) !== CHO) })),
    };
    const { events } = run(away, endTurn(P1), policy({ defender: "none" }));
    expect(ofType(events, "attackRetargeted")).toEqual([]);
    expect(attacksBy(events, MINION).map((e) => [e.targetInstanceId, e.damageDealt])).toEqual([[herc(away), 2]]);
  });

  it("the villain's attack is not redirected: Rhino still attacks Hercules (only a minion is named)", () => {
    const { state } = withMinion();
    const villain = state.activeVillainId!;
    const { events } = run(state, endTurn(P1), policy({ defender: "none" }));
    expect(attacksBy(events, villain).map((e) => e.targetInstanceId)).toEqual([herc(state)]);
  });

  it("two players: only a minion attacking Hercules's player is redirected; the one engaged with Spider-Man attacks him", () => {
    const base = quiet(twoPlayerGame());
    const staged = stagedInPlay(base, CHO);
    // Spider-Man in hero form, so the minion engaged with him attacks (in alter-ego form it schemes).
    const both = withForm(
      engageMinion(engageMinion(staged.state, MODOK, MINION, P1), THUMBELINA, "thumb", P2),
      { heroForm: 0 },
      P2,
    );
    const first = run(both, endTurn(P1), policy({ defender: "none" }));
    const second = run(first.state, endTurn(P2), policy({ defender: "none" }));
    const events = [...first.events, ...second.events];
    expect(attacksBy(events, MINION).map((e) => e.targetInstanceId)).toEqual([staged.id]);
    expect(attacksBy(events, "thumb" as InstanceId).map((e) => e.targetInstanceId)).toEqual([identityOf(both, P2)]);
    expect(ofType(events, "attackRetargeted").filter((e) => e.enemyInstanceId === ("thumb" as InstanceId))).toEqual([]);
  });

  it("Action: exhaust Cho, draw 1 card; refused while he is exhausted", () => {
    const staged = stagedInPlay(herculesHeroGame(), CHO);
    const before = playerOf(staged.state, P1).hand.length;
    const { state } = run(staged.state, use(P1, staged.id, CHO_ACTION));
    expect(playerOf(state, P1).hand).toHaveLength(before + 1);
    expect(inst(state, staged.id).exhausted).toBe(true);
    expect(accepted(state, use(P1, staged.id, CHO_ACTION))).toBe(false);
  });

  it("Action also works with Hercules in alter-ego form (it is not a Hero Action)", () => {
    const staged = stagedInPlay(withForm(herculesHeroGame(), "alterEgo"), CHO);
    const before = playerOf(staged.state, P1).hand.length;
    const { state } = run(staged.state, use(P1, staged.id, CHO_ACTION));
    expect(playerOf(state, P1).hand).toHaveLength(before + 1);
  });
});

describe("59012 Olympus", () => {
  /** Olympus in play, `gifts` Gift cards; Amadeus Cho (cost 2) in hand; the command that plays Cho paying with Olympus alone. */
  function paying(gifts: readonly string[], extra: (s: GameState) => GameState = (s) => s) {
    const olympus = stagedInPlay(withGifts(herculesHeroGame(), gifts), OLYMPUS);
    const given = moveToHand(extra(olympus.state), P1, CHO);
    return {
      state: given.state,
      olympus: olympus.id,
      playCho: play(P1, given.ids[0]!, [], { abilities: [resourceAbility(olympus.id, OLYMPUS_REF)] }),
    };
  }

  it.each([
    [[], false],
    [[NEMEAN], false],
    [[NEMEAN, SHIELD], true],
    [[NEMEAN, SHIELD, SWORD], true],
  ] as const)("with Gift cards %j (arranged), Olympus alone pays Cho's cost of 2: %s", (gifts, canPay) => {
    const { state, playCho } = paying(gifts);
    expect(accepted(state, playCho)).toBe(canPay);
  });

  it("it generates one wild resource per Gift card: 1 pays the 1-cost Prince of Power, 3 pay the 3-cost Deathcry, 2 do not", () => {
    for (const [gifts, code, canPay] of [
      [[NEMEAN], PRINCE, true],
      [[NEMEAN, SHIELD], DEATHCRY, false],
      [[NEMEAN, SHIELD, SWORD], DEATHCRY, true],
    ] as const) {
      const olympus = stagedInPlay(withGifts(herculesHeroGame(), gifts), OLYMPUS);
      const given = moveToHand(olympus.state, P1, code);
      const pay = [resourceAbility(olympus.id, OLYMPUS_REF)];
      const command =
        code === PRINCE
          ? play(P1, given.ids[0]!, [], { abilities: pay, attachToInstanceId: herc(given.state) })
          : play(P1, given.ids[0]!, [], { abilities: pay });
      expect(accepted(given.state, command), `${code} with ${gifts.length} Gift cards`).toBe(canPay);
    }
  });

  it("using it exhausts Olympus and plays Cho: the ally is in play and the support is exhausted", () => {
    const { state, playCho, olympus } = paying([NEMEAN, SHIELD]);
    const { state: after } = run(state, playCho);
    expect(inst(after, olympus).exhausted).toBe(true);
    expect(playerOf(after, P1).playArea.map((i) => codeOf(after, i))).toContain(CHO);
  });

  it("an exhausted Olympus cannot be used", () => {
    const { state, playCho, olympus } = paying([NEMEAN, SHIELD]);
    expect(accepted(patchInstance(state, olympus, { exhausted: true }), playCho)).toBe(false);
  });

  it("Appeal to Athena in play: with two Gift cards it generates nothing", () => {
    const { state, playCho } = paying([NEMEAN, SHIELD], withAppeal);
    expect(accepted(state, playCho)).toBe(false);
  });

  it("two players: Spider-Man's three Gift cards do not count for Hercules's Olympus", () => {
    const olympus = stagedInPlay(withGifts(twoPlayerGame(), [NEMEAN, SHIELD, SWORD], P2), OLYMPUS);
    const given = moveToHand(olympus.state, P1, CHO);
    const command = play(P1, given.ids[0]!, [], { abilities: [resourceAbility(olympus.id, OLYMPUS_REF)] });
    expect(accepted(given.state, command)).toBe(false);
  });
});

describe("59013 Gauntlets of Hercules", () => {
  /** Quiet deck, Gauntlets attached to Hercules, `gifts` arranged; the villain phase with the Gauntlets taken. */
  function defended(gifts: readonly string[], opts: Policy & { readonly take?: readonly string[] } = {}) {
    const staged = stagedInPlay(withGifts(quiet(herculesHeroGame()), gifts), GAUNTLETS, { attach: true });
    const offered: string[] = [];
    const villain = staged.state.activeVillainId!;
    const result = run(
      staged.state,
      endTurn(P1),
      policy({ defender: herc(staged.state), take: [GAUNTLETS_REF], ...opts }, offered),
    );
    return { ...result, staged, villain, offered };
  }

  it.each([
    [[], 0],
    [[NEMEAN], 1],
    [[NEMEAN, SWORD], 2],
    [[NEMEAN, SHIELD, SWORD], 4],
  ] as const)(
    "defending Rhino's attack with Gift cards %j (arranged): Rhino takes %i from retaliate (one per Gift, plus Shield of Perseus's own 1)",
    (gifts, retaliate) => {
      const { state, staged, villain } = defended(gifts);
      expect(inst(state, villain).damage).toBe(retaliate);
      expect(inst(state, staged.id).exhausted).toBe(gifts.length > 0 || true);
    },
  );

  it("the retaliate lasts for that attack only: none is left on Hercules afterwards (Shield's own 1 aside)", () => {
    const { state } = defended([NEMEAN, SWORD]);
    expect(keywordTotal(state, herc(state), "retaliate", WAVE10_DEPS)).toBe(0);
    const shielded = defended([SHIELD, NEMEAN]).state;
    expect(keywordTotal(shielded, herc(shielded), "retaliate", WAVE10_DEPS)).toBe(1);
  });

  it("the Gauntlets are exhausted by the use, and are offered only when Hercules defends: undefended, Rhino takes nothing and they stay ready", () => {
    const used = defended([NEMEAN, SWORD]);
    expect(inst(used.state, used.staged.id).exhausted).toBe(true);
    const undefended = defended([NEMEAN, SWORD], { defender: "none" });
    expect(undefended.offered).not.toContain(GAUNTLETS_REF);
    expect(inst(undefended.state, undefended.villain).damage).toBe(0);
    expect(inst(undefended.state, undefended.staged.id).exhausted).toBe(false);
  });

  it("an ally defending is not Hercules defending: Cho defends and the Gauntlets are not offered", () => {
    const cho = stagedInPlay(withGifts(quiet(herculesHeroGame()), [NEMEAN, SWORD]), CHO);
    const gauntlets = stagedInPlay(cho.state, GAUNTLETS, { attach: true });
    const offered: string[] = [];
    const { state } = run(gauntlets.state, endTurn(P1), policy({ defender: cho.id, take: [GAUNTLETS_REF] }, offered));
    expect(offered).not.toContain(GAUNTLETS_REF);
    expect(inst(state, state.activeVillainId!).damage).toBe(0);
  });

  it("Appeal to Athena in play: two Gift cards give no retaliate", () => {
    const staged = stagedInPlay(withGifts(quiet(herculesHeroGame()), [NEMEAN, SWORD]), GAUNTLETS, { attach: true });
    const { state } = run(
      withAppeal(staged.state),
      endTurn(P1),
      policy({ defender: herc(staged.state), take: [GAUNTLETS_REF] }),
    );
    expect(inst(state, state.activeVillainId!).damage).toBe(0);
  });
});

describe("59014 Golden Mace", () => {
  /** Quiet game, the Mace attached to Hercules, `gifts` arranged; M.O.D.O.K. (8 hit points) engaged with `damage` on it. */
  function armed(gifts: readonly string[], damage = 0) {
    const mace = stagedInPlay(withGifts(quiet(herculesHeroGame()), gifts), MACE, { attach: true });
    const minion = patchInstance(engageMinion(mace.state, MODOK, MINION, P1), MINION, { damage });
    return { state: minion, mace: mace.id };
  }
  const hit = (gifts: readonly string[], damage = 0, take: readonly string[] = [MACE_REF]) => {
    const { state, mace } = armed(gifts, damage);
    const offered: string[] = [];
    const result = run(state, basicAttack(herc(state), MINION), policy({ take }, offered));
    return { ...result, mace, offered, before: state };
  };

  it.each([
    [[], 3],
    [[NEMEAN], 4],
    [[NEMEAN, SHIELD], 5],
    [[NEMEAN, SHIELD, SWORD], 6],
  ] as const)(
    "his basic attack with Gift cards %j (arranged) deals 3 ATK +1 per Gift: %i damage; the Mace is exhausted",
    (gifts, damage) => {
      const { state, mace } = hit(gifts);
      expect(inst(state, MINION).damage).toBe(damage);
      expect(inst(state, mace).exhausted).toBe(true);
    },
  );

  it("declined, the attack is his plain 3 ATK and the Mace stays ready", () => {
    const { state, mace } = hit([NEMEAN, SHIELD], 0, []);
    expect(inst(state, MINION).damage).toBe(3);
    expect(inst(state, mace).exhausted).toBe(false);
  });

  it("the attack gains overkill: M.O.D.O.K. with 1 hit point left and +2 ATK (5): defeated, the 4 excess damage goes to the villain; without the Mace the 2 excess does not", () => {
    const withMace = hit([NEMEAN, SHIELD], 7);
    expect(locateCard(withMace.state, MINION)?.kind).not.toBe("playArea");
    expect(inst(withMace.state, withMace.state.activeVillainId!).damage).toBe(4);
    const without = hit([NEMEAN, SHIELD], 7, []);
    expect(locateCard(without.state, MINION)?.kind).not.toBe("playArea");
    expect(inst(without.state, without.state.activeVillainId!).damage).toBe(0);
  });

  it("Appeal to Athena in play: +0 ATK from two Gift cards, but the attack still gains overkill", () => {
    const { state } = armed([NEMEAN, SHIELD], 7);
    const { state: after } = run(withAppeal(state), basicAttack(herc(state), MINION), policy({ take: [MACE_REF] }));
    expect(inst(after, after.activeVillainId!).damage).toBe(2);
  });

  it("an exhausted Mace is not offered", () => {
    const { state, mace } = armed([NEMEAN]);
    const offered: string[] = [];
    const { state: after } = run(
      patchInstance(state, mace, { exhausted: true }),
      basicAttack(herc(state), MINION),
      policy({ take: [MACE_REF] }, offered),
    );
    expect(offered).not.toContain(MACE_REF);
    expect(inst(after, MINION).damage).toBe(3);
  });

  it("an ally's basic attack is not Hercules's: Deathcry attacks for 3 and the Mace is not offered", () => {
    const { state } = armed([NEMEAN, SHIELD]);
    const deathcry = stagedInPlay(state, DEATHCRY);
    const offered: string[] = [];
    const { state: after } = run(
      deathcry.state,
      basicAttack(deathcry.id, MINION),
      policy({ take: [MACE_REF] }, offered),
    );
    expect(offered).not.toContain(MACE_REF);
    expect(inst(after, MINION).damage).toBe(3);
  });

  it("two players: Spider-Man's basic attack does not use Hercules's Mace", () => {
    const base = withGifts(quiet(twoPlayerGame()), [NEMEAN, SHIELD]);
    const mace = stagedInPlay(base, MACE, { attach: true });
    const spider = run(withForm(engageMinion(mace.state, MODOK, MINION, P2), { heroForm: 0 }, P2), endTurn(P1)).state;
    const offered: string[] = [];
    const { state } = run(
      spider,
      basicAttack(identityOf(spider, P2), MINION, P2),
      policy({ take: [MACE_REF] }, offered),
    );
    expect(offered).not.toContain(MACE_REF);
    expect(inst(state, MINION).damage).toBe(characterProfile(spider, identityOf(spider, P2), WAVE10_DEPS)!.atk);
  });
});

describe("59015 Herc's Helm", () => {
  /** Quiet game, the Helm attached, the villain's boost card with `icons` icons: Rhino ATK 2 + icons. */
  function attacked(icons: number, withHelm: boolean, defends = false) {
    const base = withBoostIcons(quiet(herculesHeroGame()), icons);
    const helm = withHelm ? stagedInPlay(base, HELM, { attach: true }) : { state: base, id: null };
    const offered: string[] = [];
    const hercId = herc(base);
    const result = run(
      helm.state,
      endTurn(P1),
      policy({ defender: defends ? hercId : "none", take: [HELM_REF] }, offered),
    );
    const resolved = ofType(result.events, "attackResolved").filter((e) => e.enemyInstanceId === base.activeVillainId);
    return { ...result, helm: helm.id, offered, resolved, hercId };
  }

  it("reduces the damage the attack deals by 1: ATK 2 + 2 boost icons is 4, undefended Hercules takes 4 without the Helm and 3 with it", () => {
    const without = attacked(2, false);
    expect(without.resolved.map((e) => [e.targetInstanceId, e.damageDealt])).toEqual([[without.hercId, 4]]);
    expect(inst(without.state, without.hercId).damage).toBe(4);
    const withHelm = attacked(2, true);
    expect(withHelm.offered).toContain(HELM_REF);
    expect(withHelm.resolved.map((e) => [e.targetInstanceId, e.damageDealt])).toEqual([[withHelm.hercId, 3]]);
    expect(inst(withHelm.state, withHelm.hercId).damage).toBe(3);
    expect(inst(withHelm.state, withHelm.helm!).exhausted).toBe(true);
  });

  it("it stacks with a defense: Hercules (DEF 2) declared as the defender takes 4 - 1 - 2 = 1", () => {
    const withHelm = attacked(2, true, true);
    expect(withHelm.resolved.map((e) => e.damageDealt)).toEqual([1]);
    const without = attacked(2, false, true);
    expect(without.resolved.map((e) => e.damageDealt)).toEqual([2]);
  });

  it("the (defense) label makes Hercules the attack's defender when nobody declared one, without a basic defense: no exhaust, no DEF", () => {
    const withHelm = attacked(2, true);
    // A labeled defense announces `defended` (a trigger event, basic: false), not the Declare Defender step's
    // `defenderDeclared` log entry (RRG 1.8 "Defend, Defense", p. 15).
    const defendedBy = (events: readonly GameEvent[]) =>
      ofType(events, "triggerEvent")
        .filter((e) => e.phase === "resolved")
        .map((e) => e.event)
        .filter((e) => e.kind === "defended" && !e.basic)
        .map((e) => (e as { defenderInstanceId: InstanceId }).defenderInstanceId);
    expect(defendedBy(withHelm.events)).toEqual([withHelm.hercId]);
    expect(ofType(withHelm.events, "defenderDeclared")).toEqual([]);
    expect(inst(withHelm.state, withHelm.hercId).exhausted).toBe(false);
    const undefended = attacked(2, false);
    expect(defendedBy(undefended.events)).toEqual([]);
  });

  it("is not offered when a minion attacks (it names the villain)", () => {
    const base = quiet(herculesHeroGame());
    const helm = stagedInPlay(base, HELM, { attach: true });
    const minion = engageMinion(helm.state, MODOK, MINION, P1);
    const offered: string[] = [];
    const { events } = run(minion, endTurn(P1), policy({ defender: "none", take: [HELM_REF] }, offered));
    const byMinion = ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === MINION);
    expect(byMinion.map((e) => e.damageDealt)).toEqual([2]);
    expect(offered.filter((id) => id === HELM_REF)).toHaveLength(1);
  });
});

describe("59016 Lion of Olympus", () => {
  const stats = (s: GameState, p = P1) => {
    const profile = characterProfile(s, identityOf(s, p), WAVE10_DEPS)!;
    return [profile.thw, profile.atk, profile.def];
  };

  it("hero form: +1 THW, +1 ATK and +1 DEF (1/3/2 becomes 2/4/3); a second copy doubles it", () => {
    const base = herculesHeroGame();
    expect(stats(base)).toEqual([1, 3, 2]);
    const one = stagedInPlay(base, LION, { attach: true });
    expect(stats(one.state)).toEqual([2, 4, 3]);
    const two = stagedInPlay(one.state, LION, { attach: true });
    expect(stats(two.state)).toEqual([3, 5, 4]);
  });

  it("his basic attack and thwart use the new values", () => {
    const lion = stagedInPlay(engageMinion(herculesHeroGame(), MODOK, MINION, P1), LION, { attach: true });
    const { state } = run(lion.state, basicAttack(herc(lion.state), MINION));
    expect(inst(state, MINION).damage).toBe(4);
  });

  it("alter-ego form: no bonus (it is for your hero)", () => {
    const base = withForm(herculesHeroGame(), "alterEgo");
    const lion = stagedInPlay(base, LION, { attach: true });
    expect(stats(lion.state)).toEqual(stats(base));
  });

  it("Temporary: it is discarded at the end of the round", () => {
    const lion = stagedInPlay(quiet(herculesHeroGame()), LION, { attach: true });
    const { state } = run(lion.state, endTurn(P1), policy({ defender: "none" }));
    expect(playerOf(state, P1).discard).toContain(lion.id);
    expect(inst(state, herc(state)).attachments).not.toContain(lion.id);
  });

  it("two players: it raises Hercules's hero only; Spider-Man's stats are unchanged", () => {
    const base = twoPlayerGame();
    const lion = stagedInPlay(base, LION, { attach: true });
    expect(stats(lion.state, P2)).toEqual(stats(base, P2));
    expect(stats(lion.state, P1)).toEqual([2, 4, 3]);
  });
});

describe("59017 Prince of Power", () => {
  /** Quiet game, the Prince (and optionally the Mace with three Gift cards) attached, Hercules with `hurt` damage, and a minion engaged. */
  function setup(minion: string, minionDamage: number, hurt: number, mace = false) {
    let state = quiet(herculesHeroGame());
    if (mace) state = withGifts(state, [NEMEAN, SHIELD, SWORD]);
    const prince = stagedInPlay(state, PRINCE, { attach: true });
    state = prince.state;
    if (mace) state = stagedInPlay(state, MACE, { attach: true }).state;
    state = patchInstance(engageMinion(state, minion, MINION, P1), MINION, { damage: minionDamage });
    return { state: patchInstance(state, herc(state), { damage: hurt }), prince: prince.id };
  }
  const attack = (s: GameState, offered: string[] = [], take: readonly string[] = [PRINCE_REF, MACE_REF]) =>
    run(s, basicAttack(herc(s), MINION), policy({ take }, offered));

  // The ruling's own numbers, with RRG 1.8 "Overkill" (p. 31) superseding its heal of 3: the excess is the damage taken
  // past the remaining hit points (5 - 3 = 2), for overkill and Prince of Power alike (the user's order of rules
  // authority, 2026-10-16; replaces owner answer 31B).
  it("RRG v1.8 p.31 over February 8, 2026 - Ruling 2: 6 dealt (3 ATK + 3 Gift) to Thumbelina (3 hit points, reduces damage by 1), 5 taken, 2 overkill to the villain, Prince of Power heals 2", () => {
    const { state, prince } = setup(THUMBELINA, 0, 5, true);
    const { state: after } = attack(state);
    expect(locateCard(after, MINION)?.kind).not.toBe("playArea");
    expect(inst(after, after.activeVillainId!).damage).toBe(2);
    expect(inst(after, herc(after)).damage).toBe(3);
    expect(inst(after, prince).exhausted).toBe(true);
  });

  // Owner answer 42B (2026-10-12): Follow Through (16045, "When your hero's attack deals any amount of excess damage,
  // increase that amount by 1") also answers an attack whose damage dealt alone has excess. 4 dealt (3 ATK + 1 Gift)
  // to Thumbelina is 3 taken: exactly lethal, no excess taken, 1 excess dealt.
  describe("with Follow Through 16045, only the damage dealt in excess (answer 42B)", () => {
    function fourDealt(followThrough: boolean) {
      let state = withGifts(quiet(herculesHeroGame()), [NEMEAN]);
      const prince = stagedInPlay(state, PRINCE, { attach: true });
      state = stagedInPlay(prince.state, MACE, { attach: true }).state;
      if (followThrough) {
        // Not in the precon: the bottom card of his deck retagged to it (test surgery), then staged like the others.
        expect(state.cardPool[cardId(FOLLOW_THROUGH)]).toBeDefined();
        state = patchInstance(state, playerOf(state, P1).deck.at(-1)!, { cardId: cardId(FOLLOW_THROUGH) });
        state = stagedInPlay(state, FOLLOW_THROUGH, { attach: true }).state;
      }
      state = patchInstance(engageMinion(state, THUMBELINA, MINION, P1), herc(state), { damage: 5 });
      const { state: after } = attack(state);
      expect(locateCard(after, MINION)?.kind).not.toBe("playArea");
      return { healed: 5 - inst(after, herc(after)).damage, spilled: inst(after, after.activeVillainId!).damage };
    }

    // Prince of Power now counts the excess taken (RRG 1.8 p. 31), so with no excess taken neither case heals: the
    // excess dealt that answer 50A raises no longer shows on the board.
    it("control, without it: no excess was taken, so Prince of Power heals nothing and nothing spills", () => {
      expect(fourDealt(false)).toEqual({ healed: 0, spilled: 0 });
    });

    it("with it: still no excess taken, so nothing is healed and nothing spills", () => {
      expect(fourDealt(true)).toEqual({ healed: 0, spilled: 0 });
    });
  });

  it("heals 1 per point of excess: M.O.D.O.K. with 1 hit point left, ATK 3: 2 excess, Hercules (4 damage) heals 2", () => {
    const { state } = setup(MODOK, 7, 4);
    expect(inst(attack(state).state, herc(state)).damage).toBe(2);
  });

  it("an exactly lethal attack has no excess: nothing is healed", () => {
    const { state } = setup(MODOK, 5, 4);
    const { state: after } = attack(state);
    expect(locateCard(after, MINION)?.kind).not.toBe("playArea");
    expect(inst(after, herc(after)).damage).toBe(4);
  });

  it("heals no more than the damage he has", () => {
    const { state } = setup(MODOK, 7, 1);
    expect(inst(attack(state).state, herc(state)).damage).toBe(0);
  });

  it("an attack that does not defeat the enemy does not offer it", () => {
    const { state, prince } = setup(MODOK, 0, 4);
    const offered: string[] = [];
    const { state: after } = attack(state, offered);
    expect(offered).not.toContain(PRINCE_REF);
    expect(inst(after, prince).exhausted).toBe(false);
    expect(inst(after, herc(after)).damage).toBe(6);
  });

  it("an ally's defeating attack is not Hercules's: Deathcry defeats M.O.D.O.K. with excess and the Prince is not offered", () => {
    const { state } = setup(MODOK, 6, 4);
    const deathcry = stagedInPlay(state, DEATHCRY);
    const offered: string[] = [];
    const { state: after } = run(
      deathcry.state,
      basicAttack(deathcry.id, MINION),
      policy({ take: [PRINCE_REF] }, offered),
    );
    expect(locateCard(after, MINION)?.kind).not.toBe("playArea");
    expect(offered).not.toContain(PRINCE_REF);
    expect(inst(after, herc(after)).damage).toBe(4);
  });

  it("declined, he heals nothing and the Prince stays ready", () => {
    const { state, prince } = setup(MODOK, 7, 4);
    const { state: after } = attack(state, [], []);
    expect(inst(after, herc(after)).damage).toBe(4);
    expect(inst(after, prince).exhausted).toBe(false);
  });

  it("two players: Spider-Man defeating a minion with excess does not offer Hercules's Prince", () => {
    const prince = stagedInPlay(twoPlayerGame(), PRINCE, { attach: true });
    const spider = run(
      withForm(
        patchInstance(engageMinion(prince.state, MODOK, MINION, P2), MINION, { damage: 6 }),
        { heroForm: 0 },
        P2,
      ),
      endTurn(P1),
    ).state;
    const offered: string[] = [];
    const { state } = run(
      spider,
      basicAttack(identityOf(spider, P2), MINION, P2),
      policy({ take: [PRINCE_REF] }, offered),
    );
    expect(locateCard(state, MINION)?.kind).not.toBe("playArea");
    expect(offered).not.toContain(PRINCE_REF);
  });
});
