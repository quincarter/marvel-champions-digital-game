import { css } from "lit";

export const McBriefingCallStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  /* Role-building scrolls its own list: the call fills the column and the list takes what the head leaves. */
  :host([owns-scroll]) {
    height: 100%;
    min-height: 0;
  }
  mc-briefing-role-build {
    flex: 1 1 0;
    min-height: 0;
  }
`;
