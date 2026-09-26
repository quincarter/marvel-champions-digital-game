import { trait } from "@mc/content";
import {
  constant,
  defineAbilities,
  discard,
  each,
  gainsIcon,
  gainsKeyword,
  gets,
  query,
  self,
  whenRevealed,
} from "../../dsl/index.js";

/**
 * The Streets of Mayhem modular set (`hood` 24060-24063, docs/phase7-wave4.md §2.3): four Setting environments
 * (Back-Alley Enclave, Secret Lair, Sewer Tunnels, Warehouse District) sharing "Surge. When Revealed: discard each
 * other Setting environment in play" (Surge is data).
 *
 * Secret Lair's "each enemy in play gains 1 acceleration icon" is `gainsIcon` (docs/phase7-wave4.md §3.57).
 */

const SETTING = trait("SETTING");
/** "Discard each other Setting environment in play." */
const discardOtherSettings = () => discard(each(query("environment", { trait: SETTING, excluding: self })));

export const STREETS_OF_MAYHEM = defineAbilities({
  // Secret Lair (24061, environment; LOCATION/SETTING, Surge are data) — When Revealed: discard each other Setting
  // environment in play. Each enemy in play gains 1 acceleration icon. Each hero and ally in play gets +1 THW.
  "24061.when-revealed": whenRevealed(discardOtherSettings()),
  "24061.secret-lair-constant": constant(gainsIcon("acceleration", query("enemy"))),
  "24061.secret-lair-constant-2": constant(gets("thw", 1, query(["hero", "ally"]))),

  // Back-Alley Enclave (24060, environment; LOCATION/SETTING, Surge are data) — When Revealed: discard each other
  // Setting environment in play. Each character in play gets +1 ATK.
  "24060.when-revealed": whenRevealed(discardOtherSettings()),
  "24060.back-alley-enclave-constant": constant(gets("atk", 1, query("character"))),

  // Sewer Tunnels (24062, environment; LOCATION/SETTING, Surge are data) — When Revealed: discard each other
  // Setting environment in play. Each character in play gains retaliate 1.
  "24062.when-revealed": whenRevealed(discardOtherSettings()),
  "24062.sewer-tunnels-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, query("character"))),

  // Warehouse District (24063, environment; LOCATION/SETTING, Surge are data) — When Revealed: discard each other
  // Setting environment in play. Each character in play gains steady.
  "24063.when-revealed": whenRevealed(discardOtherSettings()),
  "24063.warehouse-district-constant": constant(gainsKeyword({ name: "steady" }, query("character"))),
});
