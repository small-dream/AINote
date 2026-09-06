import type { Locale } from "@/stores/ui.store";

const RELEASE_SECTIONS: Record<Locale, string[]> = {
  "zh-CN": ["更新内容", "更新说明"],
  "en-US": ["what's new", "whats new", "what is new"],
};

/** 从完整 Release 正文中截取当前语言的更新内容，避免展示安装说明。 */
export function extractReleaseNotes(body: string | null, locale: Locale): string | null {
  if (!body?.trim()) return null;

  const sections = parseMarkdownSections(body);
  const preferred = pickSection(sections, RELEASE_SECTIONS[locale]);
  if (preferred) return preferred;

  const alternateLocale: Locale = locale === "zh-CN" ? "en-US" : "zh-CN";
  return pickSection(sections, RELEASE_SECTIONS[alternateLocale]) ?? body.trim();
}

function parseMarkdownSections(body: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let heading: string | null = null;

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (match?.[1]) {
      heading = normalizeHeading(match[1]);
      if (!sections.has(heading)) sections.set(heading, []);
      continue;
    }
    if (heading) sections.get(heading)?.push(line);
  }

  return sections;
}

function pickSection(sections: Map<string, string[]>, headings: string[]): string | null {
  for (const heading of sections.keys()) {
    if (!headings.includes(heading)) continue;
    const content = (sections.get(heading) ?? []).join("\n").trim();
    if (content) return content;
  }
  return null;
}

function normalizeHeading(value: string): string {
  return value.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
}
