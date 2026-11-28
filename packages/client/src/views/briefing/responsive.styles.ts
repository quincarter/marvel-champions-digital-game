import { css } from "lit";

/**
 * The two arrangements of the Briefing. The scene says which (`phone` on the page: the game own width after couch scaling, which a
 * media query on the browser window would not see), and every part follows by attribute.
 */
export const BriefingResponsive = css`
  :host {
    --gutter: 24px;
    --bar-height: 60px;
    --action-height: 88px;
  }
  :host([phone]) {
    --gutter: 16px;
    --bar-height: 52px;
    --action-height: 80px;
  }
`;
