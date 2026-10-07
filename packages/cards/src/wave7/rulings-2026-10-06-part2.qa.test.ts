/**
 * QA: the owner's 2026-10-06 rulings, part 2 (part 1 is `rulings-2026-10-06.qa.test.ts`; staging in
 * `rulings-2026-10-06-harness.ts`; write-up in docs/phase7-wave7-qa-rulings.md): 0 damage opens no damage window (4, 4b),
 * a defender without DEF and defense between players (5), Cypher and Warpath (6), the "you" reader (7), Hidden in the
 * Clutter and the S.H.I.E.L.D. Soldier trait split (8).
 *
 * Sources: RRG 1.8 "Damage" (p. 14, the nine-step order), "Tough" (p. 44), "Prevent" (p. 35), "Retaliate X" (p. 38),
 * "Defense" and "Defender" (pp. 14-15), "Attack (Enemy Activation)" (p. 9), "You/Your". A `// FINDING` comment marks a
 * case whose result surprises against the printed text; the "after you deal damage" difference (4b) is the open question.
 */
import { cardId } from "@mc/content";
import {
  cardsInPlay,
  type CardInstance,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { inst, identityOf, patchInstance, playerOf, stackEncounterDeck, P1, P2 } from "../testing/harness.js";
import {
  game,
  alterEgo,
  codeOf,
  codes,
  handCodes,
  discardCodes,
  damageOn,
  heroDamage,
  villainOf,
  conjure,
  attached,
  inPlayArea,
  takes,
  drive,
  refusal,
  playCard,
  resolvedAbilities,
  withMinion,
  attachEncounter,
  threatOf,
  mainOf,
  bothEnd,
  attacksBy,
  fillers,
  BACKFLIP_OFFER,
  WARNING_OFFER,
  offeredAnywhere,
  defendSelf,
  AGILITY_OFFER,
  nthOffer,
  defenders,
  CYPHER,
  CYPHER_OFFER,
  WARPATH,
  HYDRA_MERCENARY,
  cardCost,
  passToP2,
  driveAttempt,
  type Answer,
  type Run,
} from "./rulings-2026-10-06-harness.js";

vi.setConfig({ testTimeout: 120_000 });

// ---------------------------------------------------------------------------------------------------------------------
// 4. 0 damage opens no damage window (RRG "Damage" p. 14, "Tough" p. 44, "Prevent" p. 35)
// ---------------------------------------------------------------------------------------------------------------------
describe("4. 0 damage opens no damage window: nothing was damaged (RRG p. 14)", () => {
  const table = (seats: readonly string[] = ["core-spider-man-justice", "core-black-panther-protection"]) =>
    fillers(game("rhino", seats, ["the_doomsday_chair"]));

  it("Warning 09021 in P2's hand: P1 defends Rhino's attack fully (0 damage) and it is not offered; undefended it is offered to P2's hero too", () => {
    const base = table();
    const warning = conjure(base, P2, "09021");
    const defendedRun = drive(warning.state, { declareDefender: defendSelf }, ...bothEnd(base));
    expect(offeredAnywhere(defendedRun, WARNING_OFFER)).toBe(false);
    expect(handCodes(defendedRun.state, P2)).toContain("09021");
    expect(heroDamage(defendedRun.state, P1)).toBe(0);
    expect(heroDamage(defendedRun.state, P2)).toBe(0);
    // Control: the same attack undefended deals damage, and Warning (a hero would take damage) is offered.
    const undefended = drive(warning.state, { chooseTriggers: takes(WARNING_OFFER) }, ...bothEnd(base));
    expect(offeredAnywhere(undefended, WARNING_OFFER)).toBe(true);
    expect(heroDamage(undefended.state, P1)).toBeGreaterThan(0);
  });

  it("Backflip 01003 in P1's hand: a basic defense that takes the attack to 0 does not offer it; with no defender it is offered", () => {
    const base = table();
    const backflip = conjure(base, P1, "01003");
    const defended = drive(backflip.state, { declareDefender: defendSelf }, ...bothEnd(base));
    expect(offeredAnywhere(defended, BACKFLIP_OFFER)).toBe(false);
    expect(handCodes(defended.state, P1)).toContain("01003");
    expect(heroDamage(defended.state, P1)).toBe(0);
    const undefended = drive(backflip.state, { chooseTriggers: takes(BACKFLIP_OFFER) }, ...bothEnd(base));
    expect(offeredAnywhere(undefended, BACKFLIP_OFFER)).toBe(true);
    expect(heroDamage(undefended.state, P1)).toBe(0); // Backflip prevented all of it
    expect(discardCodes(undefended.state, P1)).toContain("01003");
  });

  it("Captain America's Shield 03009 (retaliate 1): a fully defended attack still happened, so Rhino takes 1 from the retaliate", () => {
    const base = game("rhino", ["cap-leadership", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const shield = attached(base, "03009", P1);
    const staged = fillers(shield.state);
    const rhino = villainOf(staged);
    const run = drive(staged, { declareDefender: defendSelf }, ...bothEnd(staged));
    expect(heroDamage(run.state, P1)).toBe(0);
    expect(damageOn(run.state, rhino)).toBe(1);
  });

  it("Radioactive Man 01129 ('after attacks you, discard 1 card at random'): fires after his attack is defended down to 0 damage", () => {
    const base = table(["cap-leadership", "core-spider-man-justice"]);
    const man = withMinion(base, "01129", { player: P1 });
    let asked = 0;
    // Rhino's attack on P1 is left undefended (Cap stays ready); Radioactive Man's is defended by Cap's DEF.
    const defendSecond: Answer = (s, options) => (++asked === 2 ? defendSelf(s, options) : ["decline"]);
    const run = drive(man.state, { declareDefender: defendSecond }, ...bothEnd(man.state));
    const [attack] = run.events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === man.id);
    expect(attack).toEqual(expect.objectContaining({ damageDealt: 0 }));
    expect(resolvedAbilities(run.events).some((a) => a.startsWith("01129"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 5. A defender without DEF, and defense between players (RRG "Defense" and "Defender", pp. 14-15)
// ---------------------------------------------------------------------------------------------------------------------
describe("5. A defender without DEF and defense between players (RRG pp. 14-15)", () => {
  const angelAndSpider = () =>
    fillers(game("rhino", ["angel-protection", "core-spider-man-justice"], ["the_doomsday_chair"]));
  const BACKFLIP_CODE = "01003";

  it("Angel (P1) plays Aerial Agility (a defense card) on Rhino's attack against himself and declines to defend: he is the defender and DEF is not applied (2 damage, not 0)", () => {
    const base = conjure(angelAndSpider(), P1, "42004").state;
    const run = drive(
      base,
      { chooseTriggers: nthOffer(AGILITY_OFFER, 1), declareDefender: () => ["decline"] },
      ...bothEnd(base),
    );
    const [first] = run.events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === villainOf(base));
    expect(first).toEqual(
      expect.objectContaining({ targetInstanceId: identityOf(base, P1), defenseReduction: 0, damageDealt: 2 }),
    );
    expect(heroDamage(run.state, P1)).toBe(2);
    expect(discardCodes(run.state, P1)).toContain("42004");
  });

  it("control: Angel declares himself the basic defender instead (DEF 2 against ATK 2: 0 damage), and Electrostatic Armor 10031 answers once", () => {
    let s = angelAndSpider();
    const armor = attached(s, "10031", P1);
    s = armor.state;
    const run = drive(s, { declareDefender: defendSelf, chooseTriggers: takes("10031.") }, ...bothEnd(s));
    const [first] = run.events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === villainOf(s));
    expect(first).toEqual(expect.objectContaining({ defenseReduction: 2, damageDealt: 0 }));
    expect(defenders(run.events).filter((e) => e.defenderInstanceId === identityOf(s, P1))).toHaveLength(1);
    expect(damageOn(run.state, villainOf(s))).toBe(1);
  });

  it("a label, then a basic defense by the same hero is one defense: Aerial Agility then declaring Angel announces him once and Electrostatic Armor fires once", () => {
    let s = conjure(angelAndSpider(), P1, "42004").state;
    s = attached(s, "10031", P1).state;
    const agility = nthOffer(AGILITY_OFFER, 1);
    const run = drive(
      s,
      { chooseTriggers: (st, o) => agility(st, o) ?? takes("10031.")(st, o), declareDefender: defendSelf },
      ...bothEnd(s),
    );
    const own = identityOf(s, P1);
    expect(defenders(run.events).filter((e) => e.defenderInstanceId === own)).toHaveLength(1);
    // Rhino took 1 from Electrostatic Armor for P1's defense; the second activation (against P2) defends nobody.
    expect(damageOn(run.state, villainOf(s))).toBe(1);
  });

  it("two players: P1 (Angel) plays Aerial Agility on Rhino's attack against P2; P2's Backflip is then not offered", () => {
    const base0 = angelAndSpider();
    const base = conjure(conjure(base0, P1, "42004").state, P2, BACKFLIP_CODE).state;
    // P1's Aerial Agility is offered at both attacks (Rhino attacks P1, then P2); P1 plays it at the second.
    const run = drive(
      base,
      { chooseTriggers: nthOffer(AGILITY_OFFER, 2), declareDefender: () => ["decline"] },
      ...bothEnd(base),
    );
    expect(run.prompts.filter((p) => p.options.some((o) => o.includes(AGILITY_OFFER))).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(offeredAnywhere(run, BACKFLIP_OFFER)).toBe(false);
    expect(handCodes(run.state, P2)).toContain(BACKFLIP_CODE);
    expect(discardCodes(run.state, P1)).toContain("42004");
    // P1's hero is the defender of the attack on P2 and takes it without DEF: P2 is not damaged, P1 takes 2 for his own
    // undefended attack and 2 more for P2's (no DEF applied: Angel's DEF 2 would have made it 0).
    expect(heroDamage(run.state, P2)).toBe(0);
    expect(heroDamage(run.state, P1)).toBe(4);
  });

  it("control for that table: nobody plays a defense card and Backflip is offered to P2 for the attack on P2", () => {
    const base = conjure(conjure(angelAndSpider(), P1, "42004").state, P2, BACKFLIP_CODE).state;
    const run = drive(
      base,
      { chooseTriggers: takes(BACKFLIP_OFFER), declareDefender: () => ["decline"] },
      ...bothEnd(base),
    );
    expect(offeredAnywhere(run, BACKFLIP_OFFER)).toBe(true);
    expect(discardCodes(run.state, P2)).toContain(BACKFLIP_CODE);
    expect(heroDamage(run.state, P2)).toBe(0);
  });

  it("two players: P1's hero declared as the defender of the attack on P2, then P2's Backflip is not offered (while a player is defending)", () => {
    const base = conjure(angelAndSpider(), P2, BACKFLIP_CODE).state;
    const first = identityOf(base, P1);
    let asked = 0;
    // At the second defender prompt (the attack on P2), P1 steps in; the prompt is P2's, listing P1's identity as an option.
    const stepIn: Answer = (_s, options) => (++asked === 2 && options.includes(first) ? [first] : ["decline"]);
    const run = drive(base, { chooseTriggers: takes(BACKFLIP_OFFER), declareDefender: stepIn }, ...bothEnd(base));
    expect(offeredAnywhere(run, BACKFLIP_OFFER)).toBe(false);
    expect(defenders(run.events).some((e) => e.defenderInstanceId === first)).toBe(true);
    expect(heroDamage(run.state, P2)).toBe(0);
  });
});

describe("4b. Tough, prevention and the 'after deals damage' responses (open question, docs/phase7-wave7-qa-rulings.md)", () => {
  const POWER_STONE = "16149";
  const FORCE_FIELD = "40034";
  /** She-Hulk (ATK 3) attacks Rhino with Power Stone attached; `prepare` changes Rhino first. */
  function stoneAttack(prepare: (s: GameState, rhino: InstanceId) => GameState) {
    const base = game("rhino", ["core-she-hulk-aggression", "core-spider-man-justice"], ["the_doomsday_chair"]);
    const rhino = villainOf(base);
    const stone = attachEncounter(base, POWER_STONE, rhino);
    const staged = prepare(stone.state, rhino);
    const run = drive(
      staged,
      {},
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(staged, P1),
        targetInstanceId: rhino,
      },
    );
    return { run, rhino, stone: stone.id, hero: identityOf(staged, P1) };
  }
  const withTough = (s: GameState, rhino: InstanceId) =>
    patchInstance(s, rhino, { statuses: { ...inst(s, rhino).statuses, tough: 1 } });
  const withoutTough = (s: GameState, rhino: InstanceId) =>
    patchInstance(s, rhino, { statuses: { ...inst(s, rhino).statuses, tough: 0 } });

  it("control, no tough or prevention: She-Hulk deals 3, Power Stone moves to her ('after a hero deals 3 or more damage')", () => {
    const g = stoneAttack(withoutTough);
    expect(damageOn(g.run.state, g.rhino)).toBe(3);
    expect(inst(g.run.state, g.stone).attachedTo).toBe(g.hero);
  });

  // FINDING 2 (the open question): the two ways of preventing all 3 damage differ. RRG "Prevent" (p. 35): prevented damage
  // is still "dealt" (only "taken" is reduced), and "Tough" (p. 44) prevents all damage, so by the RRG both cases should
  // behave the same for an "after ... deals damage" response. Today tough still fires it and a prevention interrupt does not.
  it("PINNED, today's behavior: Rhino has tough, all 3 damage is prevented, tough is spent and Power Stone STILL moves ('after dealt' fires)", () => {
    const g = stoneAttack(withTough);
    expect(damageOn(g.run.state, g.rhino)).toBe(0);
    expect(inst(g.run.state, g.rhino).statuses.tough).toBe(0);
    expect(inst(g.run.state, g.stone).attachedTo).toBe(g.hero);
  });

  it("PINNED, today's behavior: Telekinetic Force Field 40034 prevents all 3 damage and Power Stone stays ('after dealt' does not fire)", () => {
    const g = stoneAttack((s, rhino) => attachEncounter(withoutTough(s, rhino), FORCE_FIELD, rhino).state);
    expect(damageOn(g.run.state, g.rhino)).toBe(0);
    expect(inst(g.run.state, g.stone).attachedTo).toBe(g.rhino);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 6. Cypher on a killing blow, Warpath in the villain phase, Float Like a Butterfly unchanged
// ---------------------------------------------------------------------------------------------------------------------
describe("6. Cypher draws on a killing blow; Warpath plays a Hero Action event in the villain phase", () => {
  /** Cypher (ATK 1) in P1's play area, a confused Hydra Mercenary (3 hit points) engaged with P1 at `damage`. */
  function cypherTable(opts: { damage: number; confused?: boolean; tough?: number; float?: boolean }) {
    let s = game("rhino", ["core-spider-man-justice", "core-black-panther-protection"], ["the_doomsday_chair"]);
    const cypher = inPlayArea(s, CYPHER, P1);
    const minion = withMinion(cypher.state, HYDRA_MERCENARY, { player: P1, damage: opts.damage });
    s = patchInstance(minion.state, minion.id, {
      statuses: { stunned: 0, confused: opts.confused === false ? 0 : 1, tough: opts.tough ?? 0 },
    });
    if (opts.float) s = attached(s, "41017", P1).state;
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: cypher.id,
      targetInstanceId: minion.id,
    };
    return { state: s, minion: minion.id, cypher: cypher.id, attack };
  }
  const drew = (g: { state: GameState }, run: Run) =>
    playerOf(run.state, P1).hand.length - playerOf(g.state, P1).hand.length;

  it("Cypher defeats a confused minion (damage 2 of 3, his ATK 1 kills): he draws 1 card, the confused status read as he hit it", () => {
    const g = cypherTable({ damage: 2 });
    const run = drive(g.state, { chooseTriggers: takes(CYPHER_OFFER) }, g.attack);
    expect(cardsInPlay(run.state)).not.toContain(g.minion);
    expect(drew(g, run)).toBe(1);
    expect(playerOf(run.state, P1).deck.length).toBe(playerOf(g.state, P1).deck.length - 1);
  });

  it("Float Like a Butterfly 41017 unchanged: with it Cypher's hit on a confused minion at damage 1 deals 2 (1 + 1) and kills it, and he draws", () => {
    const withFloat = cypherTable({ damage: 1, float: true });
    const run = drive(withFloat.state, { chooseTriggers: takes(CYPHER_OFFER, "41017.") }, withFloat.attack);
    expect(cardsInPlay(run.state)).not.toContain(withFloat.minion);
    expect(drew(withFloat, run)).toBe(1);
    const without = cypherTable({ damage: 1 });
    const control = drive(without.state, { chooseTriggers: takes(CYPHER_OFFER) }, without.attack);
    expect(cardsInPlay(control.state)).toContain(without.minion);
    expect(damageOn(control.state, without.minion)).toBe(2);
    expect(drew(without, control)).toBe(1);
  });

  it("not confused: no card; a confused minion with a tough status takes no damage (tough spent), so no card either", () => {
    const plain = cypherTable({ damage: 2, confused: false });
    const a = drive(plain.state, { chooseTriggers: takes(CYPHER_OFFER) }, plain.attack);
    expect(offeredAnywhere(a, CYPHER_OFFER)).toBe(false);
    expect(drew(plain, a)).toBe(0);
    const toughOne = cypherTable({ damage: 0, tough: 1 });
    const b = drive(toughOne.state, { chooseTriggers: takes(CYPHER_OFFER) }, toughOne.attack);
    expect(offeredAnywhere(b, CYPHER_OFFER)).toBe(false);
    expect(inst(b.state, toughOne.minion).statuses.tough).toBe(0);
    expect(damageOn(b.state, toughOne.minion)).toBe(0);
    expect(drew(toughOne, b)).toBe(0);
  });

  /** Angel (P1) with Warpath (tough) in play; Rhino attacks P1 and Warpath is declared the defender. */
  function warpathTable(code: string) {
    let s = angelTable();
    const warpath = inPlayArea(s, WARPATH, P1);
    s = patchInstance(warpath.state, warpath.id, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    s = conjure(s, P1, code).state;
    s = patchInstance(s, mainOf(s), { threat: 5 });
    return { state: s, warpath: warpath.id };
  }
  const angelTable = () =>
    fillers(game("rhino", ["angel-protection", "core-spider-man-justice"], ["the_doomsday_chair"]));
  const spendAll: Answer = (s, options) => options.slice(0, s.pendingChoice!.maxSelections);
  const defendWithWarpath =
    (id: InstanceId): Answer =>
    (_s, options) =>
      options.includes(id) ? [id] : ["decline"];

  it.each([
    ["42015", "Ever Vigilant (readies Angel, removes 2 threat)", 2],
    ["01060", "For Justice! (a Core Hero Action thwart event: 3 threat, 4 if paid with a mental resource)", 3],
  ])(
    "Warpath 42013 defends in the villain phase and plays %s: the Hero Action event is played in the villain phase",
    (code, _name, removed) => {
      const g = warpathTable(code);
      const control = drive(
        g.state,
        { declareDefender: defendWithWarpath(g.warpath), chooseTriggers: () => [] },
        ...bothEnd(g.state),
      );
      const run = drive(
        g.state,
        {
          declareDefender: defendWithWarpath(g.warpath),
          chooseTriggers: takes("42013."),
          chooseCards: takes(code),
          spendResources: spendAll,
        },
        ...bothEnd(g.state),
      );
      expect(discardCodes(run.state, P1)).toContain(code);
      const gone = threatOf(control.state, mainOf(control.state)) - threatOf(run.state, mainOf(run.state));
      expect(code === "01060" ? [removed, removed + 1] : [removed]).toContain(gone);
      expect(handCodes(control.state, P1)).toContain(code);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------------
// 7. One "you" reader for constants (context decides first), RRG "You/Your" and the 2026-10-06 audit
// ---------------------------------------------------------------------------------------------------------------------
describe("7. The 'you' reader reads the player the context names", () => {
  const SEATS = ["core-spider-man-justice", "core-captain-marvel-leadership"] as const;

  it("I See You 02030 as Green Goblin's boost card: +1 boost icon for an attack on the player with a Goblin minion engaged, none for the player without", () => {
    // Mutagen Formula engages a Goblin Thrall (02024) with each player at setup. Take P1's away and P1 is the attacked player.
    const table = () => {
      const s = game("mutagen-formula", [...SEATS], ["bomb_scare"], 13);
      const thralls = Object.values(s.instances).filter((i) => i.cardId === cardId("02024")) as CardInstance[];
      return { state: s, thrall: (p: PlayerId) => thralls.find((t) => t.engagedWith === p)!.instanceId };
    };
    const iconsOfFirstAttack = (state: GameState) => {
      const stacked = stackEncounterDeck(state, "02030");
      const run = drive(stacked, {}, ...bothEnd(stacked));
      const villain = villainOf(stacked);
      return attacksBy(run.events, villain).map((e) => (e as { boostIcons: number }).boostIcons)[0];
    };
    const t = table();
    // Both thralls engaged: the attacked P1 has one engaged: 1 printed + 1 = 2.
    expect(iconsOfFirstAttack(t.state)).toBe(2);
    // P1's thrall disengaged (P2's stays): the card is read for the attacked P1, who has none: 1 icon, not 2.
    const p1Free = patchInstance(t.state, t.thrall(P1), { engagedWith: null });
    expect(iconsOfFirstAttack(p1Free)).toBe(1);
    // P2's thrall disengaged (P1's stays): still 2 for the attack on P1.
    const p2Free = patchInstance(t.state, t.thrall(P2), { engagedWith: null });
    expect(iconsOfFirstAttack(p2Free)).toBe(2);
  });

  it("Sowing Discord 40161 (P1) and Manufactured Drama 40160 (P2): each stops only its own player's allies or supports from readying", () => {
    let s = game("juggernaut", [...SEATS], ["telepathy"]);
    const a1 = inPlayArea(s, "01058", P1);
    const s1 = inPlayArea(a1.state, "01063", P1);
    const a2 = inPlayArea(s1.state, "01058", P2);
    const s2 = inPlayArea(a2.state, "01073", P2);
    s = s2.state;
    for (const id of [a1.id, s1.id, a2.id, s2.id]) s = patchInstance(s, id, { exhausted: true });
    // The boosts (one per activation), then P1 is dealt Sowing Discord and P2 Manufactured Drama.
    const staged = stackEncounterDeck(s, "01186", "01187", "40161", "40160");
    const run = drive(staged, {}, ...bothEnd(staged));
    const own = (p: PlayerId) => codes(run.state, playerOf(run.state, p).playArea);
    expect(own(P1)).toContain("40161");
    expect(own(P2)).toContain("40160");
    // P1: allies cannot ready (still exhausted), supports ready as usual; P2: the reverse.
    expect(inst(run.state, a1.id).exhausted).toBe(true);
    expect(inst(run.state, s1.id).exhausted).toBe(false);
    expect(inst(run.state, a2.id).exhausted).toBe(false);
    expect(inst(run.state, s2.id).exhausted).toBe(true);
  });

  it("Psionic Amnesia 40172 on P2's identity: P2's allies cost 2 more, P1's allies cost the printed cost", () => {
    const base = game("juggernaut", [...SEATS], ["telepathy"]);
    const amnesia = attachEncounter(base, "40172", identityOf(base, P2));
    const ally = "01058"; // Daredevil, cost 3
    const cost = cardCost(ally);
    const p1 = driveAttempt(amnesia.state, ally, cost, P1);
    expect(p1).toBe("accepted");
    const p2Short = driveAttempt(passToP2(amnesia.state), ally, cost, P2);
    expect(p2Short).not.toBe("accepted");
    const p2Full = driveAttempt(passToP2(amnesia.state), ally, cost + 2, P2);
    expect(p2Full).toBe("accepted");
  });

  it("Mind Trap 40171 on P2's identity: P2's ally enters play exhausted, P1's enters ready", () => {
    const base = game("juggernaut", [...SEATS], ["telepathy"]);
    const trap = attachEncounter(base, "40171", identityOf(base, P2));
    const cost = cardCost("01058");
    const first = playCard(trap.state, "01058", cost, {}, P1);
    const second = playCard(passToP2(trap.state), "01058", cost, {}, P2);
    const ally = (r: ReturnType<typeof playCard>, p: PlayerId) =>
      playerOf(r.state, p).playArea.find((id) => codeOf(r.state, id) === "01058")!;
    expect(inst(first.state, ally(first, P1)).exhausted).toBe(false);
    expect(inst(second.state, ally(second, P2)).exhausted).toBe(true);
  });

  it("Seduced 21179 on P1's identity: P1 cannot make a basic attack, P2 can", () => {
    const base = game("rhino", [...SEATS], ["the_doomsday_chair"]);
    const seduced = attachEncounter(base, "21179", identityOf(base, P1));
    const attack = (p: PlayerId, s: GameState): Command => ({
      type: "basicAttack",
      playerId: p,
      attackerInstanceId: identityOf(s, p),
      targetInstanceId: villainOf(s),
    });
    expect(refusal(seduced.state, attack(P1, seduced.state))).not.toBe("accepted");
    const onP2 = passToP2(seduced.state);
    expect(refusal(onP2, attack(P2, onP2))).toBe("accepted");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 8. Hidden in the Clutter 40106 (tough first; a stun keeps it), and the trait split (S.H.I.E.L.D. Soldier is two traits)
// ---------------------------------------------------------------------------------------------------------------------

describe("8a. Hidden in the Clutter 40106 per the owner's rulings", () => {
  const CLUTTER = "40106";
  /** A Hydra Mercenary (3 hit points) engaged with P1, Hidden in the Clutter on it carrying `held` damage; it is P2's turn. */
  function clutterTable(opts: { held: number; tough?: number; stunned?: number }) {
    const base = game("rhino", ["core-spider-man-justice", "core-captain-marvel-leadership"], ["the_doomsday_chair"]);
    const minion = withMinion(base, HYDRA_MERCENARY, { player: P1 });
    const clutter = attachEncounter(minion.state, CLUTTER, minion.id);
    let s = patchInstance(clutter.state, clutter.id, { damage: opts.held });
    s = patchInstance(s, minion.id, { statuses: { stunned: opts.stunned ?? 0, confused: 0, tough: opts.tough ?? 0 } });
    s = stackEncounterDeck(passToP2(s), "01186");
    const attack: Command = {
      type: "basicAttack",
      playerId: P2,
      attackerInstanceId: identityOf(s, P2),
      targetInstanceId: minion.id,
    };
    return { state: s, minion: minion.id, clutter: clutter.id, attack };
  }

  it("tough is spent before any damage reaches the card: a tough minion's first hit leaves 0 damage on Hidden in the Clutter", () => {
    const g = clutterTable({ held: 0, tough: 1 });
    const run = drive(g.state, {}, g.attack);
    expect(inst(run.state, g.minion).statuses.tough).toBe(0);
    expect(damageOn(run.state, g.clutter)).toBe(0);
    expect(damageOn(run.state, g.minion)).toBe(0);
    expect(inst(run.state, g.clutter).attachedTo).toBe(g.minion);
    // The next hit (P2 readied by surgery) is redirected onto the card: Black Panther's ATK 2 is placed there.
    const again = patchInstance(run.state, identityOf(run.state, P2), { exhausted: false });
    const second = drive(again, {}, g.attack);
    expect(damageOn(second.state, g.clutter)).toBe(2);
    expect(damageOn(second.state, g.minion)).toBe(0);
  });

  it("2 damage held and P2 hits for 2: 4 is at least 3, so the minion attacks P2 (the player who dealt it) and the card is discarded", () => {
    const g = clutterTable({ held: 2 });
    const run = drive(g.state, {}, g.attack);
    const attacks = run.events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === g.minion);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toEqual(expect.objectContaining({ targetInstanceId: identityOf(g.state, P2) }));
    expect(heroDamage(run.state, P2)).toBeGreaterThan(0);
    expect(heroDamage(run.state, P1)).toBe(0);
    expect(inst(run.state, g.clutter).attachedTo).toBeNull();
    expect(damageOn(run.state, g.minion)).toBe(0);
  });

  // FINDING 3 (a card interaction, as the printed text reads): "Then, discard this card" comes after the attack, so a
  // defender with retaliate (Black Panther, retaliate 1 on his hero face) damages the attached enemy during that attack;
  // the damage is placed on the card again (still attached, at least 3 here) and the minion attacks again. The loop ends
  // only when the defender's hit points do. Pinned as built; whether paper play would break the loop is for the owner.
  it("FINDING: against Black Panther (retaliate 1) the card loops: the minion attacks P2 over and over until P2 is out of hit points", () => {
    const base = game("rhino", ["core-spider-man-justice", "core-black-panther-protection"], ["the_doomsday_chair"]);
    const minion = withMinion(base, HYDRA_MERCENARY, { player: P1 });
    const clutter = attachEncounter(minion.state, CLUTTER, minion.id);
    let s = patchInstance(clutter.state, clutter.id, { damage: 2 });
    s = stackEncounterDeck(passToP2(s), "01186");
    const run = drive(
      s,
      {},
      {
        type: "basicAttack",
        playerId: P2,
        attackerInstanceId: identityOf(s, P2),
        targetInstanceId: minion.id,
      },
    );
    const attacks = run.events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === minion.id);
    expect(attacks.length).toBeGreaterThan(1);
    expect(heroDamage(run.state, P2)).toBe(attacks.length);
  });

  it("a stun replaces the resulting attack (the stun is removed instead) and the card stays attached", () => {
    const g = clutterTable({ held: 2, stunned: 1 });
    const run = drive(g.state, {}, g.attack);
    expect(run.events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === g.minion)).toHaveLength(0);
    expect(inst(run.state, g.minion).statuses.stunned).toBe(0);
    expect(heroDamage(run.state, P2)).toBe(0);
    expect(inst(run.state, g.clutter).attachedTo).toBe(g.minion);
    expect(damageOn(run.state, g.clutter)).toBe(4);
  });
});

describe("8b. S.H.I.E.L.D. Soldier is two traits (owner ruling 2026-10-06)", () => {
  it("Mission Leader 40023 costs 1 for Carol Danvers (S.H.I.E.L.D. and SOLDIER) and 2 for Peter Parker", () => {
    let s = game("rhino", ["core-captain-marvel-leadership", "core-spider-man-justice"], ["the_doomsday_chair"]);
    s = alterEgo(s, P1);
    s = alterEgo(s, P2);
    expect(driveAttempt(s, "40023", 1, P1)).toBe("accepted");
    expect(driveAttempt(s, "40023", 0, P1)).not.toBe("accepted");
    const onP2 = passToP2(s);
    expect(driveAttempt(onP2, "40023", 1, P2)).not.toBe("accepted");
    expect(driveAttempt(onP2, "40023", 2, P2)).toBe("accepted");
  });

  it("Field Agent 27044 now protects Agent 13 (27046, S.H.I.E.L.D. and SPY): her 1 consequential damage from a Hydra Mercenary is prevented", () => {
    const base = game("rhino", ["core-spider-man-justice", "core-black-panther-protection"], ["the_doomsday_chair"]);
    const agent = inPlayArea(base, "27046", P1);
    const field = inPlayArea(agent.state, "27044", P1);
    // Backup counters ("Uses 3 backup counters") are what the interrupt spends.
    const staged = patchInstance(field.state, field.id, { counters: { backup: 3 } });
    const minion = withMinion(staged, HYDRA_MERCENARY, { player: P1 });
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: agent.id,
      targetInstanceId: minion.id,
    };
    const protectedRun = drive(minion.state, { chooseTriggers: takes("27044.field-agent-interrupt") }, attack);
    expect(damageOn(protectedRun.state, agent.id)).toBe(0);
    expect(inst(protectedRun.state, field.id).exhausted).toBe(true);
    const control = drive(minion.state, { chooseTriggers: () => [] }, attack);
    expect(damageOn(control.state, agent.id)).toBe(1);
  });
});
