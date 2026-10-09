import { NCRAWLER_CARDS, NCRAWLER_STARTER_DECKS, VNM_CARDS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  keywordTotal,
  restrictedLimitFor,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
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
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import {
  defeatWithAttack,
  driveEvents,
  driveEventsPicking,
  moveToDiscard,
  withDamage,
  withForm,
} from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { NIGHTCRAWLER_IDENTITY } from "./identity.js";
import { BAMF_MOMENT, NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nightcrawler's signature supports, upgrades and allies (48002 to 48006), docs/phase7-wave8.md §7.4, §3.72, §3.73,
 * §3.39. His real Protection precon (`nightcrawler-protection`) against Rhino (Core, standard, no modular set), built
 * through `coreScenario`; the engine gets this module's registry and the identity's on top of every earlier wave.
 * Nightcrawler: THW 2, ATK 1, DEF 3, 9 hit points; Kurt Wagner REC 3. Sandman (01102, an ELITE minion with ATK 3, 4
 * hit points) and Mercenary (01101, ATK 1, 3 hit points) are the minions; the boost cards are Core's Breakin' & Takin'
 * (01107, 2 icons), Crowd Control (01108, 2 icons) and Advance (01186, 0 icons). Plasma Pistol (20022, cost 2) is the
 * restricted upgrade, put in the deck with `requireLegalDecks: false`.
 */
const DAYTRIPPER = "48002";
const CHAPEL = "48003";
const CUTLASSES = "48004";
const TAIL = "48005";
const BAMF = "48006";
const PISTOL = "20022";
const REFS = [
  "48002.daytripper-response",
  "48003.kurts-chapel-constant",
  "48003.kurts-chapel-response",
  "48004.kurts-cutlasses-constant",
  "48005.prehensile-tail-constant",
  "48005.prehensile-tail-resource",
  "48006.bamf-interrupt",
];
const FIRST_AID = "01086";
const DAY_REF = "48002.daytripper-response";
const BAMF_REF = "48006.bamf-interrupt";
const CHAPEL_REF = "48003.kurts-chapel-response";
const TAIL_RESOURCE = "48005.prehensile-tail-resource";

const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, NIGHTCRAWLER_IDENTITY, NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES),
};
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...VNM_CARDS, ...NCRAWLER_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));

const PRECON = NCRAWLER_STARTER_DECKS.find((d) => d.id === "nightcrawler-protection")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));

const SANDMAN = "01102";
const MERCENARY = "01101";
const BREAKIN = "01107";
const CROWD = "01108";
const ADVANCE = "01186";
const CAUGHT_OFF_GUARD = "01188";

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const deckCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const count = (codes: readonly string[], code: string): number => codes.filter((c) => c === code).length;
const inPlayIds = (s: GameState, code: string): InstanceId[] => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;
const hostOf = (s: GameState, id: InstanceId): InstanceId | null => inst(s, id).attachedTo;
const bamfsOn = (s: GameState, enemy: InstanceId): number =>
  inst(s, enemy).attachments.filter((a) => codeOf(s, a) === BAMF).length;
const damageTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === target ? [e.amount] : []));
const moments = (events: readonly GameEvent[]) => events.filter((e) => e.type === "momentRaised");
/** Cards a test stages by name: never used as payment or filler. */
const KIT = new Set([DAYTRIPPER, CHAPEL, CUTLASSES, TAIL, BAMF, PISTOL, FIRST_AID]);
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as { resourceIcons?: Record<string, number> };
  return Object.values(card.resourceIcons ?? {}).reduce((a, b) => a + b, 0);
};

type Seat = { readonly kind: "nc" | "core"; readonly extra: readonly string[] };
const NC = (...extra: string[]): Seat => ({ kind: "nc", extra });
/** Spider-Man (Justice precon): hero DEF 3. */
const SM = (...extra: string[]): Seat => ({ kind: "core", extra });

/** Nightcrawler (and optionally Spider-Man) against Rhino, through setup, in alter-ego form as setup leaves everyone. */
function setupGame(seats: readonly Seat[] = [NC()], seed = 1, legal = true): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = seats.map((seat) => {
    const base =
      seat.kind === "nc"
        ? { identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, deck: PRECON_DECK }
        : coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed, modularSetIds: [] })
            .players[0]!;
    return { ...base, deck: [...base.deck, ...seat.extra.map((code) => cardId(code))] };
  });
  const created = createGame({ ...config, players, requireLegalDecks: legal }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
/** Hero form for every seat. */
const heroGame = (seats: readonly Seat[] = [NC()], seed = 1, legal = true): GameState =>
  seats.reduce<GameState>(
    (s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2),
    setupGame(seats, seed, legal),
  );
/** Spider-Man is seat 1 and Nightcrawler seat 2, both in hero form. */
const TWO: readonly Seat[] = [SM(), NC()];

/** Surgery: a minion from the encounter deck into this player's play area, engaged and faceup. */
function engage(
  state: GameState,
  code: string,
  p: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const pile = activeEncounterDeck(state);
  const id = pile.deck.find((i) => codeOf(state, i) === code) ?? pile.discard.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  const deckId = activeEncounterDeckId(state);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((pl) => (pl.playerId === p ? { ...pl, playArea: [...pl.playArea, id] } : pl)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, engagedWith: p, faceup: true, controllerId: null },
      },
    },
  };
}
/** Rhino's next activation is stunned away. */
const rhinoStunned = (s: GameState): GameState =>
  patchInstance(s, s.activeVillainId!, { statuses: { ...inst(s, s.activeVillainId!).statuses, stunned: 1 } });

