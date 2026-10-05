import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { CABLE_ABILITIES } from "./cable/index.js";
import { DOMINO_ABILITIES } from "./domino/index.js";
import { NEXT_EVOL_PRECON_PLAYER_CARDS } from "./precon-player-cards.js";
import { MORLOCK_SIEGE } from "./morlock-siege.js";
import { ON_THE_RUN } from "./on-the-run.js";
import { JUGGERNAUT } from "./juggernaut.js";
import { MISTER_SINISTER } from "./mister-sinister.js";
import { STRYFE } from "./stryfe.js";
import { MARAUDERS } from "./marauders.js";
import { HOPE_SUMMERS } from "./hope-summers.js";
import { MILITARY_GRADE } from "./military-grade.js";
import { MUTANT_SLAYERS } from "./mutant-slayers.js";
import { NASTY_BOYS } from "./nasty-boys.js";
import { BLACK_TOM_CASSIDY } from "./black-tom-cassidy.js";
import { FLIGHT } from "./flight.js";
import { SUPER_STRENGTH } from "./super-strength.js";
import { TELEPATHY } from "./telepathy.js";
import { EXTREME_MEASURES } from "./extreme-measures.js";
import { MUTANT_INSURRECTION } from "./mutant-insurrection.js";
import { NEXT_EVOL_CAMPAIGN_CARDS } from "./campaign.js";

/** Every scripted ability of this group, merged from its modules. Adding a module is an import and a line here. */
export const NEXT_EVOL_ABILITIES: AbilityRegistry = mergeRegistries(
  CABLE_ABILITIES,
  DOMINO_ABILITIES,
  NEXT_EVOL_PRECON_PLAYER_CARDS,
  MORLOCK_SIEGE,
  ON_THE_RUN,
  JUGGERNAUT,
  MISTER_SINISTER,
  STRYFE,
  MARAUDERS,
  HOPE_SUMMERS,
  MILITARY_GRADE,
  MUTANT_SLAYERS,
  NASTY_BOYS,
  BLACK_TOM_CASSIDY,
  FLIGHT,
  SUPER_STRENGTH,
  TELEPATHY,
  EXTREME_MEASURES,
  MUTANT_INSURRECTION,
  NEXT_EVOL_CAMPAIGN_CARDS,
);
