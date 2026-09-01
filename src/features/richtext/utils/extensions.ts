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

/** 富文本编辑器扩展集合：useRichTextEditor 与 markdown→JSON 互转共用 */
export function createRichTextExtensions(repoPath: string | null): Extensions {
  return [
    StarterKit,
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
