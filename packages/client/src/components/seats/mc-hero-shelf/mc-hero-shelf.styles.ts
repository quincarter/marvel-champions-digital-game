import { css } from "lit";

export const McHeroShelfStyles = css`
  :host {
    display: block;
    padding-bottom: 20px;
    min-width: 0;
  }
  .title {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    min-width: 0;
    height: 100%;
  }
  .cover {
    flex: none;
    width: 34px;
    height: 34px;
  }
  mc-section-header {
    flex: 1;
    min-width: 0;
    height: 100%;
  }
  .tap {
    position: absolute;
    inset: 0;
    appearance: none;
    margin: 0;
    padding: 0;
    background: none;
    border: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .all {
    appearance: none;
    flex: none;
    display: flex;
    align-items: center;
    height: 100%;
    margin: 0;
    padding: 0 6px;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--mc-text-red);
    background: none;
    border: 0;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .tap:focus-visible,
  .all:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -3px;
  }
`;
