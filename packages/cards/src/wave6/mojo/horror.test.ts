import {
  activeEncounterDeck,
  activeVillain,
  cardsInPlay,
  type EngineDeps,
  type GameEvent,
  hasKeyword,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  picking,
  playerOf,
  P1,
  P2,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { attachToHost, engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { intoPlayArea } from "../mut_gen/magneto-testing.js";
import { chosen, encounterCards, revealCard, selectCards, whenRevealed } from "../../dsl/index.js";
import { HORROR_ABILITIES } from "./horror.js";
import { horrorGame, inEncounterPiles, inPlay, toEncounterDiscard, tuckAllies } from "./horror-testing.js";

const deps: EngineDeps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const MOJO_FILES = "39047";
const BANDOLIER = "39048";
const CULTIST = "39049";
const KRAKEN = "39050";
const VAMPIRE = "39051";
const WEREWOLF = "39052";
const HELLCAT = "01020";
const TIGRA = "01051";

/** Zero-boost-icon encounter cards, to be an activation's boost card (and a harmless filler to reveal). */
const ZERO_BOOST = ["01186", "01186", "01187", "01187", "32153", "32153", "32154", "32154"];
const ZB = ZERO_BOOST;

/** The hero form (She-Hulk: 15 hit points), past the response window a form change can open. */
const heroGame = (starterDeckId = "core-she-hulk-aggression"): GameState =>
  settle(run(horrorGame({ players: [{ starterDeckId }] }), toHero(P1)), firstLegal, undefined, deps);
/** P1 ends their turn with these encounter cards stacked on top of the deck, `picker` answering every prompt. */
const endTurnWith = (state: GameState, picker: Picker, ...codes: string[]) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...codes), picker, { type: "endTurn", playerId: P1 });
const damageDealtBy = (events: readonly GameEvent[], source: InstanceId) =>
  of(events, "damageDealt")
    .filter((e) => e.sourceInstanceId === source)
    .map((e) => [e.targetInstanceId, e.amount] as const);
const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "damageDealt")
    .filter((e) => e.targetInstanceId === id)
    .map((e) => e.amount);
const revealedCodes = (events: readonly GameEvent[]) =>
  of(events, "encounterCardRevealed").map((e) => e.cardId as string);
/** A card of `player`'s (hand or deck) printed as `code`. */
const cardOf = (state: GameState, code: string, player = P1): InstanceId => {
  const owner = playerOf(state, player);
  const id = [...owner.hand, ...owner.deck, ...owner.discard].find((i) => state.instances[i]!.cardId === code);
  if (!id) throw new Error(`no ${code}`);
  return id;
};
const basicAttack = (state: GameState, target: InstanceId, attacker = identityOf(state, P1)) =>
  ({ type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }) as const;
/** Accepts the Bandolier's interrupt whenever it is offered, else answers like `firstLegal`. */
const usingBandolier: Picker = (state) =>
  state.pendingChoice?.prompt.kind === "chooseTriggers"
    ? [state.pendingChoice.options.find((o) => o.optionId.endsWith("39048.bandolier-of-stakes-interrupt"))!.optionId]
    : firstLegal(state);
/** `ally` defends against the attacks of `enemy` only (the villain's own attack is not defended). */
const defendingAgainst =
  (enemy: InstanceId, ally: InstanceId): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "declareDefender" &&
    state.pendingChoice.prompt.attack.enemyInstanceId === enemy &&
    state.pendingChoice.options.some((o) => o.optionId === ally)
      ? [ally as string]
      : firstLegal(state);

