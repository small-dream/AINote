import { call } from "./client";
import type { NoteMeta } from "./types";

/** 收藏索引 IPC（P1-13）；收藏数据随仓库 Git 同步。 */
export const favoriteApi = {
  list: () => call<NoteMeta[]>("list_favorite_notes"),
  toggle: (path: string) => call<boolean>("toggle_note_favorite", { path }),
};
