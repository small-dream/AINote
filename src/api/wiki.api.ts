import { call } from "./client";
import type { NoteWikiDto, UnlinkedMention, UnlinkedMentionRef } from "./types";

/** 标签与双链相关 IPC（P1-5 / 双链 2.0） */
export const wikiApi = {
  /** 扫描仓库全部笔记的标签、别名、标题与双链（一次全仓扫描，前端本地聚合） */
  index: () => call<NoteWikiDto[]>("wiki_index"),
  /** 面板打开时按需扫描当前笔记的未链接提及 */
  unlinkedMentions: (path: string) => call<UnlinkedMention[]>("wiki_unlinked_mentions", { path }),
  /** 逐条或批量转换；过期索引整批拒绝并返回 WIKI_10001 */
  convertMentions: (targetPath: string, mentions: UnlinkedMentionRef[]) =>
    call<number>("wiki_convert_mentions", { targetPath, mentions }),
};
