import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  action,
  cannotLeavePlay,
  chooseOne,
  choosePlayer,
  chosenPlayer,
  confuse,
  consideredToHaveResourceIcon,
  constant,
  defineAbilities,
  dealDamage,
  draw,
  exhaustThis,
  gets,
  giveTough,
  inHand,
  on,
  option,
  query,
  reaching,
  reduceNextCardCost,
  removeThreat,
  response,
  rule,
  theMainScheme,
  theVillain,
  you,
  yourIdentity,
} from "../../../dsl/index.js";
import { INTO_THE_MISSION, MISSION_AREA, missionAttempt } from "./mission-rules.js";

/**
 * Campaign-only encounter set `aoa_basic_campaign` (campaign mode only; docs/phase7-wave8.md §1.27, §3.42).
 *
 * The four campaign allies share one shape: "Response: After [this ally] enters your hand, ..." is
 * `inHand(response(on.thisEntersYourHand(), ...))`, optional, each time it enters a hand (the b face's hand-out, a
 * draw, a search, the starting hand). Played to the mission they are blank like any ally.
 *
 * Mission Team (45171a/b): one support with two faces (`flipSide`). Both say "cannot be discarded and the first player
 *   gains control of it" (section 3.35). The [MISSION] face's Action chooses the cost reduction by destination or a
 *   mission attempt (`missionAttempt()`, `mission-rules.ts`); the [FINISHED] face's has a player draw 1 card. The
 *   mission's own text flips it or removes it from the game, and neither is a discard.
 * Desperate Measures (45176): the stats and the considered [wild] icon, on a constant that reaches the mission area
 *   (section 3.42, section 4.1 Q19 = B).
 *
 * Cards (6):
 * - 45171a Mission Team (support)
 * - 45172 Destiny (ally)
 * - 45173 Blink (ally)
 * - 45174 Morph (ally)
 * - 45175 X-Man (ally)
 * - 45176 Desperate Measures (upgrade)
 */
const onEntersYourHand = (...effects: EffectSpec[]) => inHand(response(on.thisEntersYourHand(), ...effects));

/**
 * "Mission Team cannot be discarded and the first player gains control of it." Both faces. No discard moves it and no
 * cost may choose it (`cannotLeavePlay` by discard, section 3.35); the mission's own text removes it from the game or
 * flips it, and neither is a discard. It follows the first player token in whatever state it is in (RRG 1.8
 * "Ownership and Control", p. 31).
 */
const missionTeamConstant = () =>
  constant(
    cannotLeavePlay({ self: true }, { by: "discard" }),
    rule({ kind: "controlledByFirstPlayer", target: { self: true } }),
  );

const ATTACHED_ALLY = query("ally", { hostOfSelf: true });

export const AOA_BASIC_CAMPAIGN: AbilityRegistry = defineAbilities({
  "45171a.mission-team-constant": missionTeamConstant(),
  // Action: Exhaust Mission Team -> choose:
  // - Reduce the cost of the next ally played to the mission this phase by 2. (RRG 1.8 p. 69 added "this phase".) "The
  //   next ally played", by any player, and only a play to the mission uses it (section 3.35).
  // - Make a mission attempt. Both are always choosable, an attempt with no ally at the mission included (section 3.40).
  "45171a.mission-team-action": reaching(
    MISSION_AREA,
    action(
      { cost: exhaustThis },
      chooseOne(
        option(
          "Reduce the cost of the next ally played to the mission this phase by 2",
          reduceNextCardCost(you, 2, "phase", query("ally"), { into: INTO_THE_MISSION, anyPlayer: true }),
        ),
        option("Make a mission attempt", ...missionAttempt()),
      ),
    ),
  ),
  "45171b.mission-team-constant": missionTeamConstant(),
  // Action: Exhaust Mission Team -> choose a player to draw 1 card.
  "45171b.mission-team-action": action({ cost: exhaustThis }, choosePlayer("player"), draw(1, chosenPlayer("player"))),

  // Response: After Destiny enters your hand, remove 2 threat from the main scheme.
  "45172.destiny-response": onEntersYourHand(removeThreat(2, theMainScheme)),
  // Response: After Blink enters your hand, deal 2 damage to the villain.
  "45173.blink-response": onEntersYourHand(dealDamage(2, theVillain)),
  // Response: After Morph enters your hand, confuse the villain.
  "45174.morph-response": onEntersYourHand(confuse(theVillain)),
  // Response: After X-Man enters your hand, give your identity a tough status card.
  "45175.x-man-response": onEntersYourHand(giveTough(yourIdentity)),

  // Attached ally gets +1 THW, +1 ATK, +1 hit point, and is considered to have a wild ([wild]) resource icon in
  // addition to its printed resource icon. The one upgrade written for the mission: its constant reaches the closed
  // mission area (section 3.33, section 4.1 Q19 = B), where an ordinary upgrade does nothing. The icon is read by a
  // mission attempt's pairing and by nothing else (section 3.42).
  "45176.desperate-measures-constant": reaching(
    MISSION_AREA,
    constant(
      gets("thw", 1, ATTACHED_ALLY),
      gets("atk", 1, ATTACHED_ALLY),
      gets("hp", 1, ATTACHED_ALLY),
      consideredToHaveResourceIcon(ATTACHED_ALLY, "wild"),
    ),
  ),
});

/** Unregistered refs and why, with the engine queue task (spec section 8.2) each waits on. Empty: every card is scripted. */
export const AOA_BASIC_CAMPAIGN_SKIPPED: Readonly<Record<string, string>> = {};
