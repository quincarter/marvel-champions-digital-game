import { css } from "lit";

/** Flowing reading text: it wraps and grows natively, so the screen never measures it. */
export const McArticleStyles = css`
  :host {
    display: block;
    color: var(--mc-text-ink);
  }
  .scroller {
    height: 100%;
    padding: 8px calc(var(--article-pad, 16px) + 8px) 24px var(--article-pad, 16px);
  }
  h2.title {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 26px;
    line-height: 1;
    text-transform: uppercase;
  }
  .rule {
    width: 120px;
    max-width: 100%;
    height: 3px;
    margin: 6px 0 16px;
    background: var(--mc-fill-red);
  }
  .block {
    margin: 0 0 10px;
    font-size: 15px;
    line-height: 1.45;
    opacity: 0.92;
    overflow-wrap: anywhere;
  }
  h3.block {
    margin-top: 16px;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 18px;
    line-height: 1.1;
    opacity: 1;
  }
  .bullet {
    position: relative;
    padding-left: 14px;
    margin-left: calc(var(--depth, 0) * 18px);
  }
  .bullet::before {
    content: "•";
    position: absolute;
    left: 0;
    color: var(--mc-text-red);
  }
  .bullet.deep::before {
    content: "–";
  }
  .quote {
    padding: 8px 12px 8px 16px;
    background: var(--mc-fill-parchment);
    border-left: 4px solid var(--mc-line-red);
    font-style: italic;
    font-size: 14px;
    opacity: 0.85;
    white-space: pre-line;
  }
  .picture {
    text-align: center;
    opacity: 1;
  }
  .picture img {
    max-width: 100%;
    max-height: var(--picture-max, 70vh);
    object-fit: contain;
  }
`;
