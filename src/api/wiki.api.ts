import { call } from "./client";
import type { NoteWikiDto } from "./types";

/** 标签与双链相关 IPC（P1-5） */
export const wikiApi = {
  /** 扫描仓库全部笔记的标签与双链（一次全仓扫描，前端本地聚合） */
  index: () => call<NoteWikiDto[]>("wiki_index"),
};
