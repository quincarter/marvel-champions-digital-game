import { css } from "lit";

export const McControlsSettingsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--mc-text-paper);
  }
  mc-segments {
    --segments-width: 440px;
  }
  .preview {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
  }
`;
