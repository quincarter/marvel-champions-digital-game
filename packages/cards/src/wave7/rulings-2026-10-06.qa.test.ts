/**
 * QA: the owner's 2026-10-06 rulings (docs/phase7-wave7.md section 4.1, the last two tables) replayed with shipped cards in
 * real games, two players wherever the rule is about other players. Part 1: Restricted as a state limit (1), a move of
 * threat needs a removable source (2), the "would" tier for attacks and defeats (3). Part 2 is
 * `rulings-2026-10-06-part2.qa.test.ts`; the staging is `rulings-2026-10-06-harness.ts`; the write-up is
 * docs/phase7-wave7-qa-rulings.md. The engine proves each rule on synthetic cards (`packages/engine/src/*.test.ts`);
 * this proves it on the printed text of real cards from every wave.
 *
 * Sources: RRG 1.8 "Restricted" (p. 38), "Move" (p. 30), "Crisis Icon" (p. 14), "'Would'" (p. 48), "Interrupt" (p. 25,
 * "forced interrupts take priority"), "Permanent" (p. 32), "Facedown Cards" (p. 23), "'Swap'" (p. 42). A `// FINDING`
 * comment marks a case whose result surprises against the printed text. Every driven case also checks that its command
 * log replays to the same state.
 */
import { cardsInPlay, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  inst,
  endTurn,
  identityOf,
  mainThreat,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  use,
  P1,
  P2,
} from "../testing/harness.js";
import {
  game,
  codeOf,
  codes,
  discardCodes,
  damageOn,
  heroDamage,
  attachedCodes,
  villainOf,
  conjure,
  fromHand,
  attached,
  inPlayArea,
  takes,
  fewest,
  takesAll,
  drive,
  refusal,
  offeredOptions,
  playCard,
  resolvedAbilities,
  hasResolved,
  withScheme,
  withMinion,
  attachEncounter,
  threatOf,
  mainOf,
  withoutSideSchemes,
  CROWD_CONTROL,
  BREAKIN,
  TEMPORAL_LEAP,
  LEAP_INTERRUPT,
  completingThreat,
  runCommand,
  bothEnd,
  toVictory,
  attackWindows,
  defeatWindows,
  attacksBy,
  schemesBy,
  ordering,
  WEBBED_UP,
  CHARGE,
  WEBBED_INTERRUPT,
  SPIDER_SENSE,
  fillers,
  type Run,
} from "./rulings-2026-10-06-harness.js";

vi.setConfig({ testTimeout: 120_000 });

// ---------------------------------------------------------------------------------------------------------------------
// 1. Restricted is a state limit (RRG "Restricted", p. 38)
// ---------------------------------------------------------------------------------------------------------------------

const DISCARD_RESTRICTED = "discardRestricted";
const KATANA = "44010"; // Deadpool's Katana, restricted
const BAZOOKA = "44052"; // Bazooka, restricted
const SWORDS = "44055"; // Laser Swords, "Counts as 2 restricted cards"
const SIDE_HOLSTER = "20021"; // "You can control 1 additional weapon upgrade that has the restricted keyword."
const ARMED = "44009"; // Armed to the Teeth

const deadpoolGame = (): GameState => game("rhino", ["deadpool-pool"], ["the_doomsday_chair"]);
const restrictedOnHero = (s: GameState, p: PlayerId = P1): string[] =>
  attachedCodes(s, identityOf(s, p)).filter((c) => [KATANA, BAZOOKA, "20022", "20010", "19008", "19009"].includes(c));

