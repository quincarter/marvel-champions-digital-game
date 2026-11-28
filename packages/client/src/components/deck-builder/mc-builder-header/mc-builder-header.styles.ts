import { css } from "lit";

export const McBuilderHeaderStyles = css`
  :host {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding-top: var(--title-drop, 0px);
    position: relative;
  }
  .title {
    flex: 0 1 auto;
    min-width: 0;
    max-width: var(--title-max, none);
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 38px;
    line-height: 0.86;
    letter-spacing: 2px;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  :host([layout="phone"]) .title {
    font-size: 28px;
  }
  /* The title on one line at its natural size, out of the layout: what the scene measures. */
  .ghost {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    white-space: nowrap;
    max-width: none;
    pointer-events: none;
  }
  .ctl {
    position: relative;
    flex: none;
    width: 100px;
    height: 44px;
    margin-left: auto;
  }
  mc-button {
    width: 100%;
    height: 100%;
    --mc-button-size: 16px;
  }
`;
