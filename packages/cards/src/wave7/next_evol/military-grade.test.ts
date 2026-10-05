import { maxHitPoints, remainingHitPoints, traitsOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  endTurn,
  identityOf,
  stackEncounterDeck,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  use,
} from "../../testing/harness.js";
import { attachToHost, engageMinion, handWith } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS } from "../index.js";
import { MILITARY_GRADE } from "./military-grade.js";
import {
  SPIDER_MAN,
  TWO,
  type Seats,
  accepted,
  attackFor,
  attackRound,
  attachmentOf,
  attachmentsOf,
  attacksBy,
  discardNames,
  damageOn,
  drive,
  events,
  game,
  handOf,
  heroed,
  nameOf,
  piles,
  round,
  setHand,
  villainId,
  withStatuses,
} from "./superpower-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/** Stryfe (no tough status card, no retaliate) with Military Grade and Mutant Insurrection (Forearm: ATK 4) and Extreme Measures (Thumbelina) chosen. */
const stryfe = (players: Seats = [SPIDER_MAN]) =>
  game({ scenario: "stryfe", sets: ["military_grade", "mutant_insurrection", "extreme_measures"], players });
const traitNames = (s: GameState, id: Parameters<typeof traitsOf>[1]) => traitsOf(s, id, WAVE7_DEPS).map(String);

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(MILITARY_GRADE).sort()).toEqual(
      [
        "40090.heavy-armament-constant",
        "40090.heavy-armament-response",
        "40091.titanium-exoskeleton-constant",
        "40091.titanium-exoskeleton-action",
        "40092.inhibitor-collar-constant",
        "40092.inhibitor-collar-action",
        "40093.when-defeated",
      ].sort(),
    );
  });
});

describe("Heavy Armament (40090)", () => {
  const armed = (players: Seats = [SPIDER_MAN]) => attachToHost(stryfe(players), "40090", villainId(stryfe(players)));

  it("is the set's only attachment that goes to the enemy with the highest ATK: the villain alone, so Stryfe", () => {
    const s = stryfe();
    const run = round(s, { boosts: 1, reveals: ["40090"] });
    expect(attachmentsOf(run.state, villainId(run.state))).toContain("Heavy Armament");
  });

  it("goes to the enemy with the highest ATK: engaged Forearm (ATK 4) outranks Stryfe", () => {
    const withMinion = engageMinion(stryfe(), "40186").state;
    const run = round(withMinion, { boosts: 1, reveals: ["40090"] });
    const forearm = playerOf(run.state, P1).playArea.find((id) => nameOf(run.state, id) === "Forearm")!;
    expect(attachmentsOf(run.state, forearm)).toEqual(["Heavy Armament"]);
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual([]);
  });

  it("stat box ATK +2: the villain's attack is 2 higher than without it", () => {
    const control = attacksBy(attackRound(stryfe()).events, villainId(stryfe()))[0]!.baseAtk;
    const s = armed().state;
    const run = attackRound(s);
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(control + 2);
  });

  it("40090.heavy-armament-constant: attached enemy gains retaliate 2: Spider-Man's basic attack costs him 2 damage (control 0)", () => {
    const control = stryfe();
    expect(damageOn(attackFor(control, villainId(control)).state, identityOf(control))).toBe(0);
    const s = armed().state;
    const run = attackFor(s, villainId(s));
    expect(damageOn(run.state, villainId(run.state))).toBe(2);
    expect(damageOn(run.state, identityOf(run.state))).toBe(2);
  });

  it("40090.heavy-armament-response: after you attack the attached enemy, spend 2 resources of the same type to discard it", () => {
    const { state: base } = armed();
    const { state, ids } = handWith(base, P1, "physical", 2);
    const run = attackFor(state, villainId(state), {
      accept: ["Heavy Armament"],
      pay: ids.map((i) => nameOf(state, i)),
    });
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual([]);
    expect(discardNames(run.state)).toContain("Heavy Armament");
    expect(playerOf(run.state, P1).discard.length).toBe(playerOf(state, P1).discard.length + 2);
  });

  it("40090.heavy-armament-response: two resources of different types (one mental, one energy) do not pay it: it stays", () => {
    const { state: base } = armed();
    const hand = setHand(base, P1, ["01064", "01007"]);
    const run = attackFor(hand, villainId(hand), {
      accept: ["Heavy Armament"],
      pay: ["Surveillance Team", "Spider-Tracer"],
    });
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual(["Heavy Armament"]);
    expect(playerOf(run.state, P1).discard).toHaveLength(playerOf(hand, P1).discard.length);
  });

  it("40090.heavy-armament-response: attacking another enemy does not offer it", () => {
    const { state: base } = armed();
    const withMinion = engageMinion(base, "40186");
    const { state, ids } = handWith(withMinion.state, P1, "physical", 2);
    const run = attackFor(state, withMinion.id, { accept: ["Heavy Armament"], pay: ids.map((i) => nameOf(state, i)) });
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual(["Heavy Armament"]);
    expect(run.prompts.filter((p) => p.kind === "chooseTriggers")).toHaveLength(0);
  });
});

