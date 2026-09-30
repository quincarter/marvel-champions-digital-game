/**
 * The tutorial game (docs/guided-mode.md G5a, §3.1–4, §5.1): Rhino, standard, solo Spider-Man (Justice), with a
 * `bomb_scare` modular and a stacked opening so the five lessons land exactly where §5.1 says they do.
 *
 * A fixed seed alone would still shuffle the deck randomly; `SessionConfig.stack` (G1, `@mc/engine`'s `SetupStack`)
 * is what makes the opening hand and the first two encounter cards replay-safe. Both are needed: the seed pins
 * everything the stack doesn't (the villain's own round-2-onward boost draws, side scheme placement, and so on),
 * and the stack pins the cards the lessons actually read.
 *
 * **The opening hand (6 cards, Peter Parker's alter-ego hand size):**
 * - Black Cat (01002, cost 2) — the ally lesson 2 plays (paid for while still Peter Parker, before the flip) and
 *   lesson 4 relies on as a defender.
 * - Interrogation Room (01063, cost 1, prints one [energy] resource) — lesson 2's second payer: a support that
 *   does nothing until a minion is defeated (its own "After you defeat a minion" response), so discarding it round
 *   1 costs nothing a player would actually want. It combines with Peter Parker's own Scientist ability (his
 *   alter-ego "Resource: Generate a [mental] resource", limit once per round) to pay Black Cat's cost of 2 exactly
 *   — 1 (Scientist) + 1 (Interrogation Room) — with no overpay, unlike Energy (01088, a double print that would
 *   pay the whole cost alone and trip Hold on!'s `wastedPay` heuristic). Energy stays in the deck; it isn't in the
 *   stacked opening hand at all now.
 * - For Justice! (01060, Justice, cost 2) — a Justice card worth playing later (not stacked to be played round 1).
 * - Aunt May (01006), Spider-Tracer (01007), Backflip (01003) — round-1-harmless filler: an alter-ego heal support,
 *   an upgrade with no legal target until a minion is in play, and a defense event that can only be played as an
 *   interrupt. None of them tempts a misplay before the lessons get to them.
 *
 * **The encounter deck's first two cards:**
 * - Armored Rhino Suit (01098, boost 0) — round 1's boost card. Before the first encounter card is ever revealed,
 *   the villain's activation deals a boost card from the top of the encounter deck and adds its boost icons to the
 *   activation's stat (RRG "Boost Icons"). A boost-0 card keeps Rhino's printed ATK (2) unboosted for the round-1
 *   attack lesson 4 walks through.
 * - Advance (01186, boost 0, "When Revealed: The villain schemes.") — the first card actually revealed. It adds a
 *   second, ordinary villain activation (a scheme) with no damage and no player decision, so round 2 opens with
 *   threat on the main scheme for lesson 5's thwart without any surprises along the way.
 *
 * **Why Black Cat is played before the flip, and Spider-Man flips in round 1 regardless.** §5.1 now stages
 * "Paying for cards" (lesson 2) before "Hero & alter-ego" (lesson 3) — the owner's reorder, since Peter Parker's
 * own Scientist ability only exists on the alter-ego face, so Black Cat has to be played while still Peter. §5.1
 * also stages "The villain phase" as a round-1 lesson, which only works if Rhino *attacks* that round — and RRG
 * has the villain scheme instead of attack while every hero is in alter-ego form. `TUTORIAL_SCRIPT` therefore
 * flips to hero form after playing Black Cat but before ending the round-1 turn, exactly as lesson 3 ("Flip once
 * per turn") teaches. The Break-In!'s printed acceleration (+1 threat/player, every villain phase, from round 1
 * on) still places 1 threat during round 1's villain phase regardless of form — that's what lesson 4 calls
 * "threat is placed" before the villain activates, and it's why round 1's own threat isn't yet lesson 5's concern
 * (nothing thwartable exists until round 1's *player* phase, before that placement happens).
 *
 * **What actually happens to Black Cat.** Declaring her as defender exhausts her and she takes the full attack
 * (RRG "Defend"): Rhino's printed ATK 2 exactly equals her printed HP 2, so she's defeated absorbing it — Spider-Man
 * takes zero damage. That is the intended, RRG-correct outcome for "Black Cat blocks" in lesson 4; the lesson does
 * not require her to survive, only to demonstrate that an ally can take a hit meant for the hero.
 *
 * **The owner's "Attack Rhino" addition (2026-09-29).** Lesson 3, right after the flip, now has both Spider-Man
 * (ATK 2) and Black Cat (ATK 1, 0 consequential damage on her own attack — the card's own `consequentialDamage`,
 * only her *thwart* costs 1) attack Rhino once each: his stage-1 HP drops from 14 to 11. Neither attack changes
 * lesson 4's own math — Black Cat is still exactly full HP (2) when she defends, since attacking cost her nothing —
 * and both attackers ready again at the end of the player phase (RRG "Ready", the end-of-phase ready step), so
 * Black Cat is exhausted from her own attack but ready again in time to defend Rhino's round-1 attack.
 */
