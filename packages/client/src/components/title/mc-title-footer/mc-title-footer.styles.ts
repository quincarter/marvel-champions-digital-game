import { css } from "lit";

/**
 * One line: the quiet note at the left, then at the right the links and the build version. Each link is an underlined
 * word with a 44px-tall touch target. The note goes where the line is too narrow to hold it with the links.
 */
export const McTitleFooterStyles = css`
  :host {
    display: block;
    container-type: inline-size;
    font-family: var(--mc-font-body);
    color: var(--title-text, var(--mc-text-ink));
  }
  .aside {
    text-align: right;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 1.2;
    margin-bottom: 4px;
  }
  .line {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .note {
    flex: 1;
    min-width: 0;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 1.2;
    white-space: nowrap;
    opacity: 0.5;
  }
  .right {
    display: flex;
    margin-left: auto;
    align-items: flex-start;
    gap: 12px;
  }
  .link {
    display: flex;
    align-items: flex-start;
    height: 44px;
    padding: 0 6px;
    margin-right: -6px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .link span {
    background: linear-gradient(
        color-mix(in srgb, currentColor 60%, transparent),
        color-mix(in srgb, currentColor 60%, transparent)
      )
      bottom / 100% 1px no-repeat;
  }
  .version {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 1.2;
    white-space: nowrap;
    opacity: 0.5;
  }
  @container (max-width: 440px) {
    .note {
      display: none;
    }
  }
`;
