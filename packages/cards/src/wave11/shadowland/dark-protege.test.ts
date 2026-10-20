import { PLAYABLE_CARDS } from "@mc/content";
import { characterProfile, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  runWith,
  settle,
  stackEncounterDeck,
  use,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../wave9/falcon/testing.js";
import { BLACK_CAT, CAPTAIN_MARVEL, SHE_HULK, SPIDER_MAN } from "../../wave9/testing.js";
import { WAVE11_CARDS } from "../cards.js";
import {
  ADVANCE,
  ASSAULT,
  DEPS,
  FILLER_A,
  FILLER_B,
  attachEncounterCard,
  byLabel,
  codeOf,
  discardCodes,
  idsOf,
  recording,
  shadowGame,
} from "./corruption.testing.js";
import { SHADOWLAND_DARK_PROTEGE as REGISTRY, SHADOWLAND_DARK_PROTEGE_SKIPPED as SKIPPED } from "./dark-protege.js";

vi.setConfig({ testTimeout: 180_000 });

const ARCHPRIESTESS = "65012a";
const DAREDEVIL = "65013a";
const ELEKTRA = "65014a";
const GORGON = "65015a";
const BULLSEYE = "65016a";
const TIGER = "65017a";
const ART = "65018";
const BLESSING = "65019";
const WITHIN = "65026";
const EMBRACED = "65027";
const BO_STAFF = "65030";
const KATANA = "65032";
const CHARGE = "01099";
const CORE_MINION = "01101";
const CARDS = [ARCHPRIESTESS, DAREDEVIL, ELEKTRA, GORGON, BULLSEYE, TIGER, ART, BLESSING, WITHIN, EMBRACED];
const REFS = [
  "65012a.archpriestess-forced-response",
  "65013a.daredevil-forced-response",
  "65014a.elektra-forced-interrupt",
  "65015a.gorgon-forced-interrupt",
  "65016a.lady-bullseye-forced-response",
  "65017a.white-tiger-forced-response",
  "65018.art-of-the-kill-forced-interrupt",
  "65018.art-of-the-kill-action",
  "65019.krahllaks-blessing-forced-interrupt",
  "65026.when-revealed",
  "65026.boost",
  "65027.when-revealed",
  "65027.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const printed = (code: string) => (PLAYABLE_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const damage = (s: GameState, p = P1): number => inst(s, identityOf(s, p)).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const heroGame = (opts: Parameters<typeof shadowGame>[0] = {}) =>
  withForm(shadowGame({ ...opts, encounter: [...(opts.encounter ?? [])] }), { heroForm: 0 });
const villainAttacks = (events: readonly GameEvent[], s: GameState) =>
  ofType(events, "attackResolved").filter((e) => e.enemyInstanceId === s.activeVillainId);
function villainPhase(state: GameState, cards: readonly string[], pick = firstLegal) {
  return driveEventsPicking(DEPS, stackEncounterDeck(state, ...cards), pick, endTurn(P1));
}
const basicAttack = (s: GameState, player = P1, attacker?: InstanceId) => ({
  type: "basicAttack" as const,
  playerId: player,
  attackerInstanceId: attacker ?? identityOf(s, player),
  targetInstanceId: s.activeVillainId!,
});
/** A deck card of P1's, by what it prints. */
const deckCode = (s: GameState, want: (card: any) => boolean): string => {
  const code = playerOf(s, P1)
    .deck.map((id) => codeOf(s, id))
    .find((c) => want(printed(c)));
  if (!code) throw new Error("no such card in the deck");
  return code;
};
const isOdd = (card: any) => card.type !== "resource" && typeof card.cost === "number" && card.cost % 2 === 1;
const isEven = (card: any) => card.type !== "resource" && typeof card.cost === "number" && card.cost % 2 === 0;
const isResource = (card: any) => card.type === "resource";

describe("registry", () => {
  it("registers every printed ref of the ten cards; nothing is skipped", () => {
    const refs = CARDS.flatMap((c) => abilityRefIds(data(c))).sort();
    expect(refs).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Archpriestess 65012a", () => {
  const game = (extra: readonly string[] = []) =>
    heroGame({ villain: ARCHPRIESTESS, encounter: [BO_STAFF, KATANA, ...extra] });
  const toughOf = (s: GameState, id: string): number => inst(s, id as InstanceId).statuses.tough;

  it("forced response: gives a minion a tough status card and does nothing else", () => {
    const s = engageMinion(game(), CORE_MINION, "m1", P1);
    const run = villainPhase(s, [ADVANCE, ASSAULT, FILLER_A, FILLER_B]);
    expect(toughOf(run.state, "m1")).toBe(1);
    // Nothing was discarded from the encounter deck and nothing was dealt.
    expect(discardCodes(run.state)).not.toContain(BO_STAFF);
    expect(discardCodes(run.state)).not.toContain(KATANA);
  });

  it("forced response: if no tough status card was placed (every minion already has one), discards 3 and deals 1 minion of them to you", () => {
    const s = patchInstance(engageMinion(game(), CORE_MINION, "m1", P1), "m1" as InstanceId, {
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    // After the boost card: the three discarded are Bo Staff, Assault, Katana; the first player picks one minion.
    const run = villainPhase(s, [ADVANCE, BO_STAFF, ASSAULT, KATANA, FILLER_A, FILLER_B]);
    // One of the two discarded minions was dealt to P1 as a facedown encounter card and revealed with the phase's dealt cards.
    const revealed = [BO_STAFF, KATANA].filter((code) =>
      idsOf(run.state, code).some((id) => inst(run.state, id).engagedWith === P1),
    );
    expect(revealed).toHaveLength(1);
    expect(playerOf(run.state, P1).dealtEncounter).toHaveLength(0);
    expect(discardCodes(run.state)).toContain(ASSAULT);
    expect(toughOf(run.state, "m1")).toBe(1);
  });

  it("forced response: with no minion in play at all, the same discard-and-deal happens", () => {
    const run = villainPhase(game(), [ADVANCE, BO_STAFF, ASSAULT, KATANA, FILLER_A, FILLER_B]);
    expect(
      [BO_STAFF, KATANA].filter((code) => idsOf(run.state, code).some((id) => inst(run.state, id).engagedWith === P1)),
    ).toHaveLength(1);
  });

  it('forced response: nothing prints "choose", so the first player picks the minion that gets the tough card', () => {
    const base = withForm(
      heroGame({ villain: ARCHPRIESTESS, seats: [SPIDER_MAN, CAPTAIN_MARVEL] }),
      { heroForm: 0 },
      P2,
    );
    const s = engageMinion(engageMinion(base, CORE_MINION, "m1", P1), CORE_MINION, "m2", P2);
    const log: { kind: string; player: string; ids: string[] }[] = [];
    const run = driveEventsPicking(
      DEPS,
      stackEncounterDeck(s, ADVANCE, ASSAULT, FILLER_A, FILLER_B),
      recording(firstLegal, log),
      endTurn(P1),
      endTurn(P2),
    );
    const picks = log.filter((l) => l.ids.includes("m1") && l.ids.includes("m2"));
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((l) => l.player === P1)).toBe(true);
    expect(toughOf(run.state, "m1") + toughOf(run.state, "m2")).toBeGreaterThanOrEqual(2);
  });
});

describe("Daredevil 65013a", () => {
  const game = () => heroGame({ villain: DAREDEVIL });
  const withCat = () => stagedInPlay(game(), BLACK_CAT);
  const prompted = (log: { kind: string; ids: string[] }[]) => log.filter((l) => l.kind === "chooseOption").length;
  const discardOption = byLabel(/^Discard 1 random/);

  it("forced response: after you attack him you choose to discard 1 random card from your hand", () => {
    const s = game();
    const hand = playerOf(s, P1).hand.length;
    const run = driveEventsPicking(DEPS, s, discardOption, basicAttack(s));
    expect(playerOf(run.state, P1).hand.length).toBe(hand - 1);
    expect(villainAttacks(run.events, s)).toHaveLength(0);
  });

  it("forced response: or Daredevil attacks you", () => {
    const s = game();
    const run = driveEventsPicking(DEPS, s, byLabel(/^Daredevil attacks/), basicAttack(s));
    expect(villainAttacks(run.events, run.state)).toHaveLength(1);
    expect(playerOf(run.state, P1).hand.length).toBe(playerOf(s, P1).hand.length);
  });

  it("forced response: an ally you control attacking him also triggers it", () => {
    const staged = withCat();
    const log: { kind: string; player: string; ids: string[] }[] = [];
    driveEventsPicking(DEPS, staged.state, recording(discardOption, log), basicAttack(staged.state, P1, staged.id));
    expect(prompted(log)).toBe(1);
  });

  it("forced response: once per round per player (the ally's attack after the hero's has no prompt)", () => {
    const staged = withCat();
    const log: { kind: string; player: string; ids: string[] }[] = [];
    const first = driveEventsPicking(DEPS, staged.state, recording(discardOption, log), basicAttack(staged.state));
    expect(prompted(log)).toBe(1);
    driveEventsPicking(DEPS, first.state, recording(discardOption, log), basicAttack(first.state, P1, staged.id));
    expect(prompted(log)).toBe(1);
  });

  it("forced response: the limit is per player (a teammate's attack in the same round has its own)", () => {
    const s = withForm(heroGame({ villain: DAREDEVIL, seats: [SPIDER_MAN, CAPTAIN_MARVEL] }), { heroForm: 0 }, P2);
    const log: { kind: string; player: string; ids: string[] }[] = [];
    const first = driveEventsPicking(DEPS, s, recording(discardOption, log), basicAttack(s));
    const p2Turn = settle(runWith(DEPS, first.state, endTurn(P1)), firstLegal, undefined, DEPS);
    driveEventsPicking(DEPS, p2Turn, recording(discardOption, log), basicAttack(p2Turn, P2));
    expect(log.filter((l) => l.kind === "chooseOption").map((l) => l.player)).toEqual([P1, P2]);
  });
});

describe("Elektra 65014a", () => {
  const game = () => heroGame({ villain: ELEKTRA });
  /** P1 attacked with the top card of their deck `code`, and a tough status card already on their identity. */
  function attacked(code: string, tough = true) {
    const top = putOnTopOfDeck(game(), P1, code);
    const s = tough
      ? patchInstance(top.state, identityOf(top.state), { statuses: { stunned: 0, confused: 0, tough: 1 } })
      : top.state;
    return { s, run: villainPhase(s, [ADVANCE, FILLER_A]) };
  }

  it("forced interrupt: the top card of your deck is discarded", () => {
    const code = deckCode(game(), isOdd);
    const { s, run } = attacked(code);
    expect(playerOf(run.state, P1).deck.length).toBe(playerOf(s, P1).deck.length - 1);
    expect(playerOf(run.state, P1).discard.map((id) => codeOf(run.state, id))).toContain(code);
  });

  it("forced interrupt: an odd printed cost gives +1 ATK, and the tough status card absorbs the attack", () => {
    const { s, run } = attacked(deckCode(game(), isOdd));
    const [hit] = villainAttacks(run.events, run.state);
    expect(hit!.baseAtk).toBe(3);
    expect(damage(run.state)).toBe(0);
    expect(inst(run.state, identityOf(run.state)).statuses.tough).toBe(0);
    expect(s).toBeDefined();
  });

  it("forced interrupt: an even printed cost gives the attack overkill and piercing (the tough card is discarded first)", () => {
    const { run } = attacked(deckCode(game(), isEven));
    const [hit] = villainAttacks(run.events, run.state);
    expect(hit!.baseAtk).toBe(2);
    expect(damage(run.state)).toBe(2);
    expect(inst(run.state, identityOf(run.state)).statuses.tough).toBe(0);
  });

  it("forced interrupt: a card with no printed cost number (a resource) is not odd", () => {
    const { run } = attacked(deckCode(game(), isResource));
    const [hit] = villainAttacks(run.events, run.state);
    expect(hit!.baseAtk).toBe(2);
    expect(damage(run.state)).toBe(2);
  });

  it("forced interrupt: overkill sends the excess damage on a defending ally to the hero", () => {
    const code = deckCode(game(), isEven);
    const top = putOnTopOfDeck(game(), P1, code);
    const staged = stagedInPlay(top.state, BLACK_CAT);
    const hp = characterProfile(staged.state, staged.id, DEPS)!.maxHp;
    const weak = patchInstance(staged.state, staged.id, { damage: hp - 1 });
    const defend = (s: GameState) => {
      const c = s.pendingChoice!;
      return c.prompt.kind === "declareDefender" && c.options.some((o) => o.optionId === staged.id)
        ? [staged.id as string]
        : firstLegal(s);
    };
    const run = villainPhase(weak, [ADVANCE, FILLER_A], defend);
    // ATK 2 against 1 remaining hit point: 1 excess goes to the hero; the ally is defeated.
    expect(damage(run.state)).toBe(1);
    expect(inst(run.state, staged.id).damage).toBe(0);
  });
});

describe("Gorgon 65015a", () => {
  const game = () => heroGame({ villain: GORGON });
  const stun = byLabel(/^Stun/);

  it("forced interrupt: stun your identity", () => {
    const run = villainPhase(game(), [ADVANCE, FILLER_A], stun);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(1);
    expect(damage(run.state)).toBe(2);
  });

  it("forced interrupt: or take 2 indirect damage (on top of the attack's 2)", () => {
    const run = villainPhase(game(), [ADVANCE, FILLER_A], byLabel(/^Take 2 indirect/));
    expect(damage(run.state)).toBe(4);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(0);
  });

  it("forced interrupt: or spend a physical resource (offered only to a player who holds one)", () => {
    const withPhysical = moveToHand(
      game(),
      P1,
      deckCode(game(), (c) => c.resourceIcons?.physical > 0),
    ).state;
    const log: { kind: string; player: string; ids: string[] }[] = [];
    const labels: string[] = [];
    const run = villainPhase(withPhysical, [ADVANCE, FILLER_A], (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption") labels.push(...s.pendingChoice.options.map((o) => o.label));
      return recording(byLabel(/^Spend/), log)(s);
    });
    expect(labels.some((l) => l.startsWith("Spend a [physical]"))).toBe(true);
    expect(damage(run.state)).toBe(2);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(0);
    // A hand with no physical resource is not offered the spend.
    const bare = patchHand(game());
    const labelsBare: string[] = [];
    villainPhase(bare, [ADVANCE, FILLER_A], (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption")
        labelsBare.push(...s.pendingChoice.options.map((o) => o.label));
      return firstLegal(s);
    });
    expect(labelsBare.some((l) => l.startsWith("Spend"))).toBe(false);
    expect(labelsBare.length).toBeGreaterThan(0);
  });
});

/** The state with P1's hand emptied of every card that could pay a physical resource (printed physical or wild, and resource cards), moved to the bottom of the deck. */
function patchHand(state: GameState): GameState {
  const owner = playerOf(state, P1);
  const physical = (id: InstanceId) => {
    const icons = printed(codeOf(state, id)).resourceIcons ?? {};
    return icons.physical > 0 || icons.wild > 0 || printed(codeOf(state, id)).type === "resource";
  };
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: owner.hand.filter((id) => !physical(id)),
            deck: [...owner.deck, ...owner.hand.filter(physical)],
          }
        : p,
    ),
  };
}

describe("Lady Bullseye 65016a", () => {
  const game = () => stagedInPlay(heroGame({ villain: BULLSEYE }), BLACK_CAT);
  const defendWithCat = (id: string) => (s: GameState) => {
    const c = s.pendingChoice!;
    return c.prompt.kind === "declareDefender" && c.options.some((o) => o.optionId === id) ? [id] : firstLegal(s);
  };

  it("forced response: an undefended attack deals you 1 indirect damage (and places no threat)", () => {
    const { state } = game();
    const run = villainPhase(state, [ADVANCE, FILLER_A]);
    expect(damage(run.state)).toBe(2);
    // The hero was undefended, so the attack's damage and the indirect point both landed: 1 ATK + 1.
    expect(villainAttacks(run.events, run.state)[0]!.damageDealt).toBe(1);
  });

  it("forced response: a defended attack places 1 threat on the main scheme instead", () => {
    const { state, id } = game();
    const undefended = villainPhase(state, [ADVANCE, FILLER_A]);
    const defended = villainPhase(state, [ADVANCE, FILLER_A], defendWithCat(id));
    expect(mainThreat(defended.state) - mainThreat(undefended.state)).toBe(1);
    expect(damage(defended.state)).toBe(0);
  });
});

describe("White Tiger 65017a", () => {
  it("forced response: after she attacks you she attacks you again with +1 ATK, once", () => {
    const s = heroGame({ villain: TIGER });
    const run = villainPhase(s, [ADVANCE, ASSAULT, FILLER_A, FILLER_B]);
    const hits = villainAttacks(run.events, run.state);
    expect(hits.map((h) => h.baseAtk)).toEqual([0, 1]);
  });

  it("forced response: the limit is per player (each of two players is attacked twice)", () => {
    const s = withForm(heroGame({ villain: TIGER, seats: [SPIDER_MAN, CAPTAIN_MARVEL] }), { heroForm: 0 }, P2);
    const run = driveEventsPicking(
      DEPS,
      stackEncounterDeck(s, ADVANCE, ASSAULT, FILLER_A, FILLER_B),
      firstLegal,
      endTurn(P1),
      endTurn(P2),
    );
    expect(villainAttacks(run.events, run.state).map((h) => h.baseAtk)).toEqual([0, 1, 0, 1]);
  });
});

describe("Art of the Kill 65018", () => {
  const game = (opts: Parameters<typeof shadowGame>[0] = {}) =>
    attachEncounterCard(heroGame({ encounter: [ART], ...opts }), ART, identityOf(heroGame()));

  it("forced interrupt: an enemy that attacks you gets +1 ATK for that attack (Rhino 2 -> 3); control: unattached 2", () => {
    const { state } = game();
    const run = villainPhase(state, [ADVANCE, FILLER_A]);
    expect(villainAttacks(run.events, run.state)[0]!.baseAtk).toBe(3);
    const control = villainPhase(heroGame(), [ADVANCE, FILLER_A]);
    expect(villainAttacks(control.events, control.state)[0]!.baseAtk).toBe(2);
  });

  it("forced interrupt: if that attack defeats a character, place 1 threat on the main scheme", () => {
    const withCat = (attach: boolean) => {
      const staged = stagedInPlay(heroGame({ encounter: [ART] }), BLACK_CAT);
      const hp = characterProfile(staged.state, staged.id, DEPS)!.maxHp;
      const weak = patchInstance(staged.state, staged.id, { damage: hp - 1 });
      const s = attach ? attachEncounterCard(weak, ART, identityOf(weak)).state : weak;
      const defend = (st: GameState) => {
        const c = st.pendingChoice!;
        return c.prompt.kind === "declareDefender" && c.options.some((o) => o.optionId === staged.id)
          ? [staged.id as string]
          : firstLegal(st);
      };
      return villainPhase(s, [ADVANCE, FILLER_A], defend);
    };
    const lethal = withCat(true);
    // The ally was defeated by the attack; the extra threat is the card's.
    expect(ofType(lethal.events, "characterDefeated").map((e) => e.cardId as string)).toContain(BLACK_CAT);
    const nonLethal = (() => {
      const { state } = game();
      return villainPhase(state, [ADVANCE, FILLER_A]);
    })();
    expect(ofType(nonLethal.events, "characterDefeated")).toHaveLength(0);
    // Threat from the card: compare the attached run with the scheme's threat after an identical, unattached lethal run.
    const noCard = withCat(false);
    expect(mainThreat(lethal.state) - mainThreat(noCard.state)).toBe(1);
  });

  it("alter-ego action: spend energy, mental and physical resources to discard it (not in hero form)", () => {
    const { state, id } = attachEncounterCard(shadowGame({ encounter: [ART] }), ART, identityOf(shadowGame()));
    const energy = deckCode(state, (c) => c.resourceIcons?.energy > 0 && !c.resourceIcons?.wild);
    const mental = deckCode(state, (c) => c.resourceIcons?.mental > 0 && !c.resourceIcons?.wild);
    const physical = deckCode(state, (c) => c.resourceIcons?.physical > 0 && !c.resourceIcons?.wild);
    const given = moveToHand(state, P1, energy, mental, physical);
    const pay = given.ids.map((fromHand) => ({ fromHand }));
    const used = applyOk(given.state, use(P1, id, "65018.art-of-the-kill-action", pay), DEPS).state;
    expect(inst(used, id).attachedTo).toBeNull();
    expect(discardCodes(used)).toContain(ART);
    // Control: in hero form the action is not offered.
    const asHero = withForm(given.state, { heroForm: 0 });
    expect(() => applyOk(asHero, use(P1, id, "65018.art-of-the-kill-action", pay), DEPS)).toThrow();
  });
});

describe("Krahllak's Blessing 65019", () => {
  const game = () => {
    const base = withForm(shadowGame({ seats: [SHE_HULK], encounter: [BLESSING] }), { heroForm: 0 });
    return attachEncounterCard(base, BLESSING, base.activeVillainId!);
  };
  const damageOnVillain = (s: GameState): number => inst(s, s.activeVillainId!).damage;

  it("forced interrupt: reduces the damage by 3, the villain attacks that character, and the card is discarded", () => {
    const { state, id } = game();
    const run = driveEventsPicking(DEPS, state, firstLegal, basicAttack(state));
    const unblessed = withForm(shadowGame({ seats: [SHE_HULK] }), { heroForm: 0 });
    const plain = driveEventsPicking(DEPS, unblessed, firstLegal, basicAttack(unblessed));
    // Her basic attack against the villain does 3 less with the Blessing.
    expect(damageOnVillain(plain.state)).toBeGreaterThanOrEqual(3);
    expect(damageOnVillain(run.state)).toBe(damageOnVillain(plain.state) - 3);
    expect(villainAttacks(run.events, run.state)).toHaveLength(1);
    expect(villainAttacks(run.events, run.state)[0]!.targetInstanceId).toBe(identityOf(run.state));
    expect(inst(run.state, id).attachedTo).toBeNull();
    expect(discardCodes(run.state)).toContain(BLESSING);
  });
});

describe("Darkness Within 65026", () => {
  it("when revealed: change to hero form, and the villain attacks you", () => {
    const s = shadowGame({ encounter: [WITHIN] });
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    const run = villainPhase(s, [ADVANCE, WITHIN, FILLER_A]);
    expect(playerOf(run.state, P1).identity.form).toBe("hero");
    // The villain schemed in the villain phase (alter-ego); the attack is Darkness Within's.
    expect(villainAttacks(run.events, run.state)).toHaveLength(1);
  });

  it("boost: an attack gains overkill (the defending ally's excess damage reaches the hero); another boost does not", () => {
    const staged = stagedInPlay(heroGame({ encounter: [WITHIN] }), BLACK_CAT);
    const hp = characterProfile(staged.state, staged.id, DEPS)!.maxHp;
    const weak = patchInstance(staged.state, staged.id, { damage: hp - 1 });
    const defend = (st: GameState) => {
      const c = st.pendingChoice!;
      return c.prompt.kind === "declareDefender" && c.options.some((o) => o.optionId === staged.id)
        ? [staged.id as string]
        : firstLegal(st);
    };
    const boosted = villainPhase(weak, [WITHIN, FILLER_A], defend);
    const plain = villainPhase(weak, [ADVANCE, FILLER_A], defend);
    expect(damage(boosted.state)).toBeGreaterThan(0);
    expect(damage(plain.state)).toBe(0);
  });
});

describe("Embraced by Darkness 65027", () => {
  const game = () => shadowGame({ encounter: [EMBRACED, CHARGE] });
  /** Boost for the villain's scheme, the card, then the boost for its own scheme, and the cards below. */
  const reveal = (boost: string) => villainPhase(game(), [ADVANCE, EMBRACED, boost, FILLER_A, FILLER_B, ASSAULT]);

  it("when revealed: the villain schemes; if 2 or less threat was placed, discard the top 3 cards of the encounter deck", () => {
    const run = reveal(ASSAULT);
    const schemes = ofType(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === run.state.activeVillainId);
    expect(schemes.length).toBeGreaterThanOrEqual(2);
    expect(schemes[1]!.threatPlaced).toBeLessThanOrEqual(2);
    expect(discardCodes(run.state)).toEqual(expect.arrayContaining([FILLER_A, FILLER_B]));
  });

  it("when revealed: with more than 2 threat placed (boost icons), nothing is discarded", () => {
    const run = reveal(CHARGE);
    const schemes = ofType(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === run.state.activeVillainId);
    expect(schemes[1]!.threatPlaced).toBeGreaterThan(2);
    expect(discardCodes(run.state)).not.toContain(FILLER_B);
  });

  it("boost: an attack places 2 threat on the main scheme; another boost places none", () => {
    const start = heroGame({ encounter: [EMBRACED] });
    const boosted = villainPhase(start, [EMBRACED, FILLER_A]);
    const plain = villainPhase(start, [ADVANCE, FILLER_A]);
    expect(mainThreat(boosted.state) - mainThreat(plain.state)).toBe(2);
  });
});
