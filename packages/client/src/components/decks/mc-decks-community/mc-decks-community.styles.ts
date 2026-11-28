import { css } from "lit";

export const McDecksCommunityStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-height: 0;
    color: var(--mc-text-paper);
  }
  .top {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 10px;
    border-bottom: 3px solid var(--mc-line-paper);
  }
  .from,
  .meta,
  .notes-head {
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .name {
    margin: 0;
    font-family: var(--mc-font-display);
    font-style: italic;
    font-weight: 400;
    font-size: 24px;
    line-height: 1.1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .credit {
    font-weight: 700;
    font-size: 14px;
  }
  .stamps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .stamp {
    padding: 3px 8px;
    background: var(--stamp-fill);
    color: var(--stamp-ink);
    box-shadow: inset 0 0 0 2px var(--mc-line-paper);
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .why {
    margin: 0;
    color: var(--mc-text-red-on-ink, var(--mc-text-red));
    font-size: 13px;
    line-height: 1.3;
    font-weight: 700;
  }
  .notes-head {
    flex: none;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .cue {
    opacity: 1;
  }
  .notes {
    flex: 1;
    min-height: 34px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    font-size: 13px;
    line-height: 1.35;
    white-space: pre-line;
  }
  .notes p {
    margin: 0;
    opacity: 0.85;
  }
  .notes .none {
    opacity: 0.7;
  }
  .url {
    flex: none;
    font-weight: 700;
    font-size: var(--mc-small-11);
    opacity: 0.75;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .links {
    flex: none;
    display: flex;
    gap: 6px;
    height: 28px;
  }
  .links .ctl {
    flex: 1;
  }
  .foot {
    flex: none;
    display: flex;
    gap: 6px;
    height: 52px;
    padding-top: 10px;
    border-top: 3px solid var(--mc-line-paper);
    box-sizing: content-box;
  }
  .check {
    flex: 0 0 30%;
  }
  .add {
    flex: 1;
  }
  .check .ctl,
  .add .ctl {
    height: 100%;
  }
  @media (pointer: coarse), (max-width: 1279px) {
    .links {
      height: 44px;
    }
  }
`;
