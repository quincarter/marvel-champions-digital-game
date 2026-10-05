import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  hasKeyword,
  keywordTotal,
  type CardInstance,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "../next_evol/precon-cable-deck.js";
import { PSYLOCKE_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Psylocke's blades, allies, supports, upgrades, side scheme and resource (41002-41024), docs/phase7-wave7.md §7.2,
 * §3.64, §4.1 Q38 / Q52. Her real precon (`psylocke-justice`) against Stryfe through `wave7Scenario` with the real
 * registry. Psylocke: THW 1, ATK 1, DEF 2, hand size 4; both blades start Knife side up (+1 THW each).
 */
const KNIFE_CONSTANT = "41002a.psi-knife-constant";
const KNIFE_RESOURCE = "41002a.psi-knife-resource";
const KATANA_CONSTANT = "41002b.psi-katana-constant";
const KATANA_RESOURCE = "41002b.psi-katana-resource";
const ANGEL = "41003.angel-response";
const REGIMEN = "41008.training-regimen-action";
const MARTIAL_CONSTANT = "41009.martial-arts-training-constant";
const MARTIAL_RESPONSE = "41009.martial-arts-training-response";
const PSIONIC_CONSTANT = "41010.psionic-training-constant";
const PSIONIC_RESPONSE = "41010.psionic-training-response";
const WEAPONS_CONSTANT = "41011.weapons-training-constant";
const WEAPONS_RESPONSE = "41011.weapons-training-response";
const BRITAIN = "41012.captain-britain-constant";
const CYPHER = "41013.cypher-response";
const TRAP = "41016.when-defeated";
const BUTTERFLY = "41017.float-like-a-butterfly-interrupt";
const WISDOM = "41018.pete-wisdom-response";
const MIND = "41021.the-power-of-the-mind-constant";
const IPAC = "41022.ipac-action";
const BUNKER = "41023.x-bunker-action";
const TELEPATHY = "41024.telepathy-action";
const CONTROL = "41001a.star-psi-energy-control";
const ALL_REFS = [
  KNIFE_CONSTANT,
  KNIFE_RESOURCE,
  KATANA_CONSTANT,
  KATANA_RESOURCE,
  ANGEL,
  REGIMEN,
  MARTIAL_CONSTANT,
  MARTIAL_RESPONSE,
  PSIONIC_CONSTANT,
  PSIONIC_RESPONSE,
  WEAPONS_CONSTANT,
  WEAPONS_RESPONSE,
  BRITAIN,
  CYPHER,
  TRAP,
  BUTTERFLY,
  WISDOM,
  MIND,
  IPAC,
  BUNKER,
  TELEPATHY,
];

const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof PSYLOCKE | typeof SPIDER_MAN;
const BLADE = "41002a";
const BREAKIN = "40131"; // Captive Hope: an encounter side scheme, staged (3 threat per player)

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const heroGame = (players: readonly Seat[] = [PSYLOCKE], seed = 1, heroSeat = P1): GameState => {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
  return withForm(s, { heroForm: 0 }, heroSeat);
};
const alterEgoGame = (players: readonly Seat[] = [PSYLOCKE]): GameState => {
  const config = wave7Scenario("stryfe", { players, seed: 1, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
};

const bladesOf = (s: GameState, p = P1): InstanceId[] =>
  inst(s, identityOf(s, p)).attachments.filter((id) => codeOf(s, id) === BLADE);
const faces = (s: GameState, p = P1): boolean[] => bladesOf(s, p).map((id) => inst(s, id).flipped);
const flipAll = (s: GameState, p = P1): GameState =>
  bladesOf(s, p).reduce((acc, id) => patchInstance(acc, id, { flipped: true }), s);
const profileOf = (s: GameState, p = P1) => characterProfile(s, identityOf(s, p), WAVE7_DEPS)!;
const stryfe = (s: GameState): InstanceId => activeVillain(s).instanceId;
/** Every restricted card (showing face) among the cards attached to the player's identity. */
const restrictedIn = (s: GameState, p = P1): InstanceId[] =>
  inst(s, identityOf(s, p)).attachments.filter((id) => hasKeyword(s, id, "restricted", WAVE7_DEPS));
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;
const handOf = (s: GameState, p = P1) => playerOf(s, p).hand;
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));

const basicAttack = (s: GameState, target: InstanceId, who = identityOf(s), p = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: who,
  targetInstanceId: target,
});
const basicThwart = (s: GameState, scheme: InstanceId, who = identityOf(s), p = P1): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: who,
  schemeInstanceId: scheme,
});

/** Plays `code` from hand (an upgrade attached to `attach`), paying with other hand cards. */
function put(
  state: GameState,
  code: string,
  cost: number,
  opts: { attach?: InstanceId; player?: typeof P1; pick?: Picker } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const driven = driveEventsPicking(
    WAVE7_DEPS,
    given.state,
    opts.pick ?? firstLegal,
    play(player, id, payWith(given.state, player, cost, [id]), opts.attach ? { attachToInstanceId: opts.attach } : {}),
  );
  return { state: driven.state, id };
}
/** Puts `code` into play attached to the identity by surgery (no cost, no windows). */
function attached(state: GameState, code: string, player = P1): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const identity = identityOf(state, player);
  const s = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== id) } : p,
    ),
  };
  const withCard = patchInstance(s, id, {
    home: { kind: "player" },
    attachedTo: identity,
    controllerId: player,
    faceup: true,
  });
  return {
    state: patchInstance(withCard, identity, { attachments: [...inst(withCard, identity).attachments, id] }),
    id,
  };
}
const choosing =
  (...codes: string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards") {
      const hit = choice.options.find((o) => codes.includes(codeOf(state, o.optionId as InstanceId)));
      if (hit) return [hit.optionId];
    }
    return firstLegal(state);
  };
/** Accepts every optional response whose id contains one of `wanted`; other prompts take the first option. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return firstLegal(state);
  };
/** Every response id offered while `pick` drives `commands`. */
function driveOffers(state: GameState, pick: Picker, ...commands: Command[]) {
  const offered = new Set<string>();
  const spy: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTriggers")
      for (const o of s.pendingChoice.options) offered.add(o.optionId);
    return pick(s);
  };
  const result = driveEventsPicking(WAVE7_DEPS, state, spy, ...commands);
  return { ...result, offered };
}
const hasOffer = (offered: Set<string>, ref: string): boolean => [...offered].some((o) => o.includes(ref));

describe("Psylocke supports, upgrades and allies registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(PSYLOCKE_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });
  it("holds exactly its refs", () => {
    expect(Object.keys(PSYLOCKE_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...ALL_REFS].sort());
  });
  it("The Power of the Mind 41021 is the same definition as 40028 (a reprint)", () => {
    expect(PSYLOCKE_SUPPORT_UPGRADES_ALLIES[MIND]).toBe(
      NEXT_EVOL_PRECON_CABLE_DECK["40028.the-power-of-the-mind-constant"],
    );
  });
});

