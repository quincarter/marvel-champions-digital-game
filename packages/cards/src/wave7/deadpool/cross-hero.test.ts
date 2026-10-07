import {
  activeVillain,
  applyCommand,
  cardsInPlay,
  characterProfile,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  play,
  playerOf,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { withDamage, withForm } from "../../testing/staging.js";
import {
  basicAttackCmd,
  basicThwartCmd,
  BLACK_PANTHER,
  codesOf,
  conjure,
  conjureInHand,
  drive,
  iconCards,
  openedCrossHero,
  openedHero,
  printedCost,
  spawnMinion,
  spawnSideScheme,
  wasOffered,
  withoutSideSchemes,
} from "../cross-hero-testing.js";
import { WAVE7_CARDS, WAVE7_DEPS, wave7StarterDeckSetup } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * deadpool pack's 'Pool aspect and basic cards: 44013-44016 (allies), 44017-44023 (events), 44024 (player side scheme),
 * 44025-44027 (resources), 44028-44030 (upgrades), 44043-44058 (allies, events, supports, upgrades): 34 cards. 44031
 * Frenemies is a Team-Up card and out of this slice; 44001-44012 are Deadpool's own kit and 44032-44042 his obligation,
 * nemesis and the Dreadpool set.
 *
 * 'Pool is a chosen aspect (a hero's deck takes the Core precon's signature and basic cards and `aspects: ["pool"]`;
 * `buildPoolDeck` in `../cross-hero-testing.ts`). The Dreadpool set is added by `wave7Scenario`'s `autoIncludedSets`
 * (Deadpool insert, "Using the 'Pool Aspect"); a test below asserts it. Every card is played from Spider-Man's Core deck
 * in a Morlock Siege game (villain ATK 2) with the wave 7 deps. "[crisis], [acceleration], [amplify], and [hazard] in
 * play" is staged by putting encounter side schemes with one icon each into play: Captive Hope 40131 (acceleration),
 * Breakin' & Takin' 01107 (hazard), Crowd Control 01108 (crisis), Maraudin' Ain't Easy 40086 (amplify); the game has no
 * icon in play otherwise.
 */
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const dmg = (state: GameState, id: InstanceId): number => inst(state, id).damage;
const handIds = (state: GameState, p = P1): readonly InstanceId[] => playerOf(state, p).hand;
const inPlay = (state: GameState, id: InstanceId, p = P1): boolean => playerOf(state, p).playArea.includes(id);
const status = (state: GameState, id: InstanceId, name: "stunned" | "confused" | "tough"): number =>
  inst(state, id).statuses[name] ?? 0;
const me = (state: GameState, p: PlayerId = P1): InstanceId => identityOf(state, p);
const profile = (state: GameState, id: InstanceId) => characterProfile(state, id, WAVE7_DEPS)!;
/** The blank Advance (01186) as the boost card and as the card dealt: the villain activation is just its attack. */
const quiet = (state: GameState): GameState => stackEncounterDeck(state, "01186", "01186");
const MR_HYDE = "24035"; // hp 10, ATK 3, no keyword.
const SHOCKER = "01103"; // hp 3, ATK 2, no Guard.
const SANDMAN = "01102"; // ELITE.
const ACCELERATION = "40131";
const HAZARD = "01107";
const CRISIS = "01108";
const AMPLIFY = "40086";

/** Puts an encounter side scheme with one icon into play (threat `threat`). */
const withIcon = (state: GameState, code: string, threat = 4) => spawnSideScheme(state, threat, code);
const withIcons = (state: GameState, ...codes: readonly string[]): GameState =>
  codes.reduce((s, code) => withIcon(s, code).state, state);

/** What a scripted test answers at each prompt kind; anything unlisted takes the first legal answer. */
interface Say {
  /** Trigger refs to accept (a response event is paid for from hand). */
  readonly accept?: readonly string[];
  /** Accept at most this many `chooseTriggers` prompts (default: every one). */
  readonly acceptTimes?: number;
  /** Decline the first N `chooseTriggers` prompts that offer an accepted trigger. */
  readonly skip?: number;
  /** Decline the first N `declareDefender` prompts (the villain attacks every hero in hero form before any reveal). */
  readonly noDefenseFor?: number;
  /** `chooseOption` label substrings, tried in order. */
  readonly option?: readonly string[];
  /** Instance ids or card codes taken at `chooseTarget` / `chooseCards`. */
  readonly pick?: readonly string[];
  /** Defenders in order of preference (an instance id, or "identity"); the first one offered at each prompt defends. */
  readonly defender?: string | readonly string[];
  /** The answer to a `reportFact` / `chooseNumber` prompt. */
  readonly amount?: number;
  /** Card codes to spend at a `spendResources` prompt. */
  readonly spend?: readonly string[];
}
const says = (say: Say): Picker => {
  let accepted = 0;
  let skipped = 0;
  let defenses = 0;
  return (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const codeOfOption = (id: string): string => (state.instances[id.replace(/^hand:/, "")]?.cardId as string) ?? "";
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        if (accepted >= (say.acceptTimes ?? Infinity)) return [];
        const hits = choice.options.filter((o) => say.accept?.some((a) => o.optionId.includes(a)));
        if (hits.length > 0 && skipped < (say.skip ?? 0)) {
          skipped += 1;
          return [];
        }
        if (hits.length > 0) accepted += 1;
        return hits.map((o) => o.optionId);
      }
      case "payForCard":
      case "payForAbility":
        return choice.options
          .filter((o) => o.optionId.startsWith("hand:"))
          .slice(0, (choice.prompt as { cost?: number }).cost ?? 0)
          .map((o) => o.optionId);
      case "declareDefender": {
        defenses += 1;
        if (defenses <= (say.noDefenseFor ?? 0)) return ["decline"];
        const wanted = typeof say.defender === "string" ? [say.defender] : (say.defender ?? []);
        for (const w of wanted) {
          const want = w === "identity" ? identityOf(state, choice.playerId) : w;
          if (choice.options.some((o) => o.optionId === want)) return [want];
        }
        return ["decline"];
      }
      case "chooseOption": {
        for (const label of say.option ?? []) {
          const hit = choice.options.find((o) => o.label.includes(label));
          if (hit) return [hit.optionId];
        }
        return firstLegal(state);
      }
      case "reportFact":
      case "chooseNumber":
        return say.amount !== undefined ? [String(say.amount)] : firstLegal(state);
      case "spendResources": {
        for (const code of say.spend ?? []) {
          const hit = choice.options.find((o) => codeOfOption(o.optionId) === code);
          if (hit) return [hit.optionId];
        }
        return firstLegal(state);
      }
      case "chooseTarget":
      case "chooseCards": {
        for (const want of say.pick ?? []) {
          const hit = choice.options.find(
            (o) => o.optionId.replace(/^hand:/, "") === want || codeOfOption(o.optionId) === want,
          );
          if (hit) return [hit.optionId];
        }
        return firstLegal(state);
      }
      default:
        return firstLegal(state);
    }
  };
};

