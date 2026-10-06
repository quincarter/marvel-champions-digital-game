/**
 * The hero-mechanic "Try it" games (guided mode §3.14, `docs/guided-mode.md`): one `SessionConfig` per lesson, each
 * a solo standard Rhino game (`bomb_scare`, like the aspect Try-its in `guide/aspect-tryit-config.ts`) with the
 * hero the mechanic belongs to and a seed that pins the opening. `guide/mechanic-lessons.ts` is the lesson data
 * written against these openings; `mechanic-lessons.test.ts` plays every lesson to completion through the real
 * engine with the real card scripts, so a seed or card change that breaks an opening fails there.
 *
 * Every setup choice the engine asks before the first turn (the mulligan, a hero's own setup pick) is answered the
 * way `guide/start-mechanic-tryit.ts` answers it: kept as dealt, or the first option listed. Both are fixed by the
 * seed, which is what makes a lesson replay-safe.
 */
import { cardId } from "@mc/content";
import type { PlayerId } from "@mc/engine";
import { playerId } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import type { MechanicTryItId } from "./mechanic-tryits.js";

/** The lone seat in every mechanic "Try it" game. */
export const MECHANIC_TRYIT_PLAYER_ID: PlayerId = playerId("p1");

export interface MechanicTryItConfig {
  readonly config: SessionConfig;
}

/**
 * - Storm (`storm-leadership`): the setup pick takes the first Weather listed, Clear Skies. She starts as Ororo
 *   Munroe, so the lesson flips her first (Weather Control is printed on her hero side).
 */
const STORM: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "storm-leadership" }],
    seed: 4101,
  },
};

/**
 * - Phoenix (`phoenix-justice`): the stacked cards are her opening hand (Down Time, two Phoenix Firebirds, and the
 *   three resource cards) followed by round 2's two draws (Mission Training, twice, harmless filler). The lesson takes
 *   Phoenix Force from 4 power counters to 0 over two rounds: Down Time paid by Psionic Bond and one Firebird paid by
 *   Energy in round 1 (4 to 2), then the other Firebird paid by Psionic Bond in round 2 (2 to 0, which flips it).
 */
const PHOENIX: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "phoenix-justice" }],
    seed: 4102,
    stack: {
      players: {
        0: [
          cardId("34024"), // Down Time: cost 1, the Psionic Bond play
          cardId("34013"), // Phoenix Firebird (A): paid by Energy in round 1
          cardId("34013"), // Phoenix Firebird (B): kept for round 2
          cardId("34025"), // Energy
          cardId("34026"), // Genius
          cardId("34027"), // Strength
          cardId("34016"), // Mission Training: round 2's draws
          cardId("34016"),
        ],
      },
    },
  },
};

/**
 * - Shadowcat (`shadowcat-aggression`): she starts as Kitty Pryde with her mass form upgrade Solid side up. Phase
 *   Control (an alter-ego action) flips it to Phased; she then flips to hero form so Rhino attacks her in round 1's
 *   villain phase (he schemes against an alter-ego), and defending while Phased takes no damage.
 */
const SHADOWCAT: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "shadowcat-aggression" }],
    seed: 4103,
  },
};

/**
 * - Gambit (`gambit-justice`): the stacked hand is Charged Card (an ATTACK event, cost 2), two Molecular Accelerations
 *   (each places a charge counter when it is spent) and the three resource cards. The lesson flips him to hero form,
 *   places a counter with Charge de Card, then pays for Charged Card with Molecular Acceleration and Energy: two
 *   counters are on Gambit when Throw de Card asks how many to remove, "up to 3".
 */
const GAMBIT: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "gambit-justice" }],
    seed: 4105,
    stack: {
      players: {
        0: [
          cardId("37006"), // Charged Card
          cardId("37010"), // Molecular Acceleration
          cardId("37010"), // Molecular Acceleration (spare)
          cardId("37022"), // Energy
          cardId("37023"), // Genius
          cardId("37024"), // Strength
        ],
      },
    },
  },
};

