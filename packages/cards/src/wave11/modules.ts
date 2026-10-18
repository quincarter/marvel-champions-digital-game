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
 * ability on no card (`registryOnly`) edits its line here. The `fne` player-half modules are listed last.
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
];
