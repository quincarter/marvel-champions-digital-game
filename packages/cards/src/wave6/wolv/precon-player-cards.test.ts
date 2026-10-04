import { cardId, trait } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  runWith,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { THOR_PACK_CARDS } from "../../wave1/thor/pack-cards.js";
import { WAVE6_DEPS, wave6Scenario, wave6StarterDeckSetup } from "../index.js";
import { attachToHost, engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { SHADOWCAT_SUPPORT_UPGRADES_ALLIES } from "../mut_gen/shadowcat/support-upgrades-allies.js";
import { WOLV_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
import { wolverineGame } from "./wolverine/support.js";

/** The `wolv` aspect and basic cards no hero folder owns (`wolv/precon-player-cards.ts`), played from Wolverine's own precon. */
const DEPS = WAVE6_DEPS;
const villainOf = (state: GameState) => activeVillain(state).instanceId;
const heroOf = (state: GameState) => identityOf(state, P1);
const inPlay = (state: GameState, id: InstanceId) => playerOf(state, P1).playArea.includes(id);
const inDiscard = (state: GameState, id: InstanceId) => playerOf(state, P1).discard.includes(id);

/** Wolverine in hero form against Rhino, with eight more deck cards in hand to pay with. */
function staged(): GameState {
  const base = withForm(wolverineGame("rhino", { seed: 3 }), { heroForm: 0 });
  return {
    ...base,
    players: base.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, 8)], deck: p.deck.slice(8) } : p,
    ),
  };
}

/** Accepts only the optional triggers whose label contains one of `labels`; every other choice is answered as `firstLegal` does. */
const accepting =
  (...labels: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      return choice.options.filter((o) => labels.some((l) => o.label.includes(l))).map((o) => o.optionId);
    }
    return firstLegal(state);
  };
const targeting =
  (id: InstanceId, rest: Picker = accepting()): Picker =>
  (s) =>
    s.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : rest(s);

const iconsOf = (state: GameState, id: InstanceId, resource: "energy" | "physical" | "mental"): number =>
  (state.cardPool[state.instances[id]!.cardId] as { resourceIcons?: Record<string, number> }).resourceIcons?.[
    resource
  ] ?? 0;

/** Plays an upgrade `code` onto `host`, paying with other cards. */
function castAttached(state: GameState, code: string, host: InstanceId) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0] as InstanceId;
  const cost = (given.state.cardPool[inst(given.state, id).cardId] as { cost: number }).cost;
  const payment = payWith(given.state, P1, cost, [id]);
  const after = settle(
    runWith(DEPS, given.state, play(P1, id, payment, { attachToInstanceId: host })),
    accepting(),
    undefined,
    DEPS,
  );
  return { state: after, id };
}

/** Plays `code` from hand paying `cost` with other cards; `pay` first (e.g. Aggressive Energy). */
function cast(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = accepting(),
  pay: readonly InstanceId[] = [],
) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0] as InstanceId;
  const payment = [...pay, ...payWith(given.state, P1, cost - pay.length, [id, ...pay])];
  const after = settle(runWith(DEPS, given.state, play(P1, id, payment)), pick, undefined, DEPS);
  return { state: after, id };
}

const basicAttack = (state: GameState, attacker: InstanceId, target: InstanceId, pick: Picker = accepting()) =>
  settle(
    runWith(DEPS, state, { type: "basicAttack", playerId: P1, attackerInstanceId: attacker, targetInstanceId: target }),
    pick,
    undefined,
    DEPS,
  );

