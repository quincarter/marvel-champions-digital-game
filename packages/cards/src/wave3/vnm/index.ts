/**
 * Venom / Flash Thompson (`vnm`), wave 3 (cycle 2). Kit (20001–20022, 20026–20029), obligation and nemesis set
 * (Struggle for Control 20023, Klyntar Frenzy 20024, Enraged Symbiote 20025). This is the pack's only export to
 * the rest of wave 3 (docs/phase7-wave3-scripting.md §1).
 */
import type { AbilityRegistry } from "@mc/engine";
import { mergeRegistries } from "../../dsl/index.js";
import { VENOM_KIT } from "./venom-kit.js";
import { VENOM_OBLIGATION_NEMESIS } from "./venom-obligation-nemesis.js";

export const VNM_ABILITIES: AbilityRegistry = mergeRegistries(VENOM_KIT, VENOM_OBLIGATION_NEMESIS);