describe("1. Restricted is a state limit: the play resolves, then the player discards down to two (RRG p. 38)", () => {
  it("Deadpool controls two Katanas and plays a third: it is played, all three are offered, the chosen one is discarded", () => {
    const base = attached(attached(deadpoolGame(), KATANA).state, KATANA);
    const run = playCard(base.state, KATANA, 2, { [DISCARD_RESTRICTED]: (_s, o) => [o.slice().sort()[0]!] });
    expect(run.prompts.filter((p) => p.kind === DISCARD_RESTRICTED)).toHaveLength(1);
    expect(offeredOptions(run, DISCARD_RESTRICTED)).toHaveLength(3);
    expect(attachedCodes(run.state, identityOf(run.state))).toEqual([KATANA, KATANA]);
    expect(discardCodes(run.state)).toContain(KATANA);
  });

  it("Laser Swords (counts as 2) played beside Katana and Bazooka: the two restricted-keyword cards are discarded, the Swords stay", () => {
    const withTwo = attached(attached(deadpoolGame(), KATANA).state, BAZOOKA);
    const run = playCard(withTwo.state, SWORDS, 3, { [DISCARD_RESTRICTED]: fewest });
    // Load 4 -> discard until 2; only cards with the keyword are offered (Q52 = B), the Swords alone make 2.
    expect(run.prompts.filter((p) => p.kind === DISCARD_RESTRICTED)).toHaveLength(1);
    expect(attachedCodes(run.state, identityOf(run.state))).toEqual([SWORDS]);
    expect(discardCodes(run.state).sort()).toEqual(expect.arrayContaining([BAZOOKA, KATANA]));
  });

  it("Side Holster raises the limit to 3 and then leaves play (Caught Off Guard): the player is asked to discard one restricted card", () => {
    // Spider-Man (Justice) is a Core hero: Katana/Bazooka are Deadpool's cards but any hero can attach an upgrade.
    let s = deadpoolGame();
    const holster = attached(s, SIDE_HOLSTER);
    const a = attached(holster.state, KATANA);
    const b = attached(a.state, KATANA);
    const c = attached(b.state, BAZOOKA);
    s = c.state;
    // Three restricted weapons fit the limit of 2 + 1; nothing is asked while the Holster is in play.
    expect(restrictedOnHero(s)).toHaveLength(3);
    // Caught Off Guard 01188 (Core): "Discard an upgrade or support you control"; the player picks the Holster.
    const staged = stackEncounterDeck(s, "01186", "01188");
    const run = drive(
      staged,
      {
        chooseCards: takes(holster.id),
        chooseTarget: takes(holster.id),
        [DISCARD_RESTRICTED]: (_s, o) => [o.slice().sort()[0]!],
      },
      endTurn(),
    );
    expect(discardCodes(run.state)).toContain(SIDE_HOLSTER);
    expect(run.prompts.some((p) => p.kind === DISCARD_RESTRICTED)).toBe(true);
    expect(restrictedOnHero(run.state)).toHaveLength(2);
  });

  it("Psylocke flips her second Psi-Knife to a Psi-Katana (restricted, permanent) beside a Katana and a Bazooka: only the non-permanent card is offered", () => {
    // 41002b is "Permanent. Restricted."; flipping to a restricted face is a check point (RRG p. 38; "Permanent" p. 32).
    let s = game("stryfe", ["psylocke-justice"], ["the_doomsday_chair", "bomb_scare"]);
    const blades = inst(s, identityOf(s)).attachments;
    expect(codes(s, blades)).toEqual(["41002a", "41002a"]);
    s = patchInstance(s, blades[0]!, { flipped: true });
    s = attached(s, BAZOOKA).state;
    const before = s;
    const run = drive(
      s,
      {
        chooseTriggers: takes("41001a.star-psi-energy-control"),
        chooseCards: takes(blades[1]!),
        [DISCARD_RESTRICTED]: takesAll,
      },
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(s),
        targetInstanceId: villainOf(s),
      },
    );
    expect(inst(run.state, blades[1]!).flipped).toBe(true);
    const offers = run.prompts.filter((p) => p.kind === DISCARD_RESTRICTED);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.options.map((o) => codeOf(run.state, o as InstanceId))).toEqual([BAZOOKA]);
    expect(attachedCodes(run.state, identityOf(run.state))).toEqual(["41002a", "41002a"]);
    expect(inst(before, blades[1]!).flipped).toBe(false);
    expect(discardCodes(run.state)).toContain(BAZOOKA);
  });

  it("Armed to the Teeth's swap brings a facedown Katana in for Panther Claws beside two restricted weapons: the swap resolves, then one is discarded", () => {
    // Owner ruling 2026-10-06: "The swap resolves, then the restricted limit is enforced by discards." Facedown cards
    // are out of play (RRG "Facedown Cards" p. 23), so the load is 2 before the swap and 3 after.
    let s = deadpoolGame();
    const katana = attached(s, KATANA);
    const bazooka = attached(katana.state, BAZOOKA);
    const claws = attached(bazooka.state, "01047");
    const armed = attached(claws.state, ARMED);
    const facedown = conjure(armed.state, P1, KATANA);
    s = patchInstance(fromHand(facedown.state, P1, facedown.id), facedown.id, {
      attachedTo: armed.id,
      faceup: false,
      facedownAs: { kind: "blank", traits: [] } as never,
      controllerId: P1,
      ownerId: P1,
    });
    s = patchInstance(s, armed.id, { attachments: [facedown.id] });
    expect(restrictedOnHero(s)).toEqual([KATANA, BAZOOKA]);
    const run = drive(
      s,
      {
        chooseTarget: takes(claws.id),
        chooseCards: takes(claws.id),
        [DISCARD_RESTRICTED]: (_s, o) => [o.slice().sort()[0]!],
      },
      use(P1, armed.id, "44009.armed-to-the-teeth-action"),
    );
    expect(offeredOptions(run, DISCARD_RESTRICTED)).toHaveLength(3);
    expect(restrictedOnHero(run.state)).toHaveLength(2);
    expect(attachedCodes(run.state, armed.id)).toEqual(["01047"]);
    // The swap came first: the discard prompt follows the swap's own target prompt.
    expect(run.prompts.map((p) => p.kind).indexOf(DISCARD_RESTRICTED)).toBeGreaterThan(
      run.prompts.map((p) => p.kind).indexOf("chooseTarget"),
    );
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 2. A move of threat needs a source its threat can leave (RRG "Move", p. 30; "Crisis Icon", p. 14)
// ---------------------------------------------------------------------------------------------------------------------
describe("2. A move of threat needs a source its threat can leave (RRG p. 30; crisis icon p. 14)", () => {
  /** Rhino's table, Cable (P1) and Spider-Man (P2); Temporal Leap on Cable; a side scheme in the victory display. */
  function leapTable(crisis: boolean) {
    let s = game("rhino", ["cable-leadership", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const leap = attached(s, TEMPORAL_LEAP, P1);
    s = leap.state;
    const shown = withScheme(s, BREAKIN, 3);
    s = toVictory(shown.state, shown.id);
    s = { ...s, villainArea: [] };
    if (crisis) s = withScheme(s, CROWD_CONTROL, 0).state;
    const t = completingThreat(s);
    return { state: patchInstance(s, mainOf(s), { threat: t }), leap: leap.id, shown: shown.id, t };
  }
  const leapRules = { chooseTriggers: takes(LEAP_INTERRUPT), chooseCards: takes(BREAKIN) };

  it("Temporal Leap, no crisis icon: offered at the completion, 4 threat move to the returned side scheme (control)", () => {
    const g = leapTable(false);
    const run = drive(g.state, leapRules, ...bothEnd(g.state));
    expect(run.prompts.some((p) => p.options.some((o) => o.includes(LEAP_INTERRUPT)))).toBe(true);
    expect(run.state.removedFromGame).toContain(g.leap);
    expect(run.state.outcome).toBeNull();
    expect(run.state.mainScheme.completed).toBe(false);
    const back = run.state.villainArea.find((id) => codeOf(run.state, id) === BREAKIN)!;
    expect(threatOf(run.state, back)).toBe(2 + 4); // Breakin' & Takin' is put into play at its starting threat 2, not revealed
  });

  it("Temporal Leap under Crowd Control (a crisis icon): not offered, the stage completes, nothing is spent", () => {
    const g = leapTable(true);
    const run = drive(g.state, leapRules, ...bothEnd(g.state));
    expect(run.prompts.some((p) => p.options.some((o) => o.includes(LEAP_INTERRUPT)))).toBe(false);
    // Rhino has a single stage: the completion ends the game (a loss).
    expect(run.state.outcome).toEqual(expect.objectContaining({ result: "loss", reason: "mainSchemeCompleted" }));
    expect(run.state.removedFromGame).not.toContain(g.leap);
    expect(inst(run.state, g.leap).attachedTo).toBe(identityOf(g.state, P1));
    expect(codes(run.state, run.state.victoryDisplay)).toEqual([BREAKIN]);
  });

  it("Beat Cop 10029 (P2's support): refused while the only threat is on a crisis-locked main scheme, allowed once a side scheme holds some", () => {
    const base = game("rhino", ["cable-leadership", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const cop = inPlayArea(base, "10029", P2);
    const locked = withScheme(withoutSideSchemes(cop.state, 5), CROWD_CONTROL, 0);
    const ACTION = "10029.beat-cop-action";
    const onP2Turn = runCommand(locked.state, endTurn(P1));
    expect(refusal(onP2Turn, use(P2, cop.id, ACTION))).toBe("no_valid_target");
    // The same table with a side scheme that holds threat: the move has a source (a crisis protects only the main scheme).
    const side = withScheme(locked.state, BREAKIN, 2);
    const run = drive(side.state, { chooseTarget: takes(side.id) }, endTurn(P1), use(P2, cop.id, ACTION));
    expect(threatOf(run.state, side.id)).toBe(1);
    expect(threatOf(run.state, cop.id)).toBe(1);
    expect(threatOf(run.state, mainOf(run.state))).toBe(5);
  });

  it("Beat Cop 10029 without any crisis: the main scheme is a legal source", () => {
    const base = game("rhino", ["cable-leadership", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const cop = inPlayArea(base, "10029", P2);
    const open = withoutSideSchemes(cop.state, 5);
    const run = drive(open, {}, endTurn(P1), use(P2, cop.id, "10029.beat-cop-action"));
    expect(threatOf(run.state, mainOf(run.state))).toBe(4);
    expect(threatOf(run.state, cop.id)).toBe(1);
  });

  it("Storm 34021 thwarting a side scheme under a crisis icon: 2 threat move to the main scheme (adding is not removing), then the thwart", () => {
    let s = game("rhino", ["storm-leadership", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const storm = inPlayArea(s, "34021", P1);
    s = withoutSideSchemes(storm.state, 3);
    const crisis = withScheme(s, CROWD_CONTROL, 0);
    const side = withScheme(crisis.state, BREAKIN, 5);
    const stormThw = 2; // Storm 34021 prints THW 2
    const run = drive(
      side.state,
      { chooseTriggers: takes("34021.storm-interrupt"), chooseTarget: takes(mainOf(side.state)) },
      { type: "basicThwart", playerId: P1, thwarterInstanceId: storm.id, schemeInstanceId: side.id },
    );
    expect(hasResolved(run.events, "34021.storm-interrupt")).toBe(true);
    expect(threatOf(run.state, mainOf(run.state))).toBe(3 + 2);
    expect(threatOf(run.state, side.id)).toBe(5 - 2 - stormThw);
  });

  it("Storm 34021 thwarting the main scheme is impossible under a crisis icon, so her interrupt never starts", () => {
    let s = game("rhino", ["storm-leadership", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const storm = inPlayArea(s, "34021", P1);
    s = withScheme(withoutSideSchemes(storm.state, 5), CROWD_CONTROL, 0).state;
    expect(
      refusal(s, { type: "basicThwart", playerId: P1, thwarterInstanceId: storm.id, schemeInstanceId: mainOf(s) }),
    ).not.toBe("accepted");
  });

  it("Blackout 44053 (Deadpool): the crisis-locked main scheme is no source and is not offered; with only the locked main it is refused", () => {
    let s = game("rhino", ["deadpool-pool", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const blackout = attached(s, "44053", P1);
    s = withScheme(withoutSideSchemes(blackout.state, 5), CROWD_CONTROL, 0).state;
    const energy = conjure(
      { ...s, players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: [] } : p)) },
      P1,
      "44046",
    );
    s = energy.state;
    const ACTION = "44053.blackout-action";
    expect(refusal(s, use(P1, blackout.id, ACTION))).toBe("no_valid_target");
    const side = withScheme(s, BREAKIN, 2);
    const run = drive(
      side.state,
      { chooseTarget: takes(side.id), spendResources: takes(energy.id) },
      use(P1, blackout.id, ACTION),
    );
    expect(offeredOptions(run, "chooseTarget")).toEqual([side.id]);
    expect(threatOf(run.state, side.id)).toBe(1);
    expect(threatOf(run.state, mainOf(run.state))).toBe(5);
    expect(inst(run.state, blackout.id).counters).toEqual(expect.objectContaining({ energy: 1 }));
  });

  it("Ever Vigilant 42015 (Angel) under a crisis icon: unchanged, the card is played and the hero readied, no threat leaves the main scheme", () => {
    // The owner was told a removal (not a move) under crisis still initiates; the removal itself has no effect.
    let s = game("rhino", ["angel-protection", "core-spider-man-justice"], ["the_doomsday_chair"]);
    s = withScheme(withoutSideSchemes(s, 5), CROWD_CONTROL, 0).state;
    s = patchInstance(s, identityOf(s, P1), { exhausted: true });
    // Hero Action: a played event needs the hero ready? Ever Vigilant readies after, so the cost is paid exhausted.
    const run = playCard(s, "42015", 2);
    expect(discardCodes(run.state)).toContain("42015");
    expect(inst(run.state, identityOf(run.state, P1)).exhausted).toBe(false);
    expect(threatOf(run.state, mainOf(run.state))).toBe(5);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 3. "Would" interrupts are an earlier tier (RRG "'Would'", p. 48), for attacks, schemes and defeats
// ---------------------------------------------------------------------------------------------------------------------
describe("3a. Would-attack replacements resolve before the attack's other interrupts (RRG p. 48)", () => {
  const rhinoTable = () =>
    game("rhino", ["core-spider-man-justice", "core-captain-marvel-leadership"], ["the_doomsday_chair"]);

  it("Webbed Up 01009 on Rhino with Charge 01099: Webbed Up discards and stuns, Charge is never gathered and stays attached; Spider-Sense is not offered", () => {
    const base = rhinoTable();
    const rhino = villainOf(base);
    const web = attached(base, WEBBED_UP, P1, rhino);
    const charge = attachEncounter(web.state, CHARGE, rhino);
    const staged = fillers(charge.state);
    const run = drive(staged, {}, ...bothEnd(staged));
    expect(ordering(run)).toEqual([]);
    const windows = attackWindows(run.events, rhino);
    expect(windows[0]).toEqual({ would: true, abilities: [WEBBED_INTERRUPT] });
    expect(windows.some((w) => w.abilities.some((a) => a.startsWith("01099")))).toBe(false);
    expect(run.prompts.some((p) => p.options.some((o) => o.includes(SPIDER_SENSE)))).toBe(false);
    expect(discardCodes(run.state)).toContain(WEBBED_UP); // an upgrade of P1's: it goes to P1's discard
    expect(inst(run.state, web.id).attachedTo).toBeNull();
    expect(attachedCodes(run.state, rhino)).toContain(CHARGE);
    expect(attacksBy(run.events, rhino)).toHaveLength(0);
  });

  it("control: the same table without Webbed Up resolves Charge (the attack gains overkill) and discards it at the end of the attack", () => {
    const base = rhinoTable();
    const rhino = villainOf(base);
    const charge = attachEncounter(base, CHARGE, rhino);
    const staged = fillers(charge.state);
    const run = drive(staged, {}, ...bothEnd(staged));
    expect(attackWindows(run.events, rhino)[0]!.abilities.some((a) => a.startsWith("01099"))).toBe(true);
    expect(attacksBy(run.events, rhino).length).toBeGreaterThan(0);
    expect(attachedCodes(run.state, rhino)).not.toContain(CHARGE);
  });

  it("Webbed Up 01009 on Whirlwind 01130 (engaged with P1): his 'also attack each other hero' interrupt is never used, P2 takes nothing from him", () => {
    const base = rhinoTable();
    const minion = withMinion(base, "01130", { player: P1 });
    const staged = fillers(minion.state);
    const control = drive(staged, {}, ...bothEnd(staged));
    // Control: Whirlwind's own interrupt resolves and his attack is also made against P2.
    expect(attackWindows(control.events, minion.id)[0]!.abilities.some((a) => a.startsWith("01130"))).toBe(true);
    expect(attacksBy(control.events, minion.id).length).toBeGreaterThanOrEqual(2);
    const web = attached(staged, WEBBED_UP, P1, minion.id);
    const run = drive(web.state, {}, ...bothEnd(web.state));
    const windows = attackWindows(run.events, minion.id);
    expect(windows[0]).toEqual({ would: true, abilities: [WEBBED_INTERRUPT] });
    expect(windows.flatMap((w) => w.abilities).some((a) => a.startsWith("01130"))).toBe(false);
    expect(attacksBy(run.events, minion.id)).toHaveLength(0);
    expect(inst(run.state, minion.id).statuses.stunned).toBe(1);
    expect(heroDamage(control.state, P2)).toBeGreaterThan(heroDamage(run.state, P2));
  });

  it("Hope's Captor 40105a on Rhino, a Marauder (Vertigo) engaged with P1 only: Rhino schemes instead against P1, attacks P2 as usual and Charge resolves there", () => {
    const base = rhinoTable();
    const rhino = villainOf(base);
    const captor = attachEncounter(base, "40105a", rhino);
    const charge = attachEncounter(captor.state, CHARGE, rhino);
    const marauder = withMinion(charge.state, "40100", { player: P1 });
    const staged = fillers(marauder.state);
    const run = drive(staged, {}, ...bothEnd(staged));
    expect(ordering(run)).toEqual([]);
    // P1's activation: the would tier alone (no Charge window); P2's: Captor is gathered but replaces nothing, then Charge.
    expect(attackWindows(run.events, rhino)).toEqual([
      { would: true, abilities: ["40105a.hopes-captor-forced-interrupt"] },
      { would: true, abilities: ["40105a.hopes-captor-forced-interrupt"] },
      { would: false, abilities: ["01099.charge-forced-interrupt"] },
    ]);
    expect(schemesBy(run.events, rhino)).toHaveLength(1);
    expect(attacksBy(run.events, rhino)).toHaveLength(1);
    expect(attachedCodes(run.state, rhino)).not.toContain(CHARGE);
    expect(attachedCodes(run.state, rhino)).toContain("40105a");
  });

  it("two would-attack replacements on one attack (Hobgoblin 31033, Webbed Up 01009): the first player orders them, the one ordered first wins and the other is not used", () => {
    // As built, pinned: "would" outranks the ordinary tier, but two would abilities are still ordered by the first player.
    const base = rhinoTable();
    const minion = withMinion(base, "31033", { player: P1 });
    const web = attached(fillers(minion.state), WEBBED_UP, P1, minion.id);
    const phase = (first: string) =>
      drive(
        web.state,
        {
          orderTriggers: (_s, options) => [
            ...options.filter((o) => o.includes(first)),
            ...options.filter((o) => !o.includes(first)),
          ],
        },
        ...bothEnd(web.state),
      );
    const hobFirst = phase("31033");
    const webFirst = phase("01009");
    expect(ordering(hobFirst)[0]!.player).toBe(P1);
    expect(ordering(hobFirst)[0]!.options).toHaveLength(2);
    const upTo = (run: Run) => {
      const events = run.events;
      const from = events.findIndex(
        (e) => e.type === "windowOpened" && e.event.kind === "enemyAttack" && e.event.enemyInstanceId === minion.id,
      );
      const end = events.findIndex((e, k) => k > from && e.type === "enemyActivated");
      return resolvedAbilities(end < 0 ? events.slice(from) : events.slice(from, end));
    };
    expect(upTo(hobFirst)).toEqual(["31033.hobgoblin-forced-interrupt"]);
    expect(upTo(webFirst)).toEqual([WEBBED_INTERRUPT]);
    expect(attacksBy(hobFirst.events, minion.id)).toHaveLength(0);
    expect(attacksBy(webFirst.events, minion.id)).toHaveLength(0);
  });
});

describe("3b. Would-be-defeated replacements resolve before any is-defeated interrupt (RRG p. 48)", () => {
  const TRACER = "01007";
  const TRACER_INTERRUPT = "01007.spider-tracer-forced-interrupt";
  const attack = (s: GameState, target: InstanceId): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(s, P1),
    targetInstanceId: target,
  });
  /** Loki 06028 engaged with P1 on the brink with Spider-Tracer attached; `top` is the encounter deck's top card. */
  function lokiTable(top: string) {
    const base = game("rhino", ["core-spider-man-justice", "core-captain-marvel-leadership"], ["the_doomsday_chair"]);
    const loki = withMinion(base, "06028", { player: P1 });
    const tracer = attached(loki.state, TRACER, P1, loki.id);
    const staged = stackEncounterDeck(
      patchInstance(patchInstance(tracer.state, loki.id, { damage: 999 }), mainOf(tracer.state), { threat: 5 }),
      top,
    );
    return { state: staged, loki: loki.id, tracer: tracer.id };
  }

  // FINDING 1 (not caused by today's rulings, exposed by them): Loki's replacement tests the discarded card with
  // `refMatches(chosen("flipped"), query("treachery"))`, which only matches cards in play (no `anywhere`), and the discarded
  // card is in the encounter discard pile, so Loki is never healed. His own test (wave1/thor/nemesis.test.ts "survives,
  // healed") passes vacuously: a defeated minion's damage is also 0. Printed text: "If that card is a treachery, heal
  // all damage from Loki instead." Expected: Loki stays in play with 0 damage and Spider-Tracer never fires.
  it.fails("FINDING: Loki 06028 reveals a treachery (Advance): he should be healed instead and Spider-Tracer should never fire", () => {
    const g = lokiTable("01186");
    const run = drive(g.state, {}, attack(g.state, g.loki));
    expect(cardsInPlay(run.state)).toContain(g.loki);
    expect(damageOn(run.state, g.loki)).toBe(0);
    expect(hasResolved(run.events, TRACER_INTERRUPT)).toBe(false);
    expect(mainThreat(run.state)).toBe(5);
  });

  it("today's behavior of that card (FINDING 1): the treachery is discarded, Loki is defeated anyway and Spider-Tracer removes 3 threat (5 to 2)", () => {
    const g = lokiTable("01186");
    const run = drive(g.state, {}, attack(g.state, g.loki));
    expect(defeatWindows(run.events, g.loki).map((w) => w.would)).toEqual([true, false]);
    expect(cardsInPlay(run.state)).not.toContain(g.loki);
    expect(mainThreat(run.state)).toBe(2);
  });

  it("Loki reveals a non-treachery (Hydra Mercenary): the would resolves without replacing, then the later tier runs: he is defeated and Spider-Tracer removes 3 threat", () => {
    const g = lokiTable("01101");
    const threat = mainThreat(g.state);
    const run = drive(g.state, {}, attack(g.state, g.loki));
    expect(ordering(run)).toEqual([]);
    const windows = defeatWindows(run.events, g.loki);
    expect(windows.map((w) => w.would)).toEqual([true, false]);
    expect(windows[1]!.abilities).toEqual([TRACER_INTERRUPT]);
    expect(hasResolved(run.events, TRACER_INTERRUPT)).toBe(true);
    expect(cardsInPlay(run.state)).not.toContain(g.loki);
    expect(mainThreat(run.state)).toBe(Math.max(0, threat - 3));
  });

  it("Deadpool (P1) with Git Gud 44028 attached: two would-defeat replacements on one defeat; the first player orders them, the one ordered first wins", () => {
    // Pinned as built (docs/phase7-wave7.md 4.1: would abilities share a tier, so they are ordered like any simultaneous pair).
    const base = game("rhino", ["deadpool-pool", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const gud = attached(base, "44028", P1);
    const dying = patchInstance(gud.state, identityOf(gud.state, P1), { damage: 8 });
    const staged = fillers(dying);
    const phase = (first: string) =>
      drive(
        staged,
        {
          orderTriggers: (_s, options) => [
            ...options.filter((o) => o.includes(first)),
            ...options.filter((o) => !o.includes(first)),
          ],
        },
        ...bothEnd(staged),
      );
    const gudFirst = phase("44028");
    const identityFirst = phase("44001a");
    const hero = identityOf(staged, P1);
    // Git Gud first: HP dial to 1, alter-ego form, the card is removed from the game; Deadpool's own interrupt is not used.
    expect(gudFirst.state.removedFromGame.map((id) => codeOf(gudFirst.state, id))).toContain("44028");
    expect(hasResolved(gudFirst.events, "44001a.the-regeneratin-degenerate")).toBe(false);
    expect(playerOf(gudFirst.state, P1).identity.form).toBe("alterEgo");
    expect(gudFirst.state.outcome).toBeNull();
    // Deadpool's interrupt first: HP dial to 1, alter-ego, one acceleration token; Git Gud stays attached to him.
    expect(hasResolved(identityFirst.events, "44001a.the-regeneratin-degenerate")).toBe(true);
    expect(attachedCodes(identityFirst.state, hero)).toContain("44028");
    expect(identityFirst.state.removedFromGame.map((id) => codeOf(identityFirst.state, id))).not.toContain("44028");
    expect(identityFirst.state.mainScheme.accelerationTokens).toBe(base.mainScheme.accelerationTokens + 1);
    expect(identityFirst.state.outcome).toBeNull();
  });

  it("Captain America's Helmet 03008 (P1) with Git Gud on P2's Deadpool: both would a defeat of P1; the forced one initiates first and the Helmet is not offered", () => {
    const base = game("rhino", ["cap-leadership", "deadpool-pool"], ["the_doomsday_chair"]);
    const helmet = attached(base, "03008", P1);
    const gud = attached(helmet.state, "44028", P2);
    const dying = patchInstance(gud.state, identityOf(gud.state, P1), { damage: 9 });
    const staged = fillers(dying);
    const run = drive(staged, { chooseTriggers: takes("03008") }, ...bothEnd(staged));
    const hero = identityOf(staged, P1);
    // RRG p. 17 (line "forced interrupts take priority and initiate before non-forced interrupts"): Git Gud is forced, the
    // Helmet is optional, so the window gathers Git Gud alone, Git Gud replaces the defeat and the Helmet is never offered.
    expect(defeatWindows(run.events, hero)).toEqual([{ would: true, abilities: ["44028.git-gud-forced-interrupt"] }]);
    expect(run.prompts.some((p) => p.options.some((o) => o.includes("03008")))).toBe(false);
    expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
    expect(attachedCodes(run.state, hero)).toContain("03008");
    expect(run.state.removedFromGame.map((id) => codeOf(run.state, id))).toContain("44028");
    expect(run.state.outcome).toBeNull();
  });
});
