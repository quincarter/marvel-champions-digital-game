import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { SPIDER_MAN_MORALES_EVENTS } from "./events.js";
import { SPIDER_MAN_MORALES_IDENTITY } from "./identity.js";
import { SPIDER_MAN_MORALES_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";

/**
 * Every Spider-Man / Miles Morales (`sm` 27030a–27060) ability scripted directly (docs/phase7-wave5.md). His
 * identity (27030a/b), his own events (27031–27034, plus the precon's 27042–27043 and 27050), his obligation
 * and nemesis set (Keeping Secrets, Tracking Prey, Prowler, Razor Claws, Slice and Dice ×2, 27056–27060), and his
 * precon's non-signature supports and allies (Field Agent, Surveillance Team, Agent 13, Dum Dum Dugan, Ghost-Spider
 * ally, Spider-Man / Peter Parker ally, Government Liaison, Sky-Destroyer, 27044–27049 and 27054–27055) are
 * scripted so far.
 */
export const SPIDER_MAN_MORALES_ABILITIES: AbilityRegistry = mergeRegistries(
  SPIDER_MAN_MORALES_IDENTITY,
  SPIDER_MAN_MORALES_EVENTS,
  SPIDER_MAN_MORALES_OBLIGATION_NEMESIS,
  SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS,
);
