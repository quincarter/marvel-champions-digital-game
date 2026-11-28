import { css } from "lit";

export const McQrCodeStyles = css`
  :host {
    display: block;
    width: var(--qr-size, 220px);
    max-width: 100%;
    aspect-ratio: 1;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .light {
    fill: var(--mc-fill-paper);
  }
  .dark {
    fill: var(--mc-fill-ink);
  }
`;
