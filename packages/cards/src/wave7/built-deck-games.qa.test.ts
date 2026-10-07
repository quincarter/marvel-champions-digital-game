/**
 * Wave 7 rules-QA: full solo games with real built decks, played to a real outcome (docs/phase7-wave7-qa-built-deck-games.md).
 *
 * The six MarvelCDB decklists of `fixtures/decklists/` (imported as `custom-decks-marvelcdb.test.ts` does) against the
 * five NeXt Evolution scenarios in standard mode, one seat (the easiest table: villain hit points and the main
 * scheme's threat scale per player), driven by the QA solo driver (`qa-solo-driver.ts`), which picks only from
 * `legalActions` and the options of the open choice.
 *
 * What the committed test does (it must stay fast; the wide scan lives in the doc and in the `QA_FULL` block):
 *
 * - `PINS`: one game per pairing (6 x 5): a win where the scratch scans found one (3 pairings), otherwise the quickest
 *   game seen, each named by (seed, driver defense mode, explore). Each is played command by command with the invariants below, replayed from its log to a
 *   deep-equal state, and its outcome and round count asserted exactly (the table is the regression signal: any engine,
 *   script or content change that moves a seeded game shows up here as a changed row).
 * - Wins additionally assert the win condition by its rule, the final state (game over, winner, victory display) and
 *   the villain's final stage.
 * - `QA_FULL=1` scans seeds 1-12 per pairing with the invariants only (360 games, about half an hour in one process).
 *
 * The pins are tied to the engine and content at the time of writing (`dc26910a`): a change that moves a seeded game moves
 * its row, which is the point; re-pin from the scan in the doc, not by editing the expectation to match.
 *
 * Invariants on every command (RRG 1.8 pages in parentheses):
 * - no engine refusal of a driver command, no soft lock: a prompt always has at least `minSelections` options, and the
 *   game never rests between steps with nothing pending (Appendix II, pp. 51-52); the game ends inside the command cap;
 * - no card instance in two zones; every card a deck started with is still somewhere (Owner, Controller, p. 31) and in
 *   its owner's zones;
 * - no two matching unique cards (or a unique card matching a chosen identity) in play together (Unique Icon, p. 45);
 * - the arithmetic of every enemy attack and scheme (`checkArithmetic`);
 * - at most one player side scheme in play, for one or two players (Player Side Scheme Limit, p. 34);
 * - a voluntary form change at most once a round (Form, p. 20);
 * - the log replays to the identical final state.
 */
