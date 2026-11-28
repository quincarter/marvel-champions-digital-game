import { css } from "lit";

/**
 * The two arrangements of the scenario screens. The scene says which (`wide`, `phone` on the page: the game's own width
 * after couch scaling, which a media query on the browser window would not see), and every section follows by attribute.
 */
export const ScenarioSelectResponsive = css`
  :host {
    --gutter: 16px;
    --bar-height: 60px;
  }
  :host([wide]) {
    --gutter: 24px;
  }
  :host([phone]) {
    --bar-height: 64px;
  }
`;
