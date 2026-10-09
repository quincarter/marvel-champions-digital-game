import {
  applyCommand,
  characterProfile,
  createGame,
  replay,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerState,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";

/**
 * Whole Domino precon games ("Domino / Justice", NeXt Evolution) driven through the real engine with the real wave 7
 * scripts, by the greedy driver (`../../testing/driver.ts`) one command at a time. After every command the invariants
 * below are checked, and Domino's own rules are checked wherever a game happens to reach them:
 *
 * - no engine error on a command the driver found legal, no prompt with fewer legal options than it needs (a soft
 *   lock), the villain phase always completes (the game is never stuck outside a player turn without a prompt);
 * - every card instance is in exactly one zone (hand, deck, discard, play area, dealt encounter cards, resolving,
 *   set aside, a deck of its own, encounter deck or discard, victory display, removed from game, attached, boost, tucked)
 *   and every instance is in one, so cards are conserved;
 * - the log replays to the identical state.
 *
 * Sources: MC40 (NeXt Evolution rules insert) pp. 21-22 for Domino; RRG 1.8 "Player Deck" (p. 33, a deck that runs
 * out is reset and the player is dealt an encounter card), "'Swap'" (p. 42), "Target" (pp. 41-42), "Boost" (p. 11).
 * docs/phase7-wave7.md §3.55-§3.57, §4.1 Q31/Q32.
 */

const DEPS: EngineDeps = WAVE7_DEPS;
const DOMINO_CARD_IDS = ["40037a", "40037b"];
const MEMORIES = "40065";
const SIDE_SCHEMES = ["40054", "40059"];

/** What the games reached, by targeted check; the last test asserts each one was seen at least once. */
const SEEN = new Map<string, string[]>();
const saw = (check: string, where: string): void => {
  SEEN.set(check, [...(SEEN.get(check) ?? []), where]);
};

interface Game {
  readonly label: string;
  readonly initial: GameState;
  readonly final: GameState;
  readonly commands: readonly Command[];
  readonly rounds: number;
  /** The first player at the start of each round, or "eliminated" once a player has been eliminated. */
  readonly firstPlayerAtRoundStart: readonly string[];
}

/** Every location a card instance can sit in, as `zone -> ids`. */
function zonesOf(state: GameState): Map<string, readonly InstanceId[]> {
  const zones = new Map<string, readonly InstanceId[]>();
  for (const p of state.players) {
    zones.set(`${p.playerId}.hand`, p.hand);
    zones.set(`${p.playerId}.deck`, p.deck);
    zones.set(`${p.playerId}.discard`, p.discard);
    zones.set(`${p.playerId}.playArea`, p.playArea);
    zones.set(`${p.playerId}.dealtEncounter`, p.dealtEncounter);
    zones.set(`${p.playerId}.resolving`, p.resolving);
    zones.set(`${p.playerId}.setAside`, p.setAside);
    zones.set(`${p.playerId}.identity`, [p.identity.instanceId]);
    for (const [name, sd] of Object.entries(p.separateDecks)) {
      zones.set(`${p.playerId}.sep.${name}.deck`, sd.deck);
      zones.set(`${p.playerId}.sep.${name}.discard`, sd.discard);
    }
  }
  for (const [id, d] of Object.entries(state.encounterDecks)) {
    zones.set(`enc.${id}.deck`, d.deck);
    zones.set(`enc.${id}.discard`, d.discard);
  }
  zones.set("encounterSetAside", state.encounterSetAside);
  zones.set("villainArea", state.villainArea);
  zones.set("victoryDisplay", state.victoryDisplay);
  zones.set("removedFromGame", state.removedFromGame);
  for (const [name, d] of Object.entries(state.scenarioDecks)) {
    const deck = d as { deck?: readonly InstanceId[]; discard?: readonly InstanceId[] };
    zones.set(`scenarioDeck.${name}`, deck.deck ?? []);
    zones.set(`scenarioDeck.${name}.discard`, deck.discard ?? []);
  }
  for (const [name, ids] of Object.entries(state.scenarioAreas ?? {})) zones.set(`area.${name}`, ids);
  for (const inst of Object.values(state.instances)) {
    if (inst.attachments.length > 0) zones.set(`attachments.${inst.instanceId}`, inst.attachments);
    if (inst.boostCards.length > 0) zones.set(`boost.${inst.instanceId}`, inst.boostCards);
    if (inst.tucked.length > 0) zones.set(`tucked.${inst.instanceId}`, inst.tucked);
  }
  return zones;
}

/** Cards in two zones, and instances in none. */
function zoneFaults(state: GameState): string[] {
  const faults: string[] = [];
  const where = new Map<string, string>();
  for (const [zone, ids] of zonesOf(state)) {
    for (const id of ids) {
      const prior = where.get(id);
      if (prior !== undefined) faults.push(`${id} in ${prior} and ${zone}`);
      where.set(id, zone);
    }
  }
  // A villain stage and the main scheme are in play without being in a zone list (`villains` is a roster that keeps
  // defeated villains, tucked or removed ones included, so it is not itself a zone).
  for (const v of state.villains) if (!where.has(v.instanceId)) where.set(v.instanceId, "villain");
  if (!where.has(state.mainScheme.instanceId)) where.set(state.mainScheme.instanceId, "mainScheme");
  for (const id of Object.keys(state.instances)) if (!where.has(id)) faults.push(`${id} is in no zone`);
  for (const id of where.keys()) if (!state.instances[id]) faults.push(`${id} is in a zone but is no instance`);
  return faults;
}

const cardIdOf = (state: GameState, id: string): string => state.instances[id]?.cardId ?? "";
const nameOf = (state: GameState, id: string): string => state.cardPool[cardIdOf(state, id)]?.name ?? "?";
const typeOf = (state: GameState, id: string): string => state.cardPool[cardIdOf(state, id)]?.type ?? "";

const dominoOf = (state: GameState): PlayerState | undefined =>
  state.players.find((p) => DOMINO_CARD_IDS.includes(p.identity.cardId));

/** Allies whose leaving play loses the game (Hope Summers 40130; Morlock Siege 2B: "no Morlock allies in play"). */
const NEVER_DEFEND_WITH = new Set(["Hope Summers", "Morlock"]);

/**
 * The defense policy: never defend with an ally whose loss loses the game, otherwise another ally if one is offered;
 * the attacked hero when it is hurt (6 or more damage), or when the attack is on Hope Summers (40130: "If Hope Summers
 * leaves play, the players lose the game"), else no defense.
 */
function defend(state: GameState): Command {
  const choice = state.pendingChoice!;
  const prompt = choice.prompt;
  if (prompt.kind !== "declareDefender") throw new Error("not a defender prompt");
  const ids = choice.options.map((o) => o.optionId);
  const target = prompt.attack.targetCharacterInstanceId;
  const ally = ids.find(
    (id) => id !== "decline" && typeOf(state, id) === "ally" && !NEVER_DEFEND_WITH.has(nameOf(state, id)),
  );
  const hurt = typeOf(state, target) === "hero_identity" && (state.instances[target]?.damage ?? 0) >= 6;
  const heroDefender = ids.find((id) => id !== "decline" && typeOf(state, id) === "hero_identity");
  const hopeAttacked = nameOf(state, target) === "Hope Summers";
  const fallback = ids.includes("decline") ? "decline" : ids[0]!;
  const pick = ally ?? (hopeAttacked && heroDefender ? heroDefender : hurt && ids.includes(target) ? target : fallback);
  return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: [pick] };
}

