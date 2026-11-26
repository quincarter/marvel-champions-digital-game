/**
 * Splits `text` into user-perceived characters (grapheme clusters), so a cut never lands inside an emoji's surrogate
 * pair, a ZWJ sequence or a base letter and its combining accent. `Intl.Segmenter` where the runtime has it; else code
 * points, with each combining mark (`\p{M}`) and joiner kept with the code point before it.
 */
const segmenter: { segment(text: string): Iterable<{ segment: string }> } | undefined = (() => {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: object) => never }).Segmenter;
  return Segmenter ? (new Segmenter(undefined, { granularity: "grapheme" }) as never) : undefined;
})();

const ZWJ = "‍";

/** A code point that continues the one before it: a combining mark, a joiner, a variation selector or a skin tone. */
const isTail = (point: string): boolean => {
  const code = point.codePointAt(0)!;
  return /\p{M}/u.test(point) || point === ZWJ || code === 0xfe0f || (code >= 0x1f3fb && code <= 0x1f3ff);
};

export function graphemesOf(text: string, useSegmenter = true): string[] {
  if (useSegmenter && segmenter) return Array.from(segmenter.segment(text), (part) => part.segment);
  const parts: string[] = [];
  let joined = false;
  for (const point of Array.from(text)) {
    if (parts.length > 0 && (joined || isTail(point))) {
      parts[parts.length - 1] += point;
    } else parts.push(point);
    joined = point === ZWJ;
  }
  return parts;
}
