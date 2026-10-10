import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { AIM_ABDUCTION } from "./aim-abduction.js";
import { AIM_SCIENCE } from "./aim-science.js";
import { AOS_ASPECT_BASIC } from "./aspect-basic.js";
import { BARON_ZEMO } from "./baron-zemo.js";
import { BATROC } from "./batroc.js";
import { BATROCS_BRIGADE } from "./batrocs-brigade.js";
import { BLACK_WIDOW } from "./black-widow.js";
import { EXECUTIVE_BOARD_EVIDENCE } from "./campaign/executive-board-evidence.js";
import { EXECUTIVE_BOARD } from "./executive-board.js";
import { GRAVITATIONAL_PULL } from "./gravitational-pull.js";
import { HARD_SOUND } from "./hard-sound.js";
import { MARIA_HILL_EVENTS } from "./maria-hill/events.js";
import { MARIA_HILL_IDENTITY } from "./maria-hill/identity.js";
import { MARIA_HILL_OBLIGATION_NEMESIS } from "./maria-hill/obligation-nemesis.js";
import { MARIA_HILL_SUPPORT_UPGRADES_ALLIES } from "./maria-hill/support-upgrades-allies.js";
import { MODOK } from "./modok.js";
import { NICK_FURY_EVENTS } from "./nick-fury/events.js";
import { NICK_FURY_IDENTITY } from "./nick-fury/identity.js";
import { NICK_FURY_OBLIGATION_NEMESIS } from "./nick-fury/obligation-nemesis.js";
import { NICK_FURY_SUPPORT_UPGRADES_ALLIES } from "./nick-fury/support-upgrades-allies.js";
import { PALE_LITTLE_SPIDER } from "./pale-little-spider.js";
import { POWER_OF_THE_ATOM } from "./power-of-the-atom.js";
import { SCIENTIST_SUPREME } from "./scientist-supreme.js";
import { SHIELD } from "./shield.js";
import { SUPERSONIC } from "./supersonic.js";
import { THE_LEAPER } from "./the-leaper.js";
import { THUNDERBOLTS } from "./thunderbolts.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const AOS_ABILITIES: AbilityRegistry = mergeRegistries(
  AIM_ABDUCTION,
  AIM_SCIENCE,
  AOS_ASPECT_BASIC,
  BARON_ZEMO,
  BATROC,
  BATROCS_BRIGADE,
  BLACK_WIDOW,
  EXECUTIVE_BOARD_EVIDENCE,
  EXECUTIVE_BOARD,
  GRAVITATIONAL_PULL,
  HARD_SOUND,
  MARIA_HILL_EVENTS,
  MARIA_HILL_IDENTITY,
  MARIA_HILL_OBLIGATION_NEMESIS,
  MARIA_HILL_SUPPORT_UPGRADES_ALLIES,
  MODOK,
  NICK_FURY_EVENTS,
  NICK_FURY_IDENTITY,
  NICK_FURY_OBLIGATION_NEMESIS,
  NICK_FURY_SUPPORT_UPGRADES_ALLIES,
  PALE_LITTLE_SPIDER,
  POWER_OF_THE_ATOM,
  SCIENTIST_SUPREME,
  SHIELD,
  SUPERSONIC,
  THE_LEAPER,
  THUNDERBOLTS,
);
