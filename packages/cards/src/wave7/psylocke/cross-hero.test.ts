import {
  activeVillain,
  applyCommand,
  characterProfile,
  legalActions,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { playFromAnotherHerosDeck } from "../../testing/cross-hero.js";
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
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  use,
} from "../../testing/harness.js";
import {
  accepting,
  acceptingAndPicking,
  basicAttackCmd,
  basicThwartCmd,
  BLACK_PANTHER,
  CAPTAIN_MARVEL,
  codesOf,
  conjureInHand,
  crossHeroGame,
  drive,
  iconCards,
  openedCrossHero,
  openedHero,
  printedCost,
  SHE_HULK,
  spawnMinion,
  spawnSideScheme,
  spawnVictorySideScheme,
  wasOffered,
  withoutSideSchemes,
} from "../cross-hero-testing.js";
import { WAVE7_CARDS, WAVE7_DEPS, wave7StarterDeckSetup } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` step 4b) for the
 * psylocke pack's aspect and basic cards: 41012-41019, 41021-41024, 41030-41033 (16 cards; 41020 Soaring Hearts is a
 * Team-Up card and is out of this slice). Each is played from a Core hero's deck (Spider-Man for Justice and basic,
 * Captain Marvel for Leadership, She-Hulk for Aggression, Black Panther for Protection) in a Morlock Siege game
 * (Blockbuster, villain ATK 2), through `wave7Scenario` and the wave 7 deps. No Core identity has PSIONIC, X-FORCE or
 * MUTANT, so a gated card is asserted twice: refused for the plain Core hero (RRG 1.8 "Play Restrictions" /
 * "Restrictions", card text "Play only if ..."), and working once the Core identity carries the trait through an edited
 * card pool (`identityTraits`: the rules are untouched).
 */
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const dmg = (state: GameState, id: InstanceId): number => inst(state, id).damage;
const handIds = (state: GameState): readonly InstanceId[] => playerOf(state, P1).hand;
const inPlay = (state: GameState, id: InstanceId): boolean => playerOf(state, P1).playArea.includes(id);
const status = (state: GameState, id: InstanceId, name: "stunned" | "confused" | "tough"): number =>
  inst(state, id).statuses[name] ?? 0;

/** Plays `code` from hand (paying with other hand cards unless `pay` is given) and settles every prompt with `pick`. */
function cast(
  state: GameState,
  code: string,
  opts: { pay?: readonly InstanceId[]; pick?: ReturnType<typeof accepting>; attach?: InstanceId } = {},
) {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const pay = opts.pay ?? payWith(given.state, P1, printedCost(code), [id]);
  const run = drive(
    given.state,
    opts.pick ?? firstLegal,
    play(P1, id, pay, opts.attach ? { attachToInstanceId: opts.attach } : {}),
  );
  return { ...run, id };
}

/** The play of `code` is neither offered nor accepted by the engine. */
function expectRefused(state: GameState, code: string): void {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const actions = legalActions(given.state, P1, WAVE7_DEPS);
  expect(
    actions.kind === "turn" && actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id),
  ).toBe(false);
  expect(
    applyCommand(given.state, play(P1, id, payWith(given.state, P1, printedCost(code), [id])), WAVE7_DEPS).ok,
  ).toBe(false);
}

const PSIONIC = { identityTraits: ["PSIONIC"] } as const;
const XFORCE = { identityTraits: ["X-FORCE"] } as const;

describe("psylocke pack aspect and basic cards, from a Core hero's deck", () => {
  it("every one builds a legal Core deck and a game (one copy added to the Core precon)", () => {
    const codes = [
      "41012",
      "41013",
      "41014",
      "41015",
      "41016",
      "41017",
      "41018",
      "41019",
      "41021",
      "41022",
      "41023",
      "41024",
      "41030",
      "41031",
      "41032",
      "41033",
    ];
    expect(codes).toHaveLength(16);
    for (const code of codes) {
      const card = WAVE7_CARDS.find((c) => (c.id as string) === code)!;
      const aspect = "aspect" in card ? card.aspect : "basic";
      const hero =
        aspect === "leadership"
          ? CAPTAIN_MARVEL
          : aspect === "aggression"
            ? SHE_HULK
            : aspect === "protection"
              ? BLACK_PANTHER
              : undefined;
      const state = openedCrossHero(code, hero ? { coreHero: hero } : {});
      const all = [...playerOf(state, P1).hand, ...playerOf(state, P1).deck];
      expect(codesOf(state, all), code).toContain(code);
    }
  });

  describe("41012 Captain Britain (justice ally, -1 consequential damage per power)", () => {
    const britain = () => cast(openedHero("41012"), "41012");
    it("attacking a minion: takes 1 less than a plain ally attacking the same minion", () => {
      const { state: s, id } = britain();
      expect(inPlay(s, id)).toBe(true);
      // Hydra Soldier (01182): ATK 2, 4 hit points, so Britain (ATK 3) does not defeat it.
      const m = spawnMinion(s, { code: "01182" });
      expect(characterProfile(m.state, m.id, WAVE7_DEPS)!.atk).toBe(2);
      const run = drive(m.state, firstLegal, basicAttackCmd(m.state, m.id, id));
      expect(dmg(run.state, m.id)).toBe(3);
      expect(dmg(run.state, id)).toBe(1);
    });
    it("attacking the villain: the full consequential damage (the villain's ATK)", () => {
      const { state: s, id } = britain();
      const run = drive(s, firstLegal, basicAttackCmd(s, villainOf(s), id));
      expect(dmg(run.state, id)).toBe(characterProfile(s, villainOf(s), WAVE7_DEPS)!.atk);
    });
    it("thwarting a side scheme: 1 less; the main scheme: the full amount", () => {
      const { state: s, id } = britain();
      const side = spawnSideScheme(s, 3);
      const sideRun = drive(side.state, firstLegal, basicThwartCmd(side.state, side.id, id));
      const main = withoutSideSchemes(s, 6);
      const mainRun = drive(main, firstLegal, basicThwartCmd(main, main.mainScheme.instanceId, id));
      expect(dmg(mainRun.state, id)).toBeGreaterThan(0);
      expect(dmg(sideRun.state, id)).toBe(dmg(mainRun.state, id) - 1);
    });
  });

  describe("41013 Cypher (justice ally)", () => {
    it("after he attacks and damages a confused minion, draws 1; an unconfused one draws nothing", () => {
      const { state: s, id } = cast(openedHero("41013"), "41013");
      const confused = spawnMinion(s, { confused: true });
      const yes = drive(
        confused.state,
        accepting(["41013.cypher-response"]),
        basicAttackCmd(confused.state, confused.id, id),
      );
      expect(wasOffered(yes.offered, "41013.cypher-response")).toBe(true);
      expect(handIds(yes.state)).toHaveLength(handIds(confused.state).length + 1);
      const plain = spawnMinion(s);
      const no = drive(plain.state, accepting(["41013.cypher-response"]), basicAttackCmd(plain.state, plain.id, id));
      expect(wasOffered(no.offered, "41013.cypher-response")).toBe(false);
      expect(handIds(no.state)).toHaveLength(handIds(plain.state).length);
    });
  });

  describe("41014 Concussive Blow (justice event: confuse; 3 damage if paid with [physical])", () => {
    it("paid with [physical]: confuses the villain and deals 3", () => {
      const base = openedHero("41014");
      const given = moveToHand(base, P1, "41014");
      const phys = iconCards(given.state, "physical", 3, { only: true, exclude: given.ids });
      const { state } = cast(phys.state, "41014", { pay: phys.ids });
      expect(status(state, villainOf(state), "confused")).toBe(1);
      expect(dmg(state, villainOf(state))).toBe(3);
    });
    it("paid with no [physical] resource: confuses, deals no damage", () => {
      const base = openedHero("41014");
      const given = moveToHand(base, P1, "41014");
      const en = iconCards(given.state, "energy", 3, { only: true, exclude: given.ids });
      const { state } = cast(en.state, "41014", { pay: en.ids });
      expect(status(state, villainOf(state), "confused")).toBe(1);
      expect(dmg(state, villainOf(state))).toBe(0);
    });
  });

  describe("41015 Upside the Head (justice event response)", () => {
    const attackWith = (confused: boolean, take = true) => {
      const base = moveToHand(openedHero("41015"), P1, "41015").state;
      const m = spawnMinion(base, { confused });
      const run = drive(
        m.state,
        take ? accepting(["41015.upside-the-head-response"]) : accepting(["none"]),
        basicAttackCmd(m.state, m.id),
      );
      return { ...run, minion: m.id };
    };
    it("after the hero's basic attack damages an unconfused enemy: confuses it (the event is paid and discarded)", () => {
      const run = attackWith(false);
      expect(status(run.state, run.minion, "confused")).toBe(1);
      expect(status(run.state, run.minion, "stunned")).toBe(0);
      expect(codesOf(run.state, playerOf(run.state, P1).discard)).toContain("41015");
    });
    it("an already confused enemy is stunned instead", () => {
      const run = attackWith(true);
      expect(status(run.state, run.minion, "stunned")).toBe(1);
    });
    it("declined: no status, card stays in hand", () => {
      const run = attackWith(false, false);
      expect(status(run.state, run.minion, "confused")).toBe(0);
      expect(codesOf(run.state, handIds(run.state))).toContain("41015");
    });
  });

  describe("41016 Lay the Trap (justice player side scheme)", () => {
    it("defeated by its player's thwart: deals 5 damage (1 hero) to the villain", () => {
      const { state: s, id } = cast(openedHero("41016"), "41016");
      const ready = patchInstance(s, id, { threat: 1 });
      const run = drive(ready, firstLegal, basicThwartCmd(ready, id));
      expect(dmg(run.state, villainOf(run.state))).toBe(5);
    });
  });

  describe("41017 Float Like a Butterfly (justice upgrade)", () => {
    it("a confused enemy takes 1 additional damage from the hero's attack; an unconfused one does not", () => {
      const { state: s, id } = cast(openedHero("41017"), "41017");
      expect(inst(s, id).attachedTo).toBe(identityOf(s));
      const atk = characterProfile(s, identityOf(s), WAVE7_DEPS)!.atk;
      const confused = spawnMinion(s, { code: "01182", confused: true });
      const yes = drive(
        confused.state,
        accepting(["41017.float-like-a-butterfly-interrupt"]),
        basicAttackCmd(confused.state, confused.id),
      );
      expect(dmg(yes.state, confused.id)).toBe(atk + 1);
      const plain = spawnMinion(s, { code: "01182" });
      const no = drive(
        plain.state,
        accepting(["41017.float-like-a-butterfly-interrupt"]),
        basicAttackCmd(plain.state, plain.id),
      );
      expect(dmg(no.state, plain.id)).toBe(atk);
    });
  });

  describe("41018 Pete Wisdom (basic ally; play only if your identity has X-FORCE)", () => {
    it("refused for a Core hero without X-FORCE", () => {
      expectRefused(openedHero("41018"), "41018");
    });
    it("with an X-FORCE identity: plays, and after a treachery's When Revealed heals 1 from him", () => {
      const { state: s, id } = cast(openedHero("41018", XFORCE), "41018");
      expect(inPlay(s, id)).toBe(true);
      const hurt = patchInstance(s, id, { damage: 2 });
      const staged = stackEncounterDeck(hurt, "01186", "01186");
      const run = drive(staged, accepting(["41018.pete-wisdom-response"]), endTurn(P1));
      expect(wasOffered(run.offered, "41018.pete-wisdom-response")).toBe(true);
      expect(dmg(run.state, id)).toBe(1);
    });
  });

  describe("41019 Directed Force (basic event interrupt)", () => {
    it("adds 2 damage to a hero attack with overkill (Relentless Assault paid with [physical]): excess to the villain 2 -> 4", () => {
      const run = (take: boolean) => {
        const base = moveToHand(openedHero("41019", { coreHero: SHE_HULK }), P1, "41019").state;
        const m = spawnMinion(base);
        const phys = iconCards(m.state, "physical", 2, { only: true, exclude: [] });
        const asp = cast(phys.state, "01053", {
          pay: phys.ids,
          pick: acceptingAndPicking(take ? ["41019.directed-force-interrupt"] : ["none"], [m.id]),
        });
        return { ...asp, minion: m.id };
      };
      const without = run(false);
      const withIt = run(true);
      expect(dmg(withIt.state, villainOf(withIt.state)) - dmg(without.state, villainOf(without.state))).toBe(2);
    });
    it("is not offered for an attack with no keyword (a basic attack)", () => {
      const base = moveToHand(openedHero("41019"), P1, "41019").state;
      const run = drive(base, accepting(["41019.directed-force-interrupt"]), basicAttackCmd(base, villainOf(base)));
      expect(wasOffered(run.offered, "41019.directed-force-interrupt")).toBe(false);
    });
  });

  describe("41021 The Power of the Mind (basic resource)", () => {
    it("alone pays for a cost-2 PSIONIC card (Psi-Bow Attack) but not for a cost-2 card that is not (Float Like a Butterfly)", () => {
      const base = openedHero("41021", PSIONIC);
      const mind = moveToHand(base, P1, "41021");
      const bow = conjureInHand(mind.state, "41030");
      const ok = drive(bow.state, firstLegal, play(P1, bow.id, [mind.ids[0]!]));
      expect(dmg(ok.state, villainOf(ok.state))).toBe(4);
      const float = conjureInHand(mind.state, "41017");
      expect(applyCommand(float.state, play(P1, float.id, [mind.ids[0]!]), WAVE7_DEPS).ok).toBe(false);
    });
  });

  describe("41022 IPAC (basic support; play only if your identity has X-FORCE)", () => {
    it("refused for a Core hero without X-FORCE", () => {
      expectRefused(openedHero("41022"), "41022");
    });
    it("with an X-FORCE identity: exhaust, deal a facedown encounter card to the player, who draws 2", () => {
      const { state: s, id } = cast(openedHero("41022", XFORCE), "41022");
      expect(inPlay(s, id)).toBe(true);
      const hand = handIds(s).length;
      const run = drive(s, firstLegal, use(P1, id, "41022.ipac-action"));
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(handIds(run.state)).toHaveLength(hand + 2);
    });
  });

  describe("41023 X-Bunker (basic support; chosen player's identity must have MUTANT)", () => {
    it("a Core hero (not MUTANT) cannot use it", () => {
      const { state: s, id } = cast(openedHero("41023"), "41023");
      expect(inPlay(s, id)).toBe(true);
      expect(applyCommand(s, use(P1, id, "41023.x-bunker-action"), WAVE7_DEPS).ok).toBe(false);
    });
    it("with a MUTANT identity and 2 side schemes in the victory display: finds 1 card in the top 2 and adds it", () => {
      const { state: s, id } = cast(openedHero("41023", { identityTraits: ["MUTANT"] }), "41023");
      const a = spawnVictorySideScheme(s);
      const b = spawnVictorySideScheme(a.state);
      const top = playerOf(b.state, P1).deck.slice(0, 2);
      const run = drive(b.state, acceptingAndPicking([], [top[1]!]), use(P1, id, "41023.x-bunker-action"));
      expect(inst(run.state, id).exhausted).toBe(true);
      expect(handIds(run.state)).toContain(top[1]);
      expect(handIds(run.state)).toHaveLength(handIds(b.state).length + 1);
    });
  });

  describe("41024 Telepathy (basic upgrade; play only if your identity has PSIONIC)", () => {
    it("refused for a Core hero without PSIONIC", () => {
      expectRefused(openedHero("41024"), "41024");
    });
    it("with a PSIONIC identity: exhaust and spend [mental][mental] to remove 2 threat from a scheme", () => {
      const { state: s, id } = cast(openedHero("41024", PSIONIC), "41024");
      expect(inst(s, id).attachedTo).toBe(identityOf(s));
      const quiet = withoutSideSchemes(s, 6);
      const mental = iconCards(quiet, "mental", 2, { only: true });
      const run = drive(
        mental.state,
        firstLegal,
        use(
          P1,
          id,
          "41024.telepathy-action",
          mental.ids.map((fromHand) => ({ fromHand })),
        ),
      );
      expect(mainThreat(run.state)).toBe(4);
      expect(inst(run.state, id).exhausted).toBe(true);
    });
  });

  describe("41030 Psi-Bow Attack (aggression event; play only if your hero has PSIONIC)", () => {
    it("refused for She-Hulk without PSIONIC", () => {
      expectRefused(openedHero("41030", { coreHero: SHE_HULK }), "41030");
    });
    it("with a PSIONIC hero: 4 damage to the villain", () => {
      const { state } = cast(openedHero("41030", { coreHero: SHE_HULK, ...PSIONIC }), "41030");
      expect(dmg(state, villainOf(state))).toBe(4);
    });
  });

  describe("41031 Domino (leadership ally)", () => {
    it("after her basic attack, swaps a hand card with the top card of the deck", () => {
      const { state: s, id } = cast(openedHero("41031", { coreHero: CAPTAIN_MARVEL }), "41031");
      expect(inPlay(s, id)).toBe(true);
      const ownHand = handIds(s)[0]!;
      const top = playerOf(s, P1).deck[0]!;
      const run = drive(
        s,
        acceptingAndPicking(["41031.domino-response"], [ownHand, top]),
        basicAttackCmd(s, villainOf(s), id),
      );
      expect(wasOffered(run.offered, "41031.domino-response")).toBe(true);
      expect(handIds(run.state)).toContain(top);
      expect(handIds(run.state)).not.toContain(ownHand);
      expect(playerOf(run.state, P1).deck[0]).toBe(ownHand);
    });
  });

  describe("41032 Psi-Flail Strike (protection event response; play only if your identity has PSIONIC)", () => {
    it("refused for Black Panther without PSIONIC", () => {
      expectRefused(openedHero("41032", { coreHero: BLACK_PANTHER }), "41032");
    });
    it("with a PSIONIC identity: after the hero defends, 3 damage to the attacker and it is stunned", () => {
      const base = moveToHand(openedHero("41032", { coreHero: BLACK_PANTHER, ...PSIONIC }), P1, "41032").state;
      // The boost card is the blank Advance (01186), as the pack's own test stacks it.
      const run = drive(
        stackEncounterDeck(base, "01186"),
        accepting(["41032.psi-flail-strike-response"], { defend: true }),
        endTurn(P1),
      );
      expect(wasOffered(run.offered, "41032.psi-flail-strike-response")).toBe(true);
      expect(dmg(run.state, villainOf(run.state))).toBe(3);
      expect(status(run.state, villainOf(run.state), "stunned")).toBe(1);
    });
  });

  describe("41033 Telekinesis (basic upgrade; play only if your identity has PSIONIC)", () => {
    it("refused for a Core hero without PSIONIC", () => {
      expectRefused(openedHero("41033"), "41033");
    });
    it("with a PSIONIC identity: exhaust and spend [mental][mental] to deal 3 damage to an enemy", () => {
      const { state: s, id } = cast(openedHero("41033", PSIONIC), "41033");
      const mental = iconCards(s, "mental", 2, { only: true });
      const run = drive(
        mental.state,
        firstLegal,
        use(
          P1,
          id,
          "41033.telekinesis-action",
          mental.ids.map((fromHand) => ({ fromHand })),
        ),
      );
      expect(dmg(run.state, villainOf(run.state))).toBe(3);
      expect(inst(run.state, id).exhausted).toBe(true);
    });
  });

  describe("two players (Black Panther in seat 2)", () => {
    const twoSeats = (code: string, extra: object = {}) =>
      openedHero(code, { ...extra, otherPlayers: [wave7StarterDeckSetup(BLACK_PANTHER)] });

    it("41016 Lay the Trap: 5 per hero is 10 damage to the villain with two heroes", () => {
      const { state: s, id } = cast(twoSeats("41016"), "41016");
      const ready = patchInstance(s, id, { threat: 1 });
      const run = drive(ready, firstLegal, basicThwartCmd(ready, id));
      expect(dmg(run.state, villainOf(run.state))).toBe(10);
    });
    it("41022 IPAC: the chosen player (seat 2) is dealt the facedown encounter card and draws 2", () => {
      const { state: s, id } = cast(twoSeats("41022", XFORCE), "41022");
      const handTwo = playerOf(s, P2).hand.length;
      const handOne = handIds(s).length;
      const run = drive(s, acceptingAndPicking([], ["p2"]), use(P1, id, "41022.ipac-action"));
      expect(playerOf(run.state, P2).hand).toHaveLength(handTwo + 2);
      expect(handIds(run.state)).toHaveLength(handOne);
    });
  });

  it("the shared playFromAnotherHerosDeck helper plays a Psylocke card from a Core deck too", () => {
    const { state, cardInstanceId } = playFromAnotherHerosDeck("41013", crossHeroGame(), { cost: 2 });
    expect(playerOf(state, P1).playArea).toContain(cardInstanceId);
  });
});
