/**
 * The campaign box's name for a campaign id, on the main thread (it reads the saga shelf, which carries the story
 * text, so the engine and presence workers never import it; they are handed the table of names instead).
 */
import { SAGA_VOLUMES } from "../campaign/story.js";

/** The campaign box's name for a campaign id ("mts" is "The Mad Titan's Shadow"), or null for one the shelf doesn't list. */
export function campaignNameOf(campaignId: string | null | undefined): string | null {
  return SAGA_VOLUMES.find((volume) => volume.campaignId === campaignId)?.name ?? null;
}

/** Every campaign id on the shelf with its box name: what the presence worker names a campaign game from. */
export function campaignNameTable(): Readonly<Record<string, string>> {
  return Object.fromEntries(SAGA_VOLUMES.map((volume) => [volume.campaignId as string, volume.name]));
}
