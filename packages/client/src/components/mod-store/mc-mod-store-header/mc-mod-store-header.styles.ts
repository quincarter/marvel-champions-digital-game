import { css } from "lit";

export const McModStoreHeaderStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 60px;
    padding: 0 22px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    container-type: inline-size;
  }
  :host([size="phone"]) {
    height: 52px;
    padding: 0 12px;
  }
  .ctl {
    position: relative;
    flex: none;
    height: 44px;
  }
  .ctl mc-button {
    --mc-button-size: 20px;
    width: 100%;
    height: 100%;
  }
  .back {
    width: 100px;
  }
  :host([size="phone"]) .back {
    width: 44px;
  }
  .about {
    margin-left: auto;
    width: 132px;
  }
  /* A key or pad glyph takes room inside the button: wider, so it never lands on the word. */
  .back.glyph {
    width: 150px;
  }
  .about.glyph {
    width: 180px;
  }
  .installed ~ .about {
    margin-left: 0;
  }
  :host([size="phone"]) .about {
    width: 44px;
  }
  .title {
    flex: 0 1 auto;
    min-width: 0;
    font-family: var(--mc-font-display);
    font-size: 28px;
    line-height: 1;
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([size="phone"]) .title {
    /* Below the dark mode tab that hangs from the top edge at the bar's centre, as Deck check's does. */
    align-self: flex-end;
    padding-bottom: 8px;
    font-size: 22px;
    margin-right: auto;
  }
  /* The caution tag: ink words on yellow, so it never rests on colour alone. */
  .badge {
    flex: none;
    padding: 3px 8px;
    background: var(--mc-fill-caution);
    color: var(--mc-text-ink-on-hue);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
  }
  :host([size="phone"]) .badge {
    display: none;
  }
  .installed {
    flex: none;
    margin-left: auto;
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: nowrap;
  }
  :host([size="phone"]) .installed {
    padding-bottom: 12px;
    align-self: flex-end;
  }
  /* The tag and the title keep clear of the dark mode toggle at the bar's centre. */
  :host([size="wide"]) .title {
    max-width: max(180px, calc(50cqw - 30px - 160px));
  }
`;
