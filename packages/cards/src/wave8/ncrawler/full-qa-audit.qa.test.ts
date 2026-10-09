import { WAVE7_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS, cardId, encounterSetId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  characterProfile,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
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
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE8_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Full QA card-text audit of the Nightcrawler pack (2026-10-09). Real commands in a real game, Nightcrawler's starter
 * deck (and Spider-Man as the other seat) against Rhino. Covers what the pack's own tests do not: the interactions of
 * Bamf!'s defense with other cards (Kurt's Cutlasses' retaliate, Azazel's Sword, Riposte, Astonishing X-Men), a card
 * controlled by one player reacting to another player's hero, the "ability is canceled except its costs" rule for the
 * attack and thwart events when the hero is stunned or confused, and the form-change cards beside Moira MacTaggert.
 */
const DEPS = WAVE8_DEPS;
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...WAVE8_CARDS];

const BAMF = "48006";
const BAMF_REF = "48006.bamf-interrupt";
const SWORD = "48029";
const SWORD_REF = "48029.azazels-sword-response";
const RIPOSTE = "48018";
const RIPOSTE_REF = "48018.riposte-interrupt";
const XMEN_REF = "48020.astonishing-x-men-response";
const CONTROL_REF = "48015.under-control-response";
const CHAPEL_REF = "48003.kurts-chapel-response";
const MOIRA_REF = "48022.moira-mactaggert-response";
const ADVANCE = "01186";
const MERCENARY = "01101";

const PRECON = WAVE8_STARTER_DECKS.find((d) => d.id === "nightcrawler-protection")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
/** Cards a test stages by name: never used as payment or filler. */
const KIT = new Set([
  "48003",
  "48004",
  "48006",
  "48007",
  "48008",
  "48009",
  "48010",
  "48012",
  "48015",
  "48018",
  "48020",
  "48022",
]);
/** The top `n` cards of the encounter deck relabeled as Advance (0 boost icons; as a revealed card Rhino schemes). */
function advances(state: GameState, n: number): GameState {
  const ids = activeEncounterDeck(state).deck.slice(0, n);
  return ids.reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
}
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as {
    resourceIcons?: Record<string, number>;
    producesIcons?: Record<string, number>;
  };
  return Object.values(card.resourceIcons ?? card.producesIcons ?? {}).reduce((a, b) => a + b, 0);
};
const damageTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === target ? [e.amount] : []));
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;

type Seat = { readonly kind: "nc" | "sm"; readonly extra: readonly string[] };
const NC = (...extra: string[]): Seat => ({ kind: "nc", extra });
const SM = (...extra: string[]): Seat => ({ kind: "sm", extra });

/** The seats against Rhino, through setup, in alter-ego form; decks may hold any card (`requireLegalDecks: false`). */
function setupGame(seats: readonly Seat[]): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = seats.map((seat) => {
    const base =
      seat.kind === "nc"
        ? { identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, deck: PRECON_DECK }
        : coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1, modularSetIds: [] })
            .players[0]!;
    return { ...base, deck: [...base.deck, ...seat.extra.map((code) => cardId(code))] };
  });
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  // Headroom on the main scheme: the staged villain phases accelerate it.
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}
const heroGame = (seats: readonly Seat[]): GameState =>
  seats.reduce<GameState>((s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2), setupGame(seats));
/** Spider-Man is seat 1, Nightcrawler seat 2, both in hero form, and it is Nightcrawler's turn. */
const nightcrawlerTurn = (...extra: string[]): GameState => {
  const s = heroGame([SM(), NC(...extra)]);
  return driveEventsPicking(DEPS, s, firstLegal, endTurn(P1)).state;
};

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
const rhinoStunned = (s: GameState): GameState =>
  patchInstance(s, s.activeVillainId!, { statuses: { ...inst(s, s.activeVillainId!).statuses, stunned: 1 } });

