interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

/** 将 Markdown 行内 `#标签` 转为带 data-tag 的节点，预览层据此渲染成标签胶囊。 */
export const remarkMarkdownTags = () => (tree: MarkdownNode): void => {
  transformNodes(tree);
};

function transformNodes(node: MarkdownNode): void {
  if (!node.children || node.type === "code" || node.type === "inlineCode") return;
  node.children = node.children.flatMap(transformChild);
  for (const child of node.children) transformNodes(child);
}

function transformChild(node: MarkdownNode): MarkdownNode[] {
  if (node.type !== "text") return [node];
  return splitTagText(node.value ?? "");
}

function splitTagText(value: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(TAG_PATTERN)) {
    const tag = match[1];
    if (!tag) continue;
    const start = match.index ?? 0;
    pushText(nodes, value.slice(cursor, start));
    nodes.push({
      type: "emphasis",
      data: {
        hName: "em",
        hProperties: { "data-tag": tag },
      },
      children: [{ type: "text", value: tag }],
    });
    cursor = start + match[0].length;
  }
  pushText(nodes, value.slice(cursor));
  return nodes;
}

function pushText(nodes: MarkdownNode[], value: string): void {
  if (value) nodes.push({ type: "text", value });
}

const TAG_PATTERN = /(?:^|[\s，。、；])#([^\s#，。、；]+)/gu;
