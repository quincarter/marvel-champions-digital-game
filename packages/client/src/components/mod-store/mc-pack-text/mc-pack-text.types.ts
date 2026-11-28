export interface McPackTextProps {
  /** The text: paragraphs separated by blank lines, the load status first for an installed pack. */
  body: string;
  /** What the list shows (`text:<pack id>`): its scroll place is kept under this id. */
  listId: string;
}
