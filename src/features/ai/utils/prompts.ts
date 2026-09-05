/** AI 写作动作与提示词模板（纯函数，可单测、可审计；不在此处做任何 IPC/IO） */

export type AiWriteAction = "polish" | "translate" | "shorten" | "expand" | "continue" | "summarize" | "compose" | "review" | "optimize";

export const AI_WRITE_ACTIONS: readonly AiWriteAction[] = ["polish", "translate", "shorten", "expand", "continue"];

/** 摘要动作：不依赖选区，基于整篇笔记生成（P1-AI-2） */
export const AI_SUMMARIZE: AiWriteAction = "summarize";
export const AI_DOCUMENT_ACTIONS: readonly AiWriteAction[] = ["compose", "review", "optimize"];

/** 各动作的系统提示（约束输出为纯文本，不添加解释） */
export function actionSystem(action: AiWriteAction): string {
  switch (action) {
    case "polish":
      return "你是专业的写作助手，擅长中文写作润色。只输出润色后的文本，不添加任何解释、前后缀或 Markdown 格式。";
    case "translate":
      return "你是专业翻译。将输入文本翻译成简体中文，只输出译文，不添加解释。";
    case "shorten":
      return "你是专业的写作精简助手。将文本压缩为约一半长度，保留全部关键信息，只输出结果。";
    case "expand":
      return "你是专业的写作扩展助手。在保持原风格一致的前提下扩写文本，补充细节与例证，只输出结果。";
    case "continue":
      return "你是写作续写助手。根据上下文自然续写，保持风格一致，只输出续写部分。";
    case "summarize":
      return "你是专业的笔记摘要助手。只输出摘要正文，3-5 句话覆盖核心要点，不添加解释或 Markdown 标题。";
    case "compose":
      return "你是专业创作者。根据给定主题创作结构清晰的 Markdown 笔记，只输出可直接保存的 Markdown 正文，不要解释。";
    case "review":
      return "你是严谨的笔记审查助手。检查事实与逻辑、表述歧义、结构问题和 Markdown 语法；如果所用模型具备联网检索能力，请优先核实关键事实，否则标注为无法核实。输出 Markdown 审查报告，只列具体问题、修改建议和无法核实的信息，不要重写全文。";
    case "optimize":
      return "你是专业的笔记编辑。优化结构与语言表达，保留原意与关键事实；输出优化后的完整内容，不要添加审查报告或解释。";
  }
}

/** 构造用户消息；续写时携带当前笔记标题增强上下文 */
const WRITE_PROMPT_TEMPLATES: Record<AiWriteAction, (source: string, title: string) => string> = {
  polish: (source) => `请润色以下文本，保持原意不变：\n\n${source}`,
  translate: (source) => `请将以下文本翻译成简体中文：\n\n${source}`,
  shorten: (source) => `请精简以下文本，保留关键信息：\n\n${source}`,
  expand: (source) => `请扩写以下文本：\n\n${source}`,
  continue: (source, title) => `以下是笔记「${title}」的现有内容，请从末尾自然续写：\n\n${source}`,
  summarize: (source) => `请为以下笔记生成一段简洁摘要，覆盖核心要点：\n\n${source}`,
  compose: (source, title) => `请围绕主题「${title}」创作一篇结构清晰的 Markdown 笔记：\n\n${source}`,
  review: (source, title) => `请审查笔记「${title}」中的纰漏、事实风险、逻辑与表达问题：\n\n${source}`,
  optimize: (source, title) => `请优化笔记「${title}」的结构、组织方式与语言表达，输出完整结果：\n\n${source}`,
};

export function buildWritePrompt(action: AiWriteAction, text: string, contextTitle?: string): string {
  return WRITE_PROMPT_TEMPLATES[action](text.trim(), contextTitle || "当前笔记");
}

/** Ask AI 面板上下文范围 */
export type AskScope = "current" | "repo";

/** 文档级 AI 建议类型：标题建议 / 大纲建议（P1-AI-3） */
export type AiSuggestKind = "title" | "outline";

const SUGGEST_SOURCE_MAX_CHARS = 6000;

/** 文档级建议的系统提示：标题输出每行一个候选；大纲输出 Markdown 层级列表 */
export function suggestSystem(kind: AiSuggestKind): string {
  return kind === "title"
    ? "你是笔记标题顾问。阅读笔记后输出 3-5 个更清晰、更有吸引力的标题候选，每行一个，不要序号、引号或任何额外文字。"
    : "你是笔记结构顾问。阅读笔记后输出一份 Markdown 大纲（用 - 与缩进表达层级），保留原笔记的主要章节与要点，不要额外解释。";
}

/** 文档级建议的用户消息：标题/大纲均以整篇笔记为源（超长截断控 token） */
export function buildSuggestPrompt(kind: AiSuggestKind, source: string): string {
  const src = source.length > SUGGEST_SOURCE_MAX_CHARS ? source.slice(0, SUGGEST_SOURCE_MAX_CHARS) : source;
  return kind === "title"
    ? `请为以下笔记生成标题候选：\n\n${src}`
    : `请为以下笔记生成大纲：\n\n${src}`;
}

/** 问答系统提示：根据范围把当前笔记全文或占位说明写入 */
export function buildChatSystem(scope: AskScope, noteContent: string): string {
  const clamped = noteContent.length > 8000 ? noteContent.slice(0, 8000) : noteContent;
  if (scope === "current") {
    return `你是 AINote 的笔记助手。以下是当前笔记全文，请优先依据笔记内容回答，并指出依据的段落：\n\n【当前笔记】\n${clamped}`;
  }
  return "你是 AINote 的笔记助手。请依据本次请求附带的笔记库上下文回答，区分事实与推测；上下文不足时如实说明。";
}
