import { call } from "./client";
import type { TrashItem } from "./types";

/** 回收站相关 IPC（P2 软删除：删除→回收站，可恢复/彻底删除/清空） */
export const trashApi = {
  /** 列出回收站全部条目（按删除时间倒序） */
  list: () => call<TrashItem[]>("trash_list"),
  /** 恢复指定条目到原路径，返回实际恢复路径 */
  restore: (id: string) => call<string>("trash_restore", { id }),
  /** 彻底删除单个回收站条目 */
  remove: (id: string) => call<null>("trash_delete", { id }),
  /** 清空回收站 */
  empty: () => call<null>("trash_empty"),
};