/** Plays `code` from a hand of the player's, paying with hand resource cards other than those in `keep`. */
function playIt(
  s: GameState,
  code: string,
  o: { p?: PlayerId; attach?: InstanceId; keep?: readonly InstanceId[] } = {},
  pick: Picker = firstLegal,
) {
  const p = o.p ?? P1;
  const given = moveToHand(s, p, code);
  const id = given.ids[0]!;
  const cost = (BY_ID.get(code) as { cost: number }).cost;
  const staged = withResources(given.state, p, 4);
  const payers: InstanceId[] = [];
  let paid = 0;
  for (const h of playerOf(staged, p).hand) {
    if (paid >= cost) break;
    if (h === id || (o.keep ?? []).includes(h) || KIT.has(codeOf(staged, h)) || iconsOf(staged, h) === 0) continue;
    payers.push(h);
    paid += iconsOf(staged, h);
  }
  const r = driveEventsPicking(
    DEPS,
    staged,
    pick,
    play(p, id, payers, o.attach ? { attachToInstanceId: o.attach } : {}),
  );
  return { state: r.state, id, events: r.events };
}
/** Adds `n` resource cards from the deck to the hand so a test can pay for several cards. */
function withResources(s: GameState, p: PlayerId, n: number): GameState {
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
const defend =
  (id: InstanceId): Rule =>
  (s) =>
    s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === id)
      ? [id]
      : undefined;
const take =
  (...ids: readonly string[]): Rule =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice || (choice.prompt.kind !== "chooseCards" && choice.prompt.kind !== "chooseTarget")) return undefined;
    const hits = ids.filter((id) => choice.options.some((o) => o.optionId === id));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : undefined;
  };
/** Pays a response or interrupt event's cost (a `payForCard` prompt) with one printed-resource card from the hand. */
const pay: Rule = (s) => {
  const choice = s.pendingChoice;
  if (choice?.prompt.kind !== "payForCard") return undefined;
  const ids = choice.options
    .map((o) => o.optionId)
    .filter((o) => {
      const id = o.replace("hand:", "") as InstanceId;
      return iconsOf(s, id) > 0 && codeOf(s, id) !== RIPOSTE;
    });
  return ids.slice(0, 1);
};
type Seen = { kind: string; player: string; options: string[] };
function spy(pick: Picker): { readonly pick: Picker; readonly seen: Seen[] } {
  const seen: Seen[] = [];
  return {
    seen,
    pick: (s) => {
      const c = s.pendingChoice!;
      seen.push({ kind: c.prompt.kind, player: c.playerId as string, options: c.options.map((o) => o.optionId) });
      return pick(s);
    },
  };
}
/** The players a `chooseTriggers` prompt naming `ref` was put to. */
const offeredTo = (seen: readonly Seen[], ref: string): string[] =>
  seen.filter((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(ref))).map((p) => p.player);

/** A Bamf! of Nightcrawler's (player 2) on Rhino, in his turn; the encounter deck stacked with 0-icon boost cards. */
function bamfOnRhino(base: GameState): { state: GameState; copy: InstanceId; rhino: InstanceId } {
  const rhino = base.activeVillainId!;
  const staged = playIt(base, BAMF, { p: P2, attach: rhino });
  return { state: advances(staged.state, 8), copy: staged.id, rhino };
}

