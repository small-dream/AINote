import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";

interface AiModelToolbarProps {
  count: number;
  onAdd: () => void;
}

export function AiModelToolbar({ count, onAdd }: AiModelToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-text-primary">
        {t("ai.modelCatalog")} <span className="text-xs text-text-tertiary">{count}</span>
      </h3>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" className="inline-flex items-center gap-1 border border-border text-xs" onClick={onAdd}>
          <Plus size={13} />
          {t("ai.addModel")}
        </Button>
      </div>
    </div>
  );
}
