import { css } from "lit";

export const McModNoticeStyles = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: block;
  }
  /* The dimmed store behind: it takes every press, so nothing under the notice is touched. */
  .backdrop {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 32px;
    background: color-mix(in srgb, var(--mc-fill-void) 78%, transparent);
    overflow: auto;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 28px;
    width: 100%;
    max-width: 900px;
    margin: auto;
  }
  .speaker {
    display: flex;
    align-items: flex-start;
    gap: 20px;
  }
  .speaker.right {
    flex-direction: row-reverse;
  }
  .portrait {
    position: relative;
    flex: none;
    width: clamp(96px, 20cqh, 150px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--mc-fill-ink);
    outline: 3px solid var(--mc-line-paper);
    overflow: hidden;
  }
  .portrait mc-picture-tile {
    position: absolute;
    inset: 0;
  }
  /* A white speech bubble with a 3px ink border and a hard offset shadow; its tail points at its speaker. */
  .bubble {
    position: relative;
    flex: 0 1 520px;
    min-width: 0;
    padding: 12px 16px;
    background: var(--mc-fill-card);
    border: 3px solid var(--mc-line-ink);
    box-shadow: 4px 4px 0 var(--mc-fill-ink);
    color: var(--mc-text-ink);
  }
  .bubble::before,
  .bubble::after {
    content: "";
    position: absolute;
    top: 28px;
    width: 0;
    height: 0;
    border: 10px solid transparent;
  }
  .left .bubble::before {
    right: 100%;
    border-right-color: var(--mc-line-ink);
  }
  .left .bubble::after {
    right: calc(100% - 3px);
    border-right-color: var(--mc-fill-card);
  }
  .right .bubble::before {
    left: 100%;
    border-left-color: var(--mc-line-ink);
  }
  .right .bubble::after {
    left: calc(100% - 3px);
    border-left-color: var(--mc-fill-card);
  }
  .who {
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-text-red);
  }
  .said {
    margin-top: 4px;
    font-size: 16px;
    line-height: 1.3;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .ctl {
    position: relative;
    flex: 0 0 260px;
    height: 56px;
  }
  .ctl mc-button {
    width: 100%;
    height: 100%;
  }
  /* A phone: the speakers stack, portrait left of its bubble on both, and the buttons share the full width, one a row. */
  :host([size="phone"]) .backdrop {
    padding: 8px 16px;
    align-items: flex-start;
  }
  :host([size="phone"]) .stack {
    gap: 14px;
  }
  :host([size="phone"]) .speaker {
    gap: 10px;
  }
  :host([size="phone"]) .portrait {
    width: 64px;
  }
  :host([size="phone"]) .bubble {
    flex: 1;
    padding: 10px 12px;
  }
  :host([size="phone"]) .bubble::before,
  :host([size="phone"]) .bubble::after {
    top: 20px;
  }
  :host([size="phone"]) .said {
    font-size: 13px;
  }
  :host([size="phone"]) .buttons {
    flex-direction: column;
  }
  :host([size="phone"]) .ctl {
    flex: none;
    width: 100%;
  }
`;