describe("Bamf! (48006) beside the cards that read a defense", () => {
  it("Kurt's Cutlasses (retaliate 1): Bamf! makes Nightcrawler the defender of Rhino's attack on Spider-Man, and Rhino takes the retaliate (RRG 1.8 Retaliate X, Defend p. 15)", () => {
    const base = nightcrawlerTurn("48004");
    const nc = identityOf(base, P2);
    const armed = playIt(base, "48004", { p: P2, attach: nc });
    const { state, rhino } = bamfOnRhino(armed.state);
    const { events, state: after } = driveEventsPicking(DEPS, state, picker(accept(BAMF_REF), defend(nc)), endTurn(P2));
    expect(damageTo(events, identityOf(after, P1))).toEqual([]);
    expect(damageTo(events, rhino)[0]).toBe(1);
  });

  // RRG 1.8 p. 15 (Defend): "after [enemy] attacks you" refers to the player whose character defended, here Nightcrawler's player.
  it.fails("Azazel's Sword: 'after the attached enemy attacks you' is the player whose character defended (RRG p. 15), so the Sword is offered to Nightcrawler's player for the attack on Spider-Man", () => {
    const base = nightcrawlerTurn();
    const { state: s, rhino } = bamfOnRhino(base);
    const sword = Object.keys(s.instances).find((id) => codeOf(s, id as InstanceId) === SWORD) as InstanceId;
    const hung = patchInstance(
      patchInstance(
        {
          ...s,
          players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== sword) })),
        },
        sword,
        { attachedTo: rhino, faceup: true },
      ),
      rhino,
      { attachments: [...inst(s, rhino).attachments, sword] },
    );
    const spied = spy(picker(accept(BAMF_REF), defend(identityOf(hung, P2))));
    driveEventsPicking(DEPS, hung, spied.pick, endTurn(P2));
    const to = offeredTo(spied.seen, SWORD_REF);
    expect(to.length).toBeGreaterThan(0);
    expect(to.every((p) => p === "p2")).toBe(true);
  });

  it("Riposte: 'when your hero defends' is met by Bamf!'s defense; +2 DEF stops Rhino and he takes 3 (RRG p. 15, 'Abilities that trigger when your hero defends can be triggered when resolving a defense-labeled ability')", () => {
    const base = nightcrawlerTurn(RIPOSTE);
    const { state: s, rhino } = bamfOnRhino(moveToHand(base, P2, RIPOSTE).state);
    const spied = spy(picker(accept(BAMF_REF), accept(RIPOSTE_REF), pay, defend(identityOf(s, P2))));
    const { state, events } = driveEventsPicking(DEPS, s, spied.pick, endTurn(P2));
    expect(offeredTo(spied.seen, RIPOSTE_REF)[0]).toBe("p2");
    expect(damageTo(events, identityOf(state, P2))).toEqual([]);
    expect(damageTo(events, rhino)).toContain(3);
  });

  it("Riposte is 'your hero': Nightcrawler's player is not offered it when Spider-Man defends his own attack", () => {
    const base = nightcrawlerTurn();
    const given = moveToHand(base, P2, RIPOSTE);
    const s = advances(given.state, 8);
    const spied = spy(picker(accept(RIPOSTE_REF), defend(identityOf(s, P1)), defend(identityOf(s, P2))));
    driveEventsPicking(DEPS, s, spied.pick, endTurn(P2));
    // Spider-Man defends the first attack (nothing offered to Nightcrawler's player); Nightcrawler defends the second, where Riposte is his.
    expect(offeredTo(spied.seen, RIPOSTE_REF)).toHaveLength(1);
  });

  it("Astonishing X-Men: Nightcrawler defends through Bamf! at DEF 3 against Rhino's 2 and takes nothing, so 1 threat comes off (5 to 4)", () => {
    const base = heroGame([NC()]);
    const rhino = base.activeVillainId!;
    const scheme = playIt(base, "48020", {});
    const bamf = playIt(scheme.state, BAMF, { attach: rhino });
    const s = advances(bamf.state, 8);
    const spied = spy(picker(accept(BAMF_REF), accept(XMEN_REF)));
    const { state } = driveEventsPicking(DEPS, s, spied.pick, endTurn(P1));
    expect(offeredTo(spied.seen, XMEN_REF)).toEqual(["p1"]);
    expect(inst(state, scheme.id).threat).toBe(4);
  });

  it("Astonishing X-Men: Spider-Man (not an X-MEN character) defending and taking no damage removes nothing", () => {
    const base = nightcrawlerTurn("48020");
    const scheme = playIt(base, "48020", { p: P2 });
    expect(inst(scheme.state, scheme.id).threat).toBe(5);
    const s = advances(scheme.state, 8);
    const spied = spy(picker(accept(XMEN_REF), defend(identityOf(s, P1))));
    const { state } = driveEventsPicking(DEPS, s, spied.pick, endTurn(P2));
    // Rhino also attacks Nightcrawler (an X-MEN character, undefended here, 2 damage taken): no removal either.
    expect(offeredTo(spied.seen, XMEN_REF)).toEqual([]);
    expect(inst(state, scheme.id).threat).toBe(5);
  });
});

