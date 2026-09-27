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
 * - Black Cat (01002, cost 2) — the ally lesson 3 plays and lesson 4 relies on as a defender.
 * - Energy (01088, produces 2 generic resources) — one card that pays Black Cat's cost 2 exactly, so lesson 3
 *   doesn't need to explain splitting a payment across two cards. The Power of Justice (01062) was the other
 *   candidate raised in §5.1, but it only doubles "while paying for a Justice (yellow) card" and Black Cat is a
 *   basic (grey) ally, so it would generate 1 resource here, not 2 — wrong for this lesson. Energy is a basic
 *   (aspect "basic") card, so nothing about it is Justice-specific to explain either.
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
 * **Why Spider-Man flips in round 1.** §5.1 stages "The villain phase" as a round-1 lesson, which only works if
 * Rhino *attacks* that round — and RRG has the villain scheme instead of attack while every hero is in alter-ego
 * form. `TUTORIAL_SCRIPT` therefore flips to hero form before ending the round-1 turn, exactly as lesson 2
 * ("Flip once per turn") teaches. The Break-In!'s printed acceleration (+1 threat/player, every villain phase,
 * from round 1 on) still places 1 threat during round 1's villain phase regardless of form — that's what lesson 4
 * calls "threat is placed" before the villain activates, and it's why round 1's own threat isn't yet lesson 5's
 * concern (nothing thwartable exists until round 1's *player* phase, before that placement happens).
 *
 * **What actually happens to Black Cat.** Declaring her as defender exhausts her and she takes the full attack
 * (RRG "Defend"): Rhino's printed ATK 2 exactly equals her printed HP 2, so she's defeated absorbing it — Spider-Man
 * takes zero damage. That is the intended, RRG-correct outcome for "Black Cat blocks" in lesson 4; the lesson does
 * not require her to survive, only to demonstrate that an ally can take a hit meant for the hero.
 */
import type { Command, PlayerId } from "@mc/engine";
import { choiceId, instanceId, playerId } from "@mc/engine";
import { cardId } from "@mc/content";
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
        cardId("01088"), // Energy
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
 * `instanceId`s are what `createGame` assigns this stacked setup, in this order, every time (replay-safe): `i3` is
 * Spider-Man's identity, `i4` is Black Cat.
 */
export const TUTORIAL_SCRIPT: readonly Command[] = [
  // Setup step 15 (mulligan): keep the stacked hand, discard nothing.
  { type: "resolveChoice", playerId: TUTORIAL_PLAYER_ID, choiceId: choiceId("c1"), selectedOptionIds: [] },
  // Lesson 2: flip to Spider-Man.
  { type: "changeForm", playerId: TUTORIAL_PLAYER_ID },
  // Lesson 3: play Black Cat (i4), paying her cost 2 with Energy (i38) alone.
  {
    type: "playCard",
    playerId: TUTORIAL_PLAYER_ID,
    cardInstanceId: instanceId("i4"),
    payment: [{ fromHand: instanceId("i38") }],
    attachToInstanceId: null,
  },
  { type: "endTurn", playerId: TUTORIAL_PLAYER_ID },
  // End-of-player-phase discard down to hand size: nothing to discard with the stacked hand.
  { type: "resolveChoice", playerId: TUTORIAL_PLAYER_ID, choiceId: choiceId("c2"), selectedOptionIds: [] },
  // Rhino's round-1 attack offers Spider-Sense (an interrupt draw) before the defend prompt; the script declines it.
  { type: "resolveChoice", playerId: TUTORIAL_PLAYER_ID, choiceId: choiceId("c3"), selectedOptionIds: [] },
  // Lesson 4: defend Rhino's attack with Black Cat (i4).
  { type: "resolveChoice", playerId: TUTORIAL_PLAYER_ID, choiceId: choiceId("c4"), selectedOptionIds: ["i4"] },
];