describe("Titanium Exoskeleton (40091)", () => {
  const armored = (players: Seats = [SPIDER_MAN]) => attachToHost(stryfe(players), "40091", villainId(stryfe(players)));

  it("goes to the enemy with the fewest remaining hit points: Stryfe alone, then engaged Thumbelina (3 hit points) is lower", () => {
    const alone = round(stryfe(), { boosts: 1, reveals: ["40091"] });
    expect(attachmentsOf(alone.state, villainId(alone.state))).toContain("Titanium Exoskeleton");
    const withMinion = engageMinion(stryfe(), "40182");
    expect(remainingHitPoints(withMinion.state, villainId(withMinion.state))!).toBeGreaterThan(3);
    const run = round(withMinion.state, { boosts: 1, reveals: ["40091"] });
    expect(attachmentsOf(run.state, withMinion.id)).toEqual(["Titanium Exoskeleton"]);
  });

  it("goes to the villain once damage leaves him fewer remaining hit points than the minion", () => {
    const withMinion = engageMinion(stryfe(), "40182");
    const v = villainId(withMinion.state);
    const hurt = patchInstance(withMinion.state, v, { damage: maxHitPoints(withMinion.state, v)! - 2 });
    const run = round(hurt, { boosts: 1, reveals: ["40091"] });
    expect(attachmentsOf(run.state, villainId(run.state))).toContain("Titanium Exoskeleton");
    expect(attachmentsOf(run.state, withMinion.id)).toEqual([]);
  });

  it("40091.titanium-exoskeleton-constant: Swinging Web Kick (8 damage) deals only 2 (control 8); a basic attack of 2 is unchanged", () => {
    const kick = (s: GameState) => {
      const given = moveToHand(heroed(s), P1, "01005");
      const run = drive(given.state, {}, play(P1, given.ids[0]!, payWith(given.state, P1, 3, given.ids)));
      return damageOn(run.state, villainId(run.state));
    };
    expect(kick(stryfe())).toBe(8);
    expect(kick(armored().state)).toBe(2);
    const s = armored().state;
    expect(damageOn(attackFor(s, villainId(s)).state, villainId(s))).toBe(2);
  });

  const act = (s: GameState, branch: number, payment: readonly { fromHand: InstanceId }[] = []) =>
    drive(
      heroed(s),
      {},
      use(
        P1,
        attachmentOf(s, villainId(s), "Titanium Exoskeleton"),
        "40091.titanium-exoskeleton-action",
        payment,
        undefined,
        {
          branch,
        },
      ),
    );

  it("40091.titanium-exoskeleton-action: Hero Action, spend 3 resources of any type to discard it", () => {
    const s = armored().state;
    const hand = handOf(s, P1).slice(0, 3);
    const run = act(
      s,
      0,
      hand.map((fromHand) => ({ fromHand })),
    );
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual([]);
    expect(discardNames(run.state)).toContain("Titanium Exoskeleton");
    expect(playerOf(run.state, P1).discard).toHaveLength(3);
  });

  it("40091.titanium-exoskeleton-action: or remove a stunned status card from the attached enemy to discard it", () => {
    const base = armored().state;
    const s = withStatuses(base, villainId(base), { stunned: 1 });
    const run = act(s, 2);
    expect(inst(run.state, villainId(run.state)).statuses.stunned).toBe(0);
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual([]);
    expect(playerOf(run.state, P1).discard).toHaveLength(0);
  });

  it("40091.titanium-exoskeleton-action: or remove a confused status card", () => {
    const base = armored().state;
    const s = withStatuses(base, villainId(base), { confused: 1 });
    const run = act(s, 1);
    expect(inst(run.state, villainId(run.state)).statuses.confused).toBe(0);
    expect(attachmentsOf(run.state, villainId(run.state))).toEqual([]);
  });

  it("40091.titanium-exoskeleton-action: unusable by the status branches with no status card, and by the resource branch with fewer than 3 resources", () => {
    const s = armored().state;
    expect(
      accepted(
        heroed(s),
        use(
          P1,
          attachmentOf(s, villainId(s), "Titanium Exoskeleton"),
          "40091.titanium-exoskeleton-action",
          [],
          undefined,
          { branch: 1 },
        ),
      ),
    ).toBe(false);
    expect(
      accepted(
        heroed(s),
        use(
          P1,
          attachmentOf(s, villainId(s), "Titanium Exoskeleton"),
          "40091.titanium-exoskeleton-action",
          [],
          undefined,
          { branch: 2 },
        ),
      ),
    ).toBe(false);
    const two = handOf(s, P1)
      .slice(0, 2)
      .map((fromHand) => ({ fromHand }));
    expect(
      accepted(
        heroed(s),
        use(
          P1,
          attachmentOf(s, villainId(s), "Titanium Exoskeleton"),
          "40091.titanium-exoskeleton-action",
          two,
          undefined,
          { branch: 0 },
        ),
      ),
    ).toBe(false);
  });
});