describe("Under Control (48015) and Kurt's Chapel (48003) in a two-player game", () => {
  it("Under Control on a minion: 'a hero defends against its attack and takes no damage' is any hero, so Spider-Man's defense of his seat is answered for Nightcrawler's player", () => {
    const base = nightcrawlerTurn("48015");
    const merc = engage(rhinoStunned(base), MERCENARY, P1);
    const placed = playIt(merc.state, "48015", { p: P2, attach: merc.id });
    const s = advances(placed.state, 8);
    const spied = spy(picker(defend(identityOf(s, P1)), accept(CONTROL_REF)));
    const { state } = driveEventsPicking(DEPS, s, spied.pick, endTurn(P2));
    expect(offeredTo(spied.seen, CONTROL_REF)).toEqual(["p2"]);
    // 4 damage defeats the Mercenary (3 hit points): it is in the encounter discard pile.
    expect(activeEncounterDeck(state).discard).toContain(merc.id);
  });

  it("Kurt's Chapel: 'after you make a basic recovery' is Kurt's own, so Spider-Man's player recovering offers it nothing", () => {
    const s0 = setupGame([SM(), NC("48003")]);
    const turn2 = driveEventsPicking(DEPS, s0, firstLegal, endTurn(P1)).state;
    const chapel = playIt(turn2, "48003", { p: P2 });
    // Back to Spider-Man's turn (round 2) in alter-ego form, hurt, with the Chapel in play for the other seat.
    const round2 = driveEventsPicking(DEPS, chapel.state, firstLegal, endTurn(P2)).state;
    const myTurn = driveEventsPicking(
      DEPS,
      round2,
      firstLegal,
      endTurn(round2.players.find((p) => p.playerId !== P1) ? P2 : P2),
    ).state;
    const hurt = withDamage(withForm(myTurn, "alterEgo", P1), identityOf(myTurn, P1), 4);
    const spied = spy(picker(accept(CHAPEL_REF)));
    const { state } = driveEventsPicking(DEPS, hurt, spied.pick, { type: "basicRecover", playerId: P1 });
    expect(playerOf(hurt, P2).playArea).toContain(chapel.id);
    expect(offeredTo(spied.seen, CHAPEL_REF)).toEqual([]);
    expect(inst(state, chapel.id).exhausted).toBe(false);
  });
});