/** A card's icons as Domino's hero face counts them for a deck discard: a printed wild twice unless it is off. */
function countedIcons(state: GameState, cardId: string, doubled: boolean): number {
  const card = state.cardPool[cardId] as { resourceIcons?: Record<string, number> } | undefined;
  const icons = card?.resourceIcons ?? {};
  return (icons.physical ?? 0) + (icons.mental ?? 0) + (icons.energy ?? 0) + (icons.wild ?? 0) * (doubled ? 2 : 1);
}

/** Whether Domino's hero face rule counts a wild twice now: hero form, and Memories of Armageddon not in her play area. */
const doublesWild = (state: GameState, p: PlayerState): boolean =>
  p.identity.form === "hero" && !p.playArea.some((id) => cardIdOf(state, id) === MEMORIES);

interface Tally {
  jackpotPending: string | null;
  /** A swap Action resolved and its cards have not moved yet (the choices come in later commands). */
  swapPending: boolean;
}

/** Domino's own rules, checked on the step from `before` to `after` with the events it produced. */
function checkDomino(
  label: string,
  before: GameState,
  after: GameState,
  events: readonly GameEvent[],
  tally: Tally,
): void {
  const dBefore = dominoOf(before);
  const dAfter = dominoOf(after);
  if (!dBefore || !dAfter) return;
  const id = dBefore.playerId;
  const memories = dBefore.playArea.some((c) => cardIdOf(before, c) === MEMORIES);
  const resolved = events
    .filter((e) => e.type === "abilityResolved")
    .map((e) => (e as { abilityId: string }).abilityId);

  // Memories of Armageddon (40065): both text boxes are blank, so neither swap Action is offered or resolves (Q12 = A).
  if (memories) {
    expect(resolved, `${label}: a swap resolved while Memories of Armageddon blanked her`).not.toContain(
      "40037a.domino-action",
    );
    expect(resolved).not.toContain("40037b.neena-thurman-action");
  }
  if (
    dAfter.playArea.some((c) => cardIdOf(after, c) === MEMORIES) &&
    !after.pendingChoice &&
    after.step.phase === "player" &&
    after.step.kind === "turn" &&
    after.step.activePlayerId === id
  ) {
    const swap = {
      type: "useAbility",
      playerId: id,
      cardInstanceId: dAfter.identity.instanceId,
      abilityId: dAfter.identity.form === "hero" ? "40037a.domino-action" : "40037b.neena-thurman-action",
      payment: [],
    } as unknown as Command;
    expect(applyCommand(after, swap, DEPS).ok, `${label}: swap offered under Memories of Armageddon`).toBe(false);
    saw("Memories of Armageddon blanks her identity (swap not offered)", label);
  }

  if (resolved.some((a) => a === "40037a.domino-action" || a === "40037b.neena-thurman-action"))
    tally.swapPending = true;
  if (events.some((e) => e.type === "swapRefused")) tally.swapPending = false;

  // The swap Actions (RRG "Swap", p. 42): the hand card and the deck's top card (or the discard pile's top card)
  // trade places; neither is drawn or discarded.
  for (const swapped of events) {
    if (swapped.type !== "cardsSwapped") continue;
    if (!tally.swapPending) continue;
    tally.swapPending = false;
    const handCard = [swapped.outgoing, swapped.incoming].find((c) => dBefore.hand.includes(c));
    expect(handCard, `${label}: swap with no card from hand`).toBeDefined();
    const other = swapped.outgoing === handCard ? swapped.incoming : swapped.outgoing;
    expect(dAfter.hand.length).toBe(dBefore.hand.length);
    expect(dAfter.hand).toContain(other);
    expect(dAfter.hand).not.toContain(handCard);
    if (dBefore.identity.form === "hero") {
      const at = dBefore.deck.indexOf(other);
      expect(at, `${label}: hero swap took a card that was not the top of the deck`).toBe(0);
      expect(dAfter.deck[at]).toBe(handCard);
      expect(dAfter.deck.length).toBe(dBefore.deck.length);
      expect(dAfter.discard).toEqual(dBefore.discard);
      saw("Domino's hero-form swap (hand card <-> top of deck)", label);
    } else {
      const at = dBefore.discard.indexOf(other);
      expect(at, `${label}: Neena's swap took a card that was not in the discard pile`).toBeGreaterThanOrEqual(0);
      expect(dAfter.discard[at]).toBe(handCard);
      expect(dAfter.discard.length).toBe(dBefore.discard.length);
      expect(dAfter.deck).toEqual(dBefore.deck);
      saw("Neena's alter-ego swap (hand card <-> top of discard pile)", label);
    }
  }

  // A deck discard paid as a cost counts a printed wild twice: Sharpshooter (40064) deals 1 additional damage per
  // counted icon (MC40 p. 21), so its attack's damage is at least the counted icons (or all the hit points left).
  const sharpshooter = events.find(
    (e) => e.type === "abilityResolved" && e.abilityId === "40064.sharpshooter-interrupt",
  );
  if (sharpshooter && sharpshooter.type === "abilityResolved") {
    const paid = events.find(
      (e) => e.type === "cardDiscardedFromDeck" && e.by === sharpshooter.instanceId && e.playerId === id,
    );
    const hit = events.find(
      (e) =>
        e.type === "damageDealt" &&
        e.sourceInstanceId === dBefore.identity.instanceId &&
        !["hero_identity", "ally"].includes(typeOf(before, e.targetInstanceId)),
    );
    if (paid?.type === "cardDiscardedFromDeck" && hit?.type === "damageDealt") {
      const doubled = doublesWild(before, dBefore);
      const paidCard = cardIdOf(before, paid.instanceId);
      const icons = countedIcons(before, paidCard, doubled);
      const profile = characterProfile(before, hit.targetInstanceId as InstanceId, DEPS);
      const left = profile ? profile.maxHp - (before.instances[hit.targetInstanceId]?.damage ?? 0) : Infinity;
      expect(
        hit.amount,
        `${label}: Sharpshooter paid ${nameOf(before, paid.instanceId)} (${icons} counted icons)`,
      ).toBeGreaterThanOrEqual(Math.min(icons, left));
      const wild = (before.cardPool[paidCard] as { resourceIcons?: { wild?: number } }).resourceIcons?.wild ?? 0;
      if (doubled && wild > 0) saw("deck-discard cost paid with a wild counted as 2 (Sharpshooter)", label);
    }
  }

  // Jackpot! (40043): discarded from her deck, its response is offered, and taking it shuffles the card into the deck.
  for (const e of events) {
    if (e.type === "cardDiscardedFromDeck" && e.playerId === id && cardIdOf(after, e.instanceId) === "40043") {
      if (e.at === "discard") tally.jackpotPending = e.instanceId;
      else saw("Jackpot! discarded as the deck's last card (the reset shuffled it in)", label);
    }
  }
  if (tally.jackpotPending) {
    const offered = after.pendingChoice?.options.some((o) => o.optionId.includes("40043.jackpot-response")) ?? false;
    const took = resolved.includes("40043.jackpot-response");
    if (took) {
      expect(dAfter.deck, `${label}: Jackpot! was not shuffled into the deck`).toContain(tally.jackpotPending);
      expect(dAfter.discard).not.toContain(tally.jackpotPending);
    }
    if (took || offered) {
      saw("Jackpot! discarded from her deck offered its response", label);
      tally.jackpotPending = null;
    } else if (events.some((e) => e.type === "stepChanged") || !after.pendingChoice) {
      throw new Error(
        `${label}: Jackpot! was discarded from the top of Domino's deck and its response was never offered`,
      );
    }
  }

  // A deck that ran out is reset (RRG "Player Deck", p. 33): the discard pile is shuffled into a new deck and the
  // player is dealt an encounter card.
  for (const p of before.players) {
    if (!events.some((e) => e.type === "playerDeckReset" && e.playerId === p.playerId)) continue;
    const pAfter = after.players.find((q) => q.playerId === p.playerId)!;
    expect(pAfter.deck.length, `${label}: ${p.playerId}'s deck is empty after its reset`).toBeGreaterThan(0);
    const dealt = events.some(
      (e) =>
        (e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === p.playerId) ||
        (e.type === "encounterCardRevealed" && e.playerId === p.playerId),
    );
    expect(dealt, `${label}: no encounter card dealt on ${p.playerId}'s deck reset`).toBe(true);
    if (p.playerId === id) {
      saw("Domino's deck reset (encounter card dealt)", label);
      if (events.some((e) => e.type === "cardDiscardedFromDeck" && e.playerId === id))
        saw("deck reset during a deck discard", label);
    }
  }

  // Obligation and nemesis cards resolving, and her player side schemes entering play and being defeated.
  for (const e of events) {
    if (
      e.type === "encounterCardRevealed" &&
      ["40065", "40066", "40067", "40068", "40069"].includes(e.cardId as string)
    )
      saw(`obligation/nemesis card ${e.cardId} revealed`, label);
    if (e.type === "cardPlayed" && SIDE_SCHEMES.includes(e.cardId as string))
      saw(`player side scheme ${e.cardId} entered play`, label);
    if (e.type === "schemeDefeated" && SIDE_SCHEMES.includes(e.cardId as string)) {
      saw(`player side scheme ${e.cardId} defeated`, label);
      expect(resolved, `${label}: ${e.cardId}'s When Defeated did not resolve`).toContain(`${e.cardId}.when-defeated`);
    }
  }
}