describe("Inhibitor Collar (40092), attached to a player's identity", () => {
  const collared = (players: Seats = [SPIDER_MAN], who = P1) => {
    const s = stryfe(players);
    return attachToHost(s, "40092", identityOf(s, who));
  };

  it("is attached to the identity of the player it is revealed to (two players: each of the two copies goes to its own)", () => {
    const run = round(heroed(stryfe(TWO)), { boostCards: ["01187", "01187"], reveals: ["40092", "40092"] });
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).toEqual(["Inhibitor Collar"]);
    expect(attachmentsOf(run.state, identityOf(run.state, P2))).toEqual(["Inhibitor Collar"]);
  });

  it("stat box ATK -1: Spider-Man's basic attack deals 1 (control 2)", () => {
    const s = collared().state;
    expect(damageOn(attackFor(s, villainId(s)).state, villainId(s))).toBe(1);
  });

  it("40092.inhibitor-collar-constant: his printed text box is blank (Spider-Sense draws no card; control draws 1) but his traits stay", () => {
    const drawn = (s: GameState) =>
      events(attackRound(s, undefined, { accept: ["Spider-Man"] }).events, "cardDrawn").filter((e) => e.playerId === P1)
        .length;
    expect(drawn(stryfe()) - drawn(collared().state)).toBe(1);
    const s = collared().state;
    expect(traitNames(s, identityOf(s))).toEqual(traitNames(stryfe(), identityOf(stryfe())));
    expect(traitNames(s, identityOf(s))).toContain("GENIUS");
    expect(traitNames(heroed(s), identityOf(s))).toContain("AVENGER");
  });

  const act = (s: GameState, player: typeof P1, branch: number, plan = {}) =>
    drive(
      s,
      plan,
      ...(player === P1 ? [] : [endTurn(P1)]),
      use(
        player,
        attachmentOf(s, identityOf(s, P1), "Inhibitor Collar"),
        "40092.inhibitor-collar-action",
        [],
        { exhausted: [identityOf(s, player)] },
        {
          branch,
        },
      ),
    );

  it("40092.inhibitor-collar-action: Action, exhaust a character you control to discard it (the wearer)", () => {
    const s = collared().state;
    const run = act(s, P1, 0);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(true);
    expect(attachmentsOf(run.state, identityOf(run.state))).toEqual([]);
    expect(discardNames(run.state)).toContain("Inhibitor Collar");
    expect(damageOn(run.state, identityOf(run.state))).toBe(0);
  });

  it("40092.inhibitor-collar-action: or take 3 damage to discard it", () => {
    const s = collared().state;
    const run = act(s, P1, 1);
    expect(damageOn(run.state, identityOf(run.state))).toBe(3);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    expect(attachmentsOf(run.state, identityOf(run.state))).toEqual([]);
  });

  it("40092.inhibitor-collar-action: any player can do this: P2 exhausts her own character to free P1", () => {
    const s = collared(TWO).state;
    const run = act(s, P2, 0);
    expect(inst(run.state, identityOf(run.state, P2)).exhausted).toBe(true);
    expect(inst(run.state, identityOf(run.state, P1)).exhausted).toBe(false);
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).toEqual([]);
  });

  it("40092.inhibitor-collar-action: any player can do this: P2 takes the 3 damage herself (P1 takes none)", () => {
    const s = collared(TWO).state;
    const run = act(s, P2, 1);
    expect(damageOn(run.state, identityOf(run.state, P2))).toBe(3);
    expect(damageOn(run.state, identityOf(run.state, P1))).toBe(0);
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).toEqual([]);
  });

  it("40092.inhibitor-collar-action: the exhaust branch is unavailable with every character exhausted (Hope Summers is one too)", () => {
    const base = collared().state;
    const hope = playerOf(base, P1).playArea.find((id) => nameOf(base, id) === "Hope Summers")!;
    const s = patchInstance(patchInstance(base, identityOf(base), { exhausted: true }), hope, { exhausted: true });
    expect(
      accepted(
        s,
        use(P1, attachmentOf(s, identityOf(s), "Inhibitor Collar"), "40092.inhibitor-collar-action", [], undefined, {
          branch: 0,
        }),
      ),
    ).toBe(false);
  });
});

