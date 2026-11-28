/** One button of the banner. */
export interface TitleBannerButton {
  /** Its focus stop and what a press reports (`update-install`, `saves-reload`, ...). */
  readonly key: string;
  readonly label: string;
  readonly kind: "primary" | "secondary";
}

/**
 * A caution-yellow banner: the update on offer, a downloaded update waiting for a restart, the saves that did not load,
 * the old save recovery page. Already worded and translated.
 */
export interface TitleBannerInput {
  /** The short heading, in capitals ("UPDATE AVAILABLE"). */
  readonly heading: string;
  /** The line under it ("Version 1.2.0"). */
  readonly detail: string;
  /** The action buttons. */
  readonly buttons: readonly TitleBannerButton[];
  /** The close button, a touch-sized square at the top right ("not now"). */
  readonly dismiss: TitleBannerButton;
}