/** Each player's cards stay in their own hand, deck and discard pile. */
function checkOwnership(label: string, state: GameState): void {
  for (const p of state.players) {
    for (const zone of ["hand", "deck", "discard"] as const) {
      for (const c of p[zone]) {
        const owner = state.instances[c]?.ownerId;
        expect(owner, `${label}: ${nameOf(state, c)} (${c}) in ${p.playerId}'s ${zone} is owned by ${owner}`).toBe(
          p.playerId,
        );
      }
    }
  }
}

function runGame(
  label: string,
  config: GameSetupConfig,
  options: { readonly rounds: number; readonly onEvents?: (round: number, events: readonly GameEvent[]) => void },
): Game {
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const initial = created.state;
  const commands: Command[] = [];
  // Cards a player owned at setup stay theirs (a card put into play under a player's control, a Morlock ally, becomes
  // theirs; nothing of theirs becomes anyone else's).
  const ownedAtStart = new Map(
    initial.players.map((p) => [
      p.playerId,
      Object.values(initial.instances)
        .filter((i) => i.ownerId === p.playerId)
        .map((i) => i.instanceId as string),
    ]),
  );
  const tally: Tally = { jackpotPending: null, swapPending: false };
  const firstPlayerAtRoundStart: string[] = [initial.firstPlayerId];
  let current = initial;
  let turnKey = "";
  let turnCommands = 0;
  const max = 3000;
  while (!current.outcome && current.round <= options.rounds && commands.length < max) {
    const step = current.step;
    const key = step.phase === "player" && step.kind === "turn" ? `${current.round}:${step.activePlayerId}` : "";
    if (key !== turnKey) {
      turnKey = key;
      turnCommands = 0;
    }
    if (!current.pendingChoice && key !== "") turnCommands++;
    let command: Command;
    if (!current.pendingChoice && step.phase === "player" && step.kind === "turn" && turnCommands > 80) {
      command = { type: "endTurn", playerId: step.activePlayerId };
    } else if (current.pendingChoice?.prompt.kind === "declareDefender") {
      command = defend(current);
    } else {
      // The driver picks one command (it probes with the pure `applyCommand`, so what it returns is legal).
      command = playToOutcome(current, DEPS, { maxCommands: 1 }).session.log.commands[0]!;
    }
    const applied = applyCommand(current, command, DEPS);
    if (!applied.ok)
      throw new Error(
        `${label}: illegal ${command.type} after ${commands.length} commands: ${applied.error.code}: ${applied.error.message}`,
      );
    commands.push(command);
    const next = applied.state;
    const choice = next.pendingChoice;
    if (choice && choice.options.length < choice.minSelections)
      throw new Error(
        `${label}: soft lock after ${commands.length} commands: ${choice.prompt.kind} has ${choice.options.length} options and needs ${choice.minSelections}`,
      );
    if (!choice && !next.outcome && next.step.phase !== "player")
      throw new Error(`${label}: stalled in ${next.step.phase}/${next.step.kind} with no prompt`);
    const faults = zoneFaults(next);
    if (faults.length > 0)
      throw new Error(
        `${label}: zone faults after ${command.type} #${commands.length}: ${faults.slice(0, 4).join("; ")}`,
      );
    checkOwnership(label, next);
    for (const [owner, ids] of ownedAtStart) {
      const lost = ids.filter((id) => next.instances[id]?.ownerId !== owner);
      if (lost.length > 0) throw new Error(`${label}: ${owner} no longer owns ${lost.join(", ")}`);
    }
    checkDomino(label, current, next, applied.events, tally);
    options.onEvents?.(current.round, applied.events);
    if (next.round !== current.round) {
      expect(next.round, `${label}: the round counter jumped`).toBe(current.round + 1);
      // Once a player is eliminated the token has nobody to pass to (RRG "Player Elimination"), so it is not compared.
      firstPlayerAtRoundStart.push(next.players.some((p) => p.eliminated) ? "eliminated" : next.firstPlayerId);
    }
    current = next;
  }
  expect(commands.length, `${label}: still going after ${max} commands`).toBeLessThan(max);
  return { label, initial, final: current, commands, rounds: current.round, firstPlayerAtRoundStart };
}

