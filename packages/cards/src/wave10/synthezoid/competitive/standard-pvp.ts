import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import { COMPETITIVE_STANDARD_PVP } from "../../cw/competitive/standard-pvp.js";

const reuse = (ref: string): AbilityDefinition => {
  const definition = COMPETITIVE_STANDARD_PVP[ref];
  if (!definition) throw new Error(`Civil War Standard PvP script ${ref} is missing`);
  return definition;
};

/**
 * The two Standard PvP sets (57036 to 57039b, 57078 to 57081b) of Synthezoid Smackdown (MC57;
 * docs/phase7-synthezoid.md sections 1.6, 8.3 item 14). They are reprints of Civil War's Standard PvP cards (the
 * data points each at the Civil War scan, and the printed text is the same), so each ref reuses that card's script
 * (plain data) under the new id, the way the main schemes do. Competitive only: the Civil War scripts keep the
 * sentences the engine cannot run yet as `competitiveOnly` markers, and the data marks the sets competitive-only so
 * no cooperative scenario seats them.
 *
 * 57036 = 56125, 57037 = 56126, 57038 = 56127, 57039a/b = 56128a/b (registration);
 * 57078 = 56203, 57079 = 56204, 57080 = 56205, 57081a/b = 56206a/b (resistance).
 *
 * Cards (10):
 * - 57036 Righteous Cause (treachery)
 * - 57037 Whatever It Takes (treachery)
 * - 57038 Targeted Strike (treachery)
 * - 57039a Choosing Sides (side_scheme)
 * - 57039b Now It's Personal (obligation)
 * - 57078 Righteous Cause (treachery)
 * - 57079 Whatever It Takes (treachery)
 * - 57080 Targeted Strike (treachery)
 * - 57081a Choosing Sides (side_scheme)
 * - 57081b Now It's Personal (obligation)
 */
export const SYNTHEZOID_COMPETITIVE_STANDARD_PVP: AbilityRegistry = {
  "57036.when-revealed": reuse("56125.when-revealed"),
  "57037.when-revealed-alter-ego": reuse("56126.when-revealed-alter-ego"),
  "57037.when-revealed-hero": reuse("56126.when-revealed-hero"),
  "57038.when-revealed": reuse("56127.when-revealed"),
  "57038.boost": reuse("56127.boost"),
  "57039a.choosing-sides-constant": reuse("56128a.choosing-sides-constant"),
  "57039a.choosing-sides-forced-response": reuse("56128a.choosing-sides-forced-response"),
  "57039b.now-its-personal-constant": reuse("56128b.now-its-personal-constant"),
  "57039b.now-its-personal-action": reuse("56128b.now-its-personal-action"),

  "57078.when-revealed": reuse("56203.when-revealed"),
  "57079.when-revealed-alter-ego": reuse("56204.when-revealed-alter-ego"),
  "57079.when-revealed-hero": reuse("56204.when-revealed-hero"),
  "57080.when-revealed": reuse("56205.when-revealed"),
  "57080.boost": reuse("56205.boost"),
  "57081a.choosing-sides-constant": reuse("56206a.choosing-sides-constant"),
  "57081a.choosing-sides-forced-response": reuse("56206a.choosing-sides-forced-response"),
  "57081b.now-its-personal-constant": reuse("56206b.now-its-personal-constant"),
  "57081b.now-its-personal-action": reuse("56206b.now-its-personal-action"),
};

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const SYNTHEZOID_COMPETITIVE_STANDARD_PVP_SKIPPED: Readonly<Record<string, string>> = {};
