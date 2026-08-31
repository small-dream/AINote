import { call } from "./client";
import type { SearchResult } from "./types";

/** 全文搜索 IPC（P1-2）：标题 + 正文忽略大小写匹配，Rust 侧排序后返回 */
export const searchApi = {
  search: (query: string) => call<SearchResult[]>("search_notes", { query }),
};