describe("registry", () => {
  it("registers every ability ref of the Horror set", () => {
    expect(Object.keys(HORROR_ABILITIES).sort()).toEqual(
      [
        "39047.the-mojo-files-constant",
        "39047.the-mojo-files-constant-2",
        "39047.when-revealed",
        "39048.when-revealed",
        "39048.bandolier-of-stakes-interrupt",
        "39049.cultist-forced-response",
        "39050.the-kraken-forced-response",
        "39050.when-defeated",
        "39051.vampire-constant",
        "39051.vampire-forced-response",
        "39052.when-revealed",
        "39052.werewolf-pack-forced-interrupt",
      ].sort(),
    );
  });

  it("the set's six cards are in the game from data", () => {
    const state = horrorGame();
    for (const code of [MOJO_FILES, BANDOLIER, CULTIST, KRAKEN, VAMPIRE, WEREWOLF])
      expect(inEncounterPiles(state, code).length, code).toBe(1);
  });
});

describe("The Mojo Files (39047)", () => {
  it("reveals from the encounter deck: enters play, gains surge (the next card is revealed too)", () => {
    const { state: after, events } = endTurnWith(heroGame(), firstLegal, ZB[0]!, MOJO_FILES, ZB[2]!);
    expect(inPlay(after, MOJO_FILES)).toHaveLength(1);
    expect(revealedCodes(events)).toEqual(expect.arrayContaining([MOJO_FILES, ZB[2]!]));
  });

  it("When Revealed: discards each other SETTING environment in play", () => {
    const base = horrorGame({ modularSetIds: ["horror", "crime"] });
    // The Crime SHOW environment (Dial M for Mojo, 39035) is a SETTING too.
    const { state: withSetting, id: setting } = encounterCardInVillainArea(base, "39035");
    const state = run(withSetting, toHero(P1));
    const { state: after } = endTurnWith(state, firstLegal, ZB[0]!, MOJO_FILES);
    expect(inPlay(after, MOJO_FILES)).toHaveLength(1);
    expect(cardsInPlay(after)).not.toContain(setting);
    expect(activeEncounterDeck(after).discard).toContain(setting);
  });

  it("does not surge when revealed by a search (insert p. 18: not 'revealed from the encounter deck')", () => {
    const state = run(horrorGame({ modularSetIds: ["horror", "acolytes"] }), toHero(P1));
    // Zeal for the Cause stands in for "search the encounter deck for The Mojo Files and reveal it".
    const searching: EngineDeps = {
      ...deps,
      abilities: {
        ...deps.abilities,
        "32164.when-revealed": whenRevealed(
          selectCards("found", encounterCards(["deck", "discard"], { name: "The Mojo Files" })),
          revealCard(chosen("found")),
        ),
      },
    };
    const stacked = stackEncounterDeck(state, ZB[0]!, "32164", ZB[2]!);
    const { state: after, events } = driveEventsPicking(searching, stacked, firstLegal, {
      type: "endTurn",
      playerId: P1,
    });
    expect(inPlay(after, MOJO_FILES)).toHaveLength(1);
    expect(revealedCodes(events)).toEqual(expect.arrayContaining(["32164", MOJO_FILES]));
    // No surge: the card stacked behind Zeal for the Cause was never revealed.
    expect(revealedCodes(events)).not.toContain(ZB[2]!);
  });

  it("each minion gains quickstrike (the granted keyword is read on every minion in play)", () => {
    const base = heroGame();
    const { state: withMojo } = encounterCardInVillainArea(base, MOJO_FILES);
    const { state, id: vampire } = engageMinion(withMojo, VAMPIRE, P1);
    const plain = engageMinion(base, VAMPIRE, P1);
    expect(hasKeyword(plain.state, plain.id, "quickstrike", deps)).toBe(false);
    expect(hasKeyword(state, vampire, "quickstrike", deps)).toBe(true);
    const { state: gone } = engageMinion(base, WEREWOLF, P1);
    expect(hasKeyword(gone, inPlay(gone, WEREWOLF)[0]!, "quickstrike", deps)).toBe(false);
  });

  // ENGINE GAP (reported in the handoff): `quickstrikeAttack` (engine/src/resolve/enter-play.ts) reads
  // `hasKeyword(state, id, "quickstrike")` with no `deps`, so a granted quickstrike is never read at engagement and a
  // minion revealed with this card in play does not attack as it engages (the Brotherhood's grant has the same hole).
  it.todo(
    "a minion revealed with it in play attacks as it engages you, before its When Revealed (blocked on the engine gap)",
  );

  describe("each ally takes -1 consequential damage after attacking a minion", () => {
    /** She-Hulk with Hellcat (ATK 1, 3 hit points, 1 consequential damage from attacking and from thwarting). */
    const setup = (mojoFiles: boolean) => {
      const hero1 = heroGame();
      const withHellcat = intoPlayArea(hero1, P1, HELLCAT);
      const minion = engageMinion(withHellcat.state, WEREWOLF, P1); // 4 hit points: Hellcat's attack does not defeat it
      const state = mojoFiles ? encounterCardInVillainArea(minion.state, MOJO_FILES).state : minion.state;
      return { state, hellcat: withHellcat.id, minion: minion.id, villain: activeVillain(state)!.instanceId };
    };

    it("control: without it, Hellcat attacking a minion takes 1 consequential damage", () => {
      const { state, hellcat, minion } = setup(false);
      const after = run(state, basicAttack(state, minion, hellcat));
      expect(inst(after, minion).damage).toBe(1);
      expect(inst(after, hellcat).damage).toBe(1);
    });

    it("attacking a minion: the 1 consequential damage becomes 0", () => {
      const { state, hellcat, minion } = setup(true);
      const after = run(state, basicAttack(state, minion, hellcat));
      expect(inst(after, minion).damage).toBe(1);
      expect(inst(after, hellcat).damage).toBe(0);
    });

    it("attacking the villain is not attacking a minion: she still takes 1", () => {
      const { state, hellcat, villain } = setup(true);
      const after = run(state, basicAttack(state, villain, hellcat));
      expect(inst(after, hellcat).damage).toBe(1);
    });

    it("thwarting is not attacking: she still takes 1", () => {
      const { state, hellcat } = setup(true);
      const after = run(state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: hellcat,
        schemeInstanceId: state.mainScheme.instanceId,
      });
      expect(inst(after, hellcat).damage).toBe(1);
    });

    it("a hero attacking a minion is unaffected (no consequential damage to take)", () => {
      const { state, minion } = setup(true);
      const hero = identityOf(state, P1);
      const after = run(state, basicAttack(state, minion));
      expect(inst(after, minion).damage).toBe(3);
      expect(inst(after, hero).damage).toBe(0);
    });
  });
});

