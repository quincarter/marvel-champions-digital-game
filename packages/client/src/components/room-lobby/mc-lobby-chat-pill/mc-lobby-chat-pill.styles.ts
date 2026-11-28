import { css } from "lit";

export const McLobbyChatPillStyles = css`
  :host {
    display: block;
  }
  .pill {
    position: relative;
  }
  /* The label slides left to make room for the badge (mc-button's own shift). */
  .pill[data-unread] mc-lobby-button {
    --mc-label-shift: -10px;
  }
  .badge {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--mc-text-paper);
    pointer-events: none;
  }
  /* A small opaque card with its own box, so nothing under it is pressed through it. */
  .card {
    padding: 8px 10px;
    background: var(--mc-fill-parchment);
    border: 3px solid var(--mc-line-ink);
    box-shadow: 6px 6px 0 var(--mc-fill-ink);
  }
  .words {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
  }
`;
