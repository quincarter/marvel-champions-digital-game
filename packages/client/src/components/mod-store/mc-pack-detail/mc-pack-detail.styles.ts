import { css } from "lit";

/**
 * A flex column: the head (pictures, then the title block, with the text under the title on a wide screen), then the text
 * (a phone, or a pack with no pictures) and the gallery sharing what is left 34:66, then the status line and the buttons.
 * The gutters are the screen's: 24px, 16 on a phone. The pictures are as tall as 45% of what is left of the page, 200px at
 * most; the host is a size container so that share is a unit (cqh), not arithmetic.
 */
export const McPackDetailStyles = css`
  :host {
    display: block;
    container-type: size;
    min-height: 0;
  }
  .page {
    --mc-face-h: clamp(110px, calc((100cqh - 150px) * 0.45), 200px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    padding: 14px 24px 24px;
  }
  :host([size="phone"]) .page {
    --mc-face-h: 124px;
    padding: 14px 16px 16px;
  }
  :host([square]) .page {
    --mc-face-h: 112px;
  }
  :host([square][size="phone"]) .page {
    --mc-face-h: 72px;
  }
  .head {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, max-content) minmax(150px, 1fr);
    gap: 14px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    min-height: 0;
  }
  mc-pack-title {
    flex: none;
  }
  /* Beside the pictures: what is left of their height under the title block, at least 40px. */
  .side mc-pack-text {
    flex: 1;
    min-height: 40px;
    contain: size;
  }
  /* Under the head (a phone, or a pack with no pictures): the text and the gallery share the rest 34:66. */
  .page > mc-pack-text {
    flex: 1 1 0;
    min-height: 84px;
    contain: size;
  }
  :host([gallery]) .page > mc-pack-text {
    flex: 34 1 0;
  }
  mc-pack-gallery {
    flex: 66 1 0;
    min-height: 142px;
  }
  :host([size="wide"]:not([square])) mc-pack-gallery {
    flex: 1 1 0;
  }
  mc-pack-status,
  mc-pack-actions {
    flex: none;
  }
`;
