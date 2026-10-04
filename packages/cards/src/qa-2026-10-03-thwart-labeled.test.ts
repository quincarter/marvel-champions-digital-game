/**
 * Rules-QA 2026-10-03, change 1 (commit 7452f90c): a "(thwart)"-labeled ability is a real thwart, however its threat
 * removal is written, proved on the REAL cards whose scripts the change altered (22 abilities across Core and waves 1-6
 * whose `label` includes "thwart" and whose threat removal is `removeThreat`, `divide("threat")` or
 * `modifyAttack.removesThreat`; the commit message counts 20 cards, Determined Defense 32189 and Psychic Manipulation
 * 34017 have their own tests in `wave6/mut_gen/role-upgrades.test.ts` and `wave6/phoenix/phoenix/events.test.ts`).
 *
 * Sources:
 * - RRG 1.8 "Labeled Ability" (p. 26): "When a player resolves an ability labeled '(thwart),' that ability is
 *   considered to be a thwart made by that player's identity."
 * - RRG 1.8 "Patrol" (p. 32): "that player cannot use cards they control to thwart the main scheme."
 * - RRG 1.8 "Crisis Icon" (p. 14) and "Target" (p. 43): a scheme that cannot be thwarted is not a valid target.
 * - RRG 1.8 "Thwart" (p. 44): "An ability labeled as a thwart is considered a single thwart, even if that thwart
 *   removes multiple instances of threat."; "each of those instances that does not use the word 'additional' is
 *   increased by the specified amount."
 *
 * Every card is played from a real Core Spider-Man (Justice) hand in a real Rhino game; for each one a control run (no
 * patrol, no crisis) proves the card removes the threat it prints and makes a thwart by the hero's identity, so a
 * patrol or crisis pass cannot be vacuous because the card could not be played at all.
 */
import { activeEncounterDeck, legalActions, type Command } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { identityOf, inst, mainThreat, P1, patchInstance, playerOf, putOnTopOfDeck } from "./testing/harness.js";
import { withForm } from "./testing/staging.js";
import { conjure, DEPS, drive, intoPlay, playOut, relabel, table, thwarts, withTrait } from "./testing/qa-bench.js";

interface Case {
  readonly code: string;
  readonly name: string;
  readonly cost: number;
  /** Threat the card removes from the main scheme in the control run (everything aimed at the main scheme). */
  readonly removes: number;
  /** The card can take its threat from a scheme other than the main scheme. */
  readonly anyScheme: boolean;
  /**
   * The card has an effect besides the main-scheme removal (Impede returns itself to hand, Looking for Trouble puts a
   * minion into play). That does not make it playable while the main scheme cannot be thwarted (owner decision,
   * 2026-10-03; see "a main-scheme-only thwart" below).
   */
  readonly otherEffects?: true;
  /** A trait the hero's identity needs in order to play the card. */
  readonly trait?: string;
}

/** The 20 cards (and Giant Help's second shape), in pack order. Psychic Manipulation and Determined Defense: own files. */
const CARDS: readonly Case[] = [
  { code: "04038", name: "Inconspicuous (divide)", cost: 1, removes: 3, anyScheme: true },
  { code: "12004", name: "Hive Mind", cost: 2, removes: 2, anyScheme: true, trait: "TINY" },
  { code: "13003", name: "Giant Help (Tiny form: remove 3)", cost: 2, removes: 3, anyScheme: true, trait: "TINY" },
  { code: "13031", name: "Running Interference", cost: 2, removes: 3, anyScheme: false },
  { code: "16043", name: "Looking for Trouble", cost: 0, removes: 3, anyScheme: false, otherEffects: true },
  { code: "16160", name: "In Harm's Way", cost: 1, removes: 5, anyScheme: true },
  { code: "18016", name: "Impede", cost: 2, removes: 3, anyScheme: false, otherEffects: true },
  { code: "18020", name: "Hit and Run", cost: 3, removes: 2, anyScheme: true },
  { code: "17004", name: "Gutsy Move", cost: 2, removes: 2, anyScheme: true },
  { code: "17029", name: "Agile Flight (divide up to 5)", cost: 3, removes: 5, anyScheme: true, trait: "AERIAL" },
  { code: "31005", name: "Rapid Deployment", cost: 2, removes: 3, anyScheme: true },
  { code: "36010", name: "Torrential Rain (divide)", cost: 2, removes: 3, anyScheme: true },
];

