/** Reads a request body as text, at most `cap` bytes; `null` when the stream carries more (whatever Content-Length claimed). */
export async function readCappedText(body: ReadableStream<Uint8Array> | null, cap: number): Promise<string | null> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