/** Cards in hand that pay exactly `cost`: Energy resources (2 each) and one Dogpool (1 physical) for an odd cost. */
function funding(state: GameState, cost: number) {
  let s = state;
  const ids: InstanceId[] = [];
  for (let left = cost; left >= 2; left -= 2) {
    const c = conjureInHand(s, "43022");
    s = c.state;
    ids.push(c.id);
  }
  if (cost % 2 === 1) {
    const c = conjureInHand(s, "44013");
    s = c.state;
    ids.push(c.id);
  }
  return { state: s, ids };
}

/** Plays `code` from the hand, paying its printed cost with `funding` cards (or `pay`), answering prompts with `say`. */
function cast(
  state: GameState,
  code: string,
  say: Say | Picker = {},
  opts: { attach?: InstanceId; pay?: readonly InstanceId[]; controller?: PlayerId; cost?: number } = {},
) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const funded = opts.pay
    ? { state: given.state, ids: opts.pay }
    : funding(given.state, opts.cost ?? printedCost(code));
  const command = {
    ...play(P1, id, funded.ids, opts.attach ? { attachToInstanceId: opts.attach } : {}),
    ...(opts.controller ? { controllerId: opts.controller } : {}),
  };
  const run = drive(funded.state, typeof say === "function" ? say : says(say), command);
  return { ...run, id, before: funded.state };
}

const playable = (state: GameState, code: string, attach?: InstanceId): boolean => {
  const given = moveToHand(state, P1, code);
  const funded = funding(given.state, printedCost(code));
  return applyCommand(
    funded.state,
    play(P1, given.ids[0]!, funded.ids, attach ? { attachToInstanceId: attach } : {}),
    WAVE7_DEPS,
  ).ok;
};

/** A card of `code` conjured into the hand, played from there (a card the deck helper's single copy is not needed for). */
function castConjured(state: GameState, code: string, say: Say | Picker = {}, opts: { attach?: InstanceId } = {}) {
  const c = conjureInHand(state, code);
  return cast(c.state, code, say, opts);
}

/** Uses an ability of an in-play card. */
const useAbility = (state: GameState, id: InstanceId, ability: string, say: Say | Picker = {}, player: PlayerId = P1) =>
  drive(state, typeof say === "function" ? say : says(say), use(player, id, ability));

/** A first-player ally already in play (Dogpool by default). */
const ally = (state: GameState, code = "44013", player: PlayerId = P1) => conjure(state, code, "play", player);

/** The villain phase with the boost card and the card dealt both blank. */
const villainPhase = (state: GameState, say: Say | Picker = {}) =>
  drive(quiet(state), typeof say === "function" ? say : says(say), endTurn(P1));

const twoSeats = (code: string, extra: object = {}) =>
  openedHero(code, { ...extra, otherPlayers: [wave7StarterDeckSetup(BLACK_PANTHER)] });

/** The first player card whose printed resources are exactly one icon type (`wild` included). */
function codeWithIcon(icon: "physical" | "mental" | "energy" | "wild"): string {
  const card = WAVE7_CARDS.find((c) => {
    if (!("deckLimit" in c) || !("resourceIcons" in c) || !c.resourceIcons) return false;
    if (c.type !== "ally" && c.type !== "event" && c.type !== "upgrade") return false;
    const keys = Object.keys(c.resourceIcons as object);
    return keys.length === 1 && keys[0] === icon;
  });
  return card!.id as string;
}

const POOL_CARDS = [
  ...["44013", "44014", "44015", "44016", "44017", "44018", "44019", "44020", "44021", "44022", "44023"],
  ...["44024", "44025", "44026", "44027", "44028", "44029", "44030"],
  ...["44043", "44044", "44045", "44046", "44047", "44048", "44049", "44050"],
  ...["44051", "44052", "44053", "44054", "44055", "44056", "44057", "44058"],
];