describe("the thwart-labeled cards, control run: each removes its printed threat as a thwart by the hero's identity (RRG p. 26)", () => {
  for (const c of CARDS) {
    it(`${c.name} (${c.code})`, () => {
      const t = table({ side: true });
      const given = conjure(c.trait ? withTrait(t.state, c.trait) : t.state, c.code);
      const main = given.state.mainScheme.instanceId;
      const shares = new Map([[main, c.removes]]);
      const done = playOut(given.state, given.id, c.cost, { target: main, shares });
      expect(done.accepted).toBe(true);
      expect(mainThreat(done.state)).toBe(8 - c.removes);
      const heard = thwarts(done.events);
      expect(heard.length).toBeGreaterThan(0);
      expect(heard.every((h) => h.by === identityOf(done.state))).toBe(true);
      expect(heard.reduce((sum, h) => sum + (h.amount ?? 0), 0)).toBe(c.removes);
    });
  }
});

// Owner decision, 2026-10-03 (RRG 1.8 "Target", p. 43): a card that can only take its threat from the main scheme is not
// playable while the main scheme cannot be thwarted. These two blocks first accepted either outcome (refused, or played
// around the main scheme) and exempted the two `otherEffects` cards from the no-thwart check; they now assert the rule.
describe("under patrol, none of them takes threat from the main scheme (RRG p. 32); a main-scheme-only card is not playable (owner decision 2026-10-03; RRG 1.8 'Target', p. 43), a side scheme is still thwartable", () => {
  for (const c of CARDS) {
    it(`${c.name} (${c.code})`, () => {
      const t = table({ side: true, patrol: true });
      const given = conjure(c.trait ? withTrait(t.state, c.trait) : t.state, c.code);
      const main = given.state.mainScheme.instanceId;
      const side = t.side!;
      const shares = new Map([[side, c.removes]]);
      const done = playOut(given.state, given.id, c.cost, { target: main, shares });
      expect(mainThreat(done.state)).toBe(8);
      expect(done.accepted).toBe(c.anyScheme);
      if (c.anyScheme) expect(inst(done.state, side).threat).toBe(5 - c.removes);
      else expect(playerOf(done.state, P1).hand).toContain(given.id);
      expect(thwarts(done.events).filter((h) => h.scheme === main)).toEqual([]);
    });
  }
});

describe("under a crisis icon, none of them takes threat from the main scheme (RRG p. 14); a main-scheme-only card is not playable (owner decision 2026-10-03; RRG 1.8 'Target', p. 43)", () => {
  for (const c of CARDS) {
    it(`${c.name} (${c.code})`, () => {
      const t = table({ crisis: true });
      const given = conjure(c.trait ? withTrait(t.state, c.trait) : t.state, c.code);
      const main = given.state.mainScheme.instanceId;
      const shares = new Map([[t.crisis!, Math.min(c.removes, 4)]]);
      const done = playOut(given.state, given.id, c.cost, { target: main, shares });
      expect(mainThreat(done.state)).toBe(8);
      expect(done.accepted).toBe(c.anyScheme);
      if (c.anyScheme) expect(inst(done.state, t.crisis!).threat).toBeLessThan(4);
      expect(thwarts(done.events).filter((h) => h.scheme === main)).toEqual([]);
    });
  }
});