describe("Psi-Knife and Psi-Katana (41002a/b): stats", () => {
  it("both blades Knife side up: +1 THW each, Psylocke is THW 3, ATK 1, DEF 2", () => {
    const s = heroGame();
    expect(faces(s)).toEqual([false, false]);
    expect([profileOf(s).thw, profileOf(s).atk, profileOf(s).def]).toEqual([3, 1, 2]);
  });
  it("one Katana: THW 2 and ATK 2; two Katanas: THW 1 and ATK 3", () => {
    const s = heroGame();
    const one = patchInstance(s, bladesOf(s)[0]!, { flipped: true });
    expect([profileOf(one).thw, profileOf(one).atk]).toEqual([2, 2]);
    const two = flipAll(s);
    expect([profileOf(two).thw, profileOf(two).atk, profileOf(two).def]).toEqual([1, 3, 2]);
  });
  it("two players: only Psylocke's seat gets the bonus; Spider-Man's stats are his own", () => {
    const s = heroGame([SPIDER_MAN, PSYLOCKE], 1, P2);
    expect(profileOf(s, P2).thw).toBe(3);
    expect(profileOf(s, P1).thw).toBe(characterProfile(s, identityOf(s, P1), WAVE7_DEPS)!.thw);
    expect(bladesOf(s, P1)).toHaveLength(0);
  });
  it("a basic attack with the Knives deals her ATK (1) with no piercing: a tough villain's status absorbs it", () => {
    const base = heroGame();
    const tough = patchInstance(base, stryfe(base), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state } = driveEventsPicking(WAVE7_DEPS, tough, firstLegal, basicAttack(tough, stryfe(tough)));
    expect(inst(state, stryfe(state)).damage).toBe(0);
    expect(inst(state, stryfe(state)).statuses.tough).toBe(0);
  });
  it("a basic attack with a Katana deals ATK 2 with piercing: the tough status is discarded and the damage still lands", () => {
    const base = heroGame();
    const katana = patchInstance(base, bladesOf(base)[0]!, { flipped: true });
    const tough = patchInstance(katana, stryfe(katana), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state } = driveEventsPicking(WAVE7_DEPS, tough, firstLegal, basicAttack(tough, stryfe(tough)));
    expect(inst(state, stryfe(state)).damage).toBe(2);
    expect(inst(state, stryfe(state)).statuses.tough).toBe(0);
  });
});

describe("Psi-Energy Control flips before the value is read (spec 3.64)", () => {
  /** Accepts Psi-Energy Control and flips the blade at `index`. */
  const flipping =
    (index: number): Picker =>
    (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") {
        const hit = choice.options.find((o) => o.optionId.includes(CONTROL));
        return hit ? [hit.optionId] : [];
      }
      if (choice?.prompt.kind === "chooseCards") {
        const hit = choice.options.find((o) => o.optionId === bladesOf(s)[index]);
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    };

  it("a basic attack: Knife to Katana deals the Katana's ATK 2 with piercing (a tough villain's status does not stop it)", () => {
    const base = heroGame();
    const tough = patchInstance(base, stryfe(base), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state } = driveEventsPicking(WAVE7_DEPS, tough, flipping(0), basicAttack(tough, stryfe(tough)));
    expect(faces(state)).toEqual([true, false]);
    expect(inst(state, stryfe(state)).damage).toBe(2);
    expect(inst(state, stryfe(state)).statuses.tough).toBe(0);
  });
  it("declined, the same attack deals ATK 1 and meets the tough status", () => {
    const base = heroGame();
    const tough = patchInstance(base, stryfe(base), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      tough,
      (s) => (s.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(s)),
      basicAttack(tough, stryfe(tough)),
    );
    expect(faces(state)).toEqual([false, false]);
    expect(inst(state, stryfe(state)).damage).toBe(0);
  });
  it("a basic attack with both Katanas, one flipped back to Knife: ATK 2 (one Katana left) and still piercing", () => {
    const base = flipAll(heroGame());
    const tough = patchInstance(base, stryfe(base), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const { state } = driveEventsPicking(WAVE7_DEPS, tough, flipping(0), basicAttack(tough, stryfe(tough)));
    expect(faces(state)).toEqual([false, true]);
    expect(inst(state, stryfe(state)).damage).toBe(2);
    expect(inst(state, stryfe(state)).statuses.tough).toBe(0);
  });
  it("a basic thwart: Katana to Knife gives the Knife's +1 THW before the value is read (THW 2 instead of 1)", () => {
    const base = flipAll(heroGame());
    const staged = encounterCardInVillainArea(base, BREAKIN, 2);
    const scheme = staged.id;
    expect(profileOf(staged.state).thw).toBe(1);
    const { state } = driveEventsPicking(WAVE7_DEPS, staged.state, flipping(0), basicThwart(staged.state, scheme));
    expect(faces(state)).toEqual([false, true]);
    expect(inst(state, scheme).threat).toBe(Math.max(0, inst(staged.state, scheme).threat - 2));
  });
  it("a basic thwart declined: THW 1 with two Katanas", () => {
    const base = flipAll(heroGame());
    const staged = encounterCardInVillainArea(base, BREAKIN, 2);
    const before = inst(staged.state, staged.id).threat;
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      staged.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseTriggers" ? [] : firstLegal(s)),
      basicThwart(staged.state, staged.id),
    );
    expect(inst(state, staged.id).threat).toBe(before - 1);
  });
  it("a basic defense: the interrupt is offered, flips, and the defense still resolves (Martial Arts then readies her)", () => {
    const withMartial = attached(heroGame(), "41009");
    const base = withMartial.state;
    const seen: string[] = [];
    let flips = 0;
    const pick: Picker = (s) => {
      const c = s.pendingChoice;
      if (c) seen.push(c.prompt.kind);
      if (c?.prompt.kind === "declareDefender") return [identityOf(s)];
      if (c?.prompt.kind === "chooseTriggers") {
        const hit = c.options.find(
          (o) => (o.optionId.includes(CONTROL) && flips++ === 0) || o.optionId.includes(MARTIAL_RESPONSE),
        );
        return hit ? [hit.optionId] : [];
      }
      if (c?.prompt.kind === "chooseCards") {
        const hit = c.options.find((o) => o.optionId === bladesOf(s)[0]);
        if (hit) return [hit.optionId];
      }
      return firstLegal(s);
    };
    const { state, events } = driveEventsPicking(WAVE7_DEPS, base, pick, endTurn(P1));
    expect(events.some((e) => e.type === "cardFlipped")).toBe(true);
    expect(faces(state)).toEqual([true, false]);
    expect(seen).toContain("declareDefender");
    // Martial Arts Training's response readied her right after the defense (a later round's ready is not that one).
    const resolved = events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === MARTIAL_RESPONSE);
    expect(resolved).toBeGreaterThan(-1);
    const readied = events.findIndex(
      (e, i) => i > resolved && e.type === "cardReadied" && e.instanceId === identityOf(state),
    );
    expect(readied).toBeGreaterThan(resolved);
    expect(events.slice(resolved, readied).some((e) => e.type === "stepChanged")).toBe(false);
    expect(instancesOf(state, "41009").some((id) => playerOf(state, P1).discard.includes(id))).toBe(true);
  });
});

