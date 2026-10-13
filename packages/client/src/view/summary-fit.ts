/**
 * A short summary that ends where a reader expects: the longest run of whole sentences that fits `maxLines`, else the
 * first sentence cut at a word with an ellipsis. `linesOf` measures a string's wrapped line count (the scene supplies
 * the real text metrics), so the same rule holds whatever the font and width.
 */
export function summaryWithin(text: string, maxLines: number, linesOf: (text: string) => number): string {
  const full = text.trim();
  if (full === "" || linesOf(full) <= maxLines) return full;

  const sentences = full.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map((s) => s.trim()) ?? [full];
  let kept = "";
  for (const sentence of sentences) {
    const next = kept === "" ? sentence : `${kept} ${sentence}`;
    if (linesOf(next) > maxLines) break;
    kept = next;
  }
  if (kept !== "") return kept;

  // Not even the first sentence fits: whole words, then an ellipsis that fits too.
  const words = full.split(/\s+/);
  for (let count = words.length - 1; count > 0; count--) {
    const cut = `${words
      .slice(0, count)
      .join(" ")
      .replace(/[\s,;:(–-]+$/, "")}…`;
    if (linesOf(cut) <= maxLines) return cut;
  }
  return "…";
}