describe("Canceled labeled abilities (RRG 1.8 'Labeled Ability', p. 31: a status card that cancels the label cancels the whole ability except its costs)", () => {
  it("Teleport Drop with Nightcrawler stunned: the Bamf! is still discarded (the cost), Rhino takes nothing and is not stunned, and the stunned card is removed", () => {
    const base = heroGame([NC()]);
    const rhino = base.activeVillainId!;
    const bamf = playIt(base, BAMF, { attach: rhino });
    const nc = identityOf(bamf.state);
    const stunnedNc = patchInstance(bamf.state, nc, { statuses: { ...inst(bamf.state, nc).statuses, stunned: 1 } });
    const drop = playIt(stunnedNc, "48008", {}, picker(take(bamf.id)));
    expect(inst(drop.state, rhino).damage).toBe(0);
    expect(inst(drop.state, rhino).statuses.stunned ?? 0).toBe(0);
    expect(inst(drop.state, nc).statuses.stunned ?? 0).toBe(0);
    expect(playerOf(drop.state, P1).discard).toContain(bamf.id);
  });

  it("'Port and Punch with Nightcrawler stunned: neither the 3 damage to the target nor the 3 to each enemy with a Bamf! is dealt", () => {
    const base = heroGame([NC()]);
    const rhino = base.activeVillainId!;
    const merc = engage(base, MERCENARY);
    const bamf = playIt(merc.state, BAMF, { attach: rhino });
    const nc = identityOf(bamf.state);
    const stunnedNc = patchInstance(bamf.state, nc, { statuses: { ...inst(bamf.state, nc).statuses, stunned: 1 } });
    const punch = playIt(stunnedNc, "48007", {}, picker(take(merc.id)));
    expect(inst(punch.state, merc.id).damage).toBe(0);
    expect(inst(punch.state, rhino).damage).toBe(0);
    expect(inst(punch.state, nc).statuses.stunned ?? 0).toBe(0);
  });

  it("Scout Ahead with Nightcrawler confused: no threat is removed from either scheme and the confused card is removed", () => {
    const base = heroGame([NC()]);
    const nc = identityOf(base);
    const threat = inst(base, base.mainScheme.instanceId).threat;
    const confused = patchInstance(base, nc, { statuses: { ...inst(base, nc).statuses, confused: 1 } });
    const scout = playIt(confused, "48009", {});
    expect(inst(scout.state, scout.state.mainScheme.instanceId).threat).toBe(threat);
    expect(inst(scout.state, nc).statuses.confused ?? 0).toBe(0);
  });

  it("Teleport Drop on a villain with a tough status card: the 8 damage is prevented, the card is discarded, and the stun still lands", () => {
    const base = heroGame([NC()]);
    const rhino = base.activeVillainId!;
    const bamf = playIt(base, BAMF, { attach: rhino });
    const toughRhino = patchInstance(bamf.state, rhino, {
      statuses: { ...inst(bamf.state, rhino).statuses, tough: 1 },
    });
    const drop = playIt(toughRhino, "48008", {}, picker(take(bamf.id)));
    expect(inst(drop.state, rhino).damage).toBe(0);
    expect(inst(drop.state, rhino).statuses.tough ?? 0).toBe(0);
    expect(inst(drop.state, rhino).statuses.stunned).toBe(1);
  });
});

describe("Form changes: 'Port Away (48010) beside Moira MacTaggert (48022)", () => {
  it("'Port Away from alter-ego form changes him to hero form: Moira's Response ('a MUTANT alter-ego changes into hero form') is offered and draws 1", () => {
    const s0 = setupGame([NC("48022")]);
    const moira = playIt(s0, "48022", {});
    const given = moveToHand(moira.state, P1, BAMF, "48010");
    const handBefore = playerOf(given.state, P1).hand.length;
    const spied = spy(picker(take(given.ids[0]!), accept(MOIRA_REF)));
    const { state } = driveEventsPicking(
      DEPS,
      given.state,
      spied.pick,
      play(P1, given.ids[1]!, [], { costChoices: { discard: [given.ids[0]!] } }),
    );
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(offeredTo(spied.seen, MOIRA_REF)).toEqual(["p1"]);
    expect(inst(state, moira.id).exhausted).toBe(true);
    // 'Port Away and the Bamf! left the hand (-2), Moira drew 1.
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 1);
  });

  it("'Port Away from hero form changes him to alter-ego form: Moira (alter-ego to hero only) is not offered", () => {
    const s0 = setupGame([NC("48022")]);
    const moira = playIt(s0, "48022", {});
    const hero = withForm(moira.state, { heroForm: 0 });
    const given = moveToHand(hero, P1, BAMF, "48010");
    const spied = spy(picker(take(given.ids[0]!), accept(MOIRA_REF)));
    const { state } = driveEventsPicking(
      DEPS,
      given.state,
      spied.pick,
      play(P1, given.ids[1]!, [], { costChoices: { discard: [given.ids[0]!] } }),
    );
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(offeredTo(spied.seen, MOIRA_REF)).toEqual([]);
  });
});

describe("Another player's characters (two players)", () => {
  it("Rogue's Action may name another player's hero: Spider-Man takes 1 and Rogue adds his base THW and ATK", () => {
    const base = nightcrawlerTurn("48012");
    const rogue = playIt(base, "48012", { p: P2 });
    const spider = identityOf(rogue.state, P1);
    const before = profile(rogue.state, rogue.id);
    const spiderBase = profile(rogue.state, spider);
    const { state } = driveEventsPicking(
      DEPS,
      rogue.state,
      firstLegal,
      use(P2, rogue.id, "48012.rogue-action", [], { friend: [spider] }),
    );
    expect(inst(state, spider).damage).toBe(1);
    const after = profile(state, rogue.id);
    expect(after.thw).toBe(before.thw + (spiderBase.thw ?? 0));
    expect(after.atk).toBe(before.atk + (spiderBase.atk ?? 0));
  });
});

