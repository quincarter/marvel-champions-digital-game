/**
 * The five aspect "Try it" games (guided mode G10d, `docs/guided-mode.md` §3.7, §4 G10d): one `SessionConfig` per
 * aspect, each Core Rhino (standard, solo, `bomb_scare`) with that aspect's Core precon (`guide/aspects.ts`'s own
 * `AspectGuide.preconId`) and a stacked opening hand that guarantees the aspect's own "play it" signature card is
 * in hand and affordable from turn one — the same "predictable openings" shape `guide/tutorial-config.ts` (G5a)
 * uses for the five scripted tutorial lessons, generalized to four short one-lesson runs instead of one five-lesson
 * run. `guide/aspect-lessons.ts` is the lesson data written against these stacks; `aspect-tryit-config.test.ts`
 * proves each stack's own precondition against a real session core.
 *
 * **No encounter stack.** Unlike `TUTORIAL_CONFIG`, none of these stacks the encounter deck: an aspect lesson only
 * teaches "notice the signature card, play it" (`guide/aspect-lessons.ts`), which never depends on what the villain
 * reveals, so the seed alone (an ordinary shuffled encounter deck) is enough for a replay-safe game.
 *
 * **One signature card each, chosen to be playable turn one with no board dependency** — not a scheme with threat
 * on it, not a minion, not an ally already in play (For Justice!, Relentless Assault/Uppercut, Inspired, and
 * Counter-Punch, from the same aspects' own `AspectGuide.signatureCardCodes`, all fail one of those, which is why
 * a *different* member of each aspect's own three-card list is used here):
 * - Justice (Spider-Man): Daredevil (01058, ally, cost 4, needs a [physical] resource) — Strength (01090,
 *   [physical] 2) + Genius (01089, [mental] 2) pays exactly 4, with the physical icon Strength alone supplies.
 * - Aggression (She-Hulk): Hulk (01050, ally, cost 2, needs an [energy] resource) — Energy (01088, [energy] 2)
 *   pays it alone, the same single-card shape `TUTORIAL_CONFIG` uses for Black Cat.
 * - Leadership (Captain Marvel): Maria Hill (01067, ally, cost 2, needs a [mental] resource) — Genius ([mental] 2)
 *   pays it alone.
 * - Protection (Black Panther): Armored Vest (01081, upgrade, cost 1, needs a [mental] resource, "Play under any
 *   player's control" — no target at all) — Ancestral Knowledge (01042, an ordinary Black Panther event, printed
 *   [mental] 1) discarded alone pays exactly 1, the same "any hand card's own printed icon pays for another card"
 *   rule `TUTORIAL_CONFIG`'s header already documents for Energy, applied here to a non-resource card instead.
 *
 * Every other stacked card is round-one-harmless filler from that hero's own precon — nothing that forces a
 * decision or tempts a misplay before the player gets to the signature card.
 */
import type { PlayerId } from "@mc/engine";
import { playerId } from "@mc/engine";
import type { CardId } from "@mc/content";
import { cardId } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";

/** The lone seat in every aspect "Try it" game — same shape as `TUTORIAL_PLAYER_ID`. */
export const ASPECT_TRYIT_PLAYER_ID: PlayerId = playerId("p1");

/** The five aspects with a "Try it" game (§3.7) — Basic has a tip card only. */
export type AspectTryItId = "justice" | "aggression" | "leadership" | "protection" | "pool";

export interface AspectTryItConfig {
  readonly config: SessionConfig;
  /** The card `guide/aspect-lessons.ts`'s own lesson is built around — in the stacked opening hand, and playable
   * turn one for the reason given in this module's own header. */
  readonly signatureCardId: CardId;
}

const JUSTICE: AspectTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 4001,
    stack: {
      players: {
        0: [
          cardId("01058"), // Daredevil — this lesson's own "play it" signature card
          cardId("01090"), // Strength (physical 2)
          cardId("01089"), // Genius (mental 2) — together with Strength, exactly Daredevil's cost 4
          cardId("01006"), // Aunt May — round-1-harmless filler
          cardId("01007"), // Spider-Tracer — filler
          cardId("01003"), // Backflip — filler
        ],
      },
    },
  },
  signatureCardId: cardId("01058"),
};

