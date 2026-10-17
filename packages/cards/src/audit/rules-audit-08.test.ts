/**
 * Rules audit chunk 08 (Glossary: GAME ELEMENT ... IN PLAY AND OUT OF PLAY). Audit proofs only: each `it.fails` marks
 * a place the scripts do something the RRG does not say, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Hit Points" (p. 22): "The phrase 'starting hit points' refers to an identity's printed hit point value."
 * Dauntless (`gmw` 16016): "While your hero's remaining hit points are equal to or greater than your hero's starting
 * hit points, your hero gains retaliate 1." The script (`wave3/gmw/groot-kit.ts`, "16016.dauntless-constant") reads
 * that as "damage is 0", which is only equivalent while no ability raises the hero's maximum hit points. With
 * Endurance (+3 hit points) and 1 damage, remaining hit points (printed + 2) are still above the printed value, so
 * the retaliate must stay. (Fighting Fit, 16014, uses the same "damage is 0" reading.)
 *
 * FFG ruling (post-RRG 1.5, answered by Alex; Hall of Heroes "Latest FFG Rulings (post RRG 1.5)", "Guard prevents you
 * from initiating attacks, but does not prevent you from dealing damage. We rule that, if you already initiated an
 * attack with Swift Retribution and were dealt a Goblin Thrall during the activation, you could still deal the damage
 * from Swift Retribution."): the engine instead re-reads guard when the already-begun attack's damage instruction
 * resolves (Q49, `attack-label.test.ts`), so the 4 damage is lost.
 */
import { cardId, PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  createGame,
  keywordTotal,
  maxHitPoints,
  type CardInstance,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import { buildCrossHeroDeck } from "../testing/cross-hero.js";
import { game, villainOf } from "../wave7/rulings-2026-10-06-harness.js";
import { conjure, playOut } from "../testing/qa-bench.js";
import {
  inst,
  stackEncounterDeck,
  firstLegal,
  identityOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
} from "../testing/harness.js";

vi.setConfig({ testTimeout: 120_000 });

const BLACK_PANTHER = "core-black-panther-protection";
const DAUNTLESS = "16016";
const ENDURANCE = "05023";

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const costOf = (code: string): number => {
  const card = BY_ID.get(code)!;
  return "cost" in card && typeof card.cost === "number" ? card.cost : 0;
};
const singleIcon = (card: AnyCard): boolean =>
  "resourceIcons" in card && Object.values(card.resourceIcons).reduce((a, b) => a + (b ?? 0), 0) === 1;

/** Plays `code` (already in hand) on `attachTo`, paying with single-icon cards of the hand. */
function playUpgrade(state: GameState, id: InstanceId, code: string, attachTo: InstanceId): GameState {
  const pay = playerOf(state, P1)
    .hand.filter((h) => h !== id && singleIcon(BY_ID.get(state.instances[h]!.cardId as string)!))
    .slice(0, costOf(code));
  if (pay.length < costOf(code)) throw new Error("not enough payment cards");
  const result = applyCommand(state, play(P1, id, pay, { attachToInstanceId: attachTo }), PLAYABLE_DEPS);
  if (!result.ok) throw new Error(`play failed: ${result.error.message}`);
  return settle(result.state, firstLegal, undefined, PLAYABLE_DEPS);
}

describe("Dauntless with a hit point bonus (RRG 1.8 'Hit Points', p. 22: starting hit points = printed)", () => {
  it("keeps its retaliate while remaining hit points >= printed hit points though the hero is damaged", () => {
    const seat = buildCrossHeroDeck(PLAYABLE_CARDS, BLACK_PANTHER, DAUNTLESS);
    const seated: PlayerSetup = { ...seat, deck: [...seat.deck, ENDURANCE as never, ENDURANCE as never] };
    const created = createGame(playableScenario("rhino", { seed: 11, players: [seated] as never }), PLAYABLE_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
    const hero0 = settle(runWith(PLAYABLE_DEPS, opening, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);
    const given = moveToHand(hero0, P1, DAUNTLESS, ENDURANCE);
    const [dauntless, endurance] = given.ids as [InstanceId, InstanceId];
    const hero = identityOf(given.state);
    const printedHp = maxHitPoints(given.state, hero, PLAYABLE_DEPS)!;
    const base = keywordTotal(given.state, hero, "retaliate", PLAYABLE_DEPS);
    const withD = playUpgrade(given.state, dauntless, DAUNTLESS, hero);
    const withBoth = playUpgrade(withD, endurance, ENDURANCE, hero);
    expect(maxHitPoints(withBoth, hero, PLAYABLE_DEPS)).toBe(printedHp + 3);
    const hurt = patchInstance(withBoth, hero, { damage: 1 });
    // remaining = printed + 2 >= printed: Dauntless still applies.
    expect(keywordTotal(hurt, hero, "retaliate", PLAYABLE_DEPS)).toBe(base + 1);
  });
});

describe("Swift Retribution (15014) when the villain's scheme boost brings a Guard minion (FFG ruling post-RRG 1.5)", () => {
  /** Mutagen Formula, one player; P1's setup Goblin Thrall is disengaged and a Goblin Thrall (boost: put into play engaged) is the next card. */
  const staged = (topCode: string) => {
    const s = game("mutagen-formula", ["core-spider-man-justice"], ["bomb_scare"], 13);
    const thralls = Object.values(s.instances).filter((i) => i.cardId === cardId("02024")) as CardInstance[];
    const free = patchInstance(s, thralls.find((t) => t.engagedWith === P1)!.instanceId, { engagedWith: null });
    return conjure(stackEncounterDeck(free, topCode), "15014");
  };

  it("control: a plain boost card (Advance, 01186): the attack deals its 4 damage", () => {
    const given = staged("01186");
    const done = playOut(given.state, given.id, 1);
    expect(done.accepted).toBe(true);
    expect(inst(done.state, villainOf(given.state)).damage).toBe(4);
  });

  it.fails("a Goblin Thrall boost engages a Guard minion after the attack began: the 4 damage is still dealt", () => {
    const given = staged("02024");
    const done = playOut(given.state, given.id, 1);
    expect(done.accepted).toBe(true);
    const engaged = Object.values(done.state.instances).filter(
      (i) => i.cardId === cardId("02024") && i.engagedWith === P1,
    );
    expect(engaged).toHaveLength(1); // the Guard minion did arrive
    // Actual: 0. The attack had begun; guard "prevents you from initiating attacks, but does not prevent you from dealing damage".
    expect(inst(done.state, villainOf(given.state)).damage).toBe(4);
  });
});
