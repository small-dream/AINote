import { useTranslation } from "@/i18n";
import {
  parseFontSize,
  parseLineHeight,
  parseReadingWidth,
  useTypographyStore,
  type FontFamily,
  type FontSize,
  type LineHeight,
  type ReadingWidth,
} from "@/stores/typography.store";

const FONT_SIZE_OPTIONS: FontSize[] = [13, 14, 15, 16, 17];
const LINE_HEIGHT_OPTIONS: LineHeight[] = [1.5, 1.7, 1.9, 2.1];
const READING_WIDTH_OPTIONS: ReadingWidth[] = [60, 68, 72, 80];
const FONT_FAMILY_OPTIONS: ReadonlyArray<{ value: FontFamily; key: "settings.fontSans" | "settings.fontSerif" }> = [
  { value: "sans", key: "settings.fontSans" },
  { value: "serif", key: "settings.fontSerif" },
];

/** 设置页「外观 → 排版」：字号 / 行高 / 阅读宽度 / 字体族，与阅读主题配色解耦。 */
export function TypographySettings() {
  const { t } = useTranslation();
  const { fontSize, lineHeight, readingWidth, fontFamily, setFontSize, setLineHeight, setReadingWidth, setFontFamily } = useTypographyStore();
  return (
    <section>
      <h3 className="mb-3 text-sm font-medium text-text-primary">{t("settings.typography")}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectSetting label={t("settings.fontSize")} value={String(fontSize)} onChange={(value) => setFontSize(parseFontSize(value))} options={FONT_SIZE_OPTIONS.map((value) => ({ value: String(value), label: `${value}px` }))} />
        <SelectSetting label={t("settings.lineHeight")} value={String(lineHeight)} onChange={(value) => setLineHeight(parseLineHeight(value))} options={LINE_HEIGHT_OPTIONS.map((value) => ({ value: String(value), label: String(value) }))} />
        <SelectSetting label={t("settings.readingWidth")} value={String(readingWidth)} onChange={(value) => setReadingWidth(parseReadingWidth(value))} options={READING_WIDTH_OPTIONS.map((value) => ({ value: String(value), label: `${value}ch` }))} />
        <div>
          <span className="mb-1.5 block text-xs text-text-tertiary">{t("settings.fontFamily")}</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("settings.fontFamily")}>
            {FONT_FAMILY_OPTIONS.map(({ value, key }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={fontFamily === value}
                onClick={() => setFontFamily(value)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${fontFamily === value ? "border-accent bg-accent-soft text-accent" : "border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"}`}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectSetting({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-text-tertiary">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-bg-primary px-2.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
