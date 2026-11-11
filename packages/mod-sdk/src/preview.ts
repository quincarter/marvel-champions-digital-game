/**
 * `preview.json` and `thumb.webp` (docs/custom-content-packs.md §11.5): what the store shows of a pack before it is
 * installed. Written next to the zip by `buildPack`, never inside it, so the zip's bytes do not depend on them. Pure:
 * the same pack gives the same bytes.
 */
import {
  PACK_PREVIEW_SCHEMA_VERSION,
  packCardImagePath,
  parsePackCardImagePath,
  type PackManifest,
  type PackPreview,
} from "@mc/content";
import type { PackInput } from "./validate.js";

/** The first scenario of the pack's first campaign, whose villain a campaign-only pack leads with. */
function firstCampaignScenarioId(campaigns: readonly unknown[] | undefined): string | undefined {
  const first = campaigns?.[0] as { definition?: { graph?: { nodes?: unknown[] } } } | undefined;
  const node = first?.definition?.graph?.nodes?.[0] as { scenario?: { scenarioId?: unknown } } | undefined;
  const id = node?.scenario?.scenarioId;
  return typeof id === "string" ? id : undefined;
}

/** The card id the store features, or undefined when the pack has no card worth leading with. */
function featuredCardId(pack: PackInput): string | undefined {
  const own = new Set(pack.cards.map((card) => card.id as string));
  const villainOf = (scenarios: readonly unknown[]): string | undefined => {
    for (const scenario of scenarios as readonly { villainCardId?: unknown; mainSchemeCardId?: unknown }[]) {
      const id = scenario.villainCardId;
      if (typeof id === "string" && own.has(id)) return id;
    }
    return undefined;
  };
  const firstOfType = (type: string): string | undefined =>
    pack.cards.find((card) => card.type === type)?.id as string | undefined;
  if (pack.manifest.kind === "hero") return firstOfType("hero_identity");
  if (pack.manifest.kind === "campaign") {
    const scenarioId = firstCampaignScenarioId(pack.campaigns);
    const scenario = ((pack.scenarios ?? []) as readonly { id?: unknown }[]).find((one) => one.id === scenarioId);
    const fromCampaign = scenario ? villainOf([scenario]) : undefined;
    if (fromCampaign) return fromCampaign;
  }
  return (
    villainOf(pack.scenarios ?? []) ??
    firstOfType("villain") ??
    firstOfType("main_scheme") ??
    firstOfType("hero_identity")
  );
}

/** The faces' picture paths of the featured card in the pack's base language: a hero identity's `a` and `b` sides. */
function featuredImages(pack: PackInput, cardId: string, images: ReadonlySet<string>): string[] {
  const base = pack.manifest.languages?.base;
  if (!base) return [];
  const type = pack.cards.find((card) => (card.id as string) === cardId)?.type;
  const codes = [cardId];
  if (type === "hero_identity" && cardId.endsWith("a")) codes.push(`${cardId.slice(0, -1)}b`);
  return codes.map((code) => packCardImagePath(base, code)).filter((path) => images.has(path));
}

export interface PackPreviewFiles {
  readonly preview: PackPreview;
  /** The featured card's first picture, to be copied as `thumb.webp`; undefined when the pack ships none for it. */
  readonly thumbFrom: string | undefined;
}

/** The preview of an assembled pack. */
export function buildPreview(pack: PackInput, manifest: PackManifest = pack.manifest): PackPreviewFiles {
  const images = [...pack.files.keys()].filter((path) => parsePackCardImagePath(path) !== undefined).sort();
  const imageSet = new Set(images);
  const cardId = featuredCardId(pack);
  const featuredPaths = cardId ? featuredImages(pack, cardId, imageSet) : [];
  const preview: PackPreview = {
    schema: PACK_PREVIEW_SCHEMA_VERSION,
    packId: manifest.id,
    version: manifest.version,
    ...(cardId ? { featured: { cardId, images: featuredPaths } } : {}),
    images,
    ...(manifest.languages ? { languages: manifest.languages } : {}),
    cards: pack.cards,
    decks: [...(pack.decks ?? [])].map((deck) => ({
      id: deck.id as string,
      name: deck.name,
      identityCardId: deck.identityCardId as string,
      cards: deck.cards.map((entry) => ({ cardId: entry.cardId as string, quantity: entry.quantity })),
    })),
  };
  return { preview, thumbFrom: featuredPaths[0] };
}