/** The session log replays to the identical state. */
function expectReplays(game: Game): void {
  const replayed = replay({ initialState: game.initial, commands: game.commands }, DEPS);
  expect(replayed.ok, `${game.label}: replay`).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(game.final);
}

const SOLO = [{ starterDeckId: "domino-justice" }];
const DUO = [{ starterDeckId: "domino-justice" }, { starterDeckId: "core-spider-man-justice" }];

describe("Domino precon, Juggernaut (standard), one player", () => {
  it.each([1, 2, 3, 8, 19, 37])(
    "seed %i plays to an outcome and replays deep-equal",
    (seed) => {
      const game = runGame(`juggernaut#${seed}`, wave7Scenario("juggernaut", { players: SOLO, seed }), { rounds: 40 });
      expect(game.final.outcome).not.toBeNull();
      expect(game.rounds).toBeGreaterThanOrEqual(2);
      expectReplays(game);
    },
    120_000,
  );
});

describe("Juggernaut: two boost cards in one villain activation (the observation to run down)", () => {
  // Seed 1: in round 2 Juggernaut schemes (boost card 1, Captive Hope, 3 boost icons), the 3 more threat complete The
  // Unstoppable Juggernaut (target 7 per player, 7 here), whose Forced Interrupt (40121b) step 4 is "Juggernaut attacks
  // each player in player order (even if they are in alter-ego form)". That attack is an enemy attack, and RRG 1.8
  // "Attack (Enemy Activation)" (p. 9) step 1 gives a villain that is attacking one boost card; "Boost" (p. 11): each
  // time the villain attacks or schemes it is given one. So the second boost card is the card doing its job: no bug.
  it("a scheme activation that completes the main scheme deals a second boost card for the attack it causes", () => {
    const flat: { round: number; event: GameEvent }[] = [];
    runGame("juggernaut#1", wave7Scenario("juggernaut", { players: SOLO, seed: 1 }), {
      rounds: 40,
      onEvents: (round, events) => flat.push(...events.map((event) => ({ round, event }))),
    });
    const scheme = flat.findIndex(
      ({ round, event }) => round === 2 && event.type === "enemyActivated" && event.activation === "scheme",
    );
    expect(scheme).toBeGreaterThanOrEqual(0);
    const rest = flat.slice(scheme + 1);
    const nextActivation = rest.findIndex(({ event }) => event.type === "enemyActivated");
    const activation = (nextActivation < 0 ? rest : rest.slice(0, nextActivation)).map(({ event }) => event);
    const names: string[] = [];
    for (const e of activation) {
      if (e.type === "boostCardDealt") names.push("boost");
      else if (e.type === "abilityResolved" && e.abilityId.startsWith("40121b")) names.push(e.abilityId);
    }
    expect(names).toEqual(["boost", "40121b.the-unstoppable-juggernaut-forced-interrupt", "boost"]);
    const attack = activation.findIndex((e) => e.type === "attackResolved");
    expect(attack).toBeGreaterThan(activation.findIndex((e) => e.type === "abilityResolved"));
  });
});

