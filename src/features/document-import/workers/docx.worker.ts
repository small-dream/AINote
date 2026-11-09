import { convertDocxToHtml } from "../utils/docxCore";
import type { DocxWorkerRequest, DocxWorkerResponse } from "../types";

interface WorkerScope {
  onmessage: ((event: MessageEvent<DocxWorkerRequest>) => void) | null;
  postMessage(message: DocxWorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

async function handle(request: DocxWorkerRequest): Promise<void> {
  try {
    const result = await convertDocxToHtml(request.arrayBuffer);
    const transfer = result.assets.map((asset) => asset.bytes.buffer as ArrayBuffer);
    scope.postMessage({ ok: true, ...result }, transfer);
  } catch (error) {
    scope.postMessage({ ok: false, message: error instanceof Error ? error.message : String(error) });
  }
}

scope.onmessage = (event) => {
  void handle(event.data);
};