/** Plays a card from hand, paying with hand cards until the printed cost is covered (exact icons per card). */
function playIt(
  s: GameState,
  code: string,
  o: { attach?: InstanceId; p?: PlayerId; pick?: Picker } = {},
): { readonly state: GameState; readonly id: InstanceId; readonly events: readonly GameEvent[] } {
  const p = o.p ?? P1;
  const given = moveToHand(s, p, code);
  const id = given.ids[0]!;
  const cost = (BY_ID.get(code) as { cost: number }).cost;
  const payers: InstanceId[] = [];
  let paid = 0;
  for (const h of playerOf(given.state, p).hand) {
    if (paid >= cost) break;
    if (h === id || KIT.has(codeOf(given.state, h)) || iconsOf(given.state, h) === 0) continue;
    payers.push(h);
    paid += iconsOf(given.state, h);
  }
  if (paid < cost) throw new Error(`not enough resource cards in hand to pay ${cost} for ${code}`);
  const { state, events } = driveEventsPicking(
    DEPS,
    given.state,
    o.pick ?? firstLegal,
    play(p, id, payers, o.attach ? { attachToInstanceId: o.attach } : {}),
  );
  return { state, id, events };
}
/** Adds resource cards to the hand so a test can pay for several cards (hand size is only enforced at turn end). */
function withResources(s: GameState, n: number, p: PlayerId = P1): GameState {
  const owner = playerOf(s, p);
  const fill = owner.deck
    .filter(
      (id) =>
        iconsOf(s, id) > 0 &&
        !KIT.has(codeOf(s, id)) &&
        !(BY_ID.get(codeOf(s, id)) as { type: string }).type.startsWith("hero"),
    )
    .slice(0, n);
  return {
    ...s,
    players: s.players.map((pl) =>
      pl.playerId === p ? { ...pl, deck: pl.deck.filter((id) => !fill.includes(id)), hand: [...pl.hand, ...fill] } : pl,
    ),
  };
}

// Pickers: a rule answers the prompt it understands, anything else is declined like `firstLegal`.
type Rule = (s: GameState) => readonly string[] | undefined;
const picker =
  (...rules: readonly Rule[]): Picker =>
  (s) => {
    for (const rule of rules) {
      const answer = rule(s);
      if (answer) return answer;
    }
    return firstLegal(s);
  };
const accept =
  (ref: string): Rule =>
  (s) => {
    if (s.pendingChoice?.prompt.kind !== "chooseTriggers") return undefined;
    const hits = s.pendingChoice.options.filter((o) => o.optionId.includes(ref)).map((o) => o.optionId);
    return hits.length > 0 ? hits : undefined;
  };
const take =
  (...ids: readonly string[]): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice || (choice.prompt.kind !== "chooseCards" && choice.prompt.kind !== "chooseTarget")) return undefined;
    const hits = ids.filter((id) => choice.options.some((o) => o.optionId === id));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : undefined;
  };
const defend =
  (id: InstanceId): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === id)
      ? [id]
      : undefined;
/** Every prompt kind and option list the picker saw. */
function spy(pick: Picker): { readonly pick: Picker; readonly seen: { kind: string; options: string[] }[] } {
  const seen: { kind: string; options: string[] }[] = [];
  return {
    seen,
    pick: (s) => {
      const c = s.pendingChoice!;
      seen.push({ kind: c.prompt.kind, options: c.options.map((o) => o.optionId) });
      return pick(s);
    },
  };
}
const offered = (seen: readonly { kind: string; options: string[] }[], ref: string): boolean =>
  seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(ref)));

describe("registry", () => {
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });
  it("holds exactly these refs and names the moment 'bamf'", () => {
    expect(Object.keys(NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    expect(BAMF_MOMENT).toBe("bamf");
  });
  it("the emitted data: Bamf! is an upgrade named exactly 'Bamf!' (cost 0, max 1 per host), Cutlasses weigh 2", () => {
    const bamf = BY_ID.get(BAMF) as { type: string; name: string; cost: number; playRestrictions?: unknown };
    expect([bamf.type, bamf.name, bamf.cost, bamf.playRestrictions]).toEqual([
      "upgrade",
      "Bamf!",
      0,
      { maxPerHost: 1 },
    ]);
    expect((BY_ID.get(CUTLASSES) as { restrictedWeight?: number }).restrictedWeight).toBe(2);
    expect((BY_ID.get(CUTLASSES) as unknown as { keywords: unknown[] }).keywords).toEqual([]);
  });
});

