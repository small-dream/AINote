import { useState } from "react";
import type { ConflictFile } from "@/api/types";
import type { ConflictMergeController } from "../hooks/useConflictMerge";
import { ConflictActions, ConflictLinePane, ConflictPaneTabs, MergeEditor, type ConflictPaneKey } from "./ConflictPanes";

interface MobileConflictPanesProps {
  merge: ConflictMergeController;
  file: ConflictFile;
}

/**
 * 移动单栏冲突面板：手机宽度放不下三栏并排，改为「本地 / 合并结果 / 远端」分页签，
 * 一次只看一栏，底部固定操作条随时可点「保留本地 / 保留远端 / 保存合并」。
 */
export function MobileConflictPanes({ merge, file }: MobileConflictPanesProps) {
  const [pane, setPane] = useState<ConflictPaneKey>("merge");
  const busy = merge.resolving;

  return (
    <div className="conflict-mobile-body flex min-h-0 flex-1 flex-col">
      <ConflictPaneTabs active={pane} onChange={setPane} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {pane === "merge" ? (
          <MergeEditor merged={merge.merged} onChange={merge.setMerged} />
        ) : (
          <ConflictLinePane
            titleKey={pane === "local" ? "sync.localPane" : "sync.remotePane"}
            content={pane === "local" ? file.local : file.remote}
            onAddLine={merge.addLine}
            onAppendAll={merge.appendAll}
            disabled={busy}
            touch
          />
        )}
      </div>
      <ConflictActions
        variant="touch"
        onKeepLocal={() => merge.resolveWithSide("local")}
        onKeepRemote={() => merge.resolveWithSide("remote")}
        onSave={merge.saveMerge}
        pending={merge.pending}
        disabled={busy}
      />
    </div>
  );
}
