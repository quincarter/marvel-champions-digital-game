import type { AbilityRegistry } from "@mc/engine";
import { JJ_JESSICA_JONES_IDENTITY, JJ_JESSICA_JONES_IDENTITY_SKIPPED } from "./jj/jessica-jones/identity.js";
import { JJ_JESSICA_JONES_EVENTS, JJ_JESSICA_JONES_EVENTS_SKIPPED } from "./jj/jessica-jones/events.js";
import {
  JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES,
  JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./jj/jessica-jones/support-upgrades-allies.js";
import {
  JJ_JESSICA_JONES_OBLIGATION_NEMESIS,
  JJ_JESSICA_JONES_OBLIGATION_NEMESIS_SKIPPED,
} from "./jj/jessica-jones/obligation-nemesis.js";
import { JJ_JUSTICE, JJ_JUSTICE_SKIPPED } from "./jj/justice.js";
import { JJ_OTHER_ASPECTS, JJ_OTHER_ASPECTS_SKIPPED } from "./jj/other-aspects.js";
import { JJ_BASIC, JJ_BASIC_SKIPPED } from "./jj/basic.js";
import { LUKE_CAGE_LUKE_CAGE_IDENTITY, LUKE_CAGE_LUKE_CAGE_IDENTITY_SKIPPED } from "./luke_cage/luke-cage/identity.js";
import { LUKE_CAGE_LUKE_CAGE_EVENTS, LUKE_CAGE_LUKE_CAGE_EVENTS_SKIPPED } from "./luke_cage/luke-cage/events.js";
import {
  LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES,
  LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./luke_cage/luke-cage/support-upgrades-allies.js";
import {
  LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS,
  LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS_SKIPPED,
} from "./luke_cage/luke-cage/obligation-nemesis.js";
import { LUKE_CAGE_LEADERSHIP, LUKE_CAGE_LEADERSHIP_SKIPPED } from "./luke_cage/leadership.js";
import {
  LUKE_CAGE_OTHER_ASPECTS_BASIC,
  LUKE_CAGE_OTHER_ASPECTS_BASIC_SKIPPED,
} from "./luke_cage/other-aspects-basic.js";
import { FNE_DAREDEVIL_IDENTITY, FNE_DAREDEVIL_IDENTITY_SKIPPED } from "./fne/daredevil/identity.js";
import { FNE_DAREDEVIL_SENSE_DECK, FNE_DAREDEVIL_SENSE_DECK_SKIPPED } from "./fne/daredevil/sense-deck.js";
import { FNE_DAREDEVIL_EVENTS, FNE_DAREDEVIL_EVENTS_SKIPPED } from "./fne/daredevil/events.js";
import {
  FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES,
  FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./fne/daredevil/support-upgrades-allies.js";
import {
  FNE_DAREDEVIL_OBLIGATION_NEMESIS,
  FNE_DAREDEVIL_OBLIGATION_NEMESIS_SKIPPED,
} from "./fne/daredevil/obligation-nemesis.js";
import { FNE_ECHO_IDENTITY, FNE_ECHO_IDENTITY_SKIPPED } from "./fne/echo/identity.js";
import { FNE_ECHO_EVENTS, FNE_ECHO_EVENTS_SKIPPED } from "./fne/echo/events.js";
import {
  FNE_ECHO_SUPPORT_UPGRADES_ALLIES,
  FNE_ECHO_SUPPORT_UPGRADES_ALLIES_SKIPPED,
} from "./fne/echo/support-upgrades-allies.js";
import { FNE_ECHO_OBLIGATION_NEMESIS, FNE_ECHO_OBLIGATION_NEMESIS_SKIPPED } from "./fne/echo/obligation-nemesis.js";
import { FNE_ASPECT_BASIC_JUSTICE, FNE_ASPECT_BASIC_JUSTICE_SKIPPED } from "./fne/aspect-basic/justice.js";
import { FNE_ASPECT_BASIC_PROTECTION, FNE_ASPECT_BASIC_PROTECTION_SKIPPED } from "./fne/aspect-basic/protection.js";
import { FNE_ASPECT_BASIC_BASIC, FNE_ASPECT_BASIC_BASIC_SKIPPED } from "./fne/aspect-basic/basic.js";
import { FNE_VILLAINS_BULLSEYE, FNE_VILLAINS_BULLSEYE_SKIPPED } from "./fne/villains/bullseye.js";
import { FNE_VILLAINS_ELECTRO, FNE_VILLAINS_ELECTRO_SKIPPED } from "./fne/villains/electro.js";
import { FNE_VILLAINS_HAMMERHEAD, FNE_VILLAINS_HAMMERHEAD_SKIPPED } from "./fne/villains/hammerhead.js";
import { FNE_VILLAINS_PURPLE_MAN, FNE_VILLAINS_PURPLE_MAN_SKIPPED } from "./fne/villains/purple-man.js";
import { FNE_VILLAINS_TYPHOID_MARY, FNE_VILLAINS_TYPHOID_MARY_SKIPPED } from "./fne/villains/typhoid-mary.js";
import { FNE_SCENARIOS_KINGPIN, FNE_SCENARIOS_KINGPIN_SKIPPED } from "./fne/scenarios/kingpin.js";
import {
  FNE_SCENARIOS_ART_MUSEUM_HEIST,
  FNE_SCENARIOS_ART_MUSEUM_HEIST_SKIPPED,
} from "./fne/scenarios/art-museum-heist.js";
import { FNE_SCENARIOS_THE_GETAWAY, FNE_SCENARIOS_THE_GETAWAY_SKIPPED } from "./fne/scenarios/the-getaway.js";
import {
  FNE_SCENARIOS_PROTECTION_RACKET,
  FNE_SCENARIOS_PROTECTION_RACKET_SKIPPED,
} from "./fne/scenarios/protection-racket.js";
import {
  FNE_SCENARIOS_THE_RAFT_BREAKOUT,
  FNE_SCENARIOS_THE_RAFT_BREAKOUT_SKIPPED,
} from "./fne/scenarios/the-raft-breakout.js";
import {
  FNE_SCENARIOS_STOP_THE_PRESSES,
  FNE_SCENARIOS_STOP_THE_PRESSES_SKIPPED,
} from "./fne/scenarios/stop-the-presses.js";
import { FNE_MODULAR_DISASTERS, FNE_MODULAR_DISASTERS_SKIPPED } from "./fne/modular/disasters.js";
import { FNE_MODULAR_COPS, FNE_MODULAR_COPS_SKIPPED } from "./fne/modular/cops.js";
import { FNE_MODULAR_DRIVE, FNE_MODULAR_DRIVE_SKIPPED } from "./fne/modular/drive.js";
import { FNE_MODULAR_THE_OWL, FNE_MODULAR_THE_OWL_SKIPPED } from "./fne/modular/the-owl.js";
import { FNE_MODULAR_TOMBSTONE, FNE_MODULAR_TOMBSTONE_SKIPPED } from "./fne/modular/tombstone.js";
import { FNE_MODULAR_TRACKSUIT_MAFIA, FNE_MODULAR_TRACKSUIT_MAFIA_SKIPPED } from "./fne/modular/tracksuit-mafia.js";
import { FNE_CAMPAIGN_ENVIRONMENTS, FNE_CAMPAIGN_ENVIRONMENTS_SKIPPED } from "./fne/campaign/environments.js";
import {
  FNE_CAMPAIGN_TYPHOID_MARY_ALLY,
  FNE_CAMPAIGN_TYPHOID_MARY_ALLY_SKIPPED,
} from "./fne/campaign/typhoid-mary-ally.js";

/** One wave 11 scripting module: its group key in `CARD_GROUPS`, its registry and its skipped refs with reasons. */
export interface Wave11Module {
  readonly group: string;
  readonly registry: AbilityRegistry;
  readonly skipped: Readonly<Record<string, string>>;
  /** Registry entries listed on no card: an ability a rule grants, or a quoted one a card gives itself. */
  readonly registryOnly?: readonly string[];
}

/**
 * Every wave 11 hero-pack and Fear No Evil player-half module, scripted or not. The files exist from the scaffold,
 * so a module agent edits only its
 * own module file and its test: it fills the registry and deletes its `_SKIPPED` lines. Only a module that registers an
 * ability on no card (`registryOnly`) edits its line here. The `fne` player-half modules are listed after the packs, then the box's encounter half
 * (`fne/{villains,scenarios,modular,campaign}`, docs/phase7-wave11-scenarios.md §S6).
 */
export const WAVE11_MODULES: readonly Wave11Module[] = [
  {
    group: "jj/jessica-jones/identity",
    registry: JJ_JESSICA_JONES_IDENTITY,
    skipped: JJ_JESSICA_JONES_IDENTITY_SKIPPED,
  },
  { group: "jj/jessica-jones/events", registry: JJ_JESSICA_JONES_EVENTS, skipped: JJ_JESSICA_JONES_EVENTS_SKIPPED },
  {
    group: "jj/jessica-jones/support-upgrades-allies",
    registry: JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES,
    skipped: JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES_SKIPPED,
  },
  {
    group: "jj/jessica-jones/obligation-nemesis",
    registry: JJ_JESSICA_JONES_OBLIGATION_NEMESIS,
    skipped: JJ_JESSICA_JONES_OBLIGATION_NEMESIS_SKIPPED,
  },
  { group: "jj/justice", registry: JJ_JUSTICE, skipped: JJ_JUSTICE_SKIPPED },
  { group: "jj/other-aspects", registry: JJ_OTHER_ASPECTS, skipped: JJ_OTHER_ASPECTS_SKIPPED },
  { group: "jj/basic", registry: JJ_BASIC, skipped: JJ_BASIC_SKIPPED },
  {
    group: "luke_cage/luke-cage/identity",
    registry: LUKE_CAGE_LUKE_CAGE_IDENTITY,
    skipped: LUKE_CAGE_LUKE_CAGE_IDENTITY_SKIPPED,
  },
  {
    group: "luke_cage/luke-cage/events",
    registry: LUKE_CAGE_LUKE_CAGE_EVENTS,
    skipped: LUKE_CAGE_LUKE_CAGE_EVENTS_SKIPPED,
  },
  {
    group: "luke_cage/luke-cage/support-upgrades-allies",
    registry: LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES,
    skipped: LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES_SKIPPED,
  },
  {
    group: "luke_cage/luke-cage/obligation-nemesis",
    registry: LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS,
    skipped: LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS_SKIPPED,
  },
  { group: "luke_cage/leadership", registry: LUKE_CAGE_LEADERSHIP, skipped: LUKE_CAGE_LEADERSHIP_SKIPPED },
  {
    group: "luke_cage/other-aspects-basic",
    registry: LUKE_CAGE_OTHER_ASPECTS_BASIC,
    skipped: LUKE_CAGE_OTHER_ASPECTS_BASIC_SKIPPED,
  },
  { group: "fne/daredevil/identity", registry: FNE_DAREDEVIL_IDENTITY, skipped: FNE_DAREDEVIL_IDENTITY_SKIPPED },
  { group: "fne/daredevil/sense-deck", registry: FNE_DAREDEVIL_SENSE_DECK, skipped: FNE_DAREDEVIL_SENSE_DECK_SKIPPED },
  { group: "fne/daredevil/events", registry: FNE_DAREDEVIL_EVENTS, skipped: FNE_DAREDEVIL_EVENTS_SKIPPED },
  {
    group: "fne/daredevil/support-upgrades-allies",
    registry: FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES,
    skipped: FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES_SKIPPED,
  },
  {
    group: "fne/daredevil/obligation-nemesis",
    registry: FNE_DAREDEVIL_OBLIGATION_NEMESIS,
    skipped: FNE_DAREDEVIL_OBLIGATION_NEMESIS_SKIPPED,
  },
  { group: "fne/echo/identity", registry: FNE_ECHO_IDENTITY, skipped: FNE_ECHO_IDENTITY_SKIPPED },
  { group: "fne/echo/events", registry: FNE_ECHO_EVENTS, skipped: FNE_ECHO_EVENTS_SKIPPED },
  {
    group: "fne/echo/support-upgrades-allies",
    registry: FNE_ECHO_SUPPORT_UPGRADES_ALLIES,
    skipped: FNE_ECHO_SUPPORT_UPGRADES_ALLIES_SKIPPED,
  },
  {
    group: "fne/echo/obligation-nemesis",
    registry: FNE_ECHO_OBLIGATION_NEMESIS,
    skipped: FNE_ECHO_OBLIGATION_NEMESIS_SKIPPED,
  },
  { group: "fne/aspect-basic/justice", registry: FNE_ASPECT_BASIC_JUSTICE, skipped: FNE_ASPECT_BASIC_JUSTICE_SKIPPED },
  {
    group: "fne/aspect-basic/protection",
    registry: FNE_ASPECT_BASIC_PROTECTION,
    skipped: FNE_ASPECT_BASIC_PROTECTION_SKIPPED,
  },
  { group: "fne/aspect-basic/basic", registry: FNE_ASPECT_BASIC_BASIC, skipped: FNE_ASPECT_BASIC_BASIC_SKIPPED },
  { group: "fne/villains/bullseye", registry: FNE_VILLAINS_BULLSEYE, skipped: FNE_VILLAINS_BULLSEYE_SKIPPED },
  { group: "fne/villains/electro", registry: FNE_VILLAINS_ELECTRO, skipped: FNE_VILLAINS_ELECTRO_SKIPPED },
  { group: "fne/villains/hammerhead", registry: FNE_VILLAINS_HAMMERHEAD, skipped: FNE_VILLAINS_HAMMERHEAD_SKIPPED },
  {
    group: "fne/villains/purple-man",
    registry: FNE_VILLAINS_PURPLE_MAN,
    skipped: FNE_VILLAINS_PURPLE_MAN_SKIPPED,
    // The Boost Purple Man's stages grant his set's boost cards (gainsAbility): on no card's own refs.
    registryOnly: ["60097.granted-boost"],
  },
  {
    group: "fne/villains/typhoid-mary",
    registry: FNE_VILLAINS_TYPHOID_MARY,
    skipped: FNE_VILLAINS_TYPHOID_MARY_SKIPPED,
  },
  { group: "fne/scenarios/kingpin", registry: FNE_SCENARIOS_KINGPIN, skipped: FNE_SCENARIOS_KINGPIN_SKIPPED },
  {
    group: "fne/scenarios/art-museum-heist",
    registry: FNE_SCENARIOS_ART_MUSEUM_HEIST,
    skipped: FNE_SCENARIOS_ART_MUSEUM_HEIST_SKIPPED,
  },
  {
    group: "fne/scenarios/the-getaway",
    registry: FNE_SCENARIOS_THE_GETAWAY,
    skipped: FNE_SCENARIOS_THE_GETAWAY_SKIPPED,
  },
  {
    group: "fne/scenarios/protection-racket",
    registry: FNE_SCENARIOS_PROTECTION_RACKET,
    skipped: FNE_SCENARIOS_PROTECTION_RACKET_SKIPPED,
  },
  {
    group: "fne/scenarios/the-raft-breakout",
    registry: FNE_SCENARIOS_THE_RAFT_BREAKOUT,
    skipped: FNE_SCENARIOS_THE_RAFT_BREAKOUT_SKIPPED,
  },
  {
    group: "fne/scenarios/stop-the-presses",
    registry: FNE_SCENARIOS_STOP_THE_PRESSES,
    skipped: FNE_SCENARIOS_STOP_THE_PRESSES_SKIPPED,
  },
  { group: "fne/modular/disasters", registry: FNE_MODULAR_DISASTERS, skipped: FNE_MODULAR_DISASTERS_SKIPPED },
  { group: "fne/modular/cops", registry: FNE_MODULAR_COPS, skipped: FNE_MODULAR_COPS_SKIPPED },
  { group: "fne/modular/drive", registry: FNE_MODULAR_DRIVE, skipped: FNE_MODULAR_DRIVE_SKIPPED },
  { group: "fne/modular/the-owl", registry: FNE_MODULAR_THE_OWL, skipped: FNE_MODULAR_THE_OWL_SKIPPED },
  { group: "fne/modular/tombstone", registry: FNE_MODULAR_TOMBSTONE, skipped: FNE_MODULAR_TOMBSTONE_SKIPPED },
  {
    group: "fne/modular/tracksuit-mafia",
    registry: FNE_MODULAR_TRACKSUIT_MAFIA,
    skipped: FNE_MODULAR_TRACKSUIT_MAFIA_SKIPPED,
  },
  {
    group: "fne/campaign/environments",
    registry: FNE_CAMPAIGN_ENVIRONMENTS,
    skipped: FNE_CAMPAIGN_ENVIRONMENTS_SKIPPED,
  },
  {
    group: "fne/campaign/typhoid-mary-ally",
    registry: FNE_CAMPAIGN_TYPHOID_MARY_ALLY,
    skipped: FNE_CAMPAIGN_TYPHOID_MARY_ALLY_SKIPPED,
  },
];