describe("The Senator's Support (40093)", () => {
  /** The scheme revealed to P1 with 1 threat left, then thwarted by Spider-Man (THW 1) in the next player phase. */
  const defeated = (stack: readonly string[], players: Seats = [SPIDER_MAN], firstPlayer = P1) => {
    const base = heroed(stryfe(players));
    const revealed = round(base, { boostCards: ["01187", "01187"].slice(0, players.length), reveals: ["40093"] });
    const scheme = Object.values(revealed.state.instances).find((i) => i.cardId === "40093")!.instanceId;
    const primed = stackEncounterDeck(
      { ...patchInstance(revealed.state, scheme, { threat: 1 }), firstPlayerId: firstPlayer },
      ...stack,
    );
    const active = (
      primed.step.phase === "player" && primed.step.kind === "turn" ? primed.step.activePlayerId : P1
    ) as typeof P1;
    return drive(
      primed,
      {},
      {
        type: "basicThwart",
        playerId: active,
        thwarterInstanceId: identityOf(primed, active),
        schemeInstanceId: scheme,
      },
    );
  };

  it("is a 3 threat side scheme with hinder 1 per hero: it enters play with 1 threat more (4) for one player", () => {
    const base = heroed(stryfe());
    const revealed = round(base, { boosts: 1, reveals: ["40093"] });
    const scheme = Object.values(revealed.state.instances).find((i) => i.cardId === "40093")!;
    expect(scheme.threat).toBe(4);
  });

  it("40093.when-defeated: discards from the top of the encounter deck until an attachment is discarded and reveals it (Heavy Armament goes to the villain)", () => {
    const run = defeated(["01186", "01187", "40090"]);
    expect(attachmentsOf(run.state, villainId(run.state))).toContain("Heavy Armament");
    expect(discardNames(run.state)).toEqual(expect.arrayContaining(["Advance", "Assault"]));
    expect(piles(run.state).deck.map((id) => nameOf(run.state, id))).not.toContain("Heavy Armament");
  });

  it("40093.when-defeated: the first player reveals it: with P2 the first player, Inhibitor Collar attaches to P2's identity", () => {
    const run = defeated(["01186", "40092"], TWO, P2);
    expect(attachmentsOf(run.state, identityOf(run.state, P2))).toContain("Inhibitor Collar");
    expect(attachmentsOf(run.state, identityOf(run.state, P1))).not.toContain("Inhibitor Collar");
  });
});
