import { cardId, PLAYABLE_CARDS } from "@mc/content";
import { applyCommand, cardsInPlay, characterProfile, createGame, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { buildCrossHeroDeck, playFromAnotherHerosDeck } from "../../testing/cross-hero.js";
import { encounterCardInVillainArea, playFromHand } from "../../testing/staging.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`): every aspect or basic player card in the Captain
 * America pack (`cap`, 03011-03034) that has an ability script, played through the engine from a Core hero's own
 * deck instead of Captain America's precon. Skipped: `03001a`-`03010` (aspect `hero:03001a`, only a Steve Rogers
 * deck can hold them, RRG 1.8 "Identity-Specific Card", p. 23); `03012` Hawkeye, `03016` Make the Call, `03018` The
 * Power of Leadership and `03020` Mockingbird (verbatim Core reprints aliased in `../reprints.ts`: Core `01066`,
 * `01071`, `01072`, `01083`); `03021`-`03023` (basic resources with no `abilities`); `03026`-`03030` (obligation,
 * nemesis set and encounter cards, not player aspect cards).
 */

const buildScenario = (players: Parameters<typeof playableScenario>[1]["players"]) =>
  playableScenario("rhino", { seed: 11, players });

const game = { deps: PLAYABLE_DEPS, cards: PLAYABLE_CARDS, buildScenario };

const CAPTAIN_MARVEL = "core-captain-marvel-leadership";
const SPIDER_MAN = "core-spider-man-justice";
const SHE_HULK = "core-she-hulk-aggression";
const BLACK_PANTHER = "core-black-panther-protection";

/** Hero form, settled (a hero's own form-change responses may leave a prompt, e.g. She-Hulk's). */
const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

/** Accepts the named optional trigger (by ability id), declines everything else; pays `payForCard` from the first options. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** A fresh opening state for `cardCode` in `coreHeroId`'s deck (plus `extra` deck cards), `cardCode` in hand. */
function openHandFor(
  cardCode: string,
  coreHeroId: string,
  extra: readonly string[] = [],
): { readonly state: GameState; readonly id: InstanceId } {
  const base = buildCrossHeroDeck(PLAYABLE_CARDS, coreHeroId, cardCode);
  const setup = { ...base, deck: [...base.deck, ...extra.map((code) => cardId(code))] };
  const created = createGame(buildScenario([setup]), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const { state, ids } = moveToHand(opening, P1, cardCode);
  return { state, id: ids[0]! };
}

const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;

describe("Captain America pack leadership cards, from Captain Marvel (Leadership)'s deck", () => {
  it("03011.falcon-response: removes 1 threat from a scheme per treachery among the top 3 encounter cards", () => {
    // Stampede (01106) and Advance (01186) are treacheries; Hydra Mercenary (01101) is a minion: 2 of the 3.
    const { state } = playFromAnotherHerosDeck("03011", game, {
      coreHero: CAPTAIN_MARVEL,
      setup: (s) =>
        stackEncounterDeck(patchInstance(s, s.mainScheme.instanceId, { threat: 5 }), "01106", "01186", "01101"),
      pick: accepting("03011.falcon-response"),
    });
    expect(mainThreat(state)).toBe(5 - 2);
  });

  it("03013.squirrel-girl-response: deals 1 damage to each enemy when she enters play", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("03013", game, {
      coreHero: CAPTAIN_MARVEL,
      pick: accepting("03013.squirrel-girl-response"),
    });
    expect(cardsInPlay(state)).toContain(cardInstanceId);
    expect(inst(state, villainOf(state)).damage).toBe(1);
  });

  it("03014.wonder-man-constant: attacking with him costs a discarded card from hand; refused without it", () => {
    const { state, cardInstanceId: wonderMan } = playFromAnotherHerosDeck("03014", game, {
      coreHero: CAPTAIN_MARVEL,
      setup: toHeroFirst,
    });
    const villain = villainOf(state);
    const attack = {
      type: "basicAttack" as const,
      playerId: P1,
      attackerInstanceId: wonderMan,
      targetInstanceId: villain,
    };
    expect(applyCommand(state, attack, PLAYABLE_DEPS).ok).toBe(false); // no discard paid
    const fodder = playerOf(state, P1).hand[0]!;
    const after = settle(
      runWith(PLAYABLE_DEPS, state, { ...attack, costChoices: { discard: [fodder] } }),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, villain).damage).toBe(3); // Wonder Man's ATK 3
    expect(playerOf(after, P1).discard).toContain(fodder);
  });

  it("03015.avengers-assemble-action: readies Avengers you control; +1 THW and +1 ATK until end of phase", () => {
    const { state: opened, id } = openHandFor("03015", CAPTAIN_MARVEL);
    const hero = toHeroFirst(opened);
    const identity = identityOf(hero);
    const before = characterProfile(hero, identity, PLAYABLE_DEPS)!;
    const exhausted = patchInstance(hero, identity, { exhausted: true });
    const payment = playerOf(exhausted, P1)
      .hand.filter((h) => h !== id)
      .slice(0, 4);
    const after = settle(
      runWith(PLAYABLE_DEPS, exhausted, play(P1, id, payment)),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(false);
    const profile = characterProfile(after, identity, PLAYABLE_DEPS)!;
    expect(profile.atk).toBe(before.atk + 1);
    expect(profile.thw).toBe(before.thw + 1);
  });

  it("03017.strength-in-numbers-action: exhausts allies you control and draws 1 card per ally exhausted", () => {
    const { state: opened, id } = openHandFor("03017", CAPTAIN_MARVEL, ["03013", "03014"]);
    // Two allies in play (Squirrel Girl 03013, Wonder Man 03014; both enter play ready).
    const sg = playFromHand(PLAYABLE_DEPS, moveToHand(opened, P1, "03013", "03014").state, "03013", 2);
    const wm = playFromHand(PLAYABLE_DEPS, sg.state, "03014", 2);
    const handBefore = playerOf(wm.state, P1).hand.length;
    const after = settle(
      runWith(PLAYABLE_DEPS, wm.state, play(P1, id, [], { costChoices: { exhausted: [sg.id, wm.id] } })),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, sg.id).exhausted).toBe(true);
    expect(inst(after, wm.id).exhausted).toBe(true);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 + 2); // the event leaves hand, 2 allies exhausted draw 2
  });

  it("03019.quinjet-response + -action: gains a time counter when your turn begins; puts an Avenger ally from hand into play, then is discarded", () => {
    // Hero form, so the villain attacks rather than schemes while the round passes (RRG 1.8 "Villain Phase", p. 114).
    const { state: opened } = openHandFor("03019", CAPTAIN_MARVEL, ["03013"]);
    const { state: played, id: quinjet } = playFromHand(
      PLAYABLE_DEPS,
      toHeroFirst(opened),
      "03019",
      1,
      accepting("03019.quinjet-response"),
    );
    expect(inst(played, quinjet).counters["time"] ?? 0).toBe(0);
    // Next round's "your turn begins": the Response places 1 time counter.
    const nextTurn = settle(
      runWith(PLAYABLE_DEPS, played, endTurn(P1)),
      accepting("03019.quinjet-response"),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(nextTurn, quinjet).counters["time"]).toBe(1);
    // Squirrel Girl (Avenger ally, printed cost 2) needs 2 time counters.
    const given = moveToHand(patchInstance(nextTurn, quinjet, { counters: { time: 2 } }), P1, "03013");
    const squirrelGirl = given.ids[0]!;
    const after = settle(
      runWith(PLAYABLE_DEPS, given.state, use(P1, quinjet, "03019.quinjet-action")),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(cardsInPlay(after)).toContain(squirrelGirl);
    expect(playerOf(after, P1).discard).toContain(quinjet);
    expect(cardsInPlay(after)).not.toContain(quinjet);
  });
});

