import { useTranslation } from "@/i18n";
import type { FrontmatterField } from "../utils/markdownPipeline";

export function MarkdownProperties({ fields }: { fields: FrontmatterField[] }) {
  const { t } = useTranslation();
  return <section className="markdown-properties" aria-label={t("note.properties")}>
    <div className="markdown-properties-title">{t("note.properties")}</div>
    <dl>{fields.map((field) => <div className="markdown-property" key={field.key}><dt>{field.key}</dt><dd>{field.value}</dd></div>)}</dl>
  </section>;
}
