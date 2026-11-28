import { css } from "lit";

/** Columns of 300px or more, rows 136px (120 on a phone); the 12px at the right is the scrollbar's room. */
export const McPackGridStyles = css`
  :host {
    display: block;
    min-height: 60px;
  }
  .grid {
    height: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    grid-auto-rows: 136px;
    gap: 16px;
    align-content: start;
    padding-right: 12px;
  }
  :host([size="phone"]) .grid {
    grid-auto-rows: 120px;
    gap: 10px;
  }
`;