describe("wolv precon aspect and basic cards", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(WOLV_PRECON_PLAYER_CARDS).sort()).toEqual([
      "35013.psylocke-constant",
      "35013.psylocke-interrupt",
      "35014.sunfire-response",
      "35015.battle-fury-response",
      "35017.outta-my-way-action",
      "35018.precision-strike-action",
      "35019.mean-swing-interrupt",
      "35020.aggressive-energy-interrupt",
      "35021.colossus-constant",
      "35022.weapon-x-action",
      "35023.fastball-special-action",
      "35032.command-center-response",
      "35033.longshot-response",
    ]);
    for (const definition of Object.values(WOLV_PRECON_PLAYER_CARDS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  it("the reprints are the same definition objects as their first printings", () => {
    const refs = WOLV_PRECON_PLAYER_CARDS as Record<string, unknown>;
    expect(refs["35015.battle-fury-response"]).toBe(THOR_PACK_CARDS["06018.battle-fury-response"]);
    expect(refs["35019.mean-swing-interrupt"]).toBe(THOR_PACK_CARDS["06015.mean-swing-interrupt"]);
    expect(refs["35020.aggressive-energy-interrupt"]).toBe(
      SHADOWCAT_SUPPORT_UPGRADES_ALLIES["32047.aggressive-energy-interrupt"],
    );
    expect(refs["35021.colossus-constant"]).toBe(SHADOWCAT_SUPPORT_UPGRADES_ALLIES["32048.colossus-constant"]);
  });

  describe("Psylocke (35013)", () => {
    it("enters play with 2 psionic counters", () => {
      const { state, id } = cast(staged(), "35013", 4);
      expect(inPlay(state, id)).toBe(true);
      expect(inst(state, id).counters.psionic).toBe(2);
    });

    it("her attack, with the interrupt used, removes a counter, confuses the villain and deals it 1 extra damage", () => {
      const { state, id } = cast(staged(), "35013", 4);
      const ready = patchInstance(state, id, { exhausted: false });
      const after = basicAttack(ready, id, villainOf(ready), accepting("Psylocke"));
      expect(inst(after, id).counters.psionic).toBe(1);
      expect(inst(after, villainOf(ready)).statuses.confused).toBe(1);
      expect(inst(after, villainOf(ready)).damage).toBe(2);
    });

    it("declined, it costs nothing and does only her own 1 damage", () => {
      const { state, id } = cast(staged(), "35013", 4);
      const ready = patchInstance(state, id, { exhausted: false });
      const after = basicAttack(ready, id, villainOf(ready), firstLegal);
      expect(inst(after, id).counters.psionic).toBe(2);
      expect(inst(after, villainOf(ready)).statuses.confused).toBe(0);
      expect(inst(after, villainOf(ready)).damage).toBe(1);
    });

    it("with no counters left the interrupt is not offered", () => {
      const { state, id } = cast(staged(), "35013", 4);
      const spent = patchInstance(state, id, { exhausted: false, counters: { psionic: 0 } });
      const after = basicAttack(spent, id, villainOf(spent), accepting("Psylocke"));
      expect(inst(after, villainOf(spent)).statuses.confused).toBe(0);
      expect(inst(after, villainOf(spent)).damage).toBe(1);
    });
  });

  describe("Sunfire (35014)", () => {
    /** Rhino with Enhanced Ivory Horn (01100, a Hero Action attachment) and Armored Rhino Suit (01098, none) on him. */
    const armed = () => {
      const base = staged();
      const horn = attachToHost(base, "01100", villainOf(base));
      const suit = attachToHost(horn.state, "01098", villainOf(base));
      return { state: suit.state, horn: horn.id, suit: suit.id };
    };
    const energyCard = (state: GameState, except: readonly InstanceId[]) =>
      playerOf(state, P1).hand.find((i) => !except.includes(i) && iconsOf(state, i, "energy") > 0);
    /** Plays Sunfire paying with cards that print no [energy], so one stays in hand for the response's own spend. */
    const playSunfire = (state: GameState, pick: Picker) => {
      const given = moveToHand(state, P1, "35014");
      const sunfire = given.ids[0] as InstanceId;
      const pay = playerOf(given.state, P1)
        .hand.filter((i) => i !== sunfire && iconsOf(given.state, i, "energy") === 0)
        .slice(0, 2);
      expect(energyCard(given.state, [sunfire, ...pay])).toBeDefined();
      const handBefore = playerOf(given.state, P1).hand.length;
      const after = settle(runWith(DEPS, given.state, play(P1, sunfire, pay)), pick, undefined, DEPS);
      return { state: after, sunfire, handBefore };
    };
    const payResponse: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "payForAbility"
        ? playerOf(s, P1)
            .hand.filter((i) => iconsOf(s, i, "energy") > 0)
            .slice(0, 1)
            .map((i) => `hand:${i}`)
        : firstLegal(s);

    it("after you play Sunfire, spending an [energy] resource discards a chosen Hero Action attachment", () => {
      const { state, horn, suit } = armed();
      const {
        state: after,
        sunfire,
        handBefore,
      } = playSunfire(state, (s) =>
        s.pendingChoice?.prompt.kind === "payForAbility" ? payResponse(s) : targeting(horn, accepting("Sunfire"))(s),
      );
      expect(inPlay(after, sunfire)).toBe(true);
      expect(inst(after, villainOf(after)).attachments).not.toContain(horn);
      expect(inst(after, villainOf(after)).attachments).toContain(suit);
      // Sunfire himself and his 2 payment cards left the hand, and so did the energy resource spent.
      expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 - 2 - 1);
    });

    it("an attachment with no Hero Action or Hero Response is not a choice (Armored Rhino Suit alone: not offered)", () => {
      const base = staged();
      const suit = attachToHost(base, "01098", villainOf(base));
      const offered: string[] = [];
      const { state: after } = playSunfire(suit.state, (s) => {
        for (const o of s.pendingChoice?.options ?? []) offered.push(o.label);
        return firstLegal(s);
      });
      expect(offered).not.toContain("Sunfire");
      expect(inst(after, villainOf(after)).attachments).toContain(suit.id);
    });

    it("declined, nothing is discarded", () => {
      const { state, horn } = armed();
      const { state: after } = playSunfire(state, firstLegal);
      expect(inst(after, villainOf(after)).attachments).toContain(horn);
    });
  });

  describe("Battle Fury (35015)", () => {
    const furious = () => {
      const base = staged();
      const { state: withMinion, id: minion } = engageMinion(base, "01101", P1);
      const { state, id } = castAttached(withMinion, "35015", heroOf(withMinion));
      return { state, id, minion };
    };

    it("after your hero defeats a minion: takes 1 damage, discards Battle Fury, readies", () => {
      const { state, id, minion } = furious();
      const attacker = heroOf(state);
      const strong = patchInstance(state, minion, { damage: 99 });
      const after = basicAttack(strong, attacker, minion, accepting("Battle Fury"));
      expect(inPlay(after, minion)).toBe(false);
      expect(inDiscard(after, id)).toBe(true);
      expect(inst(after, attacker).damage).toBe(1);
      expect(inst(after, attacker).exhausted).toBe(false);
    });

    it("attacking without defeating anything does nothing", () => {
      const { state, id, minion } = furious();
      const attacker = heroOf(state);
      const after = basicAttack(state, attacker, minion, accepting("Battle Fury"));
      expect(inst(after, minion).damage).toBe(2);
      expect(inst(after, attacker).attachments).toContain(id);
      expect(inst(after, attacker).damage).toBe(0);
      expect(inst(after, attacker).exhausted).toBe(true);
    });
  });

  describe("Outta My Way! (35017)", () => {
    const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
      events
        .filter((e) => e.type === "damageDealt" && e.targetInstanceId === id)
        .reduce((n, e) => n + (e as { amount: number }).amount, 0);
    const castWithEvents = (state: GameState, pick: Picker) => {
      const given = moveToHand(state, P1, "35017");
      const id = given.ids[0] as InstanceId;
      return driveEventsPicking(DEPS, given.state, pick, play(P1, id, payWith(given.state, P1, 2, [id])));
    };

    it("deals 3 damage to an enemy with neither guard nor patrol", () => {
      const state = staged();
      const { events } = castWithEvents(state, accepting());
      expect(damageTo(events, villainOf(state))).toBe(3);
    });

    it("deals 5 damage to an enemy with the guard keyword (Hydra Mercenary)", () => {
      const { state, id: guard } = engageMinion(staged(), "01101", P1);
      const { events } = castWithEvents(state, targeting(guard));
      expect(damageTo(events, guard)).toBe(5);
    });

    it("deals 5 damage to an enemy with the patrol keyword (granted to a Hydra Mercenary)", () => {
      const { state, id: minion } = engageMinion(staged(), "01101", P1);
      const code = inst(state, minion).cardId;
      const card = state.cardPool[code] as unknown as { keywords: unknown[] };
      const patrolled = {
        ...state,
        cardPool: { ...state.cardPool, [code]: { ...card, keywords: [{ name: "patrol" }] } },
      } as GameState;
      const { events } = castWithEvents(patrolled, targeting(minion));
      expect(damageTo(events, minion)).toBe(5);
    });
  });

  describe("Precision Strike (35018)", () => {
    it("deals 2 damage; defeating the enemy heals 2 damage from your hero", () => {
      const { state, id: minion } = engageMinion(staged(), "01101", P1);
      const hurt = patchInstance(patchInstance(state, minion, { damage: 2 }), heroOf(state), { damage: 5 });
      const { state: after } = cast(hurt, "35018", 1, targeting(minion));
      expect(inPlay(after, minion)).toBe(false);
      expect(inst(after, heroOf(after)).damage).toBe(3);
    });

    it("an attack that defeats nothing heals nothing", () => {
      const state = staged();
      const hurt = patchInstance(state, heroOf(state), { damage: 5 });
      const { state: after } = cast(hurt, "35018", 1);
      expect(inst(after, villainOf(state)).damage).toBe(2);
      expect(inst(after, heroOf(after)).damage).toBe(5);
    });
  });

  describe("Aggressive Energy (35020)", () => {
    it("spent to play an ATTACK event, that event deals 1 additional damage (Outta My Way!: 3 + 1)", () => {
      const given = moveToHand(staged(), P1, "35020");
      const energy = given.ids[0] as InstanceId;
      const { state: after } = cast(given.state, "35017", 2, accepting("Aggressive Energy"), [energy]);
      expect(inst(after, villainOf(given.state)).damage).toBe(4);
      expect(inDiscard(after, energy)).toBe(true);
    });

    it("paid with other cards the same event deals only its 3", () => {
      const { state: after } = cast(staged(), "35017", 2);
      expect(inst(after, villainOf(after)).damage).toBe(3);
    });

    it("spent to play a non-ATTACK event it adds nothing (Track by Scent removes 3 threat, no damage)", () => {
      const base = staged();
      const bumped = patchInstance(base, base.mainScheme.instanceId, { threat: 8 });
      const given = moveToHand(bumped, P1, "35020");
      const { state: after } = cast(given.state, "35011", 2, accepting("Aggressive Energy"), [
        given.ids[0] as InstanceId,
      ]);
      expect(mainThreat(after)).toBe(5);
      expect(inst(after, villainOf(after)).damage).toBe(0);
    });
  });

  describe("Weapon X (35022)", () => {
    const loganWithWeaponX = () => {
      const base = withForm(staged(), "alterEgo");
      const { state, id } = cast(base, "35022", 1);
      return { state, id };
    };

    it("exhausts and takes 1 damage, discards from the deck until your identity-specific card, which goes to hand", () => {
      const { state, id } = loganWithWeaponX();
      const top = putOnTopOfDeck(state, P1, "35008", "35009");
      const first = top.ids[0] as InstanceId;
      const before = playerOf(top.state, P1).hand.length;
      const after = settle(
        runWith(DEPS, top.state, use(P1, id, "35022.weapon-x-action")),
        accepting(),
        undefined,
        DEPS,
      );
      expect(inst(after, id).exhausted).toBe(true);
      expect(inst(after, heroOf(after)).damage).toBe(1);
      expect(playerOf(after, P1).hand).toContain(first);
      expect(playerOf(after, P1).hand.length).toBe(before + 1);
      expect(playerOf(after, P1).deck[0]).toBe(top.ids[1]);
    });

    it("cards before it that are not identity-specific are discarded", () => {
      const { state, id } = loganWithWeaponX();
      const basics = playerOf(state, P1).deck.filter(
        (i) => !String((state.cardPool[inst(state, i).cardId] as { aspect?: string }).aspect).startsWith("hero:"),
      );
      const top = putOnTopOfDeck(state, P1, "35009");
      const withFillers = {
        ...top.state,
        players: top.state.players.map((p) =>
          p.playerId === P1
            ? { ...p, deck: [basics[0]!, basics[1]!, ...p.deck.filter((i) => i !== basics[0] && i !== basics[1])] }
            : p,
        ),
      } as GameState;
      const after = settle(
        runWith(DEPS, withFillers, use(P1, id, "35022.weapon-x-action")),
        accepting(),
        undefined,
        DEPS,
      );
      expect(inDiscard(after, basics[0]!)).toBe(true);
      expect(inDiscard(after, basics[1]!)).toBe(true);
      expect(playerOf(after, P1).hand).toContain(top.ids[0]);
    });

    it("an exhausted Weapon X cannot be used", () => {
      const { state, id } = loganWithWeaponX();
      const spent = patchInstance(state, id, { exhausted: true });
      const result = applyCommand(spent, use(P1, id, "35022.weapon-x-action"), DEPS);
      expect(result.ok).toBe(false);
    });
  });

  describe("Fastball Special (35023)", () => {
    it("deals X damage where X is the total ATK of Colossus and Wolverine, with overkill", () => {
      const { state: withAlly, id: colossus } = cast(staged(), "35021", 3);
      expect(inPlay(withAlly, colossus)).toBe(true);
      const total =
        characterProfile(withAlly, colossus, DEPS)!.atk + characterProfile(withAlly, heroOf(withAlly), DEPS)!.atk;
      const { state: after } = cast(withAlly, "35023", 1);
      expect(inst(after, villainOf(withAlly)).damage).toBe(total);
      expect(total).toBeGreaterThan(characterProfile(withAlly, heroOf(withAlly), DEPS)!.atk);
    });

    it("Team-Up: it cannot be played while Colossus is not in play", () => {
      const given = moveToHand(staged(), P1, "35023");
      const id = given.ids[0] as InstanceId;
      const result = applyCommand(given.state, play(P1, id, payWith(given.state, P1, 1, [id])), DEPS);
      expect(result.ok).toBe(false);
    });
  });

  describe("Colossus (35021)", () => {
    it("costs 1 less for a MUTANT identity: 3 resources, not 4", () => {
      const state = staged();
      const given = moveToHand(state, P1, "35021");
      const id = given.ids[0] as InstanceId;
      const after = settle(
        runWith(DEPS, given.state, play(P1, id, payWith(given.state, P1, 3, [id]))),
        accepting(),
        undefined,
        DEPS,
      );
      expect(inPlay(after, id)).toBe(true);
    });
  });

  describe("Longshot (35033), in Wolverine's deck", () => {
    const longshot = () => {
      const setup = wave6StarterDeckSetup("wolverine-aggression");
      const deck = [...setup.deck, cardId("35033")];
      const created = createGame(wave6Scenario("klaw", { seed: 3, players: [{ ...setup, deck }] }), DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const opened = withForm(
        settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS),
        { heroForm: 0 },
      );
      const stock = {
        ...opened,
        players: opened.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, 8)], deck: p.deck.slice(8) } : p,
        ),
      } as GameState;
      const { state: one, id: minion } = engageMinion(stock, "01120", P1);
      const { state, id } = cast(one, "35033", 4);
      return { state: patchInstance(state, id, { exhausted: false }), id, minion };
    };
    const discards = (s: GameState) => Object.values(s.encounterDecks).reduce((n, d) => n + d.discard.length, 0);

    it("after he attacks a non-ELITE minion, a star icon on the discarded encounter card defeats it", () => {
      const { state, id, minion } = longshot();
      const stacked = stackEncounterDeck(state, "01123");
      const after = basicAttack(stacked, id, minion, accepting("Longshot"));
      expect(inPlay(after, minion)).toBe(false);
      expect(discards(after)).toBeGreaterThan(discards(stacked));
    });

    it("a discarded card with no star icon leaves the minion in play (Longshot's own 2 damage only)", () => {
      const { state, id, minion } = longshot();
      const stacked = stackEncounterDeck(state, "01120");
      const after = basicAttack(stacked, id, minion, accepting("Longshot"));
      expect(inPlay(after, minion)).toBe(true);
      expect(inst(after, minion).damage).toBe(2);
      expect(discards(after)).toBeGreaterThan(discards(stacked));
    });

    it("declined, nothing is discarded and the minion stays", () => {
      const { state, id, minion } = longshot();
      const stacked = stackEncounterDeck(state, "01123");
      const after = basicAttack(stacked, id, minion, firstLegal);
      expect(inPlay(after, minion)).toBe(true);
      expect(discards(after)).toBe(discards(stacked));
    });

    it("an ELITE minion is not eligible: no discard, no defeat", () => {
      const { state, id, minion } = longshot();
      const code = inst(state, minion).cardId;
      const card = state.cardPool[code] as unknown as { traits: unknown[] };
      const elite = {
        ...state,
        cardPool: { ...state.cardPool, [code]: { ...card, traits: [...card.traits, trait("ELITE")] } },
      } as GameState;
      const stacked = stackEncounterDeck(elite, "01123");
      const after = basicAttack(stacked, id, minion, accepting("Longshot"));
      expect(inPlay(after, minion)).toBe(true);
      expect(discards(after)).toBe(discards(stacked));
    });
  });
});
