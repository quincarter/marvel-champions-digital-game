import { AOA_CARDS, AOA_ENCOUNTER_SETS, AOA_PACK, AOA_SCENARIOS, AOA_STARTER_DECKS } from "@mc/content";
import { defineBuiltinPack, type BuiltinPack } from "../../builtin-packs/define.js";
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

/**
 * The `aoa` product as a built-in pack: its cards and every script they need.
 *
 * The Age of Apocalypse campaign box (Bishop, Magik, its scenarios, modular sets and campaign-only sets), scripted
 * from per-group modules (`<hero>/{identity,events,support-upgrades-allies,obligation-nemesis}.ts` behind each hero's
 * `index.ts`, `aspect-basic.ts`, one module per scenario and encounter set, and `campaign/` for the campaign-only
 * sets). `../card-groups.ts` maps every module to its card ids. The campaign definition is `../../campaigns/aoa.ts`.
 * See docs/phase7-wave8.md.
 */
export const AOA_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "aoa", kind: "campaign", name: AOA_PACK.name, product: AOA_PACK },
  cards: AOA_CARDS,
  encounterSets: AOA_ENCOUNTER_SETS,
  scenarios: AOA_SCENARIOS,
  decks: AOA_STARTER_DECKS,
  abilities: mergeRegistries(
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
  ),
});
