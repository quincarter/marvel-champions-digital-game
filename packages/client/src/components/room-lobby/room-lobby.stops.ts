/**
 * The lobby's focus-stop keys (`data-stop`). The names are the ones the specs and the pad route already use; build them here so
 * a typo cannot make a stop that nothing finds. A scrolling list's element is `list:<key>` (`data-key`).
 */
export const LOBBY_STOP = {
  back: "back",
  copy: "copy",
  listed: "listed",
  tab: (id: string): string => `tab:${id}`,
  setup: "setup",
  seatsLess: "seats:less",
  seatsMore: "seats:more",
  resultDismiss: "start-result-dismiss",
  seat: (seat: string): string => `seat:${seat}`,
  play: (seat: string): string => `play:${seat}`,
  give: (seat: string): string => `give:${seat}`,
  giveTo: (seat: string, participant: string): string => `give:${seat}:${participant}`,
  seatModStore: (seat: string, mod: string): string => `modstore:${seat}:${mod}`,
  deck: (seat: string): string => `deck:${seat}`,
  approve: (seat: string, participant: string): string => `approve:${seat}:${participant}`,
  deny: (seat: string, participant: string): string => `deny:${seat}:${participant}`,
  /** The settings' Mod Store link for a pack a guest lacks. */
  modStore: (mod: string): string => `modstore:${mod}`,
  modeChange: "epicmode:change",
  chatPill: "chat-pill",
  chatClose: "chat-close",
  chatPopout: "chat-popout",
  chatBringBack: "chat-bring-back",
  chatField: "chat-field",
  chatSend: "chat-send",
  start: "start",
  stay: "stay",
  close: "close",
  backTitle: "back-title",
  list: (key: "seats" | "settings" | "chat"): string => `list:${key}`,
  /** The footer's line of words (`data-key`, read by the specs). */
  footerWords: "footer-words",
} as const;
