import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseKeywordStyles = [
  PauseBaseStyles,
  css`
    :host {
      min-width: 0;
      color: var(--mc-text-ink);
    }
    .card {
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 10px;
      background: var(--mc-fill-card);
      border: 2px solid var(--mc-line-ink);
    }
    .term {
      margin: 0;
      font-family: var(--mc-font-display);
      font-weight: 400;
      font-size: 16px;
      line-height: 1.15;
      letter-spacing: 2px;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }
    .definition {
      margin: 0;
      flex: 1;
      font-size: var(--mc-small-10, 10px);
      line-height: 1.4;
    }
    .tail {
      align-self: flex-start;
      font-size: var(--mc-small-9, 9px);
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.6;
      text-decoration: underline dotted;
    }
    /* A status: its own colour as the fill, with an ink frame inside, and paper words. */
    :host([tone="stunned"]) .card,
    :host([tone="confused"]) .card,
    :host([tone="tough"]) .card {
      color: var(--mc-text-paper);
      border-color: transparent;
      outline: 3px solid var(--mc-text-ink-on-hue);
      outline-offset: -5px;
    }
    :host([tone="stunned"]) .card {
      background: var(--mc-fill-stunned);
    }
    :host([tone="confused"]) .card {
      background: var(--mc-fill-confused);
    }
    :host([tone="tough"]) .card {
      background: var(--mc-fill-tough);
    }
    :host([tone="stunned"]) .tail,
    :host([tone="confused"]) .tail,
    :host([tone="tough"]) .tail {
      opacity: 0.9;
    }
  `,
];