import { describe, expect, it } from "vitest";
import {
  applyCommand,
  cardsInPlay,
  cardsMatch,
  characterProfile,
  createGame,
  legalActions,
  mainSchemeValue,
  playerSideSchemeLimit,
  replay,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { parseMarvelCdbDeckJsonText, type CoreAspect } from "@mc/content";
import { WAVE7_CARDS } from "./cards.js";
import { WAVE7_DEPS, wave7Scenario } from "./index.js";
import { playSolo, type DefenseMode, type SoloResult, type SoloStyle } from "./qa-solo-driver.js";

// `import.meta.glob` (Vite/vitest's static-file loader) rather than `node:fs`: `@mc/cards`'s tsconfig has no `node` types.
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURES = (import.meta as unknown as ImportMetaEnv).glob("./fixtures/decklists/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const HEROES = ["cable", "domino", "psylocke", "angel", "x23", "deadpool"] as const;
const SCENARIOS = ["morlock-siege", "on-the-run", "juggernaut", "mister-sinister", "stryfe"] as const;
type Hero = (typeof HEROES)[number];
type Scenario = (typeof SCENARIOS)[number];

const COMMAND_CAP = 3000;
const PLAYER_CARD_TYPES: readonly string[] = ["ally", "event", "resource", "support", "upgrade", "player_side_scheme"];
const HOPE = ["40130", "40131"];

const cardOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId as string]!;
const cardName = (s: GameState, id: InstanceId) => cardOf(s, id).name;

function buildGame(hero: Hero, scenario: Scenario, seed: number): GameState {
  const text = FIXTURES[`./fixtures/decklists/${hero}.json`];
  if (text === undefined) throw new Error(`no fixture for ${hero}`);
  const parsed = parseMarvelCdbDeckJsonText(text, WAVE7_CARDS);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems));
  const { contents } = parsed;
  const config = wave7Scenario(scenario, {
    seed,
    players: [
      {
        identityCardId: contents.identityCardId,
        deck: contents.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
        aspects: contents.aspects as readonly CoreAspect[],
      },
    ],
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return created.state;
}

/** Every list an instance can be in, labeled; attachments, tucked and boost cards are listed under their host. */
function zoneIndex(s: GameState): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (id: InstanceId, label: string) => index.set(id, [...(index.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "dealtEncounter", "resolving", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    for (const [name, sep] of Object.entries(p.separateDecks)) {
      for (const id of sep.deck) add(id, `${p.playerId}.sep.${name}.deck`);
      for (const id of sep.discard) add(id, `${p.playerId}.sep.${name}.discard`);
    }
    add(p.identity.instanceId, `${p.playerId}.identity`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.encounterSetAside) add(id, "encounterSetAside");
  for (const id of s.villainArea) add(id, "villainArea");
  for (const id of s.victoryDisplay) add(id, "victoryDisplay");
  for (const id of s.removedFromGame) add(id, "removedFromGame");
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  return index;
}

/** Throws a descriptive error on the first broken invariant of `s`. */
function checkState(s: GameState, dealtTo: ReadonlyMap<string, PlayerId>, where: string): void {
  const fail = (message: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    if (choice.minSelections > choice.options.length && choice.prompt.kind !== "reportFact")
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} but offers ${choice.options.length}`);
    if (choice.minSelections > choice.maxSelections) fail(`${choice.prompt.kind}: min > max`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  const zones = zoneIndex(s);
  for (const [id, labels] of zones)
    if (labels.length > 1) fail(`${id} (${cardName(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  const sideSchemes = s.villainArea.filter((id) => cardOf(s, id).type === "player_side_scheme");
  if (choice?.prompt.kind !== "discardOverPlayerSideSchemeLimit" && sideSchemes.length > playerSideSchemeLimit(s))
    fail(`${sideSchemes.length} player side schemes in play, limit ${playerSideSchemeLimit(s)}`);
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${cardName(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${cardName(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        // A scenario card a player took control of becomes theirs (RRG 1.8 "Ownership and Control", p. 31: Morlock allies).
        if (zone !== "hand" && zone !== "playArea" && dealt === undefined && s.instances[id]!.ownerId !== p.playerId)
          fail(`${cardName(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
  // Unique Icon (RRG p. 45): the identities of players still in the game and the unique cards they control.
  const unique: { id: InstanceId; what: string }[] = [];
  for (const p of s.players.filter((x) => !x.eliminated)) {
    unique.push({ id: p.identity.instanceId, what: `${p.playerId}'s identity` });
    for (const id of p.playArea)
      if (["ally", "support", "upgrade"].includes(cardOf(s, id).type)) unique.push({ id, what: cardName(s, id) });
  }
  for (let i = 0; i < unique.length; i++)
    for (let j = i + 1; j < unique.length; j++)
      if (cardsMatch(cardOf(s, unique[i]!.id) as never, cardOf(s, unique[j]!.id) as never))
        fail(`unique rule broken: ${unique[i]!.what} and ${unique[j]!.what} are in play together`);
}

/**
 * Damage and threat arithmetic of every enemy activation (RRG 1.8 "Attack (Enemy Activation)", p. 9, "Boost", p. 11): the
 * damage an attack deals is its ATK plus boost icons less the defender's DEF, and a scheme places its SCH plus boost icons
 * plus any threat bonus. Activations an effect redirected (`damageTo`, `removesThreat...`) are left out.
 */
function checkArithmetic(events: readonly GameEvent[], where: string): void {
  for (const e of events) {
    if (e.type === "attackResolved" && e.damageTo === undefined && e.removesThreatFrom === undefined) {
      const expected = Math.max(0, e.baseAtk + e.boostIcons - e.defenseReduction);
      if (e.damageDealt !== expected)
        throw new Error(
          `[${where}] attack dealt ${e.damageDealt}, ATK ${e.baseAtk} + boost ${e.boostIcons} - DEF ${e.defenseReduction} = ${expected}`,
        );
    }
    if (e.type === "schemeResolved" && e.removesThreat !== true) {
      const expected = e.baseSch + e.boostIcons + e.threatBonus;
      if (e.threatPlaced !== expected)
        throw new Error(
          `[${where}] scheme placed ${e.threatPlaced}, SCH ${e.baseSch} + boost ${e.boostIcons} + bonus ${e.threatBonus} = ${expected}`,
        );
    }
  }
}

interface Played {
  readonly result: SoloResult;
  readonly initial: GameState;
  readonly seen: { formChanges: number };
}

/** Plays one game with the invariants checked after every command, then replays its log. */
function playChecked(
  hero: Hero,
  scenario: Scenario,
  seed: number,
  style: SoloStyle,
  explore: number,
  defense: DefenseMode,
): Played {
  const initial = buildGame(hero, scenario, seed);
  const where = `${hero}/${scenario}/seed ${seed}/${style}/${defense}/${explore}`;
  // Every player card a player owns when the game starts (deck, hand, set aside, signature cards), as the precon e2e tests do.
  const dealtTo = new Map<string, PlayerId>();
  for (const [id, instance] of Object.entries(initial.instances))
    if (instance.ownerId !== null && PLAYER_CARD_TYPES.includes(cardOf(initial, id as InstanceId).type))
      dealtTo.set(id, instance.ownerId);
  checkState(initial, dealtTo, `${where} start`);
  const formChangesThisRound = new Map<string, number>();
  const seen = { formChanges: 0 };
  const result = playSolo(initial, WAVE7_DEPS, {
    maxCommands: COMMAND_CAP,
    style,
    explore,
    defense,
    onCommand: (before, command, after, events) => {
      checkArithmetic(events, where);
      if (command.type === "changeForm") {
        const key = `${before.round}:${command.playerId}`;
        formChangesThisRound.set(key, (formChangesThisRound.get(key) ?? 0) + 1);
        seen.formChanges++;
        if ((formChangesThisRound.get(key) ?? 0) > 1)
          throw new Error(`[${where}] two voluntary form changes in ${key}`);
      }
      checkState(after, dealtTo, `${where} after ${command.type}`);
    },
  });
  // The game ends inside the cap (no soft lock).
  expect(result.capped, `${where} did not end within ${COMMAND_CAP} commands`).toBe(false);
  const replayed = replay(result.session.log, WAVE7_DEPS);
  expect(replayed.ok, `${where} replay`).toBe(true);
  if (replayed.ok) expect(replayed.state, `${where} replay is deep-equal`).toEqual(result.session.state);
  return { result, initial, seen };
}

type Verdict =
  | "win"
  | "loss:mainSchemeCompleted"
  | "loss:allPlayersDefeated"
  | "loss:cardAbility"
  | "loss:encounterDeckExhausted";
const verdictOf = (r: SoloResult): Verdict => {
  const o = r.outcome;
  if (!o) throw new Error("no outcome");
  if (o.result === "win") return "win";
  if (o.result === "loss") return `loss:${o.reason}` as Verdict;
  throw new Error(`unexpected outcome ${o.result}`);
};

interface Pin {
  readonly hero: Hero;
  readonly scenario: Scenario;
  readonly seed: number;
  readonly style: SoloStyle;
  readonly defense: DefenseMode;
  readonly explore: number;
  readonly verdict: Verdict;
  readonly rounds: number;
}

/**
 * One pinned game per pairing: a win where the scratch scans found one, otherwise the quickest game of the scan.
 * Filled from `docs/phase7-wave7-qa-built-deck-games.md` section 1.
 */
const PINS: readonly Pin[] = [
  {
    hero: "cable",
    scenario: "morlock-siege",
    seed: 11,
    style: "rules",
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    hero: "cable",
    scenario: "on-the-run",
    seed: 11,
    style: "rules",
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:mainSchemeCompleted",
    rounds: 2,
  },
  {
    hero: "cable",
    scenario: "juggernaut",
    seed: 1,
    style: "rules",
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:cardAbility",
    rounds: 1,
  },
  {
    hero: "cable",
    scenario: "mister-sinister",
    seed: 11,
    style: "rules",
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:mainSchemeCompleted",
    rounds: 5,
  },
  {
    hero: "cable",
    scenario: "stryfe",
    seed: 2,
    style: "rules",
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    hero: "domino",
    scenario: "morlock-siege",
    seed: 11,
    style: "rules",
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    hero: "domino",
    scenario: "on-the-run",
    seed: 7,
    style: "rules",
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:mainSchemeCompleted",
    rounds: 1,
  },
  {
    hero: "domino",
    scenario: "juggernaut",
    seed: 1,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:cardAbility",
    rounds: 1,
  },
  {
    hero: "domino",
    scenario: "mister-sinister",
    seed: 3,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:allPlayersDefeated",
    rounds: 4,
  },
  {
    hero: "domino",
    scenario: "stryfe",
    seed: 2,
    style: "rules",
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:mainSchemeCompleted",
    rounds: 2,
  },
  {
    hero: "psylocke",
    scenario: "morlock-siege",
    seed: 10,
    style: "rules",
    defense: "balanced",
    explore: 6,
    verdict: "win",
    rounds: 6,
  },
  {
    hero: "psylocke",
    scenario: "on-the-run",
    seed: 7,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 2,
  },
  {
    hero: "psylocke",
    scenario: "juggernaut",
    seed: 1,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:cardAbility",
    rounds: 1,
  },
  {
    hero: "psylocke",
    scenario: "mister-sinister",
    seed: 5,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:allPlayersDefeated",
    rounds: 3,
  },
  {
    hero: "psylocke",
    scenario: "stryfe",
    seed: 2,
    style: "rules",
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    hero: "angel",
    scenario: "morlock-siege",
    seed: 8,
    style: "rules",
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    hero: "angel",
    scenario: "on-the-run",
    seed: 11,
    style: "rules",
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:mainSchemeCompleted",
    rounds: 2,
  },
  {
    hero: "angel",
    scenario: "juggernaut",
    seed: 1,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:cardAbility",
    rounds: 1,
  },
  {
    hero: "angel",
    scenario: "mister-sinister",
    seed: 6,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 4,
  },
  {
    hero: "angel",
    scenario: "stryfe",
    seed: 6,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 4,
  },
  {
    hero: "x23",
    scenario: "morlock-siege",
    seed: 12,
    style: "rules",
    defense: "hero-ready",
    explore: 6,
    verdict: "loss:allPlayersDefeated",
    rounds: 3,
  },
  {
    hero: "x23",
    scenario: "on-the-run",
    seed: 7,
    style: "rules",
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:mainSchemeCompleted",
    rounds: 1,
  },
  {
    hero: "x23",
    scenario: "juggernaut",
    seed: 10,
    style: "rules",
    defense: "hero-ready",
    explore: 8,
    verdict: "loss:allPlayersDefeated",
    rounds: 3,
  },
  {
    hero: "x23",
    scenario: "mister-sinister",
    seed: 2,
    style: "rules",
    defense: "hero-ready",
    explore: 0,
    verdict: "win",
    rounds: 8,
  },
  {
    hero: "x23",
    scenario: "stryfe",
    seed: 4,
    style: "rules",
    defense: "hero-ready",
    explore: 3,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    hero: "deadpool",
    scenario: "morlock-siege",
    seed: 6,
    style: "rules",
    defense: "balanced",
    explore: 6,
    verdict: "win",
    rounds: 9,
  },
  {
    hero: "deadpool",
    scenario: "on-the-run",
    seed: 5,
    style: "rules",
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:mainSchemeCompleted",
    rounds: 1,
  },
  {
    hero: "deadpool",
    scenario: "juggernaut",
    seed: 6,
    style: "rules",
    defense: "hero-ready",
    explore: 2,
    verdict: "loss:allPlayersDefeated",
    rounds: 2,
  },
  {
    hero: "deadpool",
    scenario: "mister-sinister",
    seed: 8,
    style: "rules",
    defense: "hero-ready",
    explore: 0,
    verdict: "loss:mainSchemeCompleted",
    rounds: 5,
  },
  {
    hero: "deadpool",
    scenario: "stryfe",
    seed: 8,
    style: "rules",
    defense: "hero-ready",
    explore: 1,
    verdict: "loss:mainSchemeCompleted",
    rounds: 2,
  },
];

describe("built-deck solo games: the pinned table", () => {
  it.each(PINS.map((pin) => ({ ...pin, name: `${pin.hero} / ${pin.scenario} / seed ${pin.seed}` })))(
    "$name ends $verdict in $rounds rounds",
    (pin) => {
      const { result } = playChecked(pin.hero, pin.scenario, pin.seed, pin.style, pin.explore, pin.defense);
      expect(verdictOf(result)).toBe(pin.verdict);
      expect(result.rounds).toBe(pin.rounds);
      const final = result.session.state;
      assertGameOver(final);
      if (pin.verdict === "win") assertWin(pin.scenario, final);
      else assertLoss(final);
    },
    120_000,
  );
});

/** Game over is a state, not a pause: no step, no prompt, no legal action, and the engine refuses a further command. */
function assertGameOver(s: GameState): void {
  expect(s.outcome).not.toBeNull();
  expect(s.pendingChoice).toBeNull();
  expect(s.step.phase).toBe("gameOver");
  expect(legalActions(s, s.players[0]!.playerId, WAVE7_DEPS).kind).toBe("gameOver");
  const refused = applyCommand(s, { type: "endTurn", playerId: s.players[0]!.playerId }, WAVE7_DEPS);
  expect(refused.ok).toBe(false);
}

/** A loss is declared when its rule is met, not before (RRG 1.8 "Main Scheme", "Defeat", "If ... leaves play, the players lose"). */
function assertLoss(s: GameState): void {
  const outcome = s.outcome;
  expect(outcome?.result).toBe("loss");
  if (outcome?.result !== "loss") return;
  if (outcome.reason === "mainSchemeCompleted") {
    const threat = s.instances[s.mainScheme.instanceId]!.threat;
    expect(threat).toBeGreaterThanOrEqual(mainSchemeValue(s, "targetThreat", WAVE7_DEPS));
  } else if (outcome.reason === "allPlayersDefeated") {
    for (const p of s.players) {
      const profile = characterProfile(s, p.identity.instanceId, WAVE7_DEPS)!;
      expect(p.eliminated || s.instances[p.identity.instanceId]!.damage >= profile.maxHp).toBe(true);
    }
  } else if (outcome.reason === "cardAbility") {
    const name = cardName(s, outcome.sourceInstanceId);
    if (name === "Hope Summers") expect(cardsInPlay(s)).not.toContain(outcome.sourceInstanceId);
    // Mutant Massacre 2B: "If this stage is completed or there are no Morlock allies in play, the players lose the game."
    else
      expect(
        cardsInPlay(s).filter((id) => cardName(s, id) === "Morlock" && cardOf(s, id).type === "ally"),
      ).toHaveLength(0);
  }
}

/** The win condition by its rule, and the final state (game over, winner, victory display). */
function assertWin(scenario: Scenario, s: GameState): void {
  expect(s.outcome).toEqual({
    result: "win",
    reason: expect.stringMatching(/^(villainDefeated|allVillainsDefeated)$/),
  });
  expect(s.pendingChoice).toBeNull();
  expect(s.step.phase).toBe("gameOver");
  // Hope Summers is never defeated in a game that is won (Stryfe 1A, Mister Sinister 1A, Juggernaut: "if Hope Summers is defeated, you lose").
  for (const id of HOPE_IDS(s)) expect(cardsInPlay(s)).toContain(id);
  if (scenario === "morlock-siege") {
    // Mutant Massacre / Knock, Knock: "If there are 3 villains under Routed, the players win the game."
    const routed = (Object.keys(s.instances) as InstanceId[]).find((id) => s.instances[id]!.cardId === "40081a");
    expect(routed).toBeDefined();
    expect(s.instances[routed!]!.tucked.length).toBeGreaterThanOrEqual(3);
  } else {
    // The (last stage of the) villain is defeated: no villain remains undefeated.
    expect(s.villains.every((v) => v.defeated)).toBe(true);
    // "Villain Defeat" (RRG 1.8 p. 47): the game is won on the defeat of the villain's last stage.
    for (const v of s.villains) expect(v.stageIndex).toBe(v.lastStageIndex);
  }
}
const HOPE_IDS = (s: GameState): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter(
    (id) => HOPE.includes(s.instances[id]!.cardId as string) && cardsInPlay(s).includes(id),
  );

const fullScan =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.QA_FULL === "1";
describe.skipIf(!fullScan)("built-deck solo games: the wide scan (QA_FULL=1)", () => {
  const cases = HEROES.flatMap((hero) => SCENARIOS.map((scenario) => ({ hero, scenario })));
  it.each(cases)(
    "$hero / $scenario: seeds 1-12 hold the invariants",
    ({ hero, scenario }) => {
      for (let seed = 1; seed <= 12; seed++) playChecked(hero, scenario, seed, "rules", 0, "hero-ready");
    },
    3_600_000,
  );
});
