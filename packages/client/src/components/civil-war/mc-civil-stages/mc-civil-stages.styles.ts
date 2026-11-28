import { css } from "lit";

export const McCivilStagesStyles = css`
  :host {
    display: block;
    color: var(--mc-text-ink);
  }
  section {
    margin-bottom: 14px;
  }
  .label {
    margin: 0 0 6px;
    font-size: var(--mc-small-11, 11px);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
    gap: 12px;
  }
  .option {
    position: relative;
  }
  .face mc-card-art {
    display: block;
    width: 100%;
    aspect-ratio: 7 / 5;
    margin-bottom: 6px;
  }
  .name {
    font-weight: 800;
    font-size: var(--mc-small-13, 13px);
  }
  .threat {
    margin-top: 2px;
    font-size: var(--mc-small-10, 10px);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .gist {
    margin-top: 4px;
    font-size: var(--mc-small-11, 11px);
    line-height: 1.35;
    opacity: 0.8;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .read {
    display: block;
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid color-mix(in srgb, var(--mc-line-ink) 50%, transparent);
    font-weight: 800;
    font-size: var(--mc-small-12, 12px);
  }
  .strip {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 6px;
    height: 28px;
  }
  .hidden {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .back {
    width: 70px;
    aspect-ratio: 5 / 7;
  }
  .summary {
    margin: 8px 0 0;
    font-weight: 800;
    font-size: var(--mc-small-13, 13px);
  }
`;