describe("Psi-Knife and Psi-Katana resources", () => {
  it("each Knife generates one [mental] resource: two pay Telepathy's [mental][mental]", () => {
    const base = heroGame();
    const { state: s, id } = attached(base, "41024");
    const [k1, k2] = bladesOf(s) as [InstanceId, InstanceId];
    const { state, events } = driveEventsPicking(
      WAVE7_DEPS,
      encounterCardInVillainArea(s, BREAKIN, 3).state,
      choosing("40131"),
      use(P1, id, TELEPATHY, [resourceAbility(k1, KNIFE_RESOURCE), resourceAbility(k2, KNIFE_RESOURCE)]),
    );
    expect(inst(state, k1).exhausted).toBe(true);
    expect(inst(state, k2).exhausted).toBe(true);
    const mental = events.filter((e) => e.type === "resourcesGenerated");
    expect(mental).toHaveLength(2);
    for (const e of mental) expect(e.type === "resourcesGenerated" && e.pool).toMatchObject({ mental: 1, physical: 0 });
  });
  it("a Katana generates a [physical] resource, which cannot pay for Telepathy's [mental]", () => {
    const base = heroGame();
    const { state: s, id } = attached(base, "41024");
    const staged = encounterCardInVillainArea(s, BREAKIN, 3).state;
    const [k1, k2] = bladesOf(staged) as [InstanceId, InstanceId];
    const katana = patchInstance(staged, k1, { flipped: true });
    expect(
      rejected(
        katana,
        use(P1, id, TELEPATHY, [resourceAbility(k1, KATANA_RESOURCE), resourceAbility(k2, KNIFE_RESOURCE)]),
      ),
    ).toBe(true);
  });
  it("paying a cost with a Katana generates [physical], logged", () => {
    const base = flipAll(heroGame());
    const given = moveToHand(base, P1, "41008");
    const [regimen] = given.ids as [InstanceId];
    const blade = bladesOf(given.state)[0]!;
    const { events, state } = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      choosing(),
      play(P1, regimen, [], { abilities: [resourceAbility(blade, KATANA_RESOURCE)] }),
    );
    const generated = events.filter((e) => e.type === "resourcesGenerated");
    expect(generated.map((e) => e.type === "resourcesGenerated" && e.pool)).toMatchObject([{ physical: 1, mental: 0 }]);
    expect(inst(state, blade).exhausted).toBe(true);
    expect(playerOf(state, P1).playArea).toContain(regimen);
  });
  it("'You may flip this card': paying with a Knife and accepting turns it into a Psi-Katana, exhausted", () => {
    const base = heroGame();
    const given = moveToHand(base, P1, "41008");
    const [regimen] = given.ids as [InstanceId];
    const blade = bladesOf(given.state)[0]!;
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseCards" ? [blade] : firstLegal(s)),
      play(P1, regimen, [], { abilities: [resourceAbility(blade, KNIFE_RESOURCE)] }),
    );
    expect(faces(state)).toEqual([true, false]);
    expect(inst(state, blade).exhausted).toBe(true);
  });
  it("declining the flip leaves the Knife as it was", () => {
    const base = heroGame();
    const given = moveToHand(base, P1, "41008");
    const [regimen] = given.ids as [InstanceId];
    const blade = bladesOf(given.state)[0]!;
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseCards" ? [] : firstLegal(s)),
      play(P1, regimen, [], { abilities: [resourceAbility(blade, KNIFE_RESOURCE)] }),
    );
    expect(faces(state)).toEqual([false, false]);
    expect(inst(state, blade).exhausted).toBe(true);
  });
  it("a Katana can be flipped back to a Psi-Knife as its resource is used", () => {
    const base = flipAll(heroGame());
    const given = moveToHand(base, P1, "41008");
    const [regimen] = given.ids as [InstanceId];
    const blade = bladesOf(given.state)[1]!;
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      (s) => (s.pendingChoice?.prompt.kind === "chooseCards" ? [blade] : firstLegal(s)),
      play(P1, regimen, [], { abilities: [resourceAbility(blade, KATANA_RESOURCE)] }),
    );
    expect(faces(state)).toEqual([true, false]);
  });
  describe("with Body Swapped (41025) in play: 'You cannot flip your Psi-Katana upgrades'", () => {
    /** The obligation moved from the encounter deck into her play area, faceup (surgery: no reveal). */
    const bodySwapped = (s: GameState): GameState => {
      const id = instancesOf(s, "41025")[0]!;
      const encounterDecks = Object.fromEntries(
        Object.entries(s.encounterDecks).map(([deckId, piles]) => [
          deckId,
          { ...piles, deck: piles.deck.filter((x) => x !== id) },
        ]),
      ) as GameState["encounterDecks"];
      const moved: GameState = {
        ...s,
        encounterDecks,
        players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      };
      return patchInstance(moved, id, { faceup: true });
    };
    /** Accepts every "you may flip" it is asked, recording each card choice's candidates. */
    const accepting =
      (asked: string[][]): Picker =>
      (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind !== "chooseCards") return firstLegal(s);
        asked.push(choice.options.map((o) => o.optionId));
        return choice.options.slice(0, 1).map((o) => o.optionId);
      };

    it("a Psi-Katana that cannot flip does not offer its flip: it pays [physical], exhausts and stays a Katana", () => {
      const given = moveToHand(bodySwapped(flipAll(heroGame())), P1, "41008");
      const [regimen] = given.ids as [InstanceId];
      const blade = bladesOf(given.state)[0]!;
      const asked: string[][] = [];
      const { events, state } = driveEventsPicking(
        WAVE7_DEPS,
        given.state,
        accepting(asked),
        play(P1, regimen, [], { abilities: [resourceAbility(blade, KATANA_RESOURCE)] }),
      );
      expect(asked.filter((candidates) => candidates.includes(blade))).toEqual([]);
      expect(faces(state)).toEqual([true, true]);
      expect(inst(state, blade).exhausted).toBe(true);
      expect(events.filter((e) => e.type === "flipBlocked")).toEqual([]);
      const generated = events.filter((e) => e.type === "resourcesGenerated");
      expect(generated.map((e) => e.type === "resourcesGenerated" && e.pool)).toMatchObject([
        { physical: 1, mental: 0 },
      ]);
    });

    it("a Psi-Knife still may flip: asked, and accepting turns it into a Psi-Katana", () => {
      const given = moveToHand(bodySwapped(heroGame()), P1, "41008");
      const [regimen] = given.ids as [InstanceId];
      const blade = bladesOf(given.state)[0]!;
      const asked: string[][] = [];
      const { state } = driveEventsPicking(
        WAVE7_DEPS,
        given.state,
        accepting(asked),
        play(P1, regimen, [], { abilities: [resourceAbility(blade, KNIFE_RESOURCE)] }),
      );
      expect(asked[0]).toEqual([blade]);
      expect(faces(state)).toEqual([true, false]);
      expect(inst(state, blade).exhausted).toBe(true);
    });
  });
  it("it is a Hero Resource: in alter-ego form a blade cannot pay", () => {
    const base = alterEgoGame();
    const given = moveToHand(base, P1, "41008");
    const [regimen] = given.ids as [InstanceId];
    const blade = bladesOf(given.state)[0]!;
    expect(rejected(given.state, play(P1, regimen, [], { abilities: [resourceAbility(blade, KNIFE_RESOURCE)] }))).toBe(
      true,
    );
  });
  it("an exhausted blade cannot pay again", () => {
    const base = heroGame();
    const blade = bladesOf(base)[0]!;
    const given = moveToHand(patchInstance(base, blade, { exhausted: true }), P1, "41008");
    const [regimen] = given.ids as [InstanceId];
    expect(rejected(given.state, play(P1, regimen, [], { abilities: [resourceAbility(blade, KNIFE_RESOURCE)] }))).toBe(
      true,
    );
  });
});