describe("Bamf! (48006): attach to an enemy, discard it to make Nightcrawler the defender", () => {
  it("plays for 0 on the villain: attached to Rhino, one card leaves the hand, nothing is paid", () => {
    const base = heroGame();
    const handBefore = playerOf(base, P1).hand.length;
    const { state, id } = playIt(base, BAMF, { attach: base.activeVillainId! });
    expect(hostOf(state, id)).toBe(base.activeVillainId);
    expect(bamfsOn(state, base.activeVillainId!)).toBe(1);
    expect(playerOf(state, P1).hand.length).toBe(handBefore - (handCodes(base).includes(BAMF) ? 1 : 0));
    expect(playerOf(state, P1).discard).toEqual([]);
  });

  it("control: with no copy on Rhino, Nightcrawler defends the attack himself and is exhausted by it", () => {
    // Rhino ATK 2 plus a 2-icon boost card is 4, less DEF 3 is 1 damage; he defends, so he exhausts.
    const base = stackEncounterDeck(heroGame(), BREAKIN, CROWD);
    const { state } = driveEventsPicking(DEPS, base, picker(defend(identityOf(base))), endTurn());
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });

  it("the villain attacks him: the copy is discarded, he defends without exhausting, 4 less DEF 3 is 1 damage", () => {
    const staged = playIt(heroGame(), BAMF, { attach: heroGame().activeVillainId! });
    const copy = staged.id;
    const base = stackEncounterDeck(staged.state, BREAKIN, CROWD);
    const spied = spy(picker(accept(BAMF_REF)));
    const { state, events } = driveEventsPicking(DEPS, base, spied.pick, endTurn());
    expect(offered(spied.seen, BAMF_REF)).toBe(true);
    expect(playerOf(state, P1).discard).toContain(copy);
    expect(cardsInPlay(state)).not.toContain(copy);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(damageTo(events, identityOf(state))).toEqual([1]);
    // He was not asked who defends: Bamf! declared him.
    expect(spied.seen.some((p) => p.kind === "declareDefender")).toBe(false);
  });

  it("raises the moment 'bamf' for its controller, with the discarded copy as the source", () => {
    const staged = playIt(heroGame(), BAMF, { attach: heroGame().activeVillainId! });
    const base = stackEncounterDeck(staged.state, BREAKIN, CROWD);
    const { events } = driveEventsPicking(DEPS, base, picker(accept(BAMF_REF)), endTurn());
    expect(moments(events)).toEqual([
      { type: "momentRaised", name: "bamf", playerId: P1, sourceInstanceId: staged.id },
    ]);
  });

  it("declined, it stays on the villain and Nightcrawler defends as usual", () => {
    const staged = playIt(heroGame(), BAMF, { attach: heroGame().activeVillainId! });
    const base = stackEncounterDeck(staged.state, BREAKIN, CROWD);
    const { state, events } = driveEventsPicking(DEPS, base, picker(defend(identityOf(base))), endTurn());
    expect(bamfsOn(state, base.activeVillainId!)).toBe(1);
    expect(moments(events)).toEqual([]);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });

  it("an exhausted Nightcrawler is still declared the defender: Rhino's attack exhausts him, then Bamf! takes Sandman's (3 damage without it)", () => {
    // Heroes ready at the end of the player phase, so exhaustion has to come from the villain phase itself: Rhino
    // attacks first (2 + 2 icons less DEF 3 is 1 damage, defended by hand, exhausting him), then Sandman (ATK 3).
    const base0 = heroGame();
    const sandman = engage(base0, SANDMAN);
    const control = driveEventsPicking(
      DEPS,
      stackEncounterDeck(sandman.state, BREAKIN, ADVANCE),
      picker(defend(identityOf(base0))),
      endTurn(),
    ).state;
    expect(inst(control, identityOf(control)).damage).toBe(4);
    const staged = playIt(sandman.state, BAMF, { attach: sandman.id });
    const base = stackEncounterDeck(staged.state, BREAKIN, ADVANCE);
    const { state, events } = driveEventsPicking(
      DEPS,
      base,
      picker(accept(BAMF_REF), defend(identityOf(base))),
      endTurn(),
    );
    expect(playerOf(state, P1).discard).toContain(staged.id);
    expect(damageTo(events, identityOf(state))).toEqual([1]);
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });

  it("on a minion: Sandman (ATK 3, no boost card: a minion gets none) attacks, 3 less DEF 3 is 0 damage, the copy goes to the discard pile", () => {
    const base0 = rhinoStunned(heroGame());
    const minion = engage(base0, SANDMAN);
    const staged = playIt(minion.state, BAMF, { attach: minion.id });
    const base = stackEncounterDeck(staged.state, BREAKIN, ADVANCE);
    const { state, events } = driveEventsPicking(DEPS, base, picker(accept(BAMF_REF)), endTurn());
    expect(playerOf(state, P1).discard).toContain(staged.id);
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(moments(events)).toHaveLength(1);
    expect(
      events.some(
        (e) =>
          e.type === "attackResolved" &&
          e.targetInstanceId === identityOf(state) &&
          e.baseAtk === 3 &&
          e.defenseReduction === 3,
      ),
    ).toBe(true);
  });

  it("a stunned enemy does not attack: no interrupt is offered, the stunned card is discarded, the copy stays", () => {
    const staged = playIt(heroGame(), BAMF, { attach: heroGame().activeVillainId! });
    const base = stackEncounterDeck(rhinoStunned(staged.state), BREAKIN, CROWD);
    const spied = spy(picker(accept(BAMF_REF)));
    const { state } = driveEventsPicking(DEPS, base, spied.pick, endTurn());
    expect(offered(spied.seen, BAMF_REF)).toBe(false);
    expect(inst(state, state.activeVillainId!).statuses.stunned ?? 0).toBe(0);
    expect(bamfsOn(state, state.activeVillainId!)).toBe(1);
    expect(inst(state, identityOf(state)).damage).toBe(0);
  });

  it("as Kurt Wagner it is a Hero Interrupt: not offered to him when a copy's minion attacks the other player", () => {
    const base0 = withForm(rhinoStunned(heroGame(TWO)), "alterEgo", P2);
    const minion = engage(base0, SANDMAN, P1);
    const turn2 = driveEvents(DEPS, minion.state, endTurn(P1)).state;
    const given = moveToHand(turn2, P2, BAMF);
    const attached = driveEvents(
      DEPS,
      given.state,
      play(P2, given.ids[0]!, [], { attachToInstanceId: minion.id }),
    ).state;
    expect(hostOf(attached, given.ids[0]!)).toBe(minion.id);
    const spied = spy(picker(accept(BAMF_REF), defend(identityOf(attached, P1))));
    const { state } = driveEventsPicking(
      DEPS,
      stackEncounterDeck(attached, BREAKIN, ADVANCE, ADVANCE),
      spied.pick,
      endTurn(P2),
    );
    expect(offered(spied.seen, BAMF_REF)).toBe(false);
    expect(bamfsOn(state, minion.id)).toBe(1);
  });

  it("two players: a copy on Rhino, which attacks Spider-Man first; Nightcrawler (player 2) answers and is the one hurt", () => {
    const base0 = heroGame(TWO);
    const turn2 = driveEvents(DEPS, base0, endTurn(P1)).state;
    const given = moveToHand(turn2, P2, BAMF);
    const copy = given.ids[0]!;
    const attached = driveEvents(
      DEPS,
      given.state,
      play(P2, copy, [], { attachToInstanceId: base0.activeVillainId! }),
    ).state;
    // Rhino attacks Spider-Man first (boost 2 icons), then Nightcrawler (boost 0 icons).
    const base = stackEncounterDeck(attached, BREAKIN, CROWD, ADVANCE, ADVANCE);
    const spied = spy(picker(accept(BAMF_REF), defend(identityOf(base, P2))));
    const { state, events } = driveEventsPicking(DEPS, base, spied.pick, endTurn(P2));
    expect(offered(spied.seen, BAMF_REF)).toBe(true);
    expect(playerOf(state, P2).discard).toContain(copy);
    expect(moments(events)).toEqual([{ type: "momentRaised", name: "bamf", playerId: P2, sourceInstanceId: copy }]);
    // The attack on Spider-Man: 2 + 2 icons less DEF 3 is 1 damage, and it lands on Nightcrawler; Spider-Man takes none.
    expect(damageTo(events, identityOf(state, P2))).toEqual([1, 1]);
    expect(damageTo(events, identityOf(state, P1))).toEqual([]);
    expect(inst(state, identityOf(state, P2)).damage).toBe(2);
    expect(inst(state, identityOf(state, P1)).damage).toBe(0);
    // He was declared the defender without exhausting; the copy was spent, so Rhino's second attack on him is his own basic defense.
    expect(inst(state, identityOf(state, P2)).exhausted).toBe(true);
  });

  it("it leaves play with its host: a minion with a copy is defeated and the copy goes to its owner's discard pile", () => {
    const base0 = heroGame();
    const minion = engage(base0, SANDMAN);
    const staged = playIt(minion.state, BAMF, { attach: minion.id });
    const defeated = defeatWithAttack(DEPS, staged.state, minion.id);
    expect(cardsInPlay(defeated)).not.toContain(staged.id);
    expect(playerOf(defeated, P1).discard).toContain(staged.id);
  });

  it("max 1 per enemy: a second copy is refused on the villain and accepted on a minion", () => {
    const base0 = heroGame();
    const minion = engage(base0, SANDMAN);
    const first = playIt(minion.state, BAMF, { attach: base0.activeVillainId! });
    const second = moveToHand(first.state, P1, BAMF);
    expect(accepted(second.state, play(P1, second.ids[0]!, [], { attachToInstanceId: base0.activeVillainId! }))).toBe(
      false,
    );
    expect(accepted(second.state, play(P1, second.ids[0]!, [], { attachToInstanceId: minion.id }))).toBe(true);
  });

  it("three copies on three enemies each answer their own attack: Rhino, Sandman and Mercenary", () => {
    const base0 = heroGame();
    const sandman = engage(base0, SANDMAN);
    const merc = engage(sandman.state, MERCENARY);
    const a = playIt(merc.state, BAMF, { attach: base0.activeVillainId! });
    const b = playIt(a.state, BAMF, { attach: sandman.id });
    const c = playIt(b.state, BAMF, { attach: merc.id });
    expect(count(deckCodes(c.state), BAMF) + count(handCodes(c.state), BAMF)).toBe(0);
    // Rhino (ATK 2 + a 2-icon boost) is 1 damage after DEF 3; minions get no boost card: Sandman (3) and Mercenary (1) are 0.
    const base = stackEncounterDeck(c.state, BREAKIN, ADVANCE);
    const { state, events } = driveEventsPicking(DEPS, base, picker(accept(BAMF_REF)), endTurn());
    expect(count(discardCodes(state), BAMF)).toBe(3);
    expect(inPlayIds(state, BAMF)).toEqual([]);
    expect(moments(events)).toHaveLength(3);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(inst(state, identityOf(state)).damage).toBe(1);
  });

  it("Rapid Teleportation returns a copy from the discard pile and it is played again on the villain", () => {
    const base0 = heroGame();
    const first = playIt(base0, BAMF, { attach: base0.activeVillainId! });
    const round1 = stackEncounterDeck(first.state, BREAKIN, ADVANCE);
    const afterVillain = driveEventsPicking(DEPS, round1, picker(accept(BAMF_REF)), endTurn()).state;
    const next = settle(afterVillain, firstLegal, (s) => s.step.phase === "player", DEPS);
    expect(next.step.phase).toBe("player");
    expect(discardCodes(next)).toContain(BAMF);
    // Rapid Teleportation: pay 1 card from hand, the copy comes back to the hand.
    const pay = playerOf(next, P1).hand.find((id) => codeOf(next, id) !== BAMF)!;
    const returned = driveEvents(
      DEPS,
      next,
      use(P1, identityOf(next), "48001a.rapid-teleportation", [{ fromHand: pay }]),
    );
    expect(count(handCodes(returned.state), BAMF)).toBeGreaterThanOrEqual(1);
    expect(count(discardCodes(returned.state), BAMF)).toBe(0);
    const again = playIt(returned.state, BAMF, { attach: next.activeVillainId! });
    expect(bamfsOn(again.state, next.activeVillainId!)).toBe(1);
    const round2 = stackEncounterDeck(again.state, BREAKIN, ADVANCE);
    const { state, events } = driveEventsPicking(DEPS, round2, picker(accept(BAMF_REF)), endTurn());
    expect(moments(events)).toHaveLength(1);
    expect(inst(state, identityOf(state)).damage).toBe(2);
    expect(bamfsOn(state, next.activeVillainId!)).toBe(0);
  });
});