describe("Bandolier of Stakes (39048)", () => {
  /** Pays with the first card of the hand the spend prompt offers; the end-of-turn discard prompt is answered first. */
  const payingAnything: Picker = (state) =>
    state.pendingChoice?.prompt.kind === "spendResources"
      ? [state.pendingChoice.options[0]!.optionId]
      : firstLegal(state);
  /** Spider-Man (ATK 2) ends his turn with the Bandolier about to be revealed; it surges into a zero-boost card. */
  const reveal = (picker: Picker) => {
    const hero1 = heroGame("core-spider-man-justice");
    const stacked = stackEncounterDeck(hero1, ZB[0]!, BANDOLIER, ZB[2]!);
    return driveEventsPicking(deps, stacked, picker, { type: "endTurn", playerId: P1 });
  };

  it("When Revealed: spend 1 resource to attach it to your identity, with 3 stake counters", () => {
    const { state, events } = reveal(payingAnything);
    const [bandolier] = inPlay(state, BANDOLIER);
    expect(inst(state, bandolier!).attachedTo).toBe(identityOf(state, P1));
    expect(inst(state, bandolier!).counters.stake).toBe(3);
    expect(revealedCodes(events)).toEqual(expect.arrayContaining([BANDOLIER, ZB[2]!]));
  });

  it("the spent resource is a card from the hand, discarded as the payment", () => {
    const paid = reveal(payingAnything);
    const declined = reveal(firstLegal);
    expect(playerOf(paid.state, P1).hand).toHaveLength(playerOf(declined.state, P1).hand.length - 1);
    expect(playerOf(paid.state, P1).discard).toHaveLength(playerOf(declined.state, P1).discard.length + 1);
  });

  it("Otherwise, discard this card: declining the payment spends nothing and discards it (it still surges)", () => {
    const { state, events } = reveal(firstLegal);
    expect(inPlay(state, BANDOLIER)).toHaveLength(0);
    expect(activeEncounterDeck(state).discard.some((i) => state.instances[i]!.cardId === BANDOLIER)).toBe(true);
    expect(revealedCodes(events)).toEqual(expect.arrayContaining([BANDOLIER, ZB[2]!]));
  });

  describe("Hero Interrupt: remove 1 stake counter → +1 ATK and piercing for that basic attack", () => {
    /** Spider-Man (ATK 2) with the Bandolier attached (3 stake counters) and `code` engaged. */
    const armed = (code: string, stakes = 3) => {
      const hero1 = heroGame("core-spider-man-justice");
      const bandolier = attachToHost(hero1, BANDOLIER, identityOf(hero1, P1));
      const withCounters = patchInstance(bandolier.state, bandolier.id, { counters: { stake: stakes } });
      const target = engageMinion(withCounters, code, P1);
      return { state: target.state, target: target.id, bandolier: bandolier.id };
    };

    it("+1 ATK and a stake counter spent: 2 becomes 3 damage", () => {
      const { state, target, bandolier } = armed(WEREWOLF);
      const { state: after } = driveEventsPicking(deps, state, usingBandolier, basicAttack(state, target));
      expect(inst(after, target).damage).toBe(3);
      expect(inst(after, bandolier).counters.stake).toBe(2);
    });

    it("it is optional: declining deals the printed 2 and keeps the counter", () => {
      const { state, target, bandolier } = armed(WEREWOLF);
      const { state: after } = driveEventsPicking(deps, state, firstLegal, basicAttack(state, target));
      expect(inst(after, target).damage).toBe(2);
      expect(inst(after, bandolier).counters.stake).toBe(3);
    });

    it("the attack gains piercing: the target's tough status card is discarded before damage, so the damage lands", () => {
      const { state, target } = armed(WEREWOLF);
      const tough = patchInstance(state, target, { statuses: { ...inst(state, target).statuses, tough: 1 } });
      // Control: without the interrupt the tough card absorbs the damage.
      const control = driveEventsPicking(deps, tough, firstLegal, basicAttack(tough, target));
      expect(inst(control.state, target).damage).toBe(0);
      expect(inst(control.state, target).statuses.tough ?? 0).toBe(0);
      const { state: after } = driveEventsPicking(deps, tough, usingBandolier, basicAttack(tough, target));
      expect(inst(after, target).damage).toBe(3);
      expect(inst(after, target).statuses.tough ?? 0).toBe(0);
    });

    it("it is for your hero only: an ally's basic attack is not offered it", () => {
      const { state, target } = armed(WEREWOLF);
      const withHellcat = intoPlayArea(state, P1, "01002"); // Black Cat, ATK 1
      const offered: string[] = [];
      const watching: Picker = (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTriggers") offered.push("offered");
        return firstLegal(s);
      };
      const { state: after } = driveEventsPicking(
        deps,
        withHellcat.state,
        watching,
        basicAttack(withHellcat.state, target, withHellcat.id),
      );
      expect(offered).toEqual([]);
      expect(inst(after, target).damage).toBe(1);
    });

    it("with no stake counters left it is not offered", () => {
      const { state, target } = armed(WEREWOLF, 0);
      const offered: string[] = [];
      const watching: Picker = (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTriggers") offered.push("offered");
        return firstLegal(s);
      };
      const { state: after } = driveEventsPicking(deps, state, watching, basicAttack(state, target));
      expect(offered).toEqual([]);
      expect(inst(after, target).damage).toBe(2);
    });

    it("it is for a basic attack only: not a basic thwart", () => {
      const { state } = armed(WEREWOLF);
      const offered: string[] = [];
      const watching: Picker = (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTriggers") offered.push("offered");
        return firstLegal(s);
      };
      driveEventsPicking(deps, state, watching, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state, P1),
        schemeInstanceId: state.mainScheme.instanceId,
      });
      expect(offered).toEqual([]);
    });

    it("against Vampire: +1 ATK is added before the piercing doubling (RRG 1.8 'Modifiers' p. 29): (2 + 1) x 2 = 6", () => {
      const { state, target } = armed(VAMPIRE);
      const { state: after, events } = driveEventsPicking(deps, state, usingBandolier, basicAttack(state, target));
      expect(of(events, "damageDoubled")).toHaveLength(1);
      // Vampire has 6 hit points: defeated.
      expect(cardsInPlay(after)).not.toContain(target);
    });
  });
});