/**
 * - Rogue (`rogue-protection`): she starts as Anna Marie; setup finds Touched and sets it aside. The lesson flips her
 *   to hero form and uses Skin Contact on Rhino, the only other character in play in round 1 (a villain host).
 */
const ROGUE: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "rogue-protection" }],
    seed: 4106,
  },
};

/**
 * - Colossus (`colossus-protection`): the stacked hand is Bulletproof Protector (cost 0), Titanium Muscles (cost 2),
 *   Steel Fist (cost 2) and the three resource cards; setup's Organic Steel search adds a seventh card. The lesson
 *   flips him (Steel Skin gives the first tough card), uses Bulletproof Protector to hold two, pays for Titanium
 *   Muscles with Energy and Genius, then pays for Steel Fist with Titanium Muscles' own resource: one [physical] per
 *   tough card, so exactly its cost of 2.
 */
const COLOSSUS: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "colossus-protection" }],
    seed: 4107,
    stack: {
      players: {
        0: [
          cardId("32009"), // Bulletproof Protector
          cardId("32005"), // Titanium Muscles
          cardId("32008"), // Steel Fist
          cardId("32022"), // Energy
          cardId("32023"), // Genius
          cardId("32024"), // Strength
        ],
      },
    },
  },
};

/**
 * - Psylocke (`psylocke-justice`): she starts as Betsy Braddock with both permanent Psi-Knives already attached to her
 *   identity (her Setup, `wave7/psylocke/psylocke/identity.ts`), Knife side up. The lesson flips her to hero form and
 *   uses her basic attack on Rhino, accepting Psi-Energy Control to flip one blade to its Katana side.
 */
const PSYLOCKE: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "psylocke-justice" }],
    seed: 4202,
  },
};

/**
 * - Angel (`angel-protection`): he starts as Warren Worthington III. The lesson changes him to Archangel (his board's
 *   "Which form?" picker asks which hero face), then, after round 1's villain phase, to Angel (hero face 0) in round 2.
 */
const ANGEL: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "angel-protection" }],
    seed: 4203,
  },
};

/**
 * - Cable (`cable-leadership`): he starts as Nathan Summers; Soldier X's setup takes the first side scheme listed,
 *   Call for Backup, into play (3 threat solo). The dealt hand holds Build Support (a second player side scheme, cost 1)
 *   and Psimitar (an energy resource that pays for it). The lesson flips him, thwarts Call for Backup once, then plays
 *   Build Support at the limit of one.
 */
const CABLE: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "cable-leadership" }],
    seed: 4201,
  },
};

/**
 * - X-23 (`x-23-aggression`): the stacked hand is Specialized Training (a basic player side scheme, cost 1, 5 threat
 *   solo), Claw Mastery, Animal Instinct and the three resource cards. X-23 has ATK 1 and THW 2, so one turn is enough:
 *   Claw Mastery makes her ATK 3, and Animal Instinct then adds her ATK to a basic thwart (2 + 3 = 5, exactly the
 *   scheme). Genius pays for Training and Energy for Claw Mastery; Animal Instinct costs 0. The lesson flips her, plays
 *   both, thwarts, and takes a Specialist from the set-aside when Training is defeated.
 */
const X23: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "x-23-aggression" }],
    seed: 4204,
    stack: {
      players: {
        0: [
          cardId("43021"), // Specialized Training: cost 1
          cardId("43005"), // Claw Mastery: cost 1, +2 ATK
          cardId("43004"), // Animal Instinct: cost 0, adds ATK to a thwart
          cardId("43022"), // Energy: pays for Claw Mastery
          cardId("43023"), // Genius: pays for Specialized Training
          cardId("43024"), // Strength (spare)
        ],
      },
    },
  },
};

export const MECHANIC_TRYIT_CONFIGS: Readonly<Record<MechanicTryItId, MechanicTryItConfig>> = {
  storm: STORM,
  phoenix: PHOENIX,
  shadowcat: SHADOWCAT,
  gambit: GAMBIT,
  rogue: ROGUE,
  colossus: COLOSSUS,
  psylocke: PSYLOCKE,
  angel: ANGEL,
  cable: CABLE,
  x23: X23,
};
