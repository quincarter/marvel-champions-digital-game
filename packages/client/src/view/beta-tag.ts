/**
 * The small "BETA" tag on device sync's screens (#276): sync is new, and the tag says so without getting in the way.
 * One switch for all of them, so taking the tag off later is flipping `SHOW_BETA_TAGS` (then deleting `ui/beta-tag.ts`).
 */

/** Whether the BETA tags are drawn anywhere. */
export const SHOW_BETA_TAGS = true;

export const BETA_TAG_TEXT = "BETA";

/** The tag's size: text 9px mono caps plus its padding. Plain data so layout tests can reserve its room. */
export const BETA_TAG_SIZE = { width: 40, height: 16 } as const;

/** The gap between the thing it tags and the tag. */
export const BETA_TAG_GAP = 8;
