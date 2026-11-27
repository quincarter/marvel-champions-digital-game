/** What `mc-image-error` carries: the URL that failed to load, and the retry key of a `picture` that names one. */
export interface PictureErrorDetail {
  readonly src: string;
  readonly key?: string;
}
