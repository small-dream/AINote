import { useNavigate } from "react-router";
import { useSessionStore } from "@/stores/session.store";
import { useCaptureController } from "../hooks/useCaptureController";
import { CaptureDialog } from "./CaptureDialog";

/** 全局快速捕捉入口：桌面快捷键事件与 Android 待确认分享共用同一弹窗。 */
export function CaptureRoot() {
  const navigate = useNavigate();
  const repoPath = useSessionStore((state) => state.repoPath);
  const controller = useCaptureController(repoPath, (note) => {
    useSessionStore.getState().navigateTo({ path: note.path });
    navigate("/workspace");
  });
  return (
    <CaptureDialog
      open={controller.open}
      hasRepo={repoPath !== null}
      text={controller.text}
      tags={controller.tags}
      link={controller.link}
      share={controller.share}
      saving={controller.saving}
      error={controller.error}
      onChangeText={controller.setText}
      onChangeTags={controller.setTags}
      onChangeLink={controller.setLink}
      onSave={() => void controller.save()}
      onClose={controller.close}
      onBindRepo={() => { controller.close(); navigate("/setup"); }}
    />
  );
}