describe("Daytripper (48002): after she enters play, search deck and discard pile for a copy of Bamf! and attach it", () => {
  const villainOf = (s: GameState) => s.activeVillainId!;
  const shuffled = (events: readonly GameEvent[]) => events.filter((e) => e.type === "deckShuffled").length;

  it("is an ally: cost 2, THW 2, ATK 2, 2 hit points; one resource is not enough to play her", () => {
    const given = moveToHand(withResources(heroGame(), 3), P1, DAYTRIPPER);
    const id = given.ids[0]!;
    const payers = playerOf(given.state, P1)
      .hand.filter((h) => h !== id && !KIT.has(codeOf(given.state, h)) && iconsOf(given.state, h) === 1)
      .slice(0, 2);
    expect(accepted(given.state, play(P1, id, payers.slice(0, 1)))).toBe(false);
    expect(accepted(given.state, play(P1, id, payers))).toBe(true);
    const played = playIt(withResources(heroGame(), 3), DAYTRIPPER).state;
    const ally = inPlayIds(played, DAYTRIPPER)[0]!;
    const p = profile(played, ally);
    expect([p.thw, p.atk, p.maxHp]).toEqual([2, 2, 2]);
  });

  it("a copy from the discard pile goes on the minion (Rhino already has one): Rhino and the minion take 1 each", () => {
    const base0 = withResources(heroGame(), 3);
    const sandman = engage(base0, SANDMAN);
    const onRhino = playIt(sandman.state, BAMF, { attach: villainOf(base0) });
    const stagedDiscard = moveToDiscard(onRhino.state, P1, BAMF);
    const copy = stagedDiscard.id;
    const spied = spy(picker(accept(DAY_REF), take(copy, sandman.id)));
    const { state, events } = playIt(stagedDiscard.state, DAYTRIPPER, { pick: spied.pick });
    // The search offers the copy in the discard pile and every copy in the deck (the one in hand is not searched).
    const search = spied.seen.find((p) => p.kind === "chooseCards")!;
    expect(search.options).toContain(copy);
    expect(search.options).toHaveLength(1 + count(deckCodes(stagedDiscard.state), BAMF));
    // Rhino already has one: the only legal host offered is the minion.
    expect(hostOf(state, copy)).toBe(sandman.id);
    expect(bamfsOn(state, villainOf(state))).toBe(1);
    expect(damageTo(events, villainOf(state))).toEqual([1]);
    expect(damageTo(events, sandman.id)).toEqual([1]);
    expect(inst(state, villainOf(state)).damage).toBe(1);
    expect(inst(state, sandman.id).damage).toBe(1);
    expect(count(discardCodes(state), BAMF)).toBe(0);
    expect(shuffled(events)).toBe(1);
  });

  it("two candidates: with a copy on Rhino the host choice is exactly Sandman and Mercenary, and the pick receives the copy", () => {
    const base0 = withResources(heroGame(), 3);
    const sandman = engage(base0, SANDMAN);
    const merc = engage(sandman.state, MERCENARY);
    const onRhino = playIt(merc.state, BAMF, { attach: villainOf(base0) });
    const stagedDiscard = moveToDiscard(onRhino.state, P1, BAMF);
    const spied = spy(picker(accept(DAY_REF), take(stagedDiscard.id, merc.id)));
    const { state, events } = playIt(stagedDiscard.state, DAYTRIPPER, { pick: spied.pick });
    const where = spied.seen.find((p) => p.kind === "chooseTarget")!;
    expect([...where.options].sort()).toEqual([sandman.id, merc.id].sort());
    expect(hostOf(state, stagedDiscard.id)).toBe(merc.id);
    expect(damageTo(events, merc.id)).toEqual([1]);
    expect(damageTo(events, villainOf(state))).toEqual([1]);
    expect(damageTo(events, sandman.id)).toEqual([]);
  });

  it("with no legal enemy (Rhino has a copy, nothing else) the copy stays in the discard pile; Rhino still takes 1", () => {
    const base0 = withResources(heroGame(), 3);
    const onRhino = playIt(base0, BAMF, { attach: villainOf(base0) });
    const stagedDiscard = moveToDiscard(onRhino.state, P1, BAMF);
    const spied = spy(picker(accept(DAY_REF), take(stagedDiscard.id)));
    const { state, events } = playIt(stagedDiscard.state, DAYTRIPPER, { pick: spied.pick });
    expect(spied.seen.some((p) => p.kind === "chooseTarget")).toBe(false);
    expect(playerOf(state, P1).discard).toContain(stagedDiscard.id);
    expect(hostOf(state, stagedDiscard.id)).toBeNull();
    expect(bamfsOn(state, villainOf(state))).toBe(1);
    expect(damageTo(events, villainOf(state))).toEqual([1]);
    expect(shuffled(events)).toBe(1);
  });

  it("from the deck: with no copy in the discard pile one is attached to Rhino and Rhino takes 1", () => {
    const base0 = withResources(heroGame(), 3);
    const inDeck = deckCodes(base0).indexOf(BAMF) >= 0 ? base0 : moveToHand(base0, P1, BAMF).state;
    const deckCopies = playerOf(inDeck, P1).deck.filter((id) => codeOf(inDeck, id) === BAMF);
    expect(deckCopies.length).toBeGreaterThan(0);
    const handBefore = count(handCodes(inDeck), BAMF);
    const spied = spy(picker(accept(DAY_REF), take(deckCopies[0]!)));
    const { state, events } = playIt(inDeck, DAYTRIPPER, { pick: spied.pick });
    expect(hostOf(state, deckCopies[0]!)).toBe(villainOf(state));
    expect(bamfsOn(state, villainOf(state))).toBe(1);
    expect(damageTo(events, villainOf(state))).toEqual([1]);
    expect(count(handCodes(state), BAMF)).toBe(handBefore);
    expect(count(deckCodes(state), BAMF)).toBe(deckCopies.length - 1);
    expect(shuffled(events)).toBe(1);
  });

  it("every copy in hand: nothing is found, nothing is attached, no enemy takes damage, the deck is still shuffled", () => {
    const base0 = withResources(heroGame(), 3);
    const inHand = moveToHand(base0, P1, BAMF, BAMF, BAMF).state;
    expect(count(deckCodes(inHand), BAMF) + count(discardCodes(inHand), BAMF)).toBe(0);
    const { state, events } = playIt(inHand, DAYTRIPPER, { pick: picker(accept(DAY_REF)) });
    expect(bamfsOn(state, villainOf(state))).toBe(0);
    expect(damageTo(events, villainOf(state))).toEqual([]);
    expect(count(handCodes(state), BAMF)).toBe(3);
    expect(shuffled(events)).toBe(1);
  });

  it("an enemy that already has a copy takes 1 even if hers went elsewhere: Rhino and Sandman each hold one", () => {
    const base0 = withResources(heroGame(), 3);
    const sandman = engage(base0, SANDMAN);
    const a = playIt(sandman.state, BAMF, { attach: villainOf(base0) });
    const b = playIt(a.state, BAMF, { attach: sandman.id });
    const { events } = playIt(b.state, DAYTRIPPER, { pick: picker(accept(DAY_REF)) });
    expect(damageTo(events, villainOf(base0))).toEqual([1]);
    expect(damageTo(events, sandman.id)).toEqual([1]);
  });
});