describe("Alliance (48031 Combine Forces): an X-FORCE character of another player may be exhausted (RRG 1.8 'Alliance', p. 6)", () => {
  it("Spider-Man's player controls Siryn (X-FORCE); Nightcrawler's player exhausts her and Nightcrawler to defeat a non-ELITE minion", () => {
    const base = heroGame([SM("42012"), NC("48031")]);
    const siryn = playIt(base, "42012", { p: P1 });
    const turn2 = driveEventsPicking(DEPS, siryn.state, firstLegal, endTurn(P1)).state;
    const merc = engage(turn2, MERCENARY, P2);
    const nc = identityOf(merc.state, P2);
    const combine = playIt(merc.state, "48031", { p: P2 }, picker(take(merc.id)));
    expect(inst(combine.state, siryn.id).exhausted).toBe(true);
    expect(inst(combine.state, nc).exhausted).toBe(true);
    expect(activeEncounterDeck(combine.state).discard).toContain(merc.id);
  });
});

describe("The Crazy Gang (48033) when the minion's scheme is canceled by a confused status card", () => {
  const GANG = "48033";
  const FILLER = "01098";
  const SET = WAVE8_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("crazy_gang")),
  );
  function gangGame(): GameState {
    const config = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: POOL,
    });
    const copies = SET.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
    const repeat = (code: string, n: number) => Array.from({ length: n }, () => cardId(code));
    const encounterDeck = [
      ...copies,
      ...repeat(FILLER, 24),
      ...repeat(MERCENARY, 2),
      ...repeat(ADVANCE, 8),
      ...repeat("01187", 8),
    ];
    const created = createGame({ ...config, encounterDeck }, DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
    return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
  }
  const roundWith = (s: GameState, ...reveals: string[]) => {
    const stacked = stackEncounterDeckAs(s, [ADVANCE, ...reveals]);
    return driveEventsPicking(DEPS, stacked, firstLegal, endTurn(P1));
  };
  /** The named cards on top of the deck, in order (distinct instances). */
  function stackEncounterDeckAs(s: GameState, codes: readonly string[]): GameState {
    const pile = activeEncounterDeck(s);
    const ids: InstanceId[] = [];
    for (const code of codes) {
      const id = pile.deck.find((i) => codeOf(s, i) === code && !ids.includes(i));
      if (!id) throw new Error(`no ${code}`);
      ids.push(id);
    }
    return {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [activeEncounterDeckId(s)]: {
          deck: [...ids, ...pile.deck.filter((i) => !ids.includes(i))],
          discard: pile.discard,
        },
      },
    };
  }
  const heal = (s: GameState): GameState =>
    patchInstance(patchInstance(s, identityOf(s), { damage: 0 }), s.mainScheme.instanceId, { threat: -30 });
  const minionId = (s: GameState): InstanceId =>
    Object.keys(s.instances).find(
      (id) => codeOf(s, id as InstanceId) === MERCENARY && inst(s, id as InstanceId).engagedWith,
    ) as InstanceId;

  it("a confused non-Elite minion does not scheme, so it is not dealt facedown; unconfused it is (control)", () => {
    const withMinion = roundWith(gangGame(), MERCENARY).state;
    const withGang = roundWith(heal(withMinion), GANG).state;
    const merc = minionId(withGang);
    const hurt = withDamage(heal(withGang), merc, 2);
    const control = roundWith(hurt, FILLER).state;
    expect(inst(control, minionId(control)).damage).toBe(0);
    const confused = patchInstance(hurt, merc, { statuses: { ...inst(hurt, merc).statuses, confused: 1 } });
    const { state } = roundWith(confused, FILLER);
    expect(minionId(state)).toBe(merc);
    expect(inst(state, merc).damage).toBe(2);
    expect(inst(state, merc).statuses.confused ?? 0).toBe(0);
  });
});