describe("Domino precon, Mister Sinister (standard), one player", () => {
  // Hope Summers in play, three set-aside superpower sets. Seeds that last at least four full rounds.
  it.each([37, 38, 6, 5])(
    "seed %i reaches round 5 (four full rounds) and replays deep-equal",
    (seed) => {
      const config = wave7Scenario("mister-sinister", { players: SOLO, seed });
      expect(config.setAside!.length).toBeGreaterThan(0);
      expect(config.encounterDeck).toContain("40130");
      const game = runGame(`mister-sinister#${seed}`, config, { rounds: 40 });
      expect(game.final.outcome).not.toBeNull();
      expect(game.rounds).toBeGreaterThanOrEqual(5);
      expectReplays(game);
    },
    120_000,
  );
});

describe("Domino precon, Mister Sinister (standard), a short game that reaches Sharpshooter", () => {
  // Seed 4: Sharpshooter's cost discards Lucky and Good (a printed wild), counted as 2 in hero form.
  it("seed 4 plays to an outcome and replays deep-equal", () => {
    const game = runGame("mister-sinister#4", wave7Scenario("mister-sinister", { players: SOLO, seed: 4 }), {
      rounds: 40,
    });
    expect(game.final.outcome).not.toBeNull();
    expectReplays(game);
  });
});