describe("what the cases above cannot reach on their own", () => {
  /** Mutant Peacekeepers (34018): exhaust your hero and any number of X-MEN allies; divide that much threat (3 here). */
  function peacekeepers(opts: { readonly patrol: boolean }) {
    const t = table({ side: true, patrol: opts.patrol });
    const ally = intoPlay(withTrait(t.state, "X-MEN"), "32011"); // Nightcrawler, an X-MEN ally
    const given = conjure(ally.state, "34018");
    const target = opts.patrol ? t.side! : given.state.mainScheme.instanceId;
    return { t, done: playOut(given.state, given.id, 1, { shares: new Map([[target, 3]]) }) };
  }
  it("Mutant Peacekeepers (34018): control, a divided thwart of the exhausted characters' THW", () => {
    const { done } = peacekeepers({ patrol: false });
    expect(done.accepted).toBe(true);
    expect(mainThreat(done.state)).toBe(8 - 3);
    expect(thwarts(done.events).map((h) => h.amount)).toEqual([3]);
  });
  it("Mutant Peacekeepers under patrol: the main scheme keeps its threat, the side scheme is thwarted", () => {
    const { t, done } = peacekeepers({ patrol: true });
    expect(done.accepted).toBe(true);
    expect(mainThreat(done.state)).toBe(8);
    expect(inst(done.state, t.side!).threat).toBe(5 - 3);
  });

  it("Giant Help (13003) in Giant form: 'remove a total of 4 threat divided among schemes' is divided thwart; patrol keeps the main scheme's share on it", () => {
    const t = table({ side: true, patrol: true });
    const giant = withTrait(withTrait(t.state, "TINY"), "GIANT");
    const given = conjure(giant, "13003");
    const side = t.side!;
    const done = playOut(given.state, given.id, 2, { shares: new Map([[side, 4]]) });
    expect(done.accepted).toBe(true);
    expect(inst(done.state, side).threat).toBe(5 - 4);
    expect(mainThreat(done.state)).toBe(8);
    expect(thwarts(done.events).map((h) => [h.scheme, h.amount])).toEqual([[side, 4]]);
  });

  it("Even the Odds (30014): '(thwart): remove 1 threat per hero from each side scheme' is one thwart, patrol-free (RRG p. 26/44)", () => {
    const t = table({ side: true, patrol: true });
    const given = conjure(t.state, "30014");
    const done = playOut(given.state, given.id, 2);
    expect(done.accepted).toBe(true);
    // Patrol only guards the main scheme: the side scheme is still thwarted, and the main scheme is untouched.
    expect(inst(done.state, t.side!).threat).toBe(4);
    expect(mainThreat(done.state)).toBe(8);
    expect(thwarts(done.events).map((h) => h.by)).toEqual([identityOf(done.state)]);
  });
});

/**
 * Owner decision, 2026-10-03 (was an open question, pinned `it.fails`): Impede (18016, "Hero Action (thwart): Remove 3
 * threat from the main scheme. If this is the first card you have played this round, return this card to your hand")
 * and Looking for Trouble (16043) are NOT playable while the player is engaged with a patrol minion or a crisis icon is
 * in play. RRG 1.8 "Target" (p. 43): "A target that cannot be thwarted is not a valid target for a thwart-labeled
 * ability"; (p. 42) an ability that requires a target "can only be initiated if it has at least one valid target"; the
 * FAQ on Wasp's Giant form (p. 61) makes the main scheme no target for a thwart under patrol and under a crisis icon
 * alike. Before, the engine played them and raised a resolved `thwart` of amount 0 that "after you thwart" heard.
 */