import type { Command, PlayerId } from "@mc/engine";
import { choiceId, instanceId, playerId } from "@mc/engine";
import { abilityId, cardId } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";

/** The lone seat in the tutorial game. */
export const TUTORIAL_PLAYER_ID: PlayerId = playerId("p1");

/**
 * Rhino, standard, solo Spider-Man (Justice), `bomb_scare` modular, stacked opening (see file header). The seed
 * (2024) is otherwise arbitrary — the stack pins every card either lesson reads, and nothing in §5.1 depends on an
 * unstacked draw.
 */
export const TUTORIAL_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  modularSetIds: ["bomb_scare"],
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2024,
  stack: {
    players: {
      0: [
        cardId("01002"), // Black Cat
        cardId("01063"), // Interrogation Room
        cardId("01060"), // For Justice!
        cardId("01006"), // Aunt May
        cardId("01007"), // Spider-Tracer
        cardId("01003"), // Backflip
      ],
    },
    encounter: [
      cardId("01098"), // Armored Rhino Suit — round 1's boost card (boost 0)
      cardId("01186"), // Advance — the first revealed encounter card (boost 0, "the villain schemes")
    ],
  },
};

/**
 * The command a tutorial player issues to walk `TUTORIAL_CONFIG` from setup through round 1's villain phase to
 * round 2's player phase, one command per lesson beat (docs/guided-mode.md §5.1). Every command here needs no
 * further input from the engine (no ability choices, no ordering prompts) except the ones this list itself answers,
 * so a test can dispatch them in order and assert each lesson's precondition after the matching step.
 *
 * Reused by later boxes (G5b/G7) so the lesson model and controller drive the exact same path this file proves.
 * `instanceId`s are what `createGame` assigns this stacked setup, in this order, every time (replay-safe): `i1` is
 * Rhino (the villain), `i3` is Spider-Man's identity, `i4` is Black Cat, `i27` is Interrogation Room.
 */
export const TUTORIAL_SCRIPT: readonly Command[] = [
  // Setup step 15 (mulligan): keep the stacked hand, discard nothing.
  { type: "resolveChoice", playerId: TUTORIAL_PLAYER_ID, choiceId: choiceId("c1"), selectedOptionIds: [] },
  // Lesson 2: play Black Cat (i4), still as Peter Parker — paying her cost 2 with his own Scientist ability
  // (i3, "Resource: Generate a [mental] resource") plus Interrogation Room (i38) discarded for its printed
  // [energy] resource. Any resource type pays any cost; only Black Cat's own text cares that these happen to be
  // mental/energy, not physical.
  {
    type: "playCard",
    playerId: TUTORIAL_PLAYER_ID,
    cardInstanceId: instanceId("i4"),
    payment: [
      { ability: { instanceId: instanceId("i3"), abilityId: abilityId("01001b.scientist") } },
      { fromHand: instanceId("i27") },
    ],
    attachToInstanceId: null,
  },
  // Lesson 3: flip to Spider-Man.
  { type: "changeForm", playerId: TUTORIAL_PLAYER_ID },
  // Lesson 3's own "Attack Rhino" steps (owner addition, 2026-09-29): Black Cat attacks first (ATK 1, 0
  // consequential damage on attack), then Spider-Man (ATK 2) — both exhaust attacking, and both ready again at the
  // end of the player phase, so Black Cat is still available to defend Rhino's round-1 attack (lesson 4).
  {
    type: "basicAttack",
    playerId: TUTORIAL_PLAYER_ID,
    attackerInstanceId: instanceId("i4"),
    targetInstanceId: instanceId("i1"),
  },
  {
    type: "basicAttack",
    playerId: TUTORIAL_PLAYER_ID,
    attackerInstanceId: instanceId("i3"),
    targetInstanceId: instanceId("i1"),
  },
  { type: "endTurn", playerId: TUTORIAL_PLAYER_ID },
  // End-of-player-phase discard down to hand size: nothing to discard with the stacked hand.
  { type: "resolveChoice", playerId: TUTORIAL_PLAYER_ID, choiceId: choiceId("c2"), selectedOptionIds: [] },
  // Rhino's round-1 attack offers Spider-Sense (an interrupt draw) before the defend prompt; the script declines it.
  { type: "resolveChoice", playerId: TUTORIAL_PLAYER_ID, choiceId: choiceId("c3"), selectedOptionIds: [] },
  // Lesson 4: defend Rhino's attack with Black Cat (i4).
  { type: "resolveChoice", playerId: TUTORIAL_PLAYER_ID, choiceId: choiceId("c4"), selectedOptionIds: ["i4"] },
];
