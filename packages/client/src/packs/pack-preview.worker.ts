/**
 * The pack preview worker (`preview-client.ts` owns it): validates a fetched `preview.json` off the main thread. All
 * the logic is `pack-preview.ts`'s, which the tests call directly. Replies with the preview as plain data (cards, deck
 * lists and the image list as an array) or null when the file is not a usable preview.
 */
import { parsePackPreviewText } from "./pack-preview.js";
import type { PreviewWorkerReply, PreviewWorkerRequest } from "./preview-client.js";

interface WorkerGlobal {
  postMessage(message: PreviewWorkerReply): void;
  onmessage: ((event: MessageEvent<PreviewWorkerRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;

worker.onmessage = (event: MessageEvent<PreviewWorkerRequest>) => {
  const { id, text, packId } = event.data;
  const parsed = parsePackPreviewText(text, packId);
  worker.postMessage({ id, preview: parsed ? { ...parsed, images: [...parsed.images] } : null });
};