describe("owner decision 2026-10-03: a (thwart) that names only a scheme that cannot be thwarted is not playable (RRG 1.8 'Target', pp. 42-43; 'Patrol', p. 32; 'Crisis Icon', p. 14)", () => {
  for (const c of CARDS.filter((card) => card.otherEffects)) {
    for (const why of ["patrol", "crisis"] as const) {
      it(`${c.name} (${c.code}) under ${why}: refused, nothing paid, no thwart`, () => {
        const t = table(why === "patrol" ? { side: true, patrol: true } : { crisis: true });
        const given = conjure(t.state, c.code);
        const done = playOut(given.state, given.id, c.cost);
        expect(done.accepted).toBe(false);
        expect(done.state).toBe(given.state);
        expect(thwarts(done.events)).toEqual([]);
        // Not offered either, with the reason a player is shown.
        const legal = legalActions(given.state, P1, DEPS);
        if (legal.kind !== "turn") throw new Error("expected the player's turn");
        const named = (action: unknown): boolean => JSON.stringify(action).includes(given.id);
        expect(legal.legal.some((a) => named(a.action))).toBe(false);
        expect(legal.illegal.find((a) => named(a.action))?.reason).toBe("no_valid_target");
      });
    }
  }

  it("Looking for Trouble (16043) under patrol: its 'discard until a minion, put it into play' side is not paid (the encounter deck and discard pile are untouched)", () => {
    const t = table({ side: true, patrol: true });
    const given = conjure(t.state, "16043");
    const done = playOut(given.state, given.id, 0);
    expect(done.accepted).toBe(false);
    expect(activeEncounterDeck(done.state)).toEqual(activeEncounterDeck(given.state));
    expect(playerOf(done.state, P1).playArea).toEqual(playerOf(given.state, P1).playArea);
  });
});

describe("QA playthrough B QB-10: Psychic Manipulation says why it is not offered under a crisis icon or a patrol", () => {
  for (const [why, setup, words] of [
    ["crisis", { crisis: true }, "a crisis icon is in play, so you can't thwart the main scheme"],
    ["patrol", { side: true, patrol: true }, "an engaged patrol minion keeps you from thwarting the main scheme"],
  ] as const) {
    it(`under ${why}: the hand card's reason names it`, () => {
      const t = table(setup);
      const given = conjure(t.state, "34017");
      const legal = legalActions(given.state, P1, DEPS);
      if (legal.kind !== "turn") throw new Error("expected the player's turn");
      const reason = legal.illegal.find((a) => JSON.stringify(a.action).includes(given.id));
      expect(reason?.message).toContain("can only be played when its interrupt or response triggers");
      expect(reason?.message).toContain(words);
    });
  }

  it("with nothing in the way the reason is the plain one", () => {
    const t = table({ side: true });
    const given = conjure(t.state, "34017");
    const legal = legalActions(given.state, P1, DEPS);
    if (legal.kind !== "turn") throw new Error("expected the player's turn");
    const reason = legal.illegal.find((a) => JSON.stringify(a.action).includes(given.id));
    expect(reason?.message).toBe("this event can only be played when its interrupt or response triggers");
  });
});

