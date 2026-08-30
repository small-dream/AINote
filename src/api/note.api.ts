import { call } from "./client";
import type { NoteMeta } from "@/features/note/types";

export const noteApi = {
  list: (repoPath: string) => call<NoteMeta[]>("list_notes", { repoPath }),
};