const AGGRESSION: AspectTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "core-she-hulk-aggression" }],
    seed: 4002,
    stack: {
      players: {
        0: [
          cardId("01050"), // Hulk — this lesson's own "play it" signature card
          cardId("01088"), // Energy (energy 2) — exactly Hulk's cost 2
          cardId("01026"), // Superhuman Law Division — filler
          cardId("01027"), // Focused Rage — filler
          cardId("01028"), // Superhuman Strength — filler
          cardId("01022"), // Ground Stomp — filler
        ],
      },
    },
  },
  signatureCardId: cardId("01050"),
};

const LEADERSHIP: AspectTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "core-captain-marvel-leadership" }],
    seed: 4003,
    stack: {
      players: {
        0: [
          cardId("01067"), // Maria Hill — this lesson's own "play it" signature card
          cardId("01089"), // Genius (mental 2) — exactly Maria Hill's cost 2
          cardId("01015"), // Alpha Flight Station — filler
          cardId("01016"), // Captain Marvel's Helmet — filler
          cardId("01017"), // Cosmic Flight — filler
          cardId("01018"), // Energy Channel — filler
        ],
      },
    },
  },
  signatureCardId: cardId("01067"),
};

const PROTECTION: AspectTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "core-black-panther-protection" }],
    seed: 4004,
    stack: {
      players: {
        0: [
          cardId("01081"), // Armored Vest — this lesson's own "play it" signature card
          cardId("01042"), // Ancestral Knowledge (printed mental 1) — exactly Armored Vest's cost 1, discarded alone
          cardId("01045"), // The Golden City — filler
          cardId("01047"), // Panther Claws — filler
          cardId("01048"), // Tactical Genius — filler
          cardId("01080"), // Med Team — filler
        ],
      },
    },
  },
  signatureCardId: cardId("01081"),
};

/**
 * 'Pool (Deadpool, `deadpool-pool`): still Core Rhino, but the playable scenario builder adds the Dreadpool set
 * because a 'Pool deck is seated (engine `autoIncludedSetsInGame`, RRG 1.8 FAQ p. 64), so the game itself shows the
 * aspect's cost. The lesson flips Deadpool, plays Dogpool (cost 3, his acceleration icon adds threat in Rhino's
 * phase) and, in round 2, "I Got This" (cost 1), which reads that icon: remove 2 threat from a scheme. Nothing in
 * this opening is out-of-game (no Break Time) and "I Got This" needs no target while there is one scheme.
 * - Dogpool paid by Maximum Effort, Exhausting Personality and "Yoo-Hoo!" (one icon each, discarded as payment only).
 * - "I Got This" paid by Metaknowledge, kept in hand through round 1.
 */
const POOL: AspectTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "deadpool-pool" }],
    seed: 4301,
    stack: {
      players: {
        0: [
          cardId("44013"), // Dogpool — this lesson's own "play it" signature card
          cardId("44004"), // Maximum Effort (physical 1)
          cardId("44003"), // Exhausting Personality (mental 1)
          cardId("44006"), // "Yoo-Hoo!" (energy 1)
          cardId("44021"), // "I Got This": played in round 2
          cardId("44005"), // Metaknowledge (mental 1): pays for "I Got This"
        ],
      },
    },
  },
  signatureCardId: cardId("44013"),
};

/** One entry per aspect with a "Try it" game — `guide/aspect-lessons.ts` and `guide/start-aspect-tryit.ts` both key
 * off this. */
export const ASPECT_TRYIT_CONFIGS: Readonly<Record<AspectTryItId, AspectTryItConfig>> = {
  justice: JUSTICE,
  aggression: AGGRESSION,
  leadership: LEADERSHIP,
  protection: PROTECTION,
  pool: POOL,
};
