import { css } from "lit";

/** A phone's gutters are 16px, not 24, and its stacks sit a little closer. */
export const ModStoreResponsiveStyles = css`
  :host([size="phone"]) .browse {
    gap: 8px;
    padding: 10px 16px 16px;
  }
`;