describe("The restricted limit and the Psi-Katana (Q38 = A, Q52 = B)", () => {
  it("two Katanas are two restricted cards, the limit exactly: nothing is discarded", () => {
    const s = flipAll(heroGame());
    expect(restrictedIn(s)).toEqual(bladesOf(s));
  });
  it("flipping a blade to a Katana beside one Katana and a restricted upgrade discards that upgrade, never a blade", () => {
    const base = heroGame();
    const first = patchInstance(base, bladesOf(base)[0]!, { flipped: true });
    // Plasma Rifle (40011, restricted) is Cable's; here it stands for any restricted upgrade, attached by surgery.
    const rifle = attachedRestricted(first);
    expect(restrictedIn(rifle.state)).toHaveLength(2);
    const flipOther = (): Picker => (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "discardRestricted") return [rifle.id];
      if (c?.prompt.kind === "chooseTriggers")
        return c.options.filter((o) => o.optionId.includes(CONTROL)).map((o) => o.optionId);
      if (c?.prompt.kind === "chooseCards") {
        const hit = c.options.find((o) => o.optionId === bladesOf(st)[1]);
        if (hit) return [hit.optionId];
      }
      return firstLegal(st);
    };
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      rifle.state,
      flipOther(),
      basicAttack(rifle.state, stryfe(rifle.state)),
    );
    expect(faces(state)).toEqual([true, true]);
    expect(playerOf(state, P1).discard).toContain(rifle.id);
    expect(restrictedIn(state)).toEqual(bladesOf(state));
  });
});

/** A restricted ordinary upgrade (Plasma Rifle 40011), in Psylocke's play area by surgery. */
function attachedRestricted(state: GameState): { state: GameState; id: InstanceId } {
  const id = "i9100" as InstanceId;
  const identity = identityOf(state);
  const base = inst(state, bladesOf(state)[0]!);
  const instance = {
    ...base,
    instanceId: id,
    cardId: "40011" as never,
    flipped: false,
    exhausted: false,
    attachedTo: identity,
    attachments: [],
  };
  const withInstance = {
    ...state,
    instances: {
      ...state.instances,
      [id]: instance,
      [identity]: { ...inst(state, identity), attachments: [...inst(state, identity).attachments, id] },
    },
  } as GameState;
  return { state: withInstance, id };
}

/** A minion by surgery: `code` engaged with `player` in their play area. */
function withMinion(
  state: GameState,
  code: string,
  opts: { player?: typeof P1; damage?: number; confused?: boolean } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const id = `i9${300 + Object.keys(state.instances).length}` as InstanceId;
  const instance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: opts.damage ?? 0,
    threat: 0,
    statuses: { stunned: 0, confused: opts.confused ? 1 : 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: player,
    flipped: false,
  } as unknown as CardInstance;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: instance },
    },
  };
}
/** No side scheme in play (Stryfe's setup leaves one with a crisis icon, which blocks thwarting the main scheme). */
const withoutSideSchemes = (s: GameState, mainThreat = 6): GameState =>
  patchInstance({ ...s, villainArea: [] }, s.mainScheme.instanceId, { threat: mainThreat });
/** Answers the first `chooseTarget` with `id` when it is offered; everything else is `firstLegal`. */
const targeting =
  (id: InstanceId): Picker =>
  (st) =>
    st.pendingChoice?.prompt.kind === "chooseTarget" && st.pendingChoice.options.some((o) => o.optionId === id)
      ? [id]
      : firstLegal(st);
const HYDRA_MERCENARY = "01101"; // ATK 1, 3 hit points, Guard
const ZERO = "40174"; // Guard, Patrol, Toughness (a Stryfe minion)