describe("Kurt's Chapel (48003): Kurt Wagner gets +1 REC; Alter-Ego Response after a basic recovery", () => {
  const recover: Command = { type: "basicRecover", playerId: P1 };
  const chapelGame = (seats: readonly Seat[] = [NC()]) => {
    const placed = playIt(withResources(setupGame(seats), 2), CHAPEL);
    return placed;
  };
  const kurtId = (s: GameState, p: PlayerId = P1) => identityOf(s, p);

  it("is a support: cost 1, played in alter-ego form and exhausted by nothing yet", () => {
    const placed = chapelGame();
    expect(inPlayIds(placed.state, CHAPEL)).toEqual([placed.id]);
    expect(inst(placed.state, placed.id).exhausted).toBe(false);
  });
  it("Kurt Wagner REC 3 plus 1: a basic recovery from 5 damage heals 4", () => {
    const placed = chapelGame();
    const hurt = withDamage(placed.state, kurtId(placed.state), 5);
    const { state } = driveEvents(DEPS, hurt, recover);
    expect(inst(state, kurtId(state)).damage).toBe(1);
  });
  it("without the Chapel the same recovery heals 3 (control)", () => {
    const hurt = withDamage(setupGame(), kurtId(setupGame()), 5);
    expect(inst(driveEvents(DEPS, hurt, recover).state, kurtId(hurt)).damage).toBe(2);
  });
  it("after the recovery it exhausts and the chosen player (herself, a solo game) draws 1 card", () => {
    const placed = chapelGame();
    const hurt = withDamage(placed.state, kurtId(placed.state), 5);
    const handBefore = playerOf(hurt, P1).hand.length;
    const spied = spy(picker(accept(CHAPEL_REF)));
    const { state } = driveEventsPicking(DEPS, hurt, spied.pick, recover);
    expect(offered(spied.seen, CHAPEL_REF)).toBe(true);
    expect(inst(state, placed.id).exhausted).toBe(true);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore + 1);
    expect(playerOf(state, P1).deck).toHaveLength(playerOf(hurt, P1).deck.length - 1);
  });
  it("declined: nothing is drawn and the Chapel stays ready", () => {
    const placed = chapelGame();
    const hurt = withDamage(placed.state, kurtId(placed.state), 5);
    const { state } = driveEvents(DEPS, hurt, recover);
    expect(inst(state, placed.id).exhausted).toBe(false);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(hurt, P1).hand.length);
  });
  it("an exhausted Chapel is not offered", () => {
    const placed = chapelGame();
    const hurt = patchInstance(withDamage(placed.state, kurtId(placed.state), 5), placed.id, { exhausted: true });
    const spied = spy(picker(accept(CHAPEL_REF)));
    const { state } = driveEventsPicking(DEPS, hurt, spied.pick, recover);
    expect(offered(spied.seen, CHAPEL_REF)).toBe(false);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(hurt, P1).hand.length);
  });
  it("two players: Kurt (player 2) recovers and chooses Spider-Man, who draws 1; Kurt draws nothing", () => {
    const two = driveEvents(DEPS, setupGame([SM(), NC()]), endTurn(P1)).state;
    const placed = playIt(withResources(two, 2, P2), CHAPEL, { p: P2 });
    const hurt = withDamage(placed.state, kurtId(placed.state, P2), 5);
    const mine = playerOf(hurt, P2).hand.length;
    const theirs = playerOf(hurt, P1).hand.length;
    const spied = spy(
      picker(accept(CHAPEL_REF), (st) =>
        st.pendingChoice?.prompt.kind === "choosePlayer" ? [P1 as string] : undefined,
      ),
    );
    const { state } = driveEventsPicking(DEPS, hurt, spied.pick, { type: "basicRecover", playerId: P2 });
    expect(inst(state, kurtId(state, P2)).damage).toBe(1);
    expect(playerOf(state, P1).hand).toHaveLength(theirs + 1);
    expect(playerOf(state, P2).hand).toHaveLength(mine);
    expect(inst(state, placed.id).exhausted).toBe(true);
  });
  it("only Kurt Wagner gets the REC: Peter Parker (player 1) recovering beside a Chapel heals his own 3", () => {
    const two = setupGame([SM(), NC()]);
    const turn2 = driveEvents(DEPS, two, endTurn(P1)).state;
    const placed = playIt(withResources(turn2, 2, P2), CHAPEL, { p: P2 });
    expect(profile(placed.state, identityOf(placed.state, P1)).rec).toBe(profile(two, identityOf(two, P1)).rec);
    expect(profile(placed.state, identityOf(placed.state, P2)).rec).toBe(4);
  });
  it("in hero form there is no basic recovery to answer: the Chapel's REC is Kurt Wagner's alone", () => {
    const placed = chapelGame();
    const hero = withForm(placed.state, { heroForm: 0 });
    expect(accepted(hero, recover)).toBe(false);
  });
});

