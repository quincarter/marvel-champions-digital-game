import { CORE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  characterProfile,
  handSize,
  locateCard,
  type Command,
  type GameState,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  stackEncounterDeck,
  use,
} from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { ELEKTRA_ELEKTRA_EVENTS } from "./events.js";
import { attack, dealDamage, enemyAttack, find, heroAction, theVillain, you } from "../../../dsl/index.js";
import { stagedInPlay } from "../../../wave9/falcon/testing.js";
import {
  ADVANCE,
  ELEKTRA_DEPS as BASE_DEPS,
  elektraGame,
  elektraHeroGame,
  ninjaDeck,
  picking,
  triggerOption,
} from "./elektra.testing.js";
import {
  ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Elektra's signature supports, upgrades and ally (63005, 63010 to 63014) against Core's Rhino, seated beside her
 * identity and Ninja deck scripts. "Elektra" is the hero face only (ruling October 12, 2026 - Ruling 2).
 */
const DEPS = { abilities: { ...BASE_DEPS.abilities, ...ELEKTRA_ELEKTRA_EVENTS, ...REGISTRY } };
/** Test only: Sai Strike's ref made "the villain attacks your ally", to attack a character that is not your identity. */
const ATTACK_ALLY = "63009.sai-strike-action";
const ALLY_DEPS = {
  abilities: {
    ...DEPS.abilities,
    [ATTACK_ALLY]: heroAction(
      enemyAttack(theVillain, { against: you, targetCharacter: find({ categories: ["ally"] }) }),
    ),
  },
};
const REFS = [
  "63005.daredevil-response",
  "63010.resurrection-altar-interrupt",
  "63011.white-tiger-response",
  "63012.elektras-sai-action",
  "63013.history-with-the-hand-constant",
  "63013.history-with-the-hand-forced-response",
  "63014.stealth-mastery-forced-interrupt",
];

/** Surgery: a spare deck card retagged as `code`, in play (or attached to the identity). */
function stage(s: GameState, code: string, attach = false) {
  const spare = playerOf(s, P1).deck.filter((i) => (inst(s, i).cardId as string) !== code);
  return stagedInPlay(patchInstance(s, spare[spare.length - 1]!, { cardId: cardId(code) }), code, { attach });
}
const drive = (s: GameState, pick: ReturnType<typeof picking>, ...commands: Command[]) =>
  driveEventsPicking(DEPS, s, pick, ...commands).state;
/** Takes `refs` where offered as triggers, and `labels` where a prompt's option id ends with one. */
const taking = (refs: readonly string[], ...labels: string[]) =>
  picking((s) => {
    for (const ref of refs) {
      const hit = triggerOption(s, ref);
      if (hit) return hit;
    }
    const option = s.pendingChoice?.options.find((o) => labels.some((l) => (o as { label?: string }).label === l));
    return option ? [option.optionId as string] : undefined;
  });
const attackRhino = (s: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: s.activeVillainId!,
});
const encounterTop = (s: GameState) => activeEncounterDeck(s).deck[0];