describe("Vampire (39051)", () => {
  it("attacks without piercing deal their normal damage to it", () => {
    const hero1 = heroGame("core-spider-man-justice");
    const { state, id } = engageMinion(hero1, VAMPIRE, P1);
    const { state: after, events } = driveEventsPicking(deps, state, firstLegal, basicAttack(state, id));
    expect(inst(after, id).damage).toBe(2);
    expect(of(events, "damageDoubled")).toHaveLength(0);
  });

  it("an attack with piercing deals double damage to it", () => {
    const hero1 = heroGame("core-spider-man-justice");
    const bandolier = attachToHost(hero1, BANDOLIER, identityOf(hero1, P1));
    const armed = patchInstance(bandolier.state, bandolier.id, { counters: { stake: 3 } });
    // Hurt it first so the doubling shows without a defeat: 1 damage already, Spider-Man deals (2 + 1) x 2 = 6.
    const { state, id } = engageMinion(armed, VAMPIRE, P1);
    const hurt = patchInstance(state, id, { damage: 0 });
    const { events } = driveEventsPicking(deps, hurt, usingBandolier, basicAttack(hurt, id));
    expect(of(events, "damageDoubled").map((e) => [e.from, e.to])).toEqual([[3, 6]]);
  });

  /** She-Hulk with a Vampire engaged, `vampireDamage` damage on it. */
  const duel = (vampireDamage: number) => {
    const { state, id } = engageMinion(heroGame(), VAMPIRE, P1);
    return { state: patchInstance(state, id, { damage: vampireDamage }), vampire: id };
  };

  it("After it attacks and damages a character: heals all damage from it (and no tough status card)", () => {
    const { state, vampire } = duel(3);
    const { state: after, events } = endTurnWith(state, firstLegal, ZB[0]!, ZB[1]!);
    expect(damageTo(events, identityOf(after, P1))).toContain(2);
    expect(inst(after, vampire).damage).toBe(0);
    expect(inst(after, vampire).statuses.tough ?? 0).toBe(0);
  });

  it("If no damage was healed this way (it had none), it gets a tough status card", () => {
    const { state, vampire } = duel(0);
    const { state: after } = endTurnWith(state, firstLegal, ZB[0]!, ZB[1]!);
    expect(inst(after, vampire).damage).toBe(0);
    expect(inst(after, vampire).statuses.tough).toBe(1);
  });

  it("an ally it damages counts: a defended attack heals it too", () => {
    const { state, vampire } = duel(3);
    const withAlly = intoPlayArea(state, P1, HELLCAT);
    const { state: after, events } = endTurnWith(
      withAlly.state,
      defendingAgainst(vampire, withAlly.id),
      ZB[0]!,
      ZB[1]!,
    );
    expect(damageTo(events, withAlly.id)).toEqual([2]);
    expect(inst(after, vampire).damage).toBe(0);
  });

  it("an attack that damages nobody (the defender's tough card absorbs it) heals nothing and gives no tough card", () => {
    const { state, vampire } = duel(3);
    const withAlly = intoPlayArea(state, P1, HELLCAT);
    const toughAlly = patchInstance(withAlly.state, withAlly.id, {
      statuses: { ...inst(withAlly.state, withAlly.id).statuses, tough: 1 },
    });
    const { state: after } = endTurnWith(toughAlly, defendingAgainst(vampire, withAlly.id), ZB[0]!, ZB[1]!);
    expect(inst(after, withAlly.id).damage).toBe(0);
    expect(inst(after, vampire).damage).toBe(3);
    expect(inst(after, vampire).statuses.tough ?? 0).toBe(0);
  });
});