describe("Kurt's Cutlasses (48004): Nightcrawler gets +1 ATK, +1 DEF and retaliate 1; counts as 2 restricted cards", () => {
  const withCutlasses = (seats: readonly Seat[] = [NC()]) => {
    const base = withResources(heroGame(seats), 6);
    return playIt(base, CUTLASSES, { attach: identityOf(base) });
  };

  it("cost 2, attached to his identity: ATK 1 to 2, DEF 3 to 4, retaliate 1 (control: none without it)", () => {
    const base = heroGame();
    expect(keywordTotal(base, identityOf(base), "retaliate", DEPS)).toBe(0);
    expect([profile(base, identityOf(base)).atk, profile(base, identityOf(base)).def]).toEqual([1, 3]);
    const { state, id } = withCutlasses();
    expect(hostOf(state, id)).toBe(identityOf(state));
    const p = profile(state, identityOf(state));
    expect([p.atk, p.def]).toEqual([2, 4]);
    expect(keywordTotal(state, identityOf(state), "retaliate", DEPS)).toBe(1);
  });
  it("as Kurt Wagner (the alter-ego face) there is no bonus and no retaliate", () => {
    const { state } = withCutlasses();
    const kurt = withForm(state, "alterEgo");
    expect(keywordTotal(kurt, identityOf(kurt), "retaliate", DEPS)).toBe(0);
    expect(profile(kurt, identityOf(kurt)).def).toBe(profile(setupGame(), identityOf(setupGame())).def);
  });
  it("a minion attacks him: DEF 4 against Mercenary (ATK 1) takes nothing, and retaliate deals the minion 1 damage", () => {
    const { state: s } = withCutlasses();
    const merc = engage(rhinoStunned(s), MERCENARY);
    const { state, events } = driveEventsPicking(
      DEPS,
      stackEncounterDeck(merc.state, ADVANCE, CROWD),
      picker(defend(identityOf(s))),
      endTurn(),
    );
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, merc.id).damage).toBe(1);
    expect(damageTo(events, merc.id)).toEqual([1]);
  });
  it("Rhino (ATK 2 + a 2-icon boost) against DEF 4 deals nothing, and retaliate hits Rhino for 1", () => {
    const { state: s } = withCutlasses();
    const { state } = driveEventsPicking(
      DEPS,
      stackEncounterDeck(s, BREAKIN, ADVANCE),
      picker(defend(identityOf(s))),
      endTurn(),
    );
    expect(inst(state, identityOf(state)).damage).toBe(0);
    expect(inst(state, state.activeVillainId!).damage).toBe(1);
  });
});