describe("module", () => {
  it("scripts every ref, skips none, and each validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    for (const ref of REFS) expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("63005 Daredevil: after he uses a basic power, put a card from the encounter discard pile on top of the deck", () => {
  it("his basic attack lets you take a discarded card to the top of the encounter deck", () => {
    const dd = stage(elektraHeroGame(), "63005");
    const deckId = activeEncounterDeckId(dd.state);
    const piles = activeEncounterDeck(dd.state);
    const discarded = piles.deck[3]!;
    const state: GameState = {
      ...patchInstance(dd.state, discarded, { home: { kind: "encounterDiscard", deckId } as never }),
      encounterDecks: {
        ...dd.state.encounterDecks,
        [deckId]: { deck: piles.deck.filter((i) => i !== discarded), discard: [...piles.discard, discarded] },
      },
    };
    const attack: Command = {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: dd.id,
      targetInstanceId: state.activeVillainId!,
    };
    const after = drive(state, taking(["63005.daredevil-response"], discarded as string), attack);
    expect(inst(after, dd.id).exhausted).toBe(true);
    expect(encounterTop(after)).toBe(discarded);
    expect(activeEncounterDeck(after).discard).not.toContain(discarded);
  });
});

describe("63010 Resurrection Altar: when you would be defeated, remove it: set the dial to 9, find your obligation and reveal it", () => {
  const ALTAR = "63010.resurrection-altar-interrupt";
  const OBLIGATION = "63040";
  const obligationOf = (s: GameState) => Object.values(s.instances).find((i) => (i.cardId as string) === OBLIGATION)!;
  /** Her hero face at 1 hit point remaining with Rhino about to attack. */
  const doomed = () => {
    const altar = stage(elektraHeroGame(), "63010");
    const hero = identityOf(altar.state);
    const max = characterProfile(altar.state, hero, DEPS)!.maxHp;
    return { altar: altar.id, hero, max, state: patchInstance(altar.state, hero, { damage: max - 1 }) };
  };
  /** Surgery: her obligation moved from wherever it waits to the encounter discard pile. */
  const obligationInDiscard = (s: GameState): GameState => {
    const id = obligationOf(s).instanceId;
    const deckId = activeEncounterDeckId(s);
    const piles = activeEncounterDeck(s);
    return {
      ...patchInstance(s, id, { home: { kind: "encounterDiscard", deckId } as never }),
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: piles.deck.filter((i) => i !== id), discard: [...piles.discard.filter((i) => i !== id), id] },
      },
    };
  };

  it("taken at 0 hit points: the card leaves the game, the dial is 9, and the obligation is revealed into her play area", () => {
    const { altar, hero, state } = doomed();
    const after = drive(state, taking([ALTAR]), endTurn(P1));
    expect(after.outcome ?? null).toBeNull();
    expect(locateCard(after, altar)?.kind).toBe("removedFromGame");
    const remaining = characterProfile(after, hero, DEPS)!.maxHp - inst(after, hero).damage;
    expect(remaining).toBe(9);
    expect(playerOf(after, P1).playArea).toContain(obligationOf(after).instanceId);
  });

  it("finds the obligation in the encounter discard pile too", () => {
    const { altar, state } = doomed();
    const staged = obligationInDiscard(state);
    expect(locateCard(staged, obligationOf(staged).instanceId)?.kind).toBe("encounterDiscard");
    const after = drive(staged, taking([ALTAR]), endTurn(P1));
    expect(locateCard(after, altar)?.kind).toBe("removedFromGame");
    expect(playerOf(after, P1).playArea).toContain(obligationOf(after).instanceId);
  });

  it("declined: it stays in play and she is defeated (a solo loss)", () => {
    const { altar, state } = doomed();
    const after = drive(
      state,
      picking(() => undefined),
      endTurn(P1),
    );
    expect(locateCard(after, altar)?.kind).not.toBe("removedFromGame");
    expect(after.outcome).not.toBeNull();
  });
});

describe("63011 White Tiger: after you change to hero form, shuffle the top Ninja card in; otherwise give Elektra a boost card", () => {
  const WT = "63011.white-tiger-response";
  it("with a Ninja card to shuffle, it goes into the encounter deck and no boost card is given", () => {
    const tiger = stage(elektraGame(), "63011");
    const top = ninjaDeck(tiger.state)[0]!;
    const after = drive(tiger.state, taking([WT]), { type: "changeForm", playerId: P1 });
    expect(playerOf(after, P1).identity.form).toBe("hero");
    expect(locateCard(after, top)?.kind).toBe("encounterDeck");
    expect(inst(after, identityOf(after)).boostCards).toEqual([]);
  });

  it("with the Ninja deck empty (nothing to shuffle), Elektra is given 1 facedown boost card for her basic powers", () => {
    const tiger = stage(elektraGame(), "63011");
    const emptied: GameState = {
      ...tiger.state,
      players: tiger.state.players.map((p) =>
        p.playerId === P1 ? { ...p, separateDecks: { ...p.separateDecks, Ninja: { deck: [], discard: [] } } } : p,
      ),
    };
    const after = drive(emptied, taking([WT]), { type: "changeForm", playerId: P1 });
    const held = inst(after, identityOf(after)).boostCards;
    expect(held).toHaveLength(1);
    expect(inst(after, held[0]!).heldForBasicPowers).toBe(true);
  });
});

