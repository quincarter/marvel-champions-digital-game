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

/** One wave 11 scripting module: its group key in `CARD_GROUPS`, its registry and its skipped refs with reasons. */
export interface Wave11Module {
  readonly group: string;
  readonly registry: AbilityRegistry;
  readonly skipped: Readonly<Record<string, string>>;
  /** Registry entries listed on no card: an ability a rule grants, or a quoted one a card gives itself. */
  readonly registryOnly?: readonly string[];
}

/**
 * Every wave 11 hero-pack module, scripted or not. The files exist from the scaffold, so a module agent edits only its
 * own module file and its test: it fills the registry and deletes its `_SKIPPED` lines. Only a module that registers an
 * ability on no card (`registryOnly`) edits its line here. The `fne` modules are added by that pack's scaffold task.
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
];