describe("Cultist (39049)", () => {
  /** She-Hulk with a Cultist engaged. */
  const cultistGame = () => {
    const { state, id } = engageMinion(heroGame(), CULTIST, P1);
    return { state, cultist: id };
  };
  const discardHas = (state: GameState, id: InstanceId) => activeEncounterDeck(state).discard.includes(id);

  it("After it attacks you: fetches The Kraken from the encounter deck, engaged with you, and discards itself", () => {
    const { state, cultist } = cultistGame();
    const [kraken] = inEncounterPiles(state, KRAKEN);
    expect(activeEncounterDeck(state).deck).toContain(kraken);
    const { state: after } = endTurnWith(state, firstLegal, ZB[0]!, ZB[1]!);
    expect(inPlay(after, KRAKEN)).toEqual([kraken]);
    expect(inst(after, kraken!).engagedWith).toBe(P1);
    expect(cardsInPlay(after)).not.toContain(cultist);
    expect(discardHas(after, cultist)).toBe(true);
  });

  it("finds The Kraken in the encounter discard pile too", () => {
    const { state, cultist } = cultistGame();
    const { state: inDiscard, id: kraken } = toEncounterDiscard(state, KRAKEN);
    expect(activeEncounterDeck(inDiscard).discard).toContain(kraken);
    const { state: after } = endTurnWith(inDiscard, firstLegal, ZB[0]!, ZB[1]!);
    expect(inPlay(after, KRAKEN)).toEqual([kraken]);
    expect(inst(after, kraken).engagedWith).toBe(P1);
    expect(cardsInPlay(after)).not.toContain(cultist);
  });

  it("works against an alter-ego too: its scheme is an activation against you", () => {
    const hero1 = horrorGame({ players: [{ starterDeckId: "core-she-hulk-aggression" }] });
    const { state, id: cultist } = engageMinion(hero1, CULTIST, P1);
    const { state: after, events } = endTurnWith(state, firstLegal, ZB[0]!, ZB[1]!);
    expect(of(events, "schemeResolved").some((e) => e.enemyInstanceId === cultist)).toBe(true);
    expect(inPlay(after, KRAKEN)).toHaveLength(1);
    expect(cardsInPlay(after)).not.toContain(cultist);
  });

  it("engaged with the player it activated against, not the first player", () => {
    const two = horrorGame({
      players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-iron-man-aggression" }],
    });
    const { state, id: cultist } = engageMinion(two, CULTIST, P2);
    const { state: after } = driveEventsPicking(
      deps,
      stackEncounterDeck(state, ZB[0]!, ZB[1]!),
      firstLegal,
      {
        type: "endTurn",
        playerId: P1,
      },
      { type: "endTurn", playerId: P2 },
    );
    const [kraken] = inPlay(after, KRAKEN);
    expect(inst(after, kraken!).engagedWith).toBe(P2);
    expect(cardsInPlay(after)).not.toContain(cultist);
  });

  it("with The Kraken already in play there is none to fetch (unique): Cultist is still discarded", () => {
    const { state, cultist } = cultistGame();
    const withKraken = engageMinion(state, KRAKEN, P1);
    const { state: after } = endTurnWith(withKraken.state, firstLegal, ZB[0]!, ZB[1]!, ZB[2]!);
    expect(inPlay(after, KRAKEN)).toEqual([withKraken.id]);
    expect(cardsInPlay(after)).not.toContain(cultist);
  });
});

