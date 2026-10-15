/**
 * The boost cell of a villain activation's arithmetic breakdown ("SCH 2 + BOOST 0 (2 cards) = THREAT 2").
 *
 * The label used to carry the card count ("BOOST ×2") with the icon total after it, which flattened into "BOOST ×2 0"
 * on the one-line rail and read as a multiplication. The label stays "BOOST"; the count rides in the value.
 */
export function boostCell(boostCount: number, boostIcons: number): { readonly label: string; readonly value: string } {
  return { label: "BOOST", value: boostCount > 1 ? `${boostIcons} (${boostCount} cards)` : String(boostIcons) };
}