describe("Captain America pack basic cards, from a Core hero's deck", () => {
  it("03024.avengers-tower-action: exhausts to reduce the cost of the next Avenger ally played by 1", () => {
    // Captain Marvel's precon: a basic card is legal there, and Squirrel Girl (leadership, Avenger) rides along.
    const { state: opened, id: towerId } = openHandFor("03024", CAPTAIN_MARVEL, ["03013"]);
    const { state: withTower, id: tower } = playFromHand(PLAYABLE_DEPS, opened, "03024", 2);
    void towerId;
    const used = runWith(PLAYABLE_DEPS, withTower, use(P1, tower, "03024.avengers-tower-action"));
    expect(inst(used, tower).exhausted).toBe(true);
    // Squirrel Girl costs 2; with the discount a single card pays for her.
    const given = moveToHand(used, P1, "03013");
    const squirrelGirl = given.ids[0]!;
    const payment = playerOf(given.state, P1)
      .hand.filter((h) => h !== squirrelGirl)
      .slice(0, 1);
    const after = settle(
      runWith(PLAYABLE_DEPS, given.state, play(P1, squirrelGirl, payment)),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(cardsInPlay(after)).toContain(squirrelGirl);
  });

  it("03025.honorary-avenger-constant: refused in alter-ego (no Avenger trait); in hero form gives +1 hit point", () => {
    const { state: opened, id } = openHandFor("03025", SPIDER_MAN);
    const identityAlter = identityOf(opened);
    const refused = applyCommand(opened, play(P1, id, [], { attachToInstanceId: identityAlter }), PLAYABLE_DEPS);
    expect(refused.ok).toBe(false); // Peter Parker has no Avenger trait: "Play only if your identity has the Avenger trait."
    const hero = toHeroFirst(opened);
    const identity = identityOf(hero);
    const before = characterProfile(hero, identity, PLAYABLE_DEPS)!;
    const after = settle(
      runWith(PLAYABLE_DEPS, hero, play(P1, id, [], { attachToInstanceId: identity })),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, identity).attachments ?? []).toContain(id);
    expect(characterProfile(after, identity, PLAYABLE_DEPS)!.maxHp).toBe(before.maxHp + 1);
  });

  it("03034.enhanced-awareness-resource: exhausts and spends a mental counter to pay 1 [mental] toward a card", () => {
    const { state, cardInstanceId: awareness } = playFromAnotherHerosDeck("03034", game, {
      coreHero: SPIDER_MAN,
      setup: toHeroFirst,
    });
    expect(inst(state, awareness).counters["mental"]).toBe(3);
    const given = moveToHand(state, P1, "01008"); // Web-Shooter, cost 1
    const webShooter = given.ids[0]!;
    const after = settle(
      runWith(
        PLAYABLE_DEPS,
        given.state,
        play(P1, webShooter, [], {
          abilities: [resourceAbility(awareness, "03034.enhanced-awareness-resource")],
        }),
      ),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(cardsInPlay(after)).toContain(webShooter);
    expect(inst(after, awareness).counters["mental"]).toBe(2);
    expect(inst(after, awareness).exhausted).toBe(true);
  });
});

describe("Captain America pack aggression/justice/protection cards, from their matching Core hero's deck", () => {
  it("03031.enraged-constant: attached ally gets +2 ATK and takes +1 consequential damage after attacking", () => {
    // Mockingbird (Core 01083, basic ally, ATK 1, consequential damage 1 on attack) is already in She-Hulk's precon.
    const { state: opened, id: enraged } = openHandFor("03031", SHE_HULK);
    const hero = toHeroFirst(opened);
    const ally = playFromHand(PLAYABLE_DEPS, hero, "01083", 3);
    const before = characterProfile(ally.state, ally.id, PLAYABLE_DEPS)!;
    const payment = playerOf(ally.state, P1)
      .hand.filter((h) => h !== enraged)
      .slice(0, 1);
    const enragedState = settle(
      runWith(PLAYABLE_DEPS, ally.state, play(P1, enraged, payment, { attachToInstanceId: ally.id })),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(characterProfile(enragedState, ally.id, PLAYABLE_DEPS)!.atk).toBe(before.atk + 2);
    const villain = villainOf(enragedState);
    const attacked = settle(
      runWith(PLAYABLE_DEPS, enragedState, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: ally.id,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(before.atk + 2);
    expect(inst(attacked, ally.id).damage).toBe(1 + 1); // Mockingbird's printed consequential damage 1, plus Enraged's 1
  });

  it("03032.followed-interrupt: when the attached side scheme is defeated, deals 4 damage to an enemy", () => {
    const { state: opened, id: followed } = openHandFor("03032", SPIDER_MAN);
    const hero = toHeroFirst(opened);
    const scheme = encounterCardInVillainArea(hero, "01109", 1); // Bomb Scare
    const payment = playerOf(scheme.state, P1)
      .hand.filter((h) => h !== followed)
      .slice(0, 1);
    const attached = settle(
      runWith(PLAYABLE_DEPS, scheme.state, play(P1, followed, payment, { attachToInstanceId: scheme.id })),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(attached, scheme.id).attachments ?? []).toContain(followed);
    const villain = villainOf(attached);
    const thwarted = settle(
      runWith(PLAYABLE_DEPS, attached, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(attached),
        schemeInstanceId: scheme.id,
      }),
      accepting("03032.followed-interrupt"),
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(thwarted, villain).damage).toBe(4);
  });

  it("03033.expert-defense-interrupt: when your hero defends, it gets +3 DEF for that attack (damage taken drops)", () => {
    // Crowd Control (01108) is a 2-boost-icon card with no boost ability: Rhino's ATK 2 + 2 boost against the hero's DEF.
    const defendOnce = (accept: boolean) => {
      const { state: opened, id: expert } = openHandFor("03033", BLACK_PANTHER);
      const hero = toHeroFirst(opened);
      const identity = identityOf(hero);
      const stacked = stackEncounterDeck(hero, "01108");
      const atDeclare = settle(
        runWith(PLAYABLE_DEPS, stacked, endTurn(P1)),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        PLAYABLE_DEPS,
      );
      const defending = settle(
        runWith(PLAYABLE_DEPS, atDeclare, {
          type: "resolveChoice",
          playerId: P1,
          choiceId: atDeclare.pendingChoice!.choiceId,
          selectedOptionIds: [identity],
        }),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "chooseTriggers",
        PLAYABLE_DEPS,
      );
      const option = `${expert}:03033.expert-defense-interrupt`;
      expect(defending.pendingChoice?.options.map((o) => o.optionId)).toContain(option);
      const before = inst(defending, identity).damage;
      const after = settle(
        runWith(PLAYABLE_DEPS, defending, {
          type: "resolveChoice",
          playerId: P1,
          choiceId: defending.pendingChoice!.choiceId,
          selectedOptionIds: accept ? [option] : [],
        }),
        firstLegal,
        (s) => s.step.phase === "player",
        PLAYABLE_DEPS,
      );
      return { taken: inst(after, identity).damage - before, discarded: playerOf(after, P1).discard.includes(expert) };
    };
    const declined = defendOnce(false);
    const accepted = defendOnce(true);
    expect(declined.taken).toBeGreaterThan(0);
    expect(accepted.taken).toBe(Math.max(0, declined.taken - 3));
    expect(accepted.discarded).toBe(true);
  });
});
