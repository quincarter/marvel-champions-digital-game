import { css } from "lit";

/**
 * The responsive rules the learning screens' pages share: how much room is left at the page's sides (`--pad`), by the
 * `mode` attribute the scene sets from the screen's shape. Each page spreads this into its `static styles`.
 */
export const LearnResponsiveStyles = css`
  :host {
    --pad: 16px;
  }
  :host([mode="wide"]) {
    --pad: 24px;
  }
`;