describe("modifiers and listeners hear the real cards' thwarts (RRG 1.8 'Thwart', p. 44)", () => {
  it("Operative Skill (37013): 'when you thwart ... that thwart removes 1 additional threat' adds to Gutsy Move's removal (Hero Action (thwart): remove 2 threat from a scheme)", () => {
    const t = table({ side: true });
    const skill = intoPlay(t.state, "37013", { operative: 3 });
    const given = conjure(skill.state, "17004");
    const main = given.state.mainScheme.instanceId;
    const done = playOut(given.state, given.id, 2, { target: main, use: ["37013"] });
    expect(mainThreat(done.state)).toBe(8 - 3);
    expect(inst(done.state, skill.id).counters.operative).toBe(2);
    expect(thwarts(done.events).map((h) => h.amount)).toEqual([3]);
  });

  it("Operative Skill adds its 1 to Inconspicuous's divided removal (Q78: each instance of threat removal)", () => {
    const t = table({ side: true });
    const skill = intoPlay(t.state, "37013", { operative: 3 });
    const given = conjure(skill.state, "04038");
    const main = given.state.mainScheme.instanceId;
    const done = playOut(given.state, given.id, 1, { target: main, shares: new Map([[main, 3]]), use: ["37013"] });
    expect(mainThreat(done.state)).toBe(8 - 4);
  });

  it("Justice Served (22014), 'after you thwart ... remove the last threat from a scheme', answers Gutsy Move's labeled removal: it discards and readies the hero", () => {
    const t = table({ side: true });
    const side = t.side!;
    const lowered = patchInstance(t.state, side, { threat: 2 });
    const served = intoPlay(lowered, "22014");
    const hero = patchInstance(served.state, identityOf(served.state), { exhausted: true });
    const given = conjure(hero, "17004");
    const done = playOut(given.state, given.id, 2, { target: side, use: ["22014"] });
    expect(inst(done.state, side).threat).toBe(0);
    expect(playerOf(done.state, P1).discard).toContain(served.id);
    expect(inst(done.state, identityOf(done.state)).exhausted).toBe(false);
  });

  it("Brainstorm (16150), a (thwart) event, removes 3 threat from the main scheme as a thwart when the named type matches", () => {
    const t = table({ side: true });
    const top = putOnTopOfDeck(relabel(t.state, "01085", 3).state, P1, "01085");
    const given = conjure(top.state, "16150");
    const done = playOut(given.state, given.id, 0, { labels: ["event", "Top of your deck"] });
    expect(mainThreat(done.state)).toBe(8 - 3);
    expect(thwarts(done.events).map((h) => h.amount)).toEqual([3]);
  });

  // Changed with the 2026-10-03 owner decision: this used to play the card and block the removal. Brainstorm's only
  // threat removal names the main scheme (inside its "if it is the named type"), so it has no valid target under patrol.
  it("Brainstorm under patrol is not playable: its only threat removal names the main scheme (owner decision 2026-10-03; RRG 1.8 'Target', p. 43)", () => {
    const t = table({ side: true, patrol: true });
    const top = putOnTopOfDeck(relabel(t.state, "01085", 3).state, P1, "01085");
    const given = conjure(top.state, "16150");
    const done = playOut(given.state, given.id, 0, { labels: ["event", "Top of your deck"] });
    expect(done.accepted).toBe(false);
    expect(mainThreat(done.state)).toBe(8);
  });
});

/**
 * Owner decision, 2026-10-03 (was an open question, pinned `it.fails`): RRG 1.8 "Thwart" (p. 44) says "An ability
 * labeled as a thwart is considered a single thwart, even if that thwart removes multiple instances of threat", and the
 * owner's Q78 answer reads "a '(thwart)' ability hitting several schemes is one thwart". Inconspicuous (04038) split
 * across two schemes used to raise two resolved `thwart` events, so "after you thwart" had two windows. It is one
 * thwart: one resolved event carrying both instances, one window.
 */