describe("63012 Elektra's Sai: exhaust: 1 damage to an enemy; the next Acrobatic or Attack event costs 1 less this phase", () => {
  const SAI = "63012.elektras-sai-action";
  it("deals 1 damage and exhausts", () => {
    const sai = stage(elektraHeroGame(), "63012", true);
    const after = drive(sai.state, taking([]), use(P1, sai.id, SAI));
    expect(inst(after, sai.id).exhausted).toBe(true);
    expect(inst(after, after.activeVillainId!).damage).toBe(1);
  });

  it("an Attack event then costs 1 less (played with no resources)", () => {
    const attackEvent = CORE_CARDS.find(
      (c) => c.type === "event" && c.cost === 1 && c.traits.some((t) => (t as string) === "ATTACK"),
    )!;
    const sai = stage(elektraHeroGame(), "63012", true);
    const used = drive(sai.state, taking([]), use(P1, sai.id, SAI));
    const spare = playerOf(used, P1).deck.filter((i) => (inst(used, i).cardId as string) !== "63012");
    const given = moveToHand(
      patchInstance(used, spare[spare.length - 1]!, { cardId: attackEvent.id }),
      P1,
      attackEvent.id as string,
    );
    const free = drive(given.state, taking([]), play(P1, given.ids[0]!, []));
    expect(playerOf(free, P1).discard).toContain(given.ids[0]!);
  });
});

describe("63012 Elektra's Sai, a card that is not an Acrobatic or Attack event", () => {
  it("does not use up the reduction: the Attack event played after it is still cheaper", () => {
    const sai = stage(elektraHeroGame(), "63012", true);
    const used = drive(sai.state, taking([]), use(P1, sai.id, "63012.elektras-sai-action"));
    const getReady = CORE_CARDS.find((c) => (c.id as string) === "01069")!;
    const attackEvent = CORE_CARDS.find(
      (c) => c.type === "event" && c.cost === 1 && c.traits.some((t) => (t as string) === "ATTACK"),
    )!;
    const spare = (s: GameState) => playerOf(s, P1).deck.filter((i) => (inst(s, i).cardId as string) !== "63012");
    const hand1 = moveToHand(patchInstance(used, spare(used)[0]!, { cardId: getReady.id }), P1, getReady.id as string);
    const hand2 = moveToHand(
      patchInstance(hand1.state, spare(hand1.state).at(-1)!, { cardId: attackEvent.id }),
      P1,
      attackEvent.id as string,
    );
    // Get Ready (cost 0, not an Attack or Acrobatic event) is played first, then the Attack event for free.
    const withAlly = stage(hand2.state, "63005");
    const first = drive(withAlly.state, taking([]), play(P1, hand1.ids[0]!, []));
    expect(playerOf(first, P1).discard).toContain(hand1.ids[0]!);
    const second = drive(first, taking([]), play(P1, hand2.ids[0]!, []));
    expect(playerOf(second, P1).discard).toContain(hand2.ids[0]!);
  });
});

describe("63013 History with the Hand: +1 hand size; discarded after you change form", () => {
  it("gives +1 hand size, and is discarded by the form change", () => {
    const base = elektraHeroGame();
    const before = handSize(base, P1, DEPS);
    const history = stage(base, "63013", true);
    expect(handSize(history.state, P1, DEPS)).toBe(before + 1);
    const after = drive(history.state, taking([]), { type: "changeForm", playerId: P1 });
    expect(playerOf(after, P1).discard).toContain(history.id);
  });
});