describe("Restricted limit with Kurt's Cutlasses (counts as 2) and Prehensile Tail (1 additional restricted upgrade)", () => {
  const SEAT = NC(PISTOL, PISTOL, PISTOL, FIRST_AID);
  const start = () => withResources(heroGame([SEAT], 1, false), 12);
  /** Plays each card in turn on his identity, answering any prompt with `pick`. */
  function playAll(s: GameState, codes: readonly string[], pick: Picker = firstLegal) {
    let state = s;
    const ids: InstanceId[] = [];
    for (const code of codes) {
      const r = playIt(state, code, { attach: identityOf(state), pick });
      state = r.state;
      ids.push(r.id);
    }
    return { state, ids };
  }
  const here = (s: GameState, ids: readonly InstanceId[]): boolean[] => ids.map((id) => cardsInPlay(s).includes(id));
  const held = (s: GameState): InstanceId[] => inPlayIds(s, PISTOL);

  it("Plasma Pistol is a restricted upgrade; the Cutlasses and the Tail are not (no keyword)", () => {
    for (const code of [CUTLASSES, TAIL]) {
      expect((BY_ID.get(code) as unknown as { keywords: unknown[] }).keywords).toEqual([]);
    }
    expect((BY_ID.get(PISTOL) as unknown as { keywords: { name: string }[] }).keywords.map((k) => k.name)).toContain(
      "restricted",
    );
  });

  it("the Cutlasses alone fill the limit: a Pistol played beside them is the only choice and is discarded", () => {
    const { state, ids } = playAll(start(), [CUTLASSES, PISTOL]);
    expect(here(state, ids)).toEqual([true, false]);
    expect(discardCodes(state)).toContain(PISTOL);
    expect(held(state)).toEqual([]);
  });

  it("one Pistol in play, then the Cutlasses: load 3 of 2, the Pistol is discarded and the Cutlasses stay", () => {
    const { state, ids } = playAll(start(), [PISTOL, CUTLASSES]);
    expect(here(state, ids)).toEqual([false, true]);
  });

  it("two Pistols in play (2 of 2), then the Cutlasses: load 4 of 2, both Pistols go and the Cutlasses stay", () => {
    const { state, ids } = playAll(start(), [PISTOL, PISTOL]);
    expect(here(state, ids)).toEqual([true, true]);
    const next = playAll(state, [CUTLASSES]);
    expect(here(next.state, [...ids, ...next.ids])).toEqual([false, false, true]);
    expect(count(discardCodes(next.state), PISTOL)).toBe(2);
  });

  it("without the Tail two Pistols stay and a third discards one of them (control, no Cutlasses)", () => {
    const { state, ids } = playAll(start(), [PISTOL, PISTOL, PISTOL]);
    expect(held(state)).toHaveLength(2);
    expect(here(state, ids).filter(Boolean)).toHaveLength(2);
  });

  it("the Tail alone: three Pistols stay (limit 3 for keyword upgrades)", () => {
    const { state, ids } = playAll(start(), [TAIL, PISTOL, PISTOL, PISTOL]);
    expect(here(state, ids)).toEqual([true, true, true, true]);
    expect(restrictedLimitFor(state, DEPS, P1, held(state))).toBe(3);
  });

  it("the limit with the Tail is 3 only for held keyword upgrades: the Cutlasses make no room", () => {
    const { state, ids } = playAll(start(), [TAIL, CUTLASSES]);
    expect(restrictedLimitFor(state, DEPS, P1, [])).toBe(2);
    expect(restrictedLimitFor(state, DEPS, P1, [ids[1]!])).toBe(2);
    const withPistol = playAll(state, [PISTOL]);
    expect(restrictedLimitFor(withPistol.state, DEPS, P1, held(withPistol.state))).toBe(3);
  });

  it("the Cutlasses, the Tail and a Pistol: load 3 of 3, all three stay", () => {
    const { state, ids } = playAll(start(), [CUTLASSES, TAIL, PISTOL]);
    expect(here(state, ids)).toEqual([true, true, true]);
  });

  it("the Cutlasses, the Tail, a Pistol and a second Pistol: load 4 of 3, one Pistol goes (his choice), never the Cutlasses or the Tail", () => {
    const first = playAll(start(), [CUTLASSES, TAIL, PISTOL]);
    const spied = spy(firstLegal);
    const second = playAll(first.state, [PISTOL], spied.pick);
    const pistols = held(second.state);
    expect(pistols).toHaveLength(1);
    const cut = inPlayIds(second.state, CUTLASSES);
    const tail = inPlayIds(second.state, TAIL);
    expect([cut.length, tail.length]).toEqual([1, 1]);
    const ask = spied.seen.find((p) => p.options.includes(first.ids[2]!));
    expect(ask).toBeDefined();
    expect([...ask!.options].sort()).toEqual([first.ids[2]!, second.ids[0]!].sort());
    expect(ask!.options).not.toContain(first.ids[0]!);
    expect(ask!.options).not.toContain(first.ids[1]!);
  });

  it("his choice is kept: he discards the new Pistol and the old one stays", () => {
    const first = playAll(start(), [CUTLASSES, TAIL, PISTOL]);
    const keepOld = (s: GameState) => {
      const c = s.pendingChoice;
      if (!c || c.prompt.kind === "chooseTriggers") return undefined;
      const wanted = c.options.find((o) => o.optionId !== first.ids[2]);
      return wanted ? [wanted.optionId] : undefined;
    };
    const again = playAll(first.state, [PISTOL], picker(keepOld));
    expect(held(again.state)).toEqual([first.ids[2]!]);
  });

  it("the Tail leaves play with the Cutlasses and a Pistol in play: load 3 of 2, the Pistol is discarded", () => {
    const placed = playAll(start(), [CUTLASSES, TAIL, PISTOL]);
    // Caught Off Guard (Standard): "discard an upgrade or support you control", dealt to him at the end of the round.
    const tail = placed.ids[1]!;
    const pickTail = picker(take(tail));
    const base = stackEncounterDeck(placed.state, ADVANCE, CAUGHT_OFF_GUARD);
    const { state } = driveEventsPicking(DEPS, base, pickTail, endTurn());
    expect(cardsInPlay(state)).not.toContain(tail);
    expect(discardCodes(state)).toContain(TAIL);
    expect(here(state, [placed.ids[0]!])).toEqual([true]);
    expect(held(state)).toEqual([]);
    expect(playerOf(state, P1).discard).toContain(placed.ids[2]!);
    expect(cardsInPlay(state)).not.toContain(placed.ids[2]!);
  });
});