describe("Domino precon + Spider-Man, Morlock Siege (standard), two players", () => {
  it.each([4, 3, 1])(
    "seed %i reaches round 4 (three full rounds) and replays deep-equal",
    (seed) => {
      const game = runGame(`morlock-siege#${seed}`, wave7Scenario("morlock-siege", { players: DUO, seed }), {
        rounds: 40,
      });
      expect(game.final.outcome).not.toBeNull();
      expect(game.rounds).toBeGreaterThanOrEqual(4);
      // The first-player token passes to the next player at the end of every round.
      const order = game.firstPlayerAtRoundStart;
      let passes = 0;
      for (let i = 1; i < order.length; i++) {
        if (order[i] === "eliminated" || order[i - 1] === "eliminated") continue;
        expect(order[i], `first player of round ${i + 1}`).not.toBe(order[i - 1]);
        passes++;
      }
      expect(passes, `${game.label}: rounds with the token passing (${order.join(",")})`).toBeGreaterThanOrEqual(2);
      saw("two-player game, first-player token passes, own-zone ownership", game.label);
      expectReplays(game);
    },
    180_000,
  );
});

/** Domino in hero form at the start of her turn in a real Juggernaut game, past setup, with the given hand and deck sizes. */
function dominoTurn(options: { readonly hand: number; readonly deck: number }): GameState {
  const created = createGame(wave7Scenario("juggernaut", { players: SOLO, seed: 1 }), DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = created.state;
  while (state.pendingChoice || state.step.phase !== "player") {
    const cmd = playToOutcome(state, DEPS, { maxCommands: 1 }).session.log.commands[0]!;
    const applied = applyCommand(state, cmd, DEPS);
    if (!applied.ok) throw new Error(applied.error.message);
    state = applied.state;
  }
  const changed = applyCommand(state, { type: "changeForm", playerId: dominoOf(state)!.playerId }, DEPS);
  if (!changed.ok) throw new Error(changed.error.message);
  state = changed.state;
  // Surgery for staging only: the surplus cards go to the discard pile, so every card is still in exactly one zone.
  const player = dominoOf(state)!;
  const hand = player.hand.slice(0, options.hand);
  const deck = player.deck.slice(0, options.deck);
  const surplus = [...player.hand.slice(options.hand), ...player.deck.slice(options.deck)];
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player.playerId ? { ...p, hand, deck, discard: [...surplus, ...p.discard] } : p,
    ),
  };
}

