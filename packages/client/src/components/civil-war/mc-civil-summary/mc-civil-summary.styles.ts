import { css } from "lit";

export const McCivilSummaryStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    padding: 10px;
    background: var(--mc-fill-card);
    border: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 70%, transparent);
    color: var(--mc-text-ink);
  }
  .head {
    display: flex;
    gap: 10px;
  }
  .leader {
    flex: none;
    width: 84px;
    aspect-ratio: 5 / 7;
  }
  p {
    margin: 0 0 3px;
    font-size: var(--mc-small-12, 12px);
    line-height: 1.4;
    opacity: 0.8;
  }
  p.first {
    opacity: 1;
    font-weight: 800;
  }
  .stages {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  figure {
    flex: 1;
    margin: 0;
    min-width: 0;
  }
  .card {
    position: relative;
  }
  mc-card-art {
    display: block;
    width: 100%;
    aspect-ratio: 7 / 5;
  }
  .back {
    display: block;
    width: 56px;
    aspect-ratio: 5 / 7;
    margin: 0 auto;
  }
  .over {
    position: absolute;
    inset: 0;
  }
  figcaption {
    margin-top: 3px;
    font-size: var(--mc-small-10, 10px);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .sets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .set {
    display: block;
    width: 44px;
    aspect-ratio: 5 / 7;
  }
  .facts {
    margin-top: 10px;
  }
`;
