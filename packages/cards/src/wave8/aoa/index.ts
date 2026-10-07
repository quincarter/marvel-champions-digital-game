import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { BISHOP_HERO_ABILITIES } from "./bishop/index.js";
import { MAGIK_HERO_ABILITIES } from "./magik/index.js";
import { AOA_ASPECT_BASIC } from "./aspect-basic.js";
import { APOCALYPSE } from "./apocalypse.js";
import { BLUE_MOON } from "./blue-moon.js";
import { CELESTIAL_TECH } from "./celestial-tech.js";
import { CLAN_AKKABA } from "./clan-akkaba.js";
import { DARK_BEAST } from "./dark-beast.js";
import { DARK_RIDERS } from "./dark-riders.js";
import { DYSTOPIAN_NIGHTMARE } from "./dystopian-nightmare.js";
import { EN_SABAH_NUR } from "./en-sabah-nur.js";
import { FOUR_HORSEMEN } from "./four-horsemen.js";
import { GENOSHA } from "./genosha.js";
import { HOUNDS } from "./hounds.js";
import { INFINITES } from "./infinites.js";
import { PRELATES } from "./prelates.js";
import { SAVAGE_LAND } from "./savage-land.js";
import { STANDARD_III } from "./standard-iii.js";
import { UNUS } from "./unus.js";
import { AOA_CAMPAIGN_ABILITIES } from "./campaign/index.js";

/** Every scripted ability of this pack, merged from its modules. Adding a module is an import and a line here. */
export const AOA_ABILITIES: AbilityRegistry = mergeRegistries(
  BISHOP_HERO_ABILITIES,
  MAGIK_HERO_ABILITIES,
  AOA_ASPECT_BASIC,
  APOCALYPSE,
  BLUE_MOON,
  CELESTIAL_TECH,
  CLAN_AKKABA,
  DARK_BEAST,
  DARK_RIDERS,
  DYSTOPIAN_NIGHTMARE,
  EN_SABAH_NUR,
  FOUR_HORSEMEN,
  GENOSHA,
  HOUNDS,
  INFINITES,
  PRELATES,
  SAVAGE_LAND,
  STANDARD_III,
  UNUS,
  AOA_CAMPAIGN_ABILITIES,
);
