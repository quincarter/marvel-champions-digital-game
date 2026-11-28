import { css } from "lit";

export const McDecksHeaderStyles = css`
  :host {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 8px 16px;
  }
  .back {
    flex: none;
    width: 100px;
    height: 44px;
  }
  .stats {
    flex: none;
    width: 150px;
    height: 44px;
  }
  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding-top: var(--drop, 0);
    max-width: var(--max-right, none);
    font-family: var(--mc-font-display);
    font-style: italic;
    font-weight: 400;
    font-size: 28px;
    text-transform: uppercase;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    flex: none;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
    white-space: nowrap;
  }
  @media (min-width: 1280px) {
    .bar {
      padding: 12px 32px;
    }
  }
  @media (max-width: 767px) {
    .bar {
      gap: 8px;
      padding: 8px 12px;
    }
    .stats {
      width: 112px;
    }
    .title {
      padding-top: calc(var(--drop, 0px) + 8px);
      font-size: 22px;
    }
  }
`;