describe("Angel (41003)", () => {
  it("after you play him from your hand, ready your identity", () => {
    const base = patchInstance(heroGame(), identityOf(heroGame()), { exhausted: true });
    const { state } = put(base, "41003", 3, { pick: accepting(ANGEL) });
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(playerOf(state, P1).playArea).toContain(instancesOf(state, "41003")[0]);
  });
  it("it is optional: declined, she stays exhausted", () => {
    const base = patchInstance(heroGame(), identityOf(heroGame()), { exhausted: true });
    const { state } = put(base, "41003", 3, { pick: accepting() });
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("works in alter-ego form as well (a plain Response)", () => {
    const base = alterEgoGame();
    const { state } = put(patchInstance(base, identityOf(base), { exhausted: true }), "41003", 3, {
      pick: accepting(ANGEL),
    });
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("two players: only the controller's identity is readied, not Spider-Man's", () => {
    const base = heroGame([PSYLOCKE, SPIDER_MAN]);
    const tired = patchInstance(patchInstance(base, identityOf(base, P1), { exhausted: true }), identityOf(base, P2), {
      exhausted: true,
    });
    const { state } = put(tired, "41003", 3, { pick: accepting(ANGEL) });
    expect(inst(state, identityOf(state, P1)).exhausted).toBe(false);
    expect(inst(state, identityOf(state, P2)).exhausted).toBe(true);
  });
});

describe("Training Regimen (41008)", () => {
  it("hero form: exhaust, search the deck for a SKILL card, add it to hand, then discard 1 card from hand", () => {
    const base = heroGame();
    const { state: s, id } = put(base, "41008", 1);
    const before = s;
    const { state } = driveEventsPicking(WAVE7_DEPS, s, choosing("41010"), use(P1, id, REGIMEN));
    expect(inst(state, id).exhausted).toBe(true);
    expect(handOf(state).map((x) => codeOf(state, x))).toContain("41010");
    expect(deckCodes(state)).toHaveLength(deckCodes(before).length - 1);
    // +1 searched, -1 discarded.
    expect(handOf(state)).toHaveLength(handOf(before).length);
    expect(playerOf(state, P1).discard).toHaveLength(playerOf(before, P1).discard.length + 1);
  });
  it("alter-ego form: the search only, no discard", () => {
    const base = alterEgoGame();
    const { state: s, id } = put(base, "41008", 1);
    const { state } = driveEventsPicking(WAVE7_DEPS, s, choosing("41011"), use(P1, id, REGIMEN));
    expect(handOf(state)).toHaveLength(handOf(s).length + 1);
    expect(handOf(state).map((x) => codeOf(state, x))).toContain("41011");
    expect(playerOf(state, P1).discard).toHaveLength(playerOf(s, P1).discard.length);
  });
  it("the candidates are SKILL cards only (the three trainings and Upside the Head, Float, Directed Force ...)", () => {
    const { state: s, id } = put(heroGame(), "41008", 1);
    let offered: string[] = [];
    driveEventsPicking(
      WAVE7_DEPS,
      s,
      (st) => {
        if (st.pendingChoice?.prompt.kind === "chooseCards")
          offered = st.pendingChoice.options.map((o) => codeOf(st, o.optionId as InstanceId));
        return firstLegal(st);
      },
      use(P1, id, REGIMEN),
    );
    expect(offered.length).toBeGreaterThan(0);
    for (const code of offered) expect(["41009", "41010", "41011", "41015", "41017", "41019"], code).toContain(code);
  });
  it("may find nothing: declining the search still discards in hero form", () => {
    const { state: s, id } = put(heroGame(), "41008", 1);
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      s,
      (st) =>
        st.pendingChoice?.prompt.kind === "chooseCards" && st.pendingChoice.minSelections === 0 ? [] : firstLegal(st),
      use(P1, id, REGIMEN),
    );
    expect(handOf(state)).toHaveLength(handOf(s).length - 1);
  });
  it("is exhausted after use, so it cannot be used twice", () => {
    const { state: s, id } = put(heroGame(), "41008", 1);
    const once = driveEventsPicking(WAVE7_DEPS, s, firstLegal, use(P1, id, REGIMEN)).state;
    expect(rejected(once, use(P1, id, REGIMEN))).toBe(true);
  });
});

describe("Martial Arts Training (41009)", () => {
  it("Psylocke gets +1 DEF (2 -> 3)", () => {
    const { state } = attached(heroGame(), "41009");
    expect(profileOf(state).def).toBe(3);
  });
  it("is attached to her identity when played (cost 1)", () => {
    const { state, id } = put(heroGame(), "41009", 1, { attach: identityOf(heroGame()) });
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
});

describe("Psionic Training (41010)", () => {
  it("ignores the guard keyword: with Zero (Guard, Patrol) engaged she may still attack Stryfe", () => {
    const base = heroGame();
    const zero = withMinion(base, ZERO);
    expect(rejected(zero.state, basicAttack(zero.state, stryfe(zero.state)))).toBe(true);
    const { state } = attached(zero.state, "41010");
    expect(rejected(state, basicAttack(state, stryfe(state)))).toBe(false);
  });
  it("ignores the patrol keyword: with Zero engaged she may thwart the main scheme", () => {
    const base = withoutSideSchemes(heroGame());
    const zero = withMinion(base, ZERO);
    const main = zero.state.mainScheme.instanceId;
    expect(rejected(zero.state, basicThwart(zero.state, main))).toBe(true);
    const { state } = attached(zero.state, "41010");
    expect(rejected(state, basicThwart(state, main))).toBe(false);
  });
  it("After she thwarts, discard it: confuse an enemy (the first option, the villain)", () => {
    const base = attached(heroGame(), "41010");
    const staged = encounterCardInVillainArea(base.state, BREAKIN, 3);
    const { state, offered } = driveOffers(
      staged.state,
      accepting(PSIONIC_RESPONSE),
      basicThwart(staged.state, staged.id),
    );
    expect(hasOffer(offered, PSIONIC_RESPONSE)).toBe(true);
    expect(playerOf(state, P1).discard).toContain(base.id);
    const confused = [stryfe(state), ...state.players.flatMap((p) => p.playArea)].filter(
      (id) => inst(state, id).statuses.confused > 0,
    );
    expect(confused).toHaveLength(1);
  });
  it("it can confuse a chosen minion instead of the villain", () => {
    const base = attached(heroGame(), "41010");
    const mercenary = withMinion(base.state, HYDRA_MERCENARY);
    const staged = encounterCardInVillainArea(mercenary.state, BREAKIN, 3);
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      staged.state,
      (st) => {
        const c = st.pendingChoice;
        if (c?.prompt.kind === "chooseTriggers") return [c.options[0]!.optionId];
        if (c?.prompt.kind === "chooseTarget" && c.options.some((o) => o.optionId === mercenary.id))
          return [mercenary.id];
        return firstLegal(st);
      },
      basicThwart(staged.state, staged.id),
    );
    expect(inst(state, mercenary.id).statuses.confused).toBe(1);
    expect(inst(state, stryfe(state)).statuses.confused).toBe(0);
  });
  it("is not offered after an ally's thwart (it is Psylocke's)", () => {
    const base = attached(heroGame(), "41010");
    const cypher = put(base.state, "41013", 2);
    const staged = encounterCardInVillainArea(cypher.state, BREAKIN, 3);
    const { offered } = driveOffers(
      staged.state,
      accepting(PSIONIC_RESPONSE),
      basicThwart(staged.state, staged.id, cypher.id),
    );
    expect(hasOffer(offered, PSIONIC_RESPONSE)).toBe(false);
  });
});

describe("Weapons Training (41011)", () => {
  it("Psylocke gains retaliate 1", () => {
    const base = heroGame();
    expect(keywordTotal(base, identityOf(base), "retaliate", WAVE7_DEPS)).toBe(0);
    const { state } = attached(base, "41011");
    expect(keywordTotal(state, identityOf(state), "retaliate", WAVE7_DEPS)).toBe(1);
  });
  it("After she attacks, discard it: ready each WEAPON upgrade you control (both exhausted blades)", () => {
    const base = attached(heroGame(), "41011");
    const tired = bladesOf(base.state).reduce((acc, id) => patchInstance(acc, id, { exhausted: true }), base.state);
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      tired,
      accepting(WEAPONS_RESPONSE),
      basicAttack(tired, stryfe(tired)),
    );
    expect(bladesOf(state).map((id) => inst(state, id).exhausted)).toEqual([false, false]);
    expect(playerOf(state, P1).discard).toContain(base.id);
  });
  it("it readies WEAPON upgrades only: a non-WEAPON exhausted upgrade (Martial Arts) stays exhausted", () => {
    const withMartial = attached(attached(heroGame(), "41011").state, "41009");
    const tired = patchInstance(withMartial.state, withMartial.id, { exhausted: true });
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      tired,
      accepting(WEAPONS_RESPONSE),
      basicAttack(tired, stryfe(tired)),
    );
    expect(inst(state, withMartial.id).exhausted).toBe(true);
  });
  it("declined, the upgrade stays and nothing is readied", () => {
    const base = attached(heroGame(), "41011");
    const tired = bladesOf(base.state).reduce((acc, id) => patchInstance(acc, id, { exhausted: true }), base.state);
    const { state } = driveEventsPicking(WAVE7_DEPS, tired, accepting(), basicAttack(tired, stryfe(tired)));
    expect(bladesOf(state).map((id) => inst(state, id).exhausted)).toEqual([true, true]);
    expect(inst(state, base.id).attachedTo).toBe(identityOf(state));
  });
});

describe("Captain Britain (41012)", () => {
  const britain = (state: GameState) => put(state, "41012", 4);
  it("attacks a minion: consequential damage 2 - 1 = 1", () => {
    const { state: s, id } = britain(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY);
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, basicAttack(m.state, m.id, id));
    expect(inst(state, id).damage).toBe(1);
  });
  it("attacks the villain: the full 2 consequential damage", () => {
    const { state: s, id } = britain(heroGame());
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, basicAttack(s, stryfe(s), id));
    expect(inst(state, id).damage).toBe(2);
  });
  it("thwarts a side scheme: consequential damage 1, even when the thwart defeats it", () => {
    const { state: s, id } = britain(heroGame());
    const staged = encounterCardInVillainArea(s, BREAKIN, 3);
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      staged.state,
      firstLegal,
      basicThwart(staged.state, staged.id, id),
    );
    expect(inst(state, id).damage).toBe(1);
  });
  it("thwarts the main scheme: the full 2", () => {
    const { state: s0, id } = britain(heroGame());
    const s = withoutSideSchemes(s0);
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, basicThwart(s, s.mainScheme.instanceId, id));
    expect(inst(state, id).damage).toBe(2);
  });
  it("two players: another player's ally takes the full consequential damage on the same attack (Cypher 1)", () => {
    const base = heroGame([PSYLOCKE, SPIDER_MAN]);
    const { state: s, id } = britain(base);
    const m = withMinion(s, HYDRA_MERCENARY);
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, basicAttack(m.state, m.id, id));
    expect(inst(state, id).damage).toBe(1);
    // Spider-Man's own identity is no ally of his and takes nothing from a scheme/attack he makes (not Britain's rule).
    expect(inst(state, identityOf(state, P2)).damage).toBe(0);
  });
});