const swapCommand = (state: GameState): Command =>
  ({
    type: "useAbility",
    playerId: dominoOf(state)!.playerId,
    cardInstanceId: dominoOf(state)!.identity.instanceId,
    abilityId: "40037a.domino-action",
    payment: [],
  }) as unknown as Command;

describe("Domino's hero-form swap needs a card in both places to be initiated", () => {
  it("is offered with cards in hand and in the deck (control)", () => {
    const state = dominoTurn({ hand: 2, deck: 5 });
    expect(applyCommand(state, swapCommand(state), DEPS).ok).toBe(true);
  });

  // RRG 1.8 "Target" (p. 42): 'The phrase "choose a [game element]" indicates that one or more targets must be selected
  // in order for an ability to initiate', and an ability with a required target "can only be initiated if it has at least
  // one valid target". "Choose a card in your hand" has no valid target with an empty hand, so the Action cannot be
  // initiated (it is not spent against its once-per-round limit). Once pinned as initiated and reporting `swapRefused`
  // (missingCard), seen in game juggernaut#1 and #5 (hand 0, deck 34).
  it("is refused with no card in hand (RRG 'Target', p. 42)", () => {
    const state = dominoTurn({ hand: 0, deck: 5 });
    expect(dominoOf(state)!.hand).toHaveLength(0);
    expect(dominoOf(state)!.identity.form).toBe("hero");
    const result = applyCommand(state, swapCommand(state), DEPS);
    expect(result.ok ? "ok" : result.error.code).toBe("no_valid_target");
  });

  // Same rule for "the top card of your deck": 'choose' with nothing to choose is not initiated.
  it("is refused with no card in the deck (RRG 'Target', p. 42)", () => {
    const state = dominoTurn({ hand: 2, deck: 0 });
    expect(dominoOf(state)!.deck).toHaveLength(0);
    expect(dominoOf(state)!.identity.form).toBe("hero");
    const result = applyCommand(state, swapCommand(state), DEPS);
    expect(result.ok ? "ok" : result.error.code).toBe("no_valid_target");
  });
});

describe("targeted checks", () => {
  it("saw every Domino rule at least once across the games above", () => {
    const required = [
      "Domino's hero-form swap (hand card <-> top of deck)",
      "Neena's alter-ego swap (hand card <-> top of discard pile)",
      "deck-discard cost paid with a wild counted as 2 (Sharpshooter)",
      "Jackpot! discarded from her deck offered its response",
      "Domino's deck reset (encounter card dealt)",
      "deck reset during a deck discard",
      "Memories of Armageddon blanks her identity (swap not offered)",
      "player side scheme 40054 entered play",
      "player side scheme 40054 defeated",
      "player side scheme 40059 entered play",
      "player side scheme 40059 defeated",
      "two-player game, first-player token passes, own-zone ownership",
    ];
    const missing = required.filter((check) => !SEEN.has(check));
    expect(missing, `never seen: ${missing.join("; ")}`).toEqual([]);
    expect([...SEEN.keys()].some((k) => k.startsWith("obligation/nemesis card"))).toBe(true);
  });
});
