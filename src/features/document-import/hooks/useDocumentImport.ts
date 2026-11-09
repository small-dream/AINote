import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { messageOf } from "@/api";
import { useImportDocumentMutation } from "@/queries/note.queries";
import { isMobileApp } from "@/platform/runtime";
import {
  DocumentImportError,
  documentFormatOf,
  isUnsupportedWordFile,
  toDocumentImportError,
  type ConversionProgress,
  type DocumentImportErrorCode,
  type DocumentImportResult,
} from "../types";

export type DocumentImportPhase = "idle" | "converting" | "ready" | "saving" | "error";

export interface DocumentImportState {
  open: boolean;
  phase: DocumentImportPhase;
  fileName: string;
  dir: string;
  progress: ConversionProgress;
  result: DocumentImportResult | null;
  error: DocumentImportErrorCode | null;
  errorDetail: string | null;
}

const INITIAL: DocumentImportState = {
  open: false,
  phase: "idle",
  fileName: "",
  dir: "",
  progress: { current: 0, total: 0 },
  result: null,
  error: null,
  errorDetail: null,
};

interface PendingFile {
  dir: string;
  file: File;
}

export interface DocumentImportController {
  state: DocumentImportState;
  start: (dir: string, file: File) => Promise<void>;
  retry: () => void;
  confirm: () => Promise<void>;
  cancel: () => void;
}

interface ConversionController {
  state: DocumentImportState;
  setState: Dispatch<SetStateAction<DocumentImportState>>;
  abortRef: MutableRefObject<AbortController | null>;
  pendingRef: MutableRefObject<PendingFile | null>;
  start: (dir: string, file: File) => Promise<void>;
  retry: () => void;
  cancel: () => void;
}

function useDocumentConversion(): ConversionController {
  const [state, setState] = useState<DocumentImportState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<PendingFile | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (pending: PendingFile, controller: AbortController) => {
    setState((previous) => ({ ...previous, open: true, phase: "converting", fileName: pending.file.name, dir: pending.dir, result: null, error: null, errorDetail: null }));
    try {
      const { convertDocumentFile } = await import("../utils/convert");
      const result = await convertDocumentFile(pending.file, controller.signal, (progress) => {
        if (abortRef.current === controller) setState((previous) => ({ ...previous, progress }));
      });
      if (abortRef.current !== controller) return;
      setState((previous) => ({ ...previous, phase: "ready", result, progress: { current: 1, total: 1 } }));
    } catch (error) {
      if (abortRef.current !== controller) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      const normalized = toDocumentImportError(error);
      setState((previous) => ({ ...previous, phase: "error", error: normalized.code, errorDetail: normalized.message }));
    }
  }, []);

  const start = useCallback((dir: string, file: File): Promise<void> => {
    if (isMobileApp() && (documentFormatOf(file.name) || isUnsupportedWordFile(file.name))) {
      return Promise.reject(new DocumentImportError("desktopOnly", "document import is desktop only"));
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    pendingRef.current = { dir, file };
    void run({ dir, file }, controller);
    return Promise.resolve();
  }, [run]);

  const retry = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void run(pending, controller);
  }, [run]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    pendingRef.current = null;
    setState(INITIAL);
  }, []);

  return { state, setState, abortRef, pendingRef, start, retry, cancel };
}

export function useDocumentImport(onOpen: (path: string) => void): DocumentImportController {
  const { state, setState, abortRef, pendingRef, start, retry, cancel } = useDocumentConversion();
  const importDocument = useImportDocumentMutation();

  const confirm = useCallback(async () => {
    const result = state.result;
    if (!result || (state.phase !== "ready" && state.error !== "saveFailed")) return;
    setState((previous) => ({ ...previous, phase: "saving", error: null, errorDetail: null }));
    try {
      const meta = await importDocument.mutateAsync({
        dir: state.dir,
        fileName: result.sourceName,
        content: result.markdown,
        assets: result.assets,
      });
      abortRef.current = null;
      pendingRef.current = null;
      setState(INITIAL);
      onOpen(meta.path);
    } catch (error) {
      setState((previous) => ({ ...previous, phase: "error", error: "saveFailed", errorDetail: messageOf(error) }));
    }
  }, [abortRef, importDocument, onOpen, pendingRef, setState, state.dir, state.error, state.phase, state.result]);

  return { state, start, retry, confirm, cancel };
}