describe("Cypher (41013)", () => {
  const cypher = (state: GameState) => put(state, "41013", 2);
  it("after he attacks and damages a confused enemy, draw 1 card", () => {
    const { state: s, id } = cypher(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY, { confused: true });
    const { state, offered } = driveOffers(m.state, accepting(CYPHER), basicAttack(m.state, m.id, id));
    expect(hasOffer(offered, CYPHER)).toBe(true);
    expect(handOf(state)).toHaveLength(handOf(m.state).length + 1);
    expect(inst(state, m.id).damage).toBe(1);
  });
  it("an enemy that is not confused: not offered", () => {
    const { state: s, id } = cypher(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY);
    const { state, offered } = driveOffers(m.state, accepting(CYPHER), basicAttack(m.state, m.id, id));
    expect(hasOffer(offered, CYPHER)).toBe(false);
    expect(handOf(state)).toHaveLength(handOf(m.state).length);
  });
  // ENGINE GAP (reported): an attack response reads the target's status as the response window opens, and a defeated
  // enemy has left play with its status cards. No `EventPattern` field carries the target's statuses as the attack
  // began (only `targetHadAttachment`, for a defeat). Rules question: Q-Cypher in the report.
  it.fails("a confused enemy he defeats still counts (it was confused as he hit it)", () => {
    const { state: s, id } = cypher(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY, { confused: true, damage: 2 });
    const { state, offered } = driveOffers(m.state, accepting(CYPHER), basicAttack(m.state, m.id, id));
    expect(hasOffer(offered, CYPHER)).toBe(true);
    expect(handOf(state)).toHaveLength(handOf(m.state).length + 1);
  });
  it("no damage, no card: a confused minion with a tough status takes none", () => {
    const { state: s, id } = cypher(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY, { confused: true });
    const tough = patchInstance(m.state, m.id, { statuses: { stunned: 0, confused: 1, tough: 1 } });
    const { offered } = driveOffers(tough, accepting(CYPHER), basicAttack(tough, m.id, id));
    expect(hasOffer(offered, CYPHER)).toBe(false);
  });
  it("another character's attack on a confused enemy does not draw (it is Cypher's own)", () => {
    const { state: s } = cypher(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY, { confused: true });
    const { offered } = driveOffers(m.state, accepting(CYPHER), basicAttack(m.state, m.id));
    expect(hasOffer(offered, CYPHER)).toBe(false);
  });
  it("two players: the controller draws, not the other player", () => {
    const base = heroGame([PSYLOCKE, SPIDER_MAN]);
    const { state: s, id } = cypher(base);
    const m = withMinion(s, HYDRA_MERCENARY, { confused: true });
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, accepting(CYPHER), basicAttack(m.state, m.id, id));
    expect(handOf(state, P1)).toHaveLength(handOf(m.state, P1).length + 1);
    expect(handOf(state, P2)).toHaveLength(handOf(m.state, P2).length);
  });
});

describe("Pete Wisdom (41018)", () => {
  const wisdom = (state: GameState) => {
    const put1 = put(state, "41018", 4);
    return { state: withDamage(put1.state, put1.id, 2), id: put1.id };
  };
  it("after you resolve a treachery's When Revealed, heal 1 damage from him", () => {
    const { state: s, id } = wisdom(heroGame());
    const stacked = stackEncounterDeck(s, "01186", "01186");
    const { state, offered } = driveOffers(stacked, accepting(WISDOM), endTurn(P1));
    expect(hasOffer(offered, WISDOM)).toBe(true);
    expect(inst(state, id).damage).toBe(1);
  });
  it("a card that is not a treachery (a minion) does not trigger it", () => {
    const { state: s, id } = wisdom(heroGame());
    const stacked = stackEncounterDeck(s, "40173", "40174");
    const { state, offered } = driveOffers(stacked, accepting(WISDOM), endTurn(P1));
    expect(hasOffer(offered, WISDOM)).toBe(false);
    expect(inst(state, id).damage).toBe(2);
  });
  it("declined, he is not healed", () => {
    const { state: s, id } = wisdom(heroGame());
    const stacked = stackEncounterDeck(s, "01186", "01186");
    const { state } = driveEventsPicking(WAVE7_DEPS, stacked, accepting(), endTurn(P1));
    expect(inst(state, id).damage).toBe(2);
  });
  it("two players: a treachery the other player resolves does not heal him", () => {
    const { state: s, id } = wisdom(heroGame([PSYLOCKE, SPIDER_MAN]));
    // The villain activates against each player first (two boost cards), then the cards are dealt in player order:
    // Psylocke's is a minion, Spider-Man's the treachery.
    const stacked = stackEncounterDeck(s, "40173", "40173", "40174", "01186");
    const { state, offered } = driveOffers(stacked, accepting(WISDOM), endTurn(P1), endTurn(P2));
    expect(hasOffer(offered, WISDOM)).toBe(false);
    expect(inst(state, id).damage).toBe(2);
  });
});