describe("deadpool pack 'Pool aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal 'Pool deck on a Core hero and a game; the Dreadpool set comes in with the aspect", () => {
    expect(POOL_CARDS).toHaveLength(34);
    for (const code of POOL_CARDS) {
      const state = openedCrossHero(code);
      const all = [...playerOf(state, P1).hand, ...playerOf(state, P1).deck];
      expect(codesOf(state, all), code).toContain(code);
      // Spider-Man's own hero and basic cards, no Justice card, and the 'Pool aspect declared.
      expect(codesOf(state, all).some((c) => c.startsWith("01058"))).toBe(false);
    }
    const state = openedCrossHero("44017");
    const dreadpool = Object.values(state.instances).filter((i) =>
      ["44037", "44038", "44041"].includes(i.cardId as string),
    );
    expect(dreadpool.length).toBeGreaterThan(0);
  });

  describe("44013 Dogpool (ally, Retaliate 1, Toughness)", () => {
    it("enters play with a tough status", () => {
      const { state, id } = castConjured(openedHero("44017"), "44013");
      expect(inPlay(state, id)).toBe(true);
      expect(status(state, id, "tough")).toBe(1);
    });
    it("defending the villain's 2 damage: tough prevents it and is spent; Retaliate 1 hits the villain (Blockbuster's own tough status, given by his attack, takes it)", () => {
      // RRG 1.8 "Retaliate X" (p. 38): "After this character is attacked, deal X damage to the attacker."
      const { state: s, id } = castConjured(openedHero("44017"), "44013");
      const run = drive(quiet(s), says({ defender: id }), endTurn(P1));
      expect(status(run.state, id, "tough")).toBe(0);
      expect(dmg(run.state, id)).toBe(0);
      const prevented = run.events.filter(
        (e) =>
          e.type === "damagePrevented" &&
          (e as { targetInstanceId?: InstanceId }).targetInstanceId === villainOf(run.state),
      );
      expect(prevented).toHaveLength(1);
      expect(dmg(run.state, villainOf(run.state))).toBe(0);
    });
    it("when defeated: deals 1 damage to an enemy of the player's choice (a minion; Blockbuster's own tough status would take it)", () => {
      const { state: s, id } = castConjured(openedHero("44017"), "44013");
      const weak = withDamage(patchInstance(s, id, { statuses: { stunned: 0, confused: 0, tough: 0 } }), id, 3);
      const m = spawnMinion(weak, { code: MR_HYDE });
      const run = villainPhase(m.state, { defender: id, pick: [m.id] });
      expect(inPlay(run.state, id)).toBe(false);
      expect(dmg(run.state, m.id)).toBe(1);
    });
  });

  describe("44014 Headpool (ally)", () => {
    it("after he attacks and damages a minion, that minion attacks another enemy of the player's choice", () => {
      const { state: s, id } = castConjured(openedHero("44017"), "44014");
      const m = spawnMinion(s, { code: MR_HYDE });
      const run = drive(
        m.state,
        says({ accept: ["44014.headpool-response"], pick: [villainOf(m.state)] }),
        basicAttackCmd(m.state, m.id, id),
      );
      expect(wasOffered(run.offered, "44014.headpool-response")).toBe(true);
      // Mister Hyde (ATK 3) attacks the villain: Headpool's 1 damage to Hyde, 3 to the villain.
      expect(dmg(run.state, m.id)).toBe(1);
      expect(dmg(run.state, villainOf(run.state))).toBe(3);
    });
    it("not offered when his attack defeats the minion", () => {
      const { state: s, id } = castConjured(openedHero("44017"), "44014");
      const m = spawnMinion(s, { code: SHOCKER, damage: 2 });
      const run = drive(m.state, says({ accept: ["44014.headpool-response"] }), basicAttackCmd(m.state, m.id, id));
      expect(wasOffered(run.offered, "44014.headpool-response")).toBe(false);
    });
  });

  describe("44015 Kidpool (ally): his attacks gain piercing", () => {
    it("his attack on a tough minion discards the tough status and damages it (2); the hero's own is absorbed (0)", () => {
      const { state: s, id } = castConjured(openedHero("44017"), "44015");
      const m = spawnMinion(s, { code: MR_HYDE, tough: true });
      const kid = drive(m.state, firstLegal, basicAttackCmd(m.state, m.id, id));
      // RRG 1.8 "Piercing" (p. 34): the attack discards the tough status before dealing damage.
      expect(dmg(kid.state, m.id)).toBe(2);
      expect(status(kid.state, m.id, "tough")).toBe(0);
      const hero = drive(m.state, firstLegal, basicAttackCmd(m.state, m.id));
      expect(dmg(hero.state, m.id)).toBe(0);
      expect(status(hero.state, m.id, "tough")).toBe(0);
    });
  });

  describe("44016 Lady Deadpool (ally)", () => {
    it("when defeated: defeats a non-ELITE minion", () => {
      const { state: s, id } = castConjured(openedHero("44017"), "44016");
      const m = spawnMinion(withDamage(s, id, 2), { code: SHOCKER, player: P1 });
      const run = villainPhase(m.state, { defender: id, pick: [m.id] });
      expect(inPlay(run.state, id)).toBe(false);
      expect(inPlay(run.state, m.id)).toBe(false);
    });
    it("an ELITE minion is not a choice: Sandman stays", () => {
      const { state: s, id } = castConjured(openedHero("44017"), "44016");
      const m = spawnMinion(withDamage(s, id, 2), { code: SANDMAN });
      const run = villainPhase(m.state, { defender: id });
      expect(inPlay(run.state, id)).toBe(false);
      expect(inPlay(run.state, m.id)).toBe(true);
    });
  });

  describe("44017 Barely a Scratch (event, cost 0; defense interrupt)", () => {
    const hit = (icons: readonly string[]) => {
      const base = moveToHand(withIcons(openedHero("44017"), ...icons), P1, "44017").state;
      return villainPhase(base, { accept: ["44017.barely-a-scratch-interrupt"] });
    };
    it("with no icon in play it prevents nothing: the villain's 2 damage lands", () => {
      expect(dmg(hit([]).state, me(hit([]).state))).toBe(2);
    });
    it("one icon prevents 1 of the 2 damage; two prevent both", () => {
      const one = hit([HAZARD]);
      expect(wasOffered(one.offered, "44017.barely-a-scratch-interrupt")).toBe(true);
      expect(dmg(one.state, me(one.state))).toBe(1);
      const two = hit([HAZARD, ACCELERATION]);
      expect(dmg(two.state, me(two.state))).toBe(0);
    });
    it("counts crisis and amplify icons too (4 icons: no damage)", () => {
      const four = hit([HAZARD, ACCELERATION, CRISIS, AMPLIFY]);
      expect(dmg(four.state, me(four.state))).toBe(0);
    });
  });

  describe("44018 Cutupper (event, cost 3; attack)", () => {
    it("deals 5 damage to an enemy and stuns it", () => {
      const m = spawnMinion(openedHero("44018"), { code: MR_HYDE });
      const { state } = cast(m.state, "44018", { pick: [m.id] });
      expect(dmg(state, m.id)).toBe(5);
      expect(status(state, m.id, "stunned")).toBe(1);
    });
    it("an enemy it defeats is not stunned (it has left play): Shocker dies", () => {
      const m = spawnMinion(openedHero("44018"), { code: SHOCKER });
      const { state } = cast(m.state, "44018", { pick: [m.id] });
      expect(inPlay(state, m.id)).toBe(false);
    });
    it("is a Hero Action: not playable in alter-ego form", () => {
      expect(playable(withForm(openedHero("44018"), "alterEgo"), "44018")).toBe(false);
    });
  });

  describe("44019 Da Bomb (event, cost 6)", () => {
    it("10 damage to the villain (hit points 11 with one hero)", () => {
      const { state } = cast(openedHero("44019"), "44019");
      expect(dmg(state, villainOf(state))).toBe(10);
    });
    it("two players, 3 icons: the villain takes 10 + 3 (hit points 22), the minion 3, and each hero 3", () => {
      const base = withIcons(withForm(twoSeats("44019"), { heroForm: 0 }, P2), HAZARD, ACCELERATION, CRISIS);
      const m = spawnMinion(base, { code: MR_HYDE });
      const { state } = cast(m.state, "44019");
      expect(dmg(state, villainOf(state))).toBe(13);
      expect(dmg(state, m.id)).toBe(3);
      expect(dmg(state, me(state, P1))).toBe(3);
      expect(dmg(state, me(state, P2))).toBe(3);
    });
    it("a hero in alter-ego form is not a hero: it takes no damage", () => {
      const base = withIcons(twoSeats("44019"), HAZARD);
      const { state } = cast(base, "44019");
      expect(dmg(state, me(state, P1))).toBe(1);
      expect(dmg(state, me(state, P2))).toBe(0);
    });
  });

  describe("44020 Get Rage-y (event, cost 0; any form)", () => {
    it("readies an ally, which gets +1 ATK until the end of the phase (Dogpool ATK 1 -> 2)", () => {
      const a = ally(openedHero("44020"));
      const tired = patchInstance(a.state, a.id, { exhausted: true });
      const { state } = cast(tired, "44020", { pick: [a.id] });
      expect(inst(state, a.id).exhausted).toBe(false);
      const m = spawnMinion(state, { code: MR_HYDE });
      const run = drive(m.state, firstLegal, basicAttackCmd(m.state, m.id, a.id));
      expect(dmg(run.state, m.id)).toBe(2);
    });
    it("can be played in alter-ego form too (an Action, not a Hero Action)", () => {
      const a = ally(withForm(openedHero("44020"), "alterEgo"));
      expect(playable(a.state, "44020")).toBe(true);
    });
  });

  describe('44021 "I Got This" (event, cost 1; Hero Action)', () => {
    it("[crisis] in play: 3 damage to an enemy", () => {
      const m = spawnMinion(withIcons(openedHero("44021"), CRISIS), { code: MR_HYDE });
      const { state } = cast(m.state, "44021", { pick: [m.id] });
      expect(dmg(state, m.id)).toBe(3);
    });
    it("[acceleration] in play: removes 2 threat from a scheme", () => {
      const side = withIcon(openedHero("44021"), ACCELERATION, 5);
      const { state } = cast(side.state, "44021", { pick: [side.id] });
      expect(inst(state, side.id).threat).toBe(3);
    });
    it("[amplify] in play: readies an ally you control", () => {
      const a = ally(withIcons(openedHero("44021"), AMPLIFY));
      const tired = patchInstance(a.state, a.id, { exhausted: true });
      const { state } = cast(tired, "44021", { pick: [a.id] });
      expect(inst(state, a.id).exhausted).toBe(false);
    });
    it("[hazard] in play: draws 1 card", () => {
      const base = moveToHand(withIcons(openedHero("44021"), HAZARD), P1, "44021").state;
      const before = handIds(base).length;
      const { state } = cast(base, "44021");
      expect(handIds(state)).toHaveLength(before);
    });
    it("with no such icon in play it does nothing and is discarded", () => {
      const m = spawnMinion(openedHero("44021"), { code: MR_HYDE });
      const { state } = cast(m.state, "44021", { pick: [m.id] });
      expect(dmg(state, m.id)).toBe(0);
      expect(codesOf(state, playerOf(state, P1).discard)).toContain("44021");
    });
    it("is a Hero Action: not playable in alter-ego form", () => {
      expect(playable(withForm(openedHero("44021"), "alterEgo"), "44021")).toBe(false);
    });
  });

  describe("44022 Not my Responsibility (event, cost 0; interrupt)", () => {
    // The villain phase places threat twice here: the main scheme's escalation (1 with one player) and then Advance's
    // scheme (2). Either is "any amount of threat placed on a scheme".
    const threatPlaced = (
      say: Omit<Say, "accept" | "pick"> | undefined,
      ally?: InstanceId,
      base = withoutSideSchemes(openedHero("44022"), 2),
    ) => {
      const held = moveToHand(base, P1, "44022").state;
      return villainPhase(
        held,
        say
          ? { ...say, acceptTimes: 1, accept: ["44022.not-my-responsibility-interrupt"], pick: [ally ?? me(held)] }
          : {},
      );
    };
    it("the escalation: the player takes the 1 threat as damage instead", () => {
      const plain = threatPlaced(undefined);
      const saved = threatPlaced({});
      expect(mainThreat(plain.state)).toBe(5);
      expect(wasOffered(saved.offered, "44022.not-my-responsibility-interrupt")).toBe(true);
      expect(mainThreat(saved.state)).toBe(4);
      expect(dmg(saved.state, me(saved.state))).toBe(dmg(plain.state, me(plain.state)) + 1);
    });
    it("Advance's scheme (the second placement, 2 threat): the player takes 2 as damage instead", () => {
      const plain = threatPlaced(undefined);
      const saved = threatPlaced({ skip: 1 });
      expect(mainThreat(saved.state)).toBe(3);
      expect(dmg(saved.state, me(saved.state))).toBe(dmg(plain.state, me(plain.state)) + 2);
    });
    it("an ally may take it instead (Pandapool)", () => {
      const a = ally(openedHero("44022"), "44045");
      const run = threatPlaced({}, a.id, withoutSideSchemes(a.state, 2));
      expect(mainThreat(run.state)).toBe(4);
      expect(dmg(run.state, a.id)).toBe(1);
    });
  });

  describe("44023 'Pool Inspection (event, cost 6; Hero Action thwart)", () => {
    it("removes 5 from the main scheme ignoring [crisis], then 1 per icon from each scheme", () => {
      const base = withoutSideSchemes(openedHero("44023"), 10);
      const crisis = withIcon(base, CRISIS, 2);
      const { state } = cast(crisis.state, "44023");
      // The "ignoring the crisis icon" belongs to the first sentence only: the per-icon removal is still blocked from
      // the main scheme by the crisis icon (RRG 1.8 "Crisis Icon", p. 12), so 10 - 5 = 5, and the crisis scheme's 2 -> 1.
      expect(mainThreat(state)).toBe(5);
      expect(inst(state, crisis.id).threat).toBe(1);
    });
    it("with 2 icons and no crisis: main 10 -> 3, a side scheme 5 -> 3", () => {
      const base = withoutSideSchemes(openedHero("44023"), 10);
      const a = withIcon(base, ACCELERATION, 5);
      const b = withIcon(a.state, HAZARD, 1);
      const { state } = cast(b.state, "44023");
      expect(mainThreat(state)).toBe(3);
      expect(inst(state, a.id).threat).toBe(3);
    });
  });

  describe("44024 Live Dangerously (player side scheme, cost 0)", () => {
    it("each identity gets +2 hand size: Spider-Man refills 2 cards higher than without it", () => {
      const without = villainPhase(openedHero("44024"));
      const { state: s } = cast(openedHero("44024"), "44024");
      const run = villainPhase(s);
      expect(handIds(run.state).length - handIds(without.state).length).toBe(2);
    });
    it("two players: the other player's identity too (Black Panther +2)", () => {
      const both = (state: GameState) => drive(quiet(state), firstLegal, endTurn(P1), endTurn(P2));
      const without = both(twoSeats("44024"));
      const { state: s } = cast(twoSeats("44024"), "44024");
      const run = both(s);
      expect(handIds(run.state, P2).length - handIds(without.state, P2).length).toBe(2);
    });
  });

  describe("44025-44027 Self Confidence, Self Control, Self Preservation (resources: 1, doubled below 5 damage, tripled with none)", () => {
    // A cost-3 card (Concussive Blow 41014) is payable by one of them alone only when it generates 3.
    const pays = (code: string, damage: number): boolean => {
      const base = openedHero("44017");
      const hurt = withDamage(base, me(base), damage);
      const blow = moveToHand(conjureInHand(hurt, "41014").state, P1, "41014");
      const self = conjureInHand(blow.state, code);
      return applyCommand(self.state, play(P1, blow.ids[0]!, [self.id]), WAVE7_DEPS).ok;
    };
    it.each(["44025", "44026", "44027"])("%s: no damage triples it (pays the cost-3 card alone)", (code) => {
      expect(pays(code, 0)).toBe(true);
    });
    it.each(["44025", "44026", "44027"])("%s: 4 damage doubles it (2 resources: cannot pay 3 alone)", (code) => {
      expect(pays(code, 4)).toBe(false);
    });
    it.each(["44025", "44026", "44027"])("%s: 5 damage leaves 1 resource", (code) => {
      expect(pays(code, 5)).toBe(false);
    });
    it("44025 Self Confidence is [physical]: three physical resources make Concussive Blow deal its 3", () => {
      const base = openedHero("44017");
      const blow = moveToHand(conjureInHand(base, "41014").state, P1, "41014");
      const self = conjureInHand(blow.state, "44025");
      const run = drive(self.state, firstLegal, play(P1, blow.ids[0]!, [self.id]));
      expect(dmg(run.state, villainOf(run.state))).toBe(3);
    });
    it("44026 Self Control is [mental]: no [physical], so Concussive Blow deals no damage", () => {
      const base = openedHero("44017");
      const blow = moveToHand(conjureInHand(base, "41014").state, P1, "41014");
      const self = conjureInHand(blow.state, "44026");
      const run = drive(self.state, firstLegal, play(P1, blow.ids[0]!, [self.id]));
      expect(dmg(run.state, villainOf(run.state))).toBe(0);
      expect(status(run.state, villainOf(run.state), "confused")).toBe(1);
    });
  });

  describe("44028 Git Gud (upgrade)", () => {
    it("no recorded win: costs 0 (Q48: no recorded win means you did not win)", () => {
      const given = moveToHand(openedHero("44028"), P1, "44028");
      expect(applyCommand(given.state, play(P1, given.ids[0]!, []), WAVE7_DEPS).ok).toBe(true);
    });
    it("a recorded win: the printed cost of 2 applies", () => {
      const given = moveToHand(openedHero("44028", { outsideFacts: { wonPreviousGame: true } }), P1, "44028");
      expect(applyCommand(given.state, play(P1, given.ids[0]!, []), WAVE7_DEPS).ok).toBe(false);
      const paid = funding(given.state, 2);
      expect(applyCommand(paid.state, play(P1, given.ids[0]!, paid.ids), WAVE7_DEPS).ok).toBe(true);
    });
    it("when the hero would be defeated: hit points set to 1, alter-ego form, Git Gud removed from the game", () => {
      const { state: s, id } = cast(openedHero("44028"), "44028");
      const nearly = withDamage(s, me(s), 9);
      const run = villainPhase(nearly);
      expect(run.state.outcome ?? null).toBeNull();
      expect(playerOf(run.state, P1).identity.form).toBe("alterEgo");
      expect(dmg(run.state, me(run.state))).toBe(9);
      expect(playerOf(run.state, P1).discard).not.toContain(id);
      expect(inst(run.state, me(run.state)).attachments).not.toContain(id);
    });
  });

  describe("44029 Healing Factor (upgrade, Max 1 per player)", () => {
    it("after the player phase begins: exhausts to heal 2 from the identity", () => {
      const { state: s, id } = cast(openedHero("44029"), "44029");
      const hurt = withDamage(s, me(s), 4);
      const without = villainPhase(hurt, {});
      const healed = villainPhase(hurt, { accept: ["44029.healing-factor-response"] });
      expect(wasOffered(healed.offered, "44029.healing-factor-response")).toBe(true);
      expect(dmg(without.state, me(without.state)) - dmg(healed.state, me(healed.state))).toBe(2);
      expect(inst(healed.state, id).exhausted).toBe(true);
    });
    it("Max 1 per player: a second copy is refused", () => {
      const { state: s } = cast(openedHero("44029"), "44029");
      expect(playable(conjureInHand(s, "44029").state, "44029")).toBe(false);
    });
  });

  describe("44030 Stick-To-Itiveness (upgrade)", () => {
    it("Hero Action: spend a [physical] resource and exhaust it to ready the hero", () => {
      const { state: s, id } = cast(openedHero("44030"), "44030");
      const tired = patchInstance(s, me(s), { exhausted: true });
      const phys = iconCards(tired, "physical", 1, { only: true });
      const run = drive(
        phys.state,
        firstLegal,
        use(P1, id, "44030.stick-to-itiveness-action", [{ fromHand: phys.ids[0]! }]),
      );
      expect(inst(run.state, me(run.state)).exhausted).toBe(false);
      expect(inst(run.state, id).exhausted).toBe(true);
    });
    it("a [mental] resource does not pay it", () => {
      const { state: s, id } = cast(openedHero("44030"), "44030");
      const tired = patchInstance(s, me(s), { exhausted: true });
      const mental = iconCards(tired, "mental", 1, { only: true });
      expect(
        applyCommand(
          mental.state,
          use(P1, id, "44030.stick-to-itiveness-action", [{ fromHand: mental.ids[0]! }]),
          WAVE7_DEPS,
        ).ok,
      ).toBe(false);
    });
  });

  describe("44043 Bob, Agent of Hydra (ally)", () => {
    it("after he enters play: 2 damage to an enemy", () => {
      const m = spawnMinion(openedHero("44043"), { code: MR_HYDE });
      const { state } = cast(m.state, "44043", {
        accept: ["44043.bob-agent-of-hydra-response"],
        option: ["Deal 2"],
        pick: [m.id],
      });
      expect(dmg(state, m.id)).toBe(2);
    });
    it("or removes 1 threat from a scheme", () => {
      const side = spawnSideScheme(openedHero("44043"), 3);
      const { state } = cast(side.state, "44043", {
        accept: ["44043.bob-agent-of-hydra-response"],
        option: ["Remove 1"],
        pick: [side.id],
      });
      expect(inst(state, side.id).threat).toBe(2);
    });
  });

  describe("44044 Negasonic Teenage Warhead (ally)", () => {
    const reveal = (cancel: boolean) => {
      const base = withoutSideSchemes(openedHero("44044"), 2);
      const { state: s, id } = cast(base, "44044");
      return {
        run: villainPhase(s, cancel ? { acceptTimes: 1, accept: ["44044.negasonic-teenage-warhead-interrupt"] } : {}),
        id,
      };
    };
    it("when a treachery is revealed: takes 2 damage to cancel its When Revealed (Advance's scheme)", () => {
      const plain = reveal(false);
      const cancelled = reveal(true);
      expect(wasOffered(cancelled.run.offered, "44044.negasonic-teenage-warhead-interrupt")).toBe(true);
      expect(mainThreat(cancelled.run.state)).toBeLessThan(mainThreat(plain.run.state));
      expect(dmg(cancelled.run.state, cancelled.id)).toBe(2);
    });
  });

  describe("44044 Negasonic Teenage Warhead, two players", () => {
    it("cancels the treachery revealed to the other player (the text names no player): she takes 2", () => {
      const base = withoutSideSchemes(withForm(twoSeats("44044"), { heroForm: 0 }, P2), 2);
      const { state: s, id } = cast(base, "44044");
      const stacked = stackEncounterDeck(s, "01187", "01186", "01186");
      const run = drive(
        stacked,
        says({ skip: 1, acceptTimes: 1, accept: ["44044.negasonic-teenage-warhead-interrupt"] }),
        endTurn(P1),
        endTurn(P2),
      );
      expect(wasOffered(run.offered, "44044.negasonic-teenage-warhead-interrupt")).toBe(true);
      expect(dmg(run.state, id)).toBe(2);
    });
  });

  describe("44045 Pandapool (ally, Toughness)", () => {
    it("enters play with a tough status", () => {
      const { state, id } = cast(openedHero("44045"), "44045");
      expect(inPlay(state, id)).toBe(true);
      expect(status(state, id, "tough")).toBe(1);
    });
  });

  // Alliance: the cost is paid once per player (3 each: 6 with two heroes).
  describe("44046 Break Time (event, cost 3; Alter-Ego Action; Alliance)", () => {
    const heal = (minutes: number, damage = 6) => {
      const base = withForm(openedHero("44046"), "alterEgo");
      return cast(withDamage(base, me(base), damage), "44046", { amount: minutes });
    };
    it("heals 1 damage from each identity for every minute away (4 minutes: 6 -> 2)", () => {
      const { state } = heal(4);
      expect(dmg(state, me(state))).toBe(2);
    });
    it("0 minutes heals nothing, and a large number heals only what is there", () => {
      expect(dmg(heal(0).state, me(heal(0).state))).toBe(6);
      expect(dmg(heal(1000).state, me(heal(1000).state))).toBe(0);
    });
    it("is an Alter-Ego Action: not playable in hero form", () => {
      expect(playable(openedHero("44046"), "44046")).toBe(false);
    });
    it("two players: every identity heals (Spider-Man 6 -> 3, Black Panther 4 -> 1 for 3 minutes)", () => {
      const base = withForm(twoSeats("44046"), "alterEgo");
      const hurt = withDamage(withDamage(base, me(base), 6), me(base, P2), 4);
      const { state } = cast(hurt, "44046", { amount: 3 }, { cost: 6 });
      expect(dmg(state, me(state, P1))).toBe(3);
      expect(dmg(state, me(state, P2))).toBe(1);
    });
  });

  describe("44047 Get in Front of Me! (event, cost 1; Hero Interrupt)", () => {
    /** The attacks on a player's identity in a villain phase: each `attackResolved` event's damage. */
    const attacksOn = (run: { events: readonly { type: string }[] }, target: InstanceId): number[] =>
      run.events
        .filter(
          (e) =>
            e.type === "attackResolved" &&
            (e as unknown as { targetInstanceId: InstanceId }).targetInstanceId === target,
        )
        .map((e) => (e as unknown as { damageDealt: number }).damageDealt);
    const treachery = (base: GameState, say: Say) => villainPhase(moveToHand(base, P1, "44047").state, say);
    it("cancels the treachery's When Revealed and the villain attacks the player instead (one more attack)", () => {
      const base = withoutSideSchemes(openedHero("44047"), 2);
      const plain = villainPhase(base);
      const run = treachery(base, { accept: ["44047.get-in-front-of-me-interrupt"] });
      expect(wasOffered(run.offered, "44047.get-in-front-of-me-interrupt")).toBe(true);
      expect(mainThreat(run.state)).toBeLessThan(mainThreat(plain.state));
      const extra = attacksOn(run, me(run.state));
      expect(extra).toHaveLength(attacksOn(plain, me(plain.state)).length + 1);
      expect(dmg(run.state, me(run.state)) - dmg(plain.state, me(plain.state))).toBe(extra[extra.length - 1]);
    });
    it("two players: if the other player's hero defends the attack, draws 1 card", () => {
      const base = withoutSideSchemes(withForm(twoSeats("44047"), { heroForm: 0 }, P2), 2);
      const accept = ["44047.get-in-front-of-me-interrupt"];
      const held = moveToHand(base, P1, "44047").state;
      const stacked = stackEncounterDeck(held, "01187", "01186", "01186");
      const at = (say: Say) => drive(stacked, says(say), endTurn(P1), endTurn(P2));
      const alone = at({ accept });
      // Both heroes are in hero form, so the villain attacks each of them before the reveals: decline those two.
      const helped = at({ accept, defender: [me(base, P2)], noDefenseFor: 2 });
      expect(handIds(helped.state).length).toBe(handIds(alone.state).length + 1);
    });
    it("if an ally defends the attack, draws 1 card", () => {
      const a = ally(withoutSideSchemes(openedHero("44047"), 2), "44045");
      const b = ally(a.state, "44013");
      const accept = ["44047.get-in-front-of-me-interrupt"];
      const alone = treachery(b.state, { accept });
      // Both allies are offered at each attack; the first one offered defends, so each of the two attacks is defended.
      const defended = treachery(b.state, { accept, defender: [a.id, b.id] });
      expect(handIds(defended.state).length).toBe(handIds(alone.state).length + 1);
    });
  });

  describe("44048 Mulligan (event, cost 3)", () => {
    it("discards the hand and draws up to hand size (Spider-Man 5)", () => {
      const { state } = castConjured(openedHero("44048"), "44048");
      expect(handIds(state)).toHaveLength(5);
    });
    it("cannot be played after another card was played this phase", () => {
      const first = castConjured(openedHero("44048"), "43027");
      expect(playable(conjureInHand(first.state, "44048").state, "44048")).toBe(false);
    });
  });

  describe("44049 Deadpool Corps Ship (support, cost 1)", () => {
    it("Action: exhaust and deal yourself a facedown encounter card to put a 'Pool ally from hand into play", () => {
      const { state: s, id } = cast(openedHero("44049"), "44049");
      const dog = conjureInHand(s, "44013");
      const run = drive(
        stackEncounterDeck(dog.state, "01186"),
        says({ pick: [dog.id] }),
        use(P1, id, "44049.deadpool-corps-ship-action"),
      );
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(inPlay(run.state, dog.id)).toBe(true);
      expect(handIds(run.state)).not.toContain(dog.id);
    });
    it("a non-'Pool ally in hand (Rictor) cannot be put into play: the Action cannot start", () => {
      const { state: s, id } = cast(openedHero("44049"), "44049");
      const rictor = conjureInHand(s, "43014");
      // With no 'Pool ally in hand the Action has no valid target and cannot be started.
      expect(
        applyCommand(
          stackEncounterDeck(rictor.state, "01186"),
          use(P1, id, "44049.deadpool-corps-ship-action"),
          WAVE7_DEPS,
        ).ok,
      ).toBe(false);
    });
  });

  describe("44050 Plot Convenience (support, cost 2)", () => {
    it("Action: attaches an aspect card from hand facedown, then takes it back into hand later", () => {
      const { state: s, id } = cast(openedHero("44050"), "44050");
      const card = conjureInHand(s, "44017");
      const put = useAbility(card.state, id, "44050.plot-convenience-action", { option: ["Attach"], pick: [card.id] });
      expect(inst(put.state, id).attachments).toContain(card.id);
      expect(handIds(put.state)).not.toContain(card.id);
      const ready = patchInstance(put.state, id, { exhausted: false });
      const back = useAbility(ready, id, "44050.plot-convenience-action", { option: ["Add 1"], pick: [card.id] });
      expect(handIds(back.state)).toContain(card.id);
    });
    it("a basic card is not an aspect card: Frenemies-type basic cards are not offered (Endurance 43027)", () => {
      const { state: s, id } = cast(openedHero("44050"), "44050");
      const basic = conjureInHand(s, "43027");
      const put = useAbility(basic.state, id, "44050.plot-convenience-action", {
        option: ["Attach"],
        pick: [basic.id],
      });
      expect(inst(put.state, id).attachments).not.toContain(basic.id);
    });
    it("two players: the other player may trigger it", () => {
      const { state: s, id } = cast(twoSeats("44050"), "44050");
      const theirs = conjure(s, "44017", "hand", P2);
      const run = useAbility(
        theirs.state,
        id,
        "44050.plot-convenience-action",
        { option: ["Attach"], pick: [theirs.id] },
        P2,
      );
      expect(inst(run.state, id).attachments).toContain(theirs.id);
    });
  });

  describe("44051 Ambush (upgrade on a side scheme)", () => {
    it("when the attached scheme is defeated: discards a non-ELITE minion", () => {
      const side = spawnSideScheme(openedHero("44051"), 3);
      const { state: s, id } = cast(side.state, "44051", {}, { attach: side.id });
      expect(inst(s, id).attachedTo).toBe(side.id);
      const m = spawnMinion(patchInstance(s, side.id, { threat: 1 }), { code: SHOCKER });
      const run = drive(
        m.state,
        says({ accept: ["44051.ambush-interrupt"], pick: [m.id] }),
        basicThwartCmd(m.state, side.id),
      );
      expect(wasOffered(run.offered, "44051.ambush-interrupt")).toBe(true);
      expect(inPlay(run.state, m.id)).toBe(false);
    });
    it("with only an ELITE minion in play there is nothing to discard: the interrupt is not offered", () => {
      const side = spawnSideScheme(openedHero("44051"), 3);
      const { state: s } = cast(side.state, "44051", {}, { attach: side.id });
      const m = spawnMinion(patchInstance(s, side.id, { threat: 1 }), { code: SANDMAN });
      const run = drive(m.state, says({ accept: ["44051.ambush-interrupt"] }), basicThwartCmd(m.state, side.id));
      expect(wasOffered(run.offered, "44051.ambush-interrupt")).toBe(false);
      expect(inPlay(run.state, m.id)).toBe(true);
    });
    it("Max 1 per side scheme", () => {
      const side = spawnSideScheme(openedHero("44051"), 3);
      const { state } = cast(side.state, "44051", {}, { attach: side.id });
      expect(playable(conjureInHand(state, "44051").state, "44051", side.id)).toBe(false);
    });
  });

  describe("44052 Bazooka (upgrade, Restricted)", () => {
    it("Hero Action (attack): discard it to deal 1 damage per icon in play (3 here) to an enemy", () => {
      const base = spawnMinion(withIcons(openedHero("44052"), HAZARD, ACCELERATION, CRISIS), { code: MR_HYDE });
      const { state: s, id } = cast(base.state, "44052");
      const run = drive(s, says({ pick: [base.id] }), use(P1, id, "44052.bazooka-action"));
      expect(dmg(run.state, base.id)).toBe(3);
      expect(codesOf(run.state, playerOf(run.state, P1).discard)).toContain("44052");
    });
    it("with no icon in play the attack deals nothing", () => {
      const base = spawnMinion(openedHero("44052"), { code: MR_HYDE });
      const { state: s, id } = cast(base.state, "44052");
      const run = drive(s, says({ pick: [base.id] }), use(P1, id, "44052.bazooka-action"));
      expect(dmg(run.state, base.id)).toBe(0);
    });
  });

  describe("44053 Blackout (upgrade)", () => {
    const blackout = (counters: Record<string, number>, type: "energy" | "mental" | "physical") => {
      const side = spawnSideScheme(openedHero("44053"), 5);
      const { state: s, id } = cast(side.state, "44053");
      const spend = conjureInHand(patchInstance(s, id, { counters }), codeWithIcon(type));
      const run = drive(
        spend.state,
        says({ pick: [side.id], option: [`[${type}]`], spend: [codeWithIcon(type)] }),
        use(P1, id, "44053.blackout-action"),
      );
      return { run, side: side.id, id };
    };
    it("Hero Action: spend a resource to move 1 threat off a scheme onto the matching space", () => {
      const r = blackout({}, "energy");
      expect(inst(r.run.state, r.side).threat).toBe(4);
      expect(inst(r.run.state, r.id).counters.energy).toBe(1);
    });
    it("a [physical] resource fills the [physical] row", () => {
      const r = blackout({}, "physical");
      expect(inst(r.run.state, r.id).counters.physical).toBe(1);
    });
    it("when every space is filled: it is discarded and the villain is confused", () => {
      const r = blackout({ energy: 2, mental: 2, physical: 1 }, "physical");
      expect(codesOf(r.run.state, playerOf(r.run.state, P1).discard)).toContain("44053");
      expect(status(r.run.state, villainOf(r.run.state), "confused")).toBe(1);
    });
  });

  describe("44054 Distraction (upgrade on a non-ELITE minion)", () => {
    it("the attached minion cannot activate: only the villain's 2 damage lands, not the minion's too", () => {
      const m = spawnMinion(openedHero("44054"), { code: SHOCKER });
      const free = drive(quiet(m.state), firstLegal, endTurn(P1));
      const { state: s } = cast(m.state, "44054", {}, { attach: m.id });
      const held = drive(quiet(s), firstLegal, endTurn(P1));
      expect(dmg(free.state, me(free.state))).toBeGreaterThan(dmg(held.state, me(held.state)));
      expect(dmg(held.state, me(held.state))).toBe(2);
    });
    it("an ELITE minion is not a legal host (Sandman)", () => {
      const m = spawnMinion(openedHero("44054"), { code: SANDMAN });
      expect(playable(m.state, "44054", m.id)).toBe(false);
    });
  });

  describe("44055 Laser Swords (upgrade, counts as 2 restricted)", () => {
    it("your hero gets +1 ATK per icon in play, to a maximum of +4", () => {
      const base = openedHero("44055");
      const at = (n: number) => {
        const codes = [HAZARD, ACCELERATION, CRISIS, AMPLIFY, "01109"].slice(0, n);
        return cast(withIcons(base, ...codes), "44055").state;
      };
      expect(profile(at(0), me(at(0))).atk).toBe(2);
      expect(profile(at(3), me(at(3))).atk).toBe(5);
      expect(profile(at(5), me(at(5))).atk).toBe(6);
    });
    // RRG 1.8 "Restricted" (p. 38): the play is legal; the Bazooka, the only card with the keyword (Q52 = B), is the
    // one discarded for the limit.
    it("counts as 2 restricted cards: a Bazooka (1 restricted) is played beside it and discarded at once", () => {
      const { state: s, id: swords } = cast(openedHero("44055"), "44055");
      const hand = conjureInHand(s, "44052").state;
      expect(playable(hand, "44052")).toBe(true);
      const given = moveToHand(hand, P1, "44052");
      const bazooka = given.ids[0]!;
      const funded = funding(given.state, printedCost("44052"));
      const played = applyCommand(funded.state, play(P1, bazooka, funded.ids), WAVE7_DEPS);
      if (!played.ok) throw new Error(played.error.message);
      const choice = played.state.pendingChoice;
      expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
      expect(choice?.options.map((o) => o.optionId)).toEqual([bazooka]);
      const after = applyCommand(
        played.state,
        { type: "resolveChoice", playerId: P1, choiceId: choice!.choiceId, selectedOptionIds: [bazooka] },
        WAVE7_DEPS,
      );
      if (!after.ok) throw new Error(after.error.message);
      expect(cardsInPlay(after.state)).toContain(swords);
      expect(cardsInPlay(after.state)).not.toContain(bazooka);
    });
  });

  describe("44056 Rock, Paper, Scissors (upgrade)", () => {
    const rps = (chosen: string, top: string) => {
      const { state: s, id } = cast(openedHero("44056"), "44056");
      const mine = conjureInHand(s, chosen);
      const above = conjure(mine.state, top, "topOfDeck");
      const run = drive(
        above.state,
        firstLegal,
        use(P1, id, "44056.rock-paper-scissors-action", [], { pick: [mine.id] }),
      );
      return { run, discarded: above.id, id };
    };
    const ENERGY = codeWithIcon("energy");
    const MENTAL = codeWithIcon("mental");
    const PHYSICAL = codeWithIcon("physical");
    const WILD = codeWithIcon("wild");
    it("[energy] beats [mental]: the discarded card is added to the hand", () => {
      const r = rps(ENERGY, MENTAL);
      expect(handIds(r.run.state)).toContain(r.discarded);
      expect(inst(r.run.state, r.id).exhausted).toBe(true);
    });
    it("[physical] beats [energy], [mental] beats [physical]", () => {
      const a = rps(PHYSICAL, ENERGY);
      expect(handIds(a.run.state)).toContain(a.discarded);
      const b = rps(MENTAL, PHYSICAL);
      expect(handIds(b.run.state)).toContain(b.discarded);
    });
    it("the loser's card stays in the discard pile", () => {
      const r = rps(MENTAL, ENERGY);
      expect(handIds(r.run.state)).not.toContain(r.discarded);
      expect(playerOf(r.run.state, P1).discard).toContain(r.discarded);
    });
    it("[wild] beats every type, and nothing beats [wild]", () => {
      const w = rps(WILD, ENERGY);
      expect(handIds(w.run.state)).toContain(w.discarded);
      const l = rps(ENERGY, WILD);
      expect(handIds(l.run.state)).not.toContain(l.discarded);
    });
  });

  describe("44057 Tic-Tac-Toe (upgrade)", () => {
    const energy = codeWithIcon("energy");
    const tictac = (counters: Record<string, number>, columns: string) => {
      const { state: s, id } = cast(openedHero("44057"), "44057");
      const m = spawnMinion(withDamage(s, me(s), 3), { code: MR_HYDE });
      const spend = conjureInHand(patchInstance(m.state, id, { counters }), energy);
      const run = drive(
        spend.state,
        says({ pick: [me(s), m.id], option: ["[energy]", columns], spend: [energy] }),
        use(P1, id, "44057.tic-tac-toe-action"),
      );
      return { run, id, minion: m.id };
    };
    it("Hero Action: spend a resource to move 1 damage from a character onto the matching row", () => {
      const r = tictac({}, "Column 1");
      expect(dmg(r.run.state, me(r.run.state))).toBe(2);
      expect(inst(r.run.state, r.id).counters["r1c1"]).toBe(1);
    });
    it("three in a line: deals all the damage on the card to an enemy and is discarded", () => {
      const r = tictac({ r1c1: 1, r1c2: 1 }, "Column 3");
      expect(codesOf(r.run.state, playerOf(r.run.state, P1).discard)).toContain("44057");
      expect(dmg(r.run.state, r.minion)).toBe(3);
    });
  });

  describe("Hero Actions are not usable in alter-ego form", () => {
    it.each(["44030", "44052", "44053", "44056", "44057", "44058"])("%s", (code) => {
      const base = spawnSideScheme(openedHero(code), 3);
      const { state: s, id } = cast(base.state, code);
      const ego = withForm(withDamage(s, me(s), 2), "alterEgo");
      const abilities: Record<string, string> = {
        "44030": "44030.stick-to-itiveness-action",
        "44052": "44052.bazooka-action",
        "44053": "44053.blackout-action",
        "44056": "44056.rock-paper-scissors-action",
        "44057": "44057.tic-tac-toe-action",
        "44058": "44058.war-action",
      };
      expect(applyCommand(ego, use(P1, id, abilities[code]!), WAVE7_DEPS).ok).toBe(false);
    });
  });

  describe("44058 War (upgrade)", () => {
    it("Hero Action: discards the top encounter card (taking damage per its icons), discards your top card, deals its cost to an enemy", () => {
      const { state: s, id } = cast(openedHero("44058"), "44058");
      const top = conjure(s, "44018", "topOfDeck");
      const m = spawnMinion(top.state, { code: MR_HYDE });
      // Mister Hyde's own boost icons are counted for the card on top of the encounter deck: stack a known card.
      const staged = stackEncounterDeck(m.state, "40097");
      const boost = (
        staged.cardPool[staged.instances[Object.values(staged.encounterDecks)[0]!.deck[0]!]!.cardId] as {
          boostIcons: number;
        }
      ).boostIcons;
      const run = drive(staged, says({ pick: [m.id] }), use(P1, id, "44058.war-action"));
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(dmg(run.state, me(run.state))).toBe(boost);
      expect(dmg(run.state, m.id)).toBe(3);
    });
  });
});
