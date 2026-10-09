import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../../dsl/index.js";
import { AGE_OF_APOCALYPSE } from "./age-of-apocalypse.js";
import { AOA_BASIC_CAMPAIGN } from "./aoa-basic-campaign.js";
import { AOA_CAMPAIGN } from "./aoa-campaign.js";
import { AOA_MISSION } from "./aoa-mission.js";
import { OVERSEER } from "./overseer.js";

/** Every scripted ability of the campaign-only sets, merged from its modules. */
export const AOA_CAMPAIGN_ABILITIES: AbilityRegistry = mergeRegistries(
  AGE_OF_APOCALYPSE,
  AOA_BASIC_CAMPAIGN,
  AOA_CAMPAIGN,
  AOA_MISSION,
  OVERSEER,
);