describe("The Kraken (39050)", () => {
  /** She-Hulk with Hellcat, a Werewolf Pack and The Kraken engaged; her villain acts first. */
  const lair = () => {
    const hero1 = heroGame();
    const withHellcat = intoPlayArea(hero1, P1, HELLCAT);
    const werewolf = engageMinion(withHellcat.state, WEREWOLF, P1);
    const kraken = engageMinion(werewolf.state, KRAKEN, P1);
    const villainId = activeVillain(kraken.state)!.instanceId;
    // The villain's own tough status card would absorb the 1 damage.
    const noTough = patchInstance(kraken.state, villainId, {
      statuses: { ...inst(kraken.state, villainId).statuses, tough: 0 },
    });
    return {
      state: noTough,
      kraken: kraken.id,
      hellcat: withHellcat.id,
      werewolf: werewolf.id,
      hero: identityOf(kraken.state, P1),
      villain: activeVillain(kraken.state)!.instanceId,
    };
  };

  it("After it activates: each other character takes 1 damage (hero, ally, other minion, villain), not itself", () => {
    const { state, kraken, hellcat, werewolf, hero, villain } = lair();
    const { events } = endTurnWith(state, firstLegal, ...ZERO_BOOST);
    const dealt = damageDealtBy(events, kraken);
    // Its own attack on the hero (ATK 2), then 1 to each other character.
    expect(dealt).toContainEqual([hero, 2]);
    for (const other of [hero, hellcat, werewolf, villain]) expect(dealt, other).toContainEqual([other, 1]);
    expect(dealt.map(([target]) => target)).not.toContain(kraken);
    expect(dealt.filter(([, amount]) => amount === 1)).toHaveLength(4);
  });

  it("an alter-ego's scheme activation triggers it as well", () => {
    const hero1 = horrorGame({ players: [{ starterDeckId: "core-she-hulk-aggression" }] });
    const { state, id: kraken } = engageMinion(hero1, KRAKEN, P1);
    const { events } = endTurnWith(state, firstLegal, ...ZERO_BOOST);
    expect(damageDealtBy(events, kraken)).toContainEqual([identityOf(state, P1), 1]);
  });

  it("When Defeated: each friendly character heals 1 damage (not enemies)", () => {
    const { state, kraken, hellcat, werewolf, hero, villain } = lair();
    const hurt = [
      [hero, 5],
      [hellcat, 2],
      [werewolf, 1],
      [villain, 2],
      [kraken, 5],
    ] as const;
    const staged = hurt.reduce((s, [id, damage]) => patchInstance(s, id, { damage }), state);
    const after = run(staged, basicAttack(staged, kraken));
    expect(cardsInPlay(after)).not.toContain(kraken);
    expect(inst(after, hero).damage).toBe(4);
    expect(inst(after, hellcat).damage).toBe(1);
    expect(inst(after, werewolf).damage).toBe(1);
    expect(inst(after, villain).damage).toBe(2);
  });
});