describe("owner decision 2026-10-03: a (thwart) ability that removes threat from two schemes is one thwart (RRG 1.8 'Thwart', p. 44; Q78)", () => {
  const split = () => {
    const t = table({ side: true });
    return { t, main: t.state.mainScheme.instanceId, side: t.side! };
  };
  const resolvedThwarts = (events: Parameters<typeof thwarts>[0]) =>
    events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart" ? [e.event] : [],
    );

  it("Inconspicuous (04038) split 2 + 1 over the main scheme and a side scheme raises one thwart, carrying both instances", () => {
    const { t, main, side } = split();
    const given = conjure(t.state, "04038");
    const shares = new Map([
      [main, 2],
      [side, 1],
    ]);
    const done = playOut(given.state, given.id, 1, { shares });
    expect(mainThreat(done.state)).toBe(6);
    expect(inst(done.state, side).threat).toBe(4);
    expect(thwarts(done.events)).toEqual([{ by: identityOf(done.state), scheme: main, amount: 3 }]);
    expect(resolvedThwarts(done.events)[0]!.instances).toEqual([
      { schemeInstanceId: main, amount: 2 },
      { schemeInstanceId: side, amount: 1 },
    ]);
  });

  it("Operative Skill (37013) is used once for that one thwart and adds 1 to each instance (Q78): 1 counter spent, 3 + 2 removed", () => {
    const { t, main, side } = split();
    const skill = intoPlay(t.state, "37013", { operative: 3 });
    const given = conjure(skill.state, "04038");
    const shares = new Map([
      [main, 2],
      [side, 1],
    ]);
    const done = playOut(given.state, given.id, 1, { shares, use: ["37013"] });
    expect(mainThreat(done.state)).toBe(8 - 3);
    expect(inst(done.state, side).threat).toBe(5 - 2);
    expect(inst(done.state, skill.id).counters.operative).toBe(2);
    expect(thwarts(done.events).map((h) => h.amount)).toEqual([5]);
  });

  it("Justice Served (22014) answers that one thwart when its second instance removed the last threat from the side scheme", () => {
    const { t, main, side } = split();
    const lowered = patchInstance(t.state, side, { threat: 1 });
    const served = intoPlay(lowered, "22014");
    const hero = patchInstance(served.state, identityOf(served.state), { exhausted: true });
    const given = conjure(hero, "04038");
    const shares = new Map([
      [main, 2],
      [side, 1],
    ]);
    const done = playOut(given.state, given.id, 1, { shares, use: ["22014"] });
    expect(mainThreat(done.state)).toBe(6);
    expect(playerOf(done.state, P1).discard).toContain(served.id);
    expect(inst(done.state, identityOf(done.state)).exhausted).toBe(false);
  });
});

describe("the responses and the interrupt that are not played as actions", () => {
  const changeForm: Command = { type: "changeForm", playerId: P1 };
  /** Main-scheme threat after a change of form, with the card in hand and used (or not). */
  function afterChangeForm(opts: { readonly patrol: boolean; readonly use: boolean }) {
    const t = table({ side: true, patrol: opts.patrol });
    const given = conjure(withForm(t.state, "alterEgo"), "12031");
    const done = drive(given.state, changeForm, {
      target: given.state.mainScheme.instanceId,
      use: opts.use ? ["12031"] : [],
      pay: 1,
    });
    return { ...done, main: mainThreat(done.state), side: inst(done.state, t.side!).threat };
  }

  it("Lay Down the Law (12031), Hero Response (thwart) after you change form: removes 3 as a thwart by the hero", () => {
    const used = afterChangeForm({ patrol: false, use: true });
    const unused = afterChangeForm({ patrol: false, use: false });
    expect(used.main).toBe(unused.main - 3);
    expect(thwarts(used.events).map((h) => h.amount)).toEqual([3]);
  });

  it("Lay Down the Law while an engaged patrol minion guards the main scheme: not taken from the main scheme (RRG p. 32)", () => {
    const used = afterChangeForm({ patrol: true, use: true });
    const unused = afterChangeForm({ patrol: true, use: false });
    expect(used.main).toBe(unused.main);
    expect(
      thwarts(used.events).filter((h) => (h.amount ?? 0) > 0 && h.scheme === used.state.mainScheme.instanceId),
    ).toEqual([]);
  });

  /** Main-scheme threat after the villain phase in which Rhino attacks the hero, with the response used (or not). */
  function afterVillainAttack(opts: { readonly patrol: boolean; readonly use: boolean }) {
    const t = table({ side: true, patrol: opts.patrol });
    // Few tokens on the main scheme: this villain phase must not complete it.
    const given = conjure(patchInstance(t.state, t.state.mainScheme.instanceId, { threat: 3 }), "10016");
    const done = drive(
      given.state,
      { type: "endTurn", playerId: P1 },
      {
        target: given.state.mainScheme.instanceId,
        use: opts.use ? ["10016"] : [],
        pay: 1,
      },
    );
    return { ...done, main: mainThreat(done.state) };
  }

  it("\"You'll Pay for That!\" (10016), Response (thwart) after the villain's attack damages you: removes threat as a thwart", () => {
    const used = afterVillainAttack({ patrol: false, use: true });
    const unused = afterVillainAttack({ patrol: false, use: false });
    expect(used.main).toBeLessThan(unused.main);
    expect(thwarts(used.events).length).toBeGreaterThan(0);
  });

  it('"You\'ll Pay for That!" under patrol: nothing comes off the main scheme', () => {
    const used = afterVillainAttack({ patrol: true, use: true });
    const unused = afterVillainAttack({ patrol: true, use: false });
    expect(used.main).toBe(unused.main);
  });
});

