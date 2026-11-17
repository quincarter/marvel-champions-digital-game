/**
 * An attachment's removal cost as icons (issue #767): the resources to spend, then a hero icon when the hero must
 * exhaust, in the letters the Champions icon font (`fonts/champions-icons.css`) draws as pictures. Null when any part
 * of the cost has no icon (a damage, a discard, an "each player" part, a resource of no named type), so the chip keeps
 * its words rather than showing a cost that looks cheaper than it is. The icons never stand alone: the chip's hover
 * and Inspect carry the cost in words (`removalCostText`).
 */

import type { AbilityCost } from "@mc/engine";

/** The font's letters (either case draws the same glyph). */
export const ICON_GLYPH = {
  physical: "p",
  mental: "m",
  energy: "e",
  wild: "w",
  hero: "g",
} as const;

const RESOURCE_ORDER = ["physical", "mental", "energy", "wild"] as const;

/** "pp" + "g" for "spend 2 physical, exhaust your identity"; null when the cost has no icon form (or no cost). */
export function removalCostIcons(cost: AbilityCost | undefined): string | null {
  if (!cost) return null;
  for (const [field, part] of Object.entries(cost)) {
    if (part === undefined || part === false) continue;
    if (field !== "resources" && field !== "exhaustIdentity") return null;
  }
  let icons = "";
  const resources = cost.resources;
  if (resources !== undefined) {
    // A bare number is "any resources", which the font has no icon for.
    if (typeof resources !== "object") return null;
    for (const key of Object.keys(resources)) {
      if (!(RESOURCE_ORDER as readonly string[]).includes(key)) return null;
    }
    for (const type of RESOURCE_ORDER) {
      const amount = (resources as Readonly<Record<string, number | undefined>>)[type];
      if (typeof amount === "number" && amount > 0) icons += ICON_GLYPH[type].repeat(amount);
    }
  }
  if (cost.exhaustIdentity) icons += ICON_GLYPH.hero;
  return icons === "" ? null : icons;
}