describe("IPAC (41022)", () => {
  const ipac = (state: GameState) => put(state, "41022", 1);
  it("exhaust: deal 1 facedown encounter card to a player, who draws 2 cards", () => {
    const { state: s, id } = ipac(heroGame());
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, use(P1, id, IPAC));
    expect(inst(state, id).exhausted).toBe(true);
    expect(handOf(state)).toHaveLength(handOf(s).length + 2);
    expect(playerOf(state, P1).dealtEncounter).toHaveLength(playerOf(s, P1).dealtEncounter.length + 1);
  });
  it("two players: she may deal it to Spider-Man, who then draws the 2 cards", () => {
    const { state: s, id } = ipac(heroGame([PSYLOCKE, SPIDER_MAN]));
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      s,
      (st) => (st.pendingChoice?.prompt.kind === "choosePlayer" ? [P2] : firstLegal(st)),
      use(P1, id, IPAC),
    );
    expect(handOf(state, P2)).toHaveLength(handOf(s, P2).length + 2);
    expect(playerOf(state, P2).dealtEncounter).toHaveLength(playerOf(s, P2).dealtEncounter.length + 1);
    expect(handOf(state, P1)).toHaveLength(handOf(s, P1).length);
    expect(playerOf(state, P1).dealtEncounter).toHaveLength(playerOf(s, P1).dealtEncounter.length);
  });
  it("it is a hero action: refused in alter-ego form", () => {
    const { state: s, id } = ipac(heroGame());
    expect(rejected(withForm(s, "alterEgo"), use(P1, id, IPAC))).toBe(true);
  });
});

describe("X-Bunker (41023)", () => {
  /** `n` side schemes (encounter ones) moved to the victory display by surgery. */
  function withVictory(state: GameState, n: number): GameState {
    let s = state;
    if (n >= 1) {
      const staged = encounterCardInVillainArea(s, BREAKIN, 0);
      s = {
        ...staged.state,
        villainArea: staged.state.villainArea.filter((x) => x !== staged.id),
        victoryDisplay: [...staged.state.victoryDisplay, staged.id],
      };
    }
    if (n >= 2) {
      // Her own Lay the Trap (a player side scheme counts too), taken from the deck.
      const trap = moveToHand(s, P1, "41016").ids[0]!;
      s = {
        ...s,
        victoryDisplay: [...s.victoryDisplay, trap],
        players: s.players.map((p) =>
          p.playerId === P1
            ? {
                ...p,
                deck: p.deck.filter((x) => x !== trap),
                hand: p.hand.filter((x) => x !== trap),
                discard: p.discard.filter((x) => x !== trap),
              }
            : p,
        ),
      };
    }
    return s;
  }
  const bunker = (state: GameState) => put(state, "41023", 2);
  const topOf = (s: GameState, n: number, p = P1) => playerOf(s, p).deck.slice(0, n);

  it("a MUTANT identity (Betsy, alter-ego form) searches the top X cards, X the side schemes in the victory display", () => {
    const { state: s0, id } = bunker(alterEgoGame());
    const s = withVictory(s0, 1);
    const window = topOf(s, 1);
    let offered: InstanceId[] = [];
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      s,
      (st) => {
        if (st.pendingChoice?.prompt.kind === "chooseCards") {
          offered = st.pendingChoice.options.map((o) => o.optionId as InstanceId);
          return [offered[0]!];
        }
        return firstLegal(st);
      },
      use(P1, id, BUNKER),
    );
    expect(offered).toEqual(window);
    expect(handOf(state)).toContain(window[0]);
    expect(inst(state, id).exhausted).toBe(true);
    expect(playerOf(state, P1).deck).toHaveLength(playerOf(s, P1).deck.length - 1);
  });
  it("X = 2: the top two cards are the candidates", () => {
    const { state: s0, id } = bunker(alterEgoGame());
    const s = withVictory(s0, 2);
    let offered: InstanceId[] = [];
    driveEventsPicking(
      WAVE7_DEPS,
      s,
      (st) => {
        if (st.pendingChoice?.prompt.kind === "chooseCards")
          offered = st.pendingChoice.options.map((o) => o.optionId as InstanceId);
        return firstLegal(st);
      },
      use(P1, id, BUNKER),
    );
    expect(offered).toEqual(topOf(s, 2));
  });
  it("X = 0: nothing to search, no card is added (the support is still exhausted)", () => {
    const { state: s, id } = bunker(alterEgoGame());
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, use(P1, id, BUNKER));
    expect(handOf(state)).toHaveLength(handOf(s).length);
  });
  it("hero form Psylocke (PSIONIC, X-FORCE) has no MUTANT identity: nobody can be chosen, so it cannot be used", () => {
    const { state: s, id } = bunker(heroGame());
    expect(rejected(withVictory(s, 1), use(P1, id, BUNKER))).toBe(true);
  });
  it("two players: Spider-Man (not MUTANT) is not eligible; only Betsy searches", () => {
    const { state: s0, id } = bunker(alterEgoGame([PSYLOCKE, SPIDER_MAN]));
    const s = withVictory(s0, 1);
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      s,
      (st) =>
        st.pendingChoice?.prompt.kind === "chooseCards" ? [st.pendingChoice.options[0]!.optionId] : firstLegal(st),
      use(P1, id, BUNKER),
    );
    expect(handOf(state, P1)).toHaveLength(handOf(s, P1).length + 1);
    expect(handOf(state, P2)).toHaveLength(handOf(s, P2).length);
  });
});

describe("Float Like a Butterfly (41017)", () => {
  const withFloat = (state: GameState) => put(state, "41017", 2, { attach: identityOf(state) });
  it("when a character you control attacks a confused enemy, that attack deals 1 more damage", () => {
    const { state: s } = withFloat(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY, { confused: true });
    const { state, offered } = driveOffers(m.state, accepting(BUTTERFLY), basicAttack(m.state, m.id));
    expect(hasOffer(offered, BUTTERFLY)).toBe(true);
    expect(inst(state, m.id).damage).toBe(2); // ATK 1 + 1
  });
  it("not offered against an enemy that is not confused", () => {
    const { state: s } = withFloat(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY);
    const { state, offered } = driveOffers(m.state, accepting(BUTTERFLY), basicAttack(m.state, m.id));
    expect(hasOffer(offered, BUTTERFLY)).toBe(false);
    expect(inst(state, m.id).damage).toBe(1);
  });
  it("it is optional: declined, the damage is unchanged", () => {
    const { state: s } = withFloat(heroGame());
    const m = withMinion(s, HYDRA_MERCENARY, { confused: true });
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, accepting(), basicAttack(m.state, m.id));
    expect(inst(state, m.id).damage).toBe(1);
  });
  it("an ally she controls counts (Cypher attacks a confused minion: 1 + 1)", () => {
    const { state: s } = withFloat(heroGame());
    const cypher = put(s, "41013", 2);
    const m = withMinion(cypher.state, HYDRA_MERCENARY, { confused: true });
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      m.state,
      accepting(BUTTERFLY),
      basicAttack(m.state, m.id, cypher.id),
    );
    expect(inst(state, m.id).damage).toBe(2);
  });
  it("Max 1 per player: a second copy under her control is refused", () => {
    const { state: s } = withFloat(heroGame());
    const given = moveToHand(s, P1, "41017");
    const [second] = given.ids as [InstanceId];
    expect(
      rejected(
        given.state,
        play(P1, second, payWith(given.state, P1, 2, [second]), { attachToInstanceId: identityOf(s) }),
      ),
    ).toBe(true);
  });
  it("two players: played under Spider-Man's control, it is his character's attack on a confused enemy that gains the damage", () => {
    const base = heroGame([PSYLOCKE, SPIDER_MAN]);
    const withSpider = withForm(base, { heroForm: 0 }, P2);
    const given = moveToHand(withSpider, P1, "41017");
    const [float] = given.ids as [InstanceId];
    const played = driveEventsPicking(WAVE7_DEPS, given.state, firstLegal, {
      ...(play(P1, float, payWith(given.state, P1, 2, [float])) as Extract<Command, { type: "playCard" }>),
      controllerId: P2,
    }).state;
    expect(inst(played, float).attachedTo).toBe(identityOf(played, P2));
    const m0 = withMinion(played, HYDRA_MERCENARY, { confused: true, player: P2 });
    const m = { ...m0, state: { ...m0.state, step: { ...m0.state.step, activePlayerId: P2 } } as GameState };
    const { state, offered } = driveOffers(
      m.state,
      accepting(BUTTERFLY),
      basicAttack(m.state, m.id, identityOf(m.state, P2), P2),
    );
    expect(hasOffer(offered, BUTTERFLY)).toBe(true);
    expect(inst(m.state, m.id).damage).toBe(0);
    // Spider-Man's ATK 2 would leave the 3-hit-point Hydra Mercenary alive; with the upgrade's +1 it is defeated.
    expect(characterProfile(m.state, identityOf(m.state, P2), WAVE7_DEPS)!.atk).toBe(2);
    expect(playerOf(state, P2).playArea).not.toContain(m.id);
  });
});