describe("Prehensile Tail (48005): [wild] resource for an event", () => {
  const withTail = () => {
    const base = withResources(heroGame([NC(FIRST_AID)]), 6);
    return playIt(base, TAIL, { attach: identityOf(base) });
  };
  it("pays for an event: First Aid (cost 1) is played with the Tail alone and the Tail exhausts", () => {
    const { state: s, id: tail } = withTail();
    const given = moveToHand(s, P1, FIRST_AID);
    const aid = given.ids[0]!;
    const { state } = driveEvents(
      DEPS,
      given.state,
      play(P1, aid, [], { abilities: [resourceAbility(tail, TAIL_RESOURCE)] }),
    );
    expect(inst(state, tail).exhausted).toBe(true);
    expect(playerOf(state, P1).discard).toContain(aid);
  });
  it("is refused for an ally (Daytripper, cost 2: the Tail plus one card), though the same card plays with two cards", () => {
    const { state: s, id: tail } = withTail();
    const given = moveToHand(s, P1, DAYTRIPPER);
    const id = given.ids[0]!;
    const payers = playerOf(given.state, P1)
      .hand.filter((h) => h !== id && !KIT.has(codeOf(given.state, h)) && iconsOf(given.state, h) === 1)
      .slice(0, 2);
    expect(
      accepted(given.state, play(P1, id, payers.slice(0, 1), { abilities: [resourceAbility(tail, TAIL_RESOURCE)] })),
    ).toBe(false);
    expect(accepted(given.state, play(P1, id, payers))).toBe(true);
  });
  it("is refused for Rapid Teleportation (an ability, not an event)", () => {
    const { state: s, id: tail } = withTail();
    const staged = moveToDiscard(s, P1, BAMF).state;
    expect(
      accepted(
        staged,
        use(P1, identityOf(staged), "48001a.rapid-teleportation", [resourceAbility(tail, TAIL_RESOURCE)]),
      ),
    ).toBe(false);
    const pay = playerOf(staged, P1).hand.find((h) => !KIT.has(codeOf(staged, h)))!;
    expect(accepted(staged, use(P1, identityOf(staged), "48001a.rapid-teleportation", [{ fromHand: pay }]))).toBe(true);
  });
  it("works in alter-ego form too (a Resource has no form): First Aid paid with the Tail as Kurt Wagner", () => {
    const { state: s, id: tail } = withTail();
    const kurt = withForm(s, "alterEgo");
    const given = moveToHand(kurt, P1, FIRST_AID);
    expect(
      accepted(given.state, play(P1, given.ids[0]!, [], { abilities: [resourceAbility(tail, TAIL_RESOURCE)] })),
    ).toBe(true);
  });
  it("an exhausted Tail pays nothing", () => {
    const { state: s, id: tail } = withTail();
    const tired = patchInstance(s, tail, { exhausted: true });
    const given = moveToHand(tired, P1, FIRST_AID);
    expect(
      accepted(given.state, play(P1, given.ids[0]!, [], { abilities: [resourceAbility(tail, TAIL_RESOURCE)] })),
    ).toBe(false);
  });
});
