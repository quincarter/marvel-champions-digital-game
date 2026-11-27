export interface TapOptions {
  /** Read at the press: false makes this press do nothing (a disabled control). */
  readonly enabled?: () => boolean;
}
