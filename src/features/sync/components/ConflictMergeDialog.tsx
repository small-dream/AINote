import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { useTranslation } from "@/i18n";
import { useBackHandler } from "@/platform/back-navigation";
import { isEnvelopeText } from "@/features/vault/utils/envelope";
import { useConflictMerge } from "../hooks/useConflictMerge";
import type { ConflictMergeController } from "../hooks/useConflictMerge";
import { ConflictFailureBanner } from "./ConflictFailureBanner";
import { ConflictMergeHeader } from "./ConflictMergeHeader";
import { ConflictMergePlaceholder } from "./ConflictMergePlaceholder";
import { DesktopConflictPanes } from "./DesktopConflictPanes";
import { EncryptedMergePane } from "./EncryptedMergePane";
import { MobileConflictPanes } from "./MobileConflictPanes";
import "../conflict.css";

interface ConflictMergeDialogProps {
  repoPath: string | null;
  open: boolean;
  onClose: () => void;
}

/** 合并冲突图形化处理（P1-3）：桌面三栏对比，移动端分页签单栏 + 底部操作条 */
export function ConflictMergeDialog({ repoPath, open, onClose }: ConflictMergeDialogProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobileViewport();
  const merge = useConflictMerge(repoPath, open, onClose);
  useBackHandler(open, onClose);
  if (!open) return null;
  // 加密笔记不可逐行合并（密文没有可挑选的行结构）：降级为「保留本地 / 保留远端」二选一
  const encrypted = isEnvelopeText(merge.file?.local) || isEnvelopeText(merge.file?.remote);
  return (
    <div
      data-mobile-overlay="conflict"
      className="fixed inset-0 z-50 bg-black/40"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={merge.file?.path ?? t("sync.conflictMerge")}
        className="mx-auto mt-10 flex h-[80vh] w-[min(1120px,94vw)] flex-col overflow-hidden rounded-xl bg-bg-primary shadow-2xl"
      >
        <ConflictMergeHeader merge={merge} onClose={onClose} />
        <ConflictFailureBanner error={merge.error} onRetry={merge.retry} retrying={merge.resolving} />
        <ConflictMergeBody merge={merge} isMobile={isMobile} encrypted={encrypted} />
      </div>
    </div>
  );
}

interface ConflictMergeBodyProps {
  merge: ConflictMergeController;
  isMobile: boolean;
  encrypted: boolean;
}

/** 主体：先兜住加载/失败/空三态，再按加密、平台选择面板 */
function ConflictMergeBody({ merge, isMobile, encrypted }: ConflictMergeBodyProps) {
  if (merge.phase !== "ready" || !merge.file) return <ConflictMergePlaceholder merge={merge} />;
  const file = merge.file;
  if (encrypted) {
    return (
      <EncryptedMergePane
        pending={merge.pending}
        disabled={merge.resolving}
        onKeepLocal={() => merge.resolveWithSide("local")}
        onKeepRemote={() => merge.resolveWithSide("remote")}
      />
    );
  }
  // key：切换冲突文件时重置移动端面板选择（本地 / 合并 / 远端）
  return isMobile ? (
    <MobileConflictPanes key={file.path} merge={merge} file={file} />
  ) : (
    <DesktopConflictPanes merge={merge} file={file} />
  );
}