/**
 * Owner decision, 2026-10-03 (was an open question, `it.todo`): Emergency is a thwart by the player's identity (RRG 1.8
 * "Labeled Ability", p. 26) that removes no threat. An engaged patrol minion stops it while the villain schemes on the
 * main scheme (p. 32: "cannot use cards they control to thwart the main scheme"; not offered, no valid target, p. 43);
 * "after you thwart" hears it once; a crisis icon does not stop it (p. 14 forbids REMOVING threat, and it removes none);
 * a thwart bonus adds nothing (FAQ, p. 59: "Because Emergency only prevents threat and does not remove any, Shrink
 * will have no effect").
 */
describe("Emergency (01085), Interrupt (thwart): when the villain schemes, reduce the threat placed by 1 (owner decision 2026-10-03)", () => {
  type Staging = { readonly patrol?: boolean; readonly crisis?: boolean; readonly skill?: boolean };
  /** Main-scheme threat after the villain phase in which Rhino schemes (the hero is in alter-ego form). */
  function afterVillainScheme(opts: Staging & { readonly use: readonly string[] }) {
    const t = table({ side: true, patrol: opts.patrol === true, crisis: opts.crisis === true });
    const staged = opts.skill ? intoPlay(t.state, "37013", { operative: 3 }).state : t.state;
    const given = conjure(
      withForm(patchInstance(staged, staged.mainScheme.instanceId, { threat: 0 }), "alterEgo"),
      "01085",
    );
    const done = drive(given.state, { type: "endTurn", playerId: P1 }, { use: opts.use, pay: 0 });
    return { ...done, main: mainThreat(done.state), card: given.id };
  }
  it("control: using it leaves 1 fewer threat on the main scheme than not using it, as one thwart by the identity that removed 0 threat (RRG 1.8 p. 26)", () => {
    const used = afterVillainScheme({ use: ["01085"] });
    const unused = afterVillainScheme({ use: [] });
    expect(used.main).toBe(unused.main - 1);
    expect(thwarts(used.events)).toEqual([
      { by: identityOf(used.state), scheme: used.state.mainScheme.instanceId, amount: 0 },
    ]);
    expect(thwarts(unused.events)).toEqual([]);
  });
  it("while an engaged patrol minion guards the main scheme it is not offered: the full threat is placed and the card stays in hand (RRG 1.8 pp. 26, 32, 43)", () => {
    const used = afterVillainScheme({ patrol: true, use: ["01085"] });
    const unused = afterVillainScheme({ patrol: true, use: [] });
    expect(used.main).toBe(unused.main);
    expect(thwarts(used.events)).toEqual([]);
    expect(playerOf(used.state, P1).discard).not.toContain(used.card);
  });
  it("a crisis icon does not stop it: it removes no threat (RRG 1.8 'Crisis Icon', p. 14)", () => {
    const used = afterVillainScheme({ crisis: true, use: ["01085"] });
    const unused = afterVillainScheme({ crisis: true, use: [] });
    expect(used.main).toBe(unused.main - 1);
    expect(thwarts(used.events)).toHaveLength(1);
  });
  it("Operative Skill's 'that thwart removes 1 additional threat' adds nothing to it (RRG 1.8 FAQ 'Emergency', p. 59)", () => {
    const plain = afterVillainScheme({ skill: true, use: ["01085"] });
    const boosted = afterVillainScheme({ skill: true, use: ["01085", "37013"] });
    expect(boosted.main).toBe(plain.main);
  });
});
