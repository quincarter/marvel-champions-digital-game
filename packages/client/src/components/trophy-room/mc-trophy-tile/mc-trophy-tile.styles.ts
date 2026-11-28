import { css } from "lit";

export const McTrophyTileStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    min-width: 0;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    content-visibility: auto;
    contain-intrinsic-size: auto 84px;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  /* Locked: parchment, outlined. Earned: a solid ink card with paper words. Soon: parchment, dimmed. */
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 64px;
    margin: 3px 0;
    padding: 8px 10px 8px 12px;
    background: var(--mc-fill-parchment);
    border: 2px solid var(--mc-line-ink);
    color: var(--mc-text-ink);
  }
  :host([state="earned"]) .card {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  :host([state="untracked"]) .card {
    border-color: color-mix(in srgb, var(--mc-line-ink) 45%, transparent);
  }
  :host([state="untracked"]) .top,
  :host([state="untracked"]) .progress {
    opacity: 0.6;
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
  }
  .text {
    flex: 1 1 0;
    min-width: 0;
  }
  .name {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 15px;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.35;
    opacity: 0.8;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  :host([earned]) .detail {
    opacity: 0.85;
  }
  .side {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    max-width: 45%;
  }
  .reward {
    font-weight: 800;
    font-size: 11px;
    opacity: 0.85;
    text-align: right;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    padding-right: 48px;
  }
  .progress mc-progress-bar {
    flex: 1 1 0;
    min-width: 0;
  }
  .count {
    flex: none;
    font-weight: 800;
    font-size: 11px;
  }
  /* A phone's card takes a line more for its wrapped words. */
  @media (max-width: 599px) {
    .detail {
      -webkit-line-clamp: 3;
      line-clamp: 3;
    }
  }
`;
