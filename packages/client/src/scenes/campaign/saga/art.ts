import { CAMPAIGN_RECORDS } from "../../../campaign/campaign-service.js";
import { packCampaignEntryOf } from "../../../campaign/pack-campaigns.js";
import { packFileArt } from "../../../art/pack-art.js";
import type { ArtSource } from "../../../art/art-source.js";
import { loadedPacks } from "../../../packs/pack-registry.js";
import { customBadge } from "../../../view/custom-content.js";
import { accent, signal, surface } from "../../../tokens.js";
import { campaignCoverPicture, villainPicture } from "../../../ui/campaign-chrome.js";
import { t } from "../../../i18n/translate.js";
import type { Picture } from "../../../art/pictures.js";
import { typeRole } from "../../../tokens.js";
import type { SagaVolume } from "../../../campaign/story.js";
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import type { SagaCtx } from "./context.js";

/** The picture a volume's tile or card shows: a small copy for a tile, the whole picture for the featured card. */
export function pictureOf(ctx: SagaCtx, volume: SagaVolume, tile: boolean): { src: string | null; retry?: string } {
  const picture = volumeArtOf(volume);
  if (!picture) return { src: null };
  const tileUrl = (picture as Picture).tileUrl;
  return ctx.leases.image(tile && tileUrl !== undefined ? { key: picture.key, url: tileUrl } : picture);
}

/** A text's width and height, wrapped at `width` (the width of its longest line, as Phaser's wrapped `Text` reports). */
export function wrapped(
  b: SheetBuilder,
  text: string,
  spec: typeof typeRole.label,
  width: number,
  options: { readonly size?: number; readonly letterSpacing?: number },
): { width: number; height: number } {
  const single = b.measure(text, spec, options);
  if (single.width <= width) return single;
  return { width, height: b.measure(text, spec, { ...options, wrapWidth: width }).height };
}

/** A box's own final scenario (its `Campaign.scenarioIds`' last entry) — the villain art `villainPicture` keys on. */
const finalScenarioIdOf = (campaignId: string): string =>
  (CAMPAIGN_RECORDS[campaignId]?.scenarioIds.at(-1) as string | undefined) ?? campaignId;

/**
 * A volume's art: the box's own cover (`art/campaigns/<id>/cover.*`) when it has one, as the Cover screen uses, else its
 * final villain. A pack campaign's is the cover file its pack lists (null when it lists none, or once the pack is gone:
 * the tile then draws its generated ink cover).
 */
export const volumeArtOf = (volume: SagaVolume): Picture | ArtSource | null => {
  if (volume.custom) {
    const cover = packCampaignEntryOf(loadedPacks(), volume.campaignId)?.campaign.art?.cover;
    return cover === undefined ? null : packFileArt(volume.custom.packId, cover);
  }
  return campaignCoverPicture(volume.campaignId) ?? villainPicture(finalScenarioIdOf(volume.campaignId));
};

/** "VOL. 3" for a base box; a pack campaign says CUSTOM in words (never a number past the base game's). */
export const volumeTagOf = (volume: SagaVolume): string =>
  volume.custom ? customBadge() : t("saga.volume", { number: volume.number }).toLocaleUpperCase();

/** A rectangle's corners turned by `angle` radians about its own center (Phaser rotates a container about its origin). */
export function turnedCorners(
  cx: number,
  cy: number,
  width: number,
  height: number,
  angle: number,
): [number, number][] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (
    [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ] as const
  ).map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
}

/** A status chip's fill (null: an outline) and text color, by volume status. */
export const CHIP_COLORS = {
  done: { fill: signal.heal.hex, text: surface.paper.hex },
  live: { fill: accent.heroRed.hex, text: surface.paper.hex },
  fresh: { fill: signal.caution.hex, text: surface.inkOnHue.hex },
  sealed: { fill: null, text: surface.paper.hex },
} as const;
