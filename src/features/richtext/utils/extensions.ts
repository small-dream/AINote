import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import { AinoteImage } from "../extensions/image";
import { WikiLink } from "../extensions/wikiLink";
import { TagMark } from "../extensions/tag";
import { SlashCommand } from "../extensions/slashCommand";
import { CodeBlock } from "../extensions/codeBlock";

/** 富文本编辑器扩展集合：useRichTextEditor 与 markdown→JSON 互转共用 */
export function createRichTextExtensions(repoPath: string | null): Extensions {
  return [
    StarterKit.configure({
      codeBlock: false,
      // 链接 mark：命名为标准 "link"，tiptap-markdown 按名字自动复用 [text](href) 序列化/解析
      link: { openOnClick: false, HTMLAttributes: { class: "link-mark", rel: "noopener noreferrer" } },
    }),
    CodeBlock,
    AinoteImage.configure({ repoPath }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({ transformPastedText: true, transformCopiedText: true, breaks: false, tightLists: true }),
    WikiLink,
    TagMark,
    SlashCommand,
  ];
}