describe("Lay the Trap (41016)", () => {
  const trap = (state: GameState) => {
    const given = moveToHand(state, P1, "41016");
    const [id] = given.ids as [InstanceId];
    const played = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      firstLegal,
      play(P1, id, payWith(given.state, P1, 1, [id])),
    );
    return { state: played.state, id };
  };
  it("is a player side scheme with 3 threat per player; defeated, the defeating player deals 5 damage per player to the villain", () => {
    const { state: s, id } = trap(heroGame());
    expect(s.villainArea).toContain(id);
    expect(inst(s, id).threat).toBe(3);
    const lowered = patchInstance(s, id, { threat: 1 });
    const { state } = driveEventsPicking(WAVE7_DEPS, lowered, firstLegal, basicThwart(lowered, id));
    expect(inst(state, stryfe(state)).damage).toBe(5);
    expect(state.victoryDisplay).toContain(id);
  });
  it("two players: 6 threat, 10 damage to the villain, and the one who defeated it is the thwarter", () => {
    const { state: s, id } = trap(heroGame([PSYLOCKE, SPIDER_MAN]));
    expect(inst(s, id).threat).toBe(6);
    const lowered = patchInstance(
      { ...withForm(s, { heroForm: 0 }, P2), step: { ...s.step, activePlayerId: P2 } } as GameState,
      id,
      { threat: 1 },
    );
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      lowered,
      firstLegal,
      basicThwart(lowered, id, identityOf(lowered, P2), P2),
    );
    expect(inst(state, stryfe(state)).damage).toBe(10);
  });
  it("not defeated, nothing happens to the villain", () => {
    const { state: s0, id } = trap(heroGame());
    const s = patchInstance(s0, id, { threat: 5 });
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, basicThwart(s, id));
    expect(inst(state, id).threat).toBe(2);
    expect(inst(state, stryfe(state)).damage).toBe(0);
  });
});

describe("Telepathy (41024)", () => {
  const withTelepathy = (state: GameState) => attached(state, "41024");
  const payBoth = (s: GameState, id: InstanceId) => {
    const [k1, k2] = bladesOf(s) as [InstanceId, InstanceId];
    return use(P1, id, TELEPATHY, [resourceAbility(k1, KNIFE_RESOURCE), resourceAbility(k2, KNIFE_RESOURCE)]);
  };
  it("exhaust it and spend [mental][mental] (two Knives): remove 2 threat from a scheme", () => {
    const { state: s0, id } = withTelepathy(heroGame());
    const staged = encounterCardInVillainArea(s0, BREAKIN, 3);
    const { state } = driveEventsPicking(WAVE7_DEPS, staged.state, targeting(staged.id), payBoth(staged.state, id));
    expect(inst(state, staged.id).threat).toBe(1);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("it is a thwart: Psylocke's thwart responses hear it (Psionic Training's confuse is offered)", () => {
    const withTraining = attached(withTelepathy(heroGame()).state, "41010");
    const telepathy = instancesOf(withTraining.state, "41024")[0]!;
    const staged = encounterCardInVillainArea(withTraining.state, BREAKIN, 3);
    const { offered } = driveOffers(staged.state, accepting(PSIONIC_RESPONSE), payBoth(staged.state, telepathy));
    expect(hasOffer(offered, PSIONIC_RESPONSE)).toBe(true);
  });
  it("can also take threat off the main scheme", () => {
    const { state: s0, id } = withTelepathy(heroGame());
    const s = withoutSideSchemes(s0, 6);
    const main = s.mainScheme.instanceId;
    const { state } = driveEventsPicking(WAVE7_DEPS, s, targeting(main), payBoth(s, id));
    expect(inst(state, main).threat).toBe(4);
  });
  it("one [mental] is not enough", () => {
    const { state: s, id } = withTelepathy(heroGame());
    const [k1] = bladesOf(s) as [InstanceId];
    expect(rejected(s, use(P1, id, TELEPATHY, [resourceAbility(k1, KNIFE_RESOURCE)]))).toBe(true);
  });
  it("it is a hero action: refused in alter-ego form", () => {
    const { state: s, id } = withTelepathy(alterEgoGame());
    expect(rejected(s, payBoth(s, id))).toBe(true);
  });
  it("an exhausted Telepathy cannot be used again", () => {
    const { state: s, id } = withTelepathy(patchInstance(heroGame(), identityOf(heroGame()), {}));
    const tired = patchInstance(s, id, { exhausted: true });
    expect(rejected(tired, payBoth(tired, id))).toBe(true);
  });
});

describe("The Power of the Mind (41021)", () => {
  it("while paying for a PSIONIC card its [mental] counts double: Flurry of Blades (3) paid with it and 1 other card", () => {
    const given = moveToHand(heroGame(), P1, "41004", "41021", "41009");
    const [flurry, mind, other] = given.ids as [InstanceId, InstanceId, InstanceId];
    expect(applyCommand(given.state, play(P1, flurry, [mind, other]), WAVE7_DEPS).ok).toBe(true);
  });
  it("not doubled for a card that is not PSIONIC: Angel (3) cannot be paid with it and 1 other card", () => {
    const given = moveToHand(heroGame(), P1, "41003", "41021", "41009");
    const [angel, mind, other] = given.ids as [InstanceId, InstanceId, InstanceId];
    expect(rejected(given.state, play(P1, angel, [mind, other]))).toBe(true);
    const three = moveToHand(given.state, P1, "41010");
    expect(rejected(three.state, play(P1, angel, [mind, other, three.ids[0]!]))).toBe(false);
  });
});