describe("63014 Stealth Mastery: when you attack or are attacked, +3 or -3 damage; it goes on top of your deck", () => {
  const SM = "63014.stealth-mastery-forced-interrupt";
  const staged = () => stage(stackEncounterDeck(elektraHeroGame(), ADVANCE), "63014", true);
  /** Rhino attacks Elektra undefended in the villain phase; Advance (boost 0) on top. */
  const attacked = (label: string) => {
    const sm = staged();
    const hero = identityOf(sm.state);
    return { sm: sm.id, hero, state: drive(sm.state, taking([SM], label), endTurn(P1)), before: sm.state };
  };
  const rhinoAtk = (s: GameState) => characterProfile(s, s.activeVillainId!, DEPS)!.atk;

  it("attacked, increase: she takes 3 more, and Stealth Mastery is on top of her deck", () => {
    const { sm, hero, state, before } = attacked("Increase the damage by 3");
    expect(inst(state, hero).damage).toBe(rhinoAtk(before) + 3);
    expect(playerOf(state, P1).deck[0]).toBe(sm);
  });

  it("attacked, reduce: she takes 3 less, and it is on top of her deck", () => {
    const { sm, hero, state, before } = attacked("Reduce the damage by 3");
    expect(inst(state, hero).damage).toBe(Math.max(0, rhinoAtk(before) - 3));
    expect(playerOf(state, P1).deck[0]).toBe(sm);
  });

  it("your own basic attack, increase: it deals 3 more", () => {
    const sm = staged();
    const atk = characterProfile(sm.state, identityOf(sm.state), DEPS)!.atk;
    const after = drive(sm.state, taking([SM], "Increase the damage by 3"), attackRhino(sm.state));
    expect(inst(after, after.activeVillainId!).damage).toBe(atk + 3);
    expect(playerOf(after, P1).deck[0]).toBe(sm.id);
  });

  it("your own basic attack, reduce: it deals 3 less (0)", () => {
    const sm = staged();
    const after = drive(sm.state, taking([SM], "Reduce the damage by 3"), attackRhino(sm.state));
    expect(inst(after, after.activeVillainId!).damage).toBe(0);
  });

  /** Sai Strike and an energy resource in hand (retagged deck cards); returns the state, the event and the payment. */
  const withStrike = (s: GameState) => {
    const spare = playerOf(s, P1).deck.filter((i) => (inst(s, i).cardId as string) !== "63014");
    const tagged = patchInstance(patchInstance(s, spare[0]!, { cardId: cardId("01088") }), spare.at(-1)!, {
      cardId: cardId("63009"),
    });
    const given = moveToHand(moveToHand(tagged, P1, "01088").state, P1, "63009");
    const energy = playerOf(given.state, P1).hand.find((i) => (inst(given.state, i).cardId as string) === "01088")!;
    return { state: given.state, strike: given.ids[0]!, energy };
  };

  it("an attack event: Sai Strike (3) deals 3 more, 6", () => {
    const { state, strike, energy } = withStrike(staged().state);
    const after = drive(state, taking([SM], "Increase the damage by 3"), play(P1, strike, [energy]));
    expect(inst(after, after.activeVillainId!).damage).toBe(6);
  });

  it("an attack ability, reduce: the reduction reaches its later instruction too, each instance floored at 0", () => {
    // Test only: Sai Strike made "(attack): Deal 5 damage to the villain. Deal 4 damage to the villain." (RRG 1.8 p. 10).
    const twice = {
      abilities: {
        ...DEPS.abilities,
        "63009.sai-strike-action": heroAction({ label: "attack" }, attack(5, theVillain), dealDamage(4, theVillain)),
      },
    };
    const { state, strike, energy } = withStrike(staged().state);
    const run = (label: string) =>
      driveEventsPicking(twice, state, taking([SM], label), play(P1, strike, [energy])).state;
    const dealt = (s: GameState) => inst(s, s.activeVillainId!).damage;
    // 5 - 3 and 4 - 3: without the reach to the later instruction it would be 2 + 4.
    expect(dealt(run("Reduce the damage by 3"))).toBe(2 + 1);
  });

  it('an attack on your ally does not trigger it: "you" is your identity', () => {
    const sm = staged();
    const ally = stage(sm.state, "63005");
    const { state, strike, energy } = withStrike(ally.state);
    const after = driveEventsPicking(
      ALLY_DEPS,
      state,
      taking([SM], "Increase the damage by 3"),
      play(P1, strike, [energy]),
    ).state;
    expect(inst(after, sm.id).attachedTo).toBe(identityOf(after));
    expect(playerOf(after, P1).deck[0]).not.toBe(sm.id);
    expect(inst(after, ally.id).damage).toBeGreaterThan(0);
  });
});
