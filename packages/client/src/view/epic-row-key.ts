/**
 * The key of a button in the Epic sheet's list: the command and the thing it acts on (a table, a person, a character),
 * never the row's place. The panel keeps a button's element, and a finger already down on it, across a redraw; a key by
 * place would hand that press to whatever row moved into the place.
 */
export const epicRowKey = (kind: string, ...ids: readonly string[]): string => `row:${[kind, ...ids].join(":")}`;