describe("Werewolf Pack (39052)", () => {
  const revealWith = (state: GameState, picker: Picker = firstLegal) =>
    driveEventsPicking(
      deps,
      stackEncounterDeck(
        state,
        // With two players the villain takes a boost card for each of its two activations first.
        ...(state.players.length > 1 ? [ZB[0]!, ZB[1]!, WEREWOLF, ZB[2]!] : [ZB[0]!, WEREWOLF, ZB[2]!]),
      ),
      picker,
      { type: "endTurn", playerId: P1 },
      ...(state.players.length > 1 ? [{ type: "endTurn", playerId: P2 } as const] : []),
    );

  it("When Revealed: defeats an ally you control and places it facedown under itself", () => {
    const hero1 = heroGame();
    const withHellcat = intoPlayArea(hero1, P1, HELLCAT);
    const { state: after } = revealWith(withHellcat.state);
    const [werewolf] = inPlay(after, WEREWOLF);
    expect(inst(after, werewolf!).tucked).toEqual([withHellcat.id]);
    expect(inst(after, withHellcat.id).faceup).toBe(false);
    expect(playerOf(after, P1).playArea).not.toContain(withHellcat.id);
    expect(playerOf(after, P1).discard).not.toContain(withHellcat.id);
  });

  it("you choose which of your allies", () => {
    const hero1 = heroGame();
    const a = intoPlayArea(hero1, P1, HELLCAT);
    const b = intoPlayArea(a.state, P1, TIGRA);
    const { state: after } = revealWith(b.state, picking(b.id as string));
    const [werewolf] = inPlay(after, WEREWOLF);
    expect(inst(after, werewolf!).tucked).toEqual([b.id]);
    expect(playerOf(after, P1).playArea).toContain(a.id);
  });

  it("only an ally you control: another player's ally stays", () => {
    const two = run(
      horrorGame({
        players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-iron-man-aggression" }],
      }),
      toHero(P1),
    );
    const mine = intoPlayArea(two, P1, HELLCAT);
    const theirs = intoPlayArea(mine.state, P2, "01030"); // War Machine
    const { state: after } = revealWith(theirs.state);
    const [werewolf] = inPlay(after, WEREWOLF);
    expect(inst(after, werewolf!).tucked).toEqual([mine.id]);
    expect(playerOf(after, P2).playArea).toContain(theirs.id);
  });

  it("with no ally to defeat nothing is tucked", () => {
    const { state: after } = revealWith(heroGame());
    const [werewolf] = inPlay(after, WEREWOLF);
    expect(inst(after, werewolf!).tucked).toEqual([]);
  });

  describe("Forced Interrupt: when it would be defeated, discard an ally from under it instead, then heal it", () => {
    /** She-Hulk with a Werewolf Pack engaged, 3 of its 4 hit points gone, `under` tucked beneath it. */
    const hunted = (...under: string[]) => {
      const hero1 = heroGame();
      const { state, id } = engageMinion(hero1, WEREWOLF, P1);
      const ids = under.map((code) => cardOf(state, code));
      return { state: patchInstance(tuckAllies(state, id, ids), id, { damage: 3 }), werewolf: id, ids };
    };

    it("is not defeated: one ally under it is discarded to its owner's discard pile and it heals all damage", () => {
      const { state, werewolf, ids } = hunted(HELLCAT);
      const { state: after } = driveEventsPicking(deps, state, firstLegal, basicAttack(state, werewolf));
      expect(cardsInPlay(after)).toContain(werewolf);
      expect(inst(after, werewolf).damage).toBe(0);
      expect(inst(after, werewolf).tucked).toEqual([]);
      expect(playerOf(after, P1).discard).toContain(ids[0]);
    });

    it("discards only one ally: the others stay beneath it, and you choose which", () => {
      const { state, werewolf, ids } = hunted(HELLCAT, TIGRA);
      const { state: after } = driveEventsPicking(deps, state, picking(ids[1] as string), basicAttack(state, werewolf));
      expect(cardsInPlay(after)).toContain(werewolf);
      expect(inst(after, werewolf).damage).toBe(0);
      expect(inst(after, werewolf).tucked).toEqual([ids[0]]);
      expect(playerOf(after, P1).discard).toContain(ids[1]);
      expect(playerOf(after, P1).discard).not.toContain(ids[0]);
    });

    it("the ally is gone for good: the next lethal blow, with nothing under it, defeats it", () => {
      const { state, werewolf } = hunted(HELLCAT);
      const once = driveEventsPicking(deps, state, firstLegal, basicAttack(state, werewolf)).state;
      expect(cardsInPlay(once)).toContain(werewolf);
      const hit = patchInstance(once, werewolf, { damage: 3 });
      const readied = patchInstance(hit, identityOf(hit, P1), { exhausted: false });
      const twice = driveEventsPicking(deps, readied, firstLegal, basicAttack(readied, werewolf)).state;
      expect(cardsInPlay(twice)).not.toContain(werewolf);
      expect(activeEncounterDeck(twice).discard).toContain(werewolf);
    });

    it("with no ally under it, it is defeated normally", () => {
      const { state, werewolf } = hunted();
      const after = run(state, basicAttack(state, werewolf));
      expect(cardsInPlay(after)).not.toContain(werewolf);
      expect(activeEncounterDeck(after).discard).toContain(werewolf);
    });
  });
});
