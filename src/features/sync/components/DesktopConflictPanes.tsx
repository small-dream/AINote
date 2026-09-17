import type { ConflictFile } from "@/api/types";
import type { ConflictMergeController } from "../hooks/useConflictMerge";
import { ConflictActions, ConflictLinePane, MergeEditor } from "./ConflictPanes";

interface DesktopConflictPanesProps {
  merge: ConflictMergeController;
  file: ConflictFile;
}

/** 桌面三栏：本地 | 合并结果 | 远端，同时可见，行级挑选与两侧一键保留都在这里 */
export function DesktopConflictPanes({ merge, file }: DesktopConflictPanesProps) {
  const busy = merge.resolving;
  return (
    <div className="conflict-panel-body grid min-h-0 flex-1 grid-cols-3 divide-x divide-border">
      <ConflictLinePane
        titleKey="sync.localPane"
        content={file.local}
        onAddLine={merge.addLine}
        onAppendAll={merge.appendAll}
        disabled={busy}
      />
      <section className="flex min-h-0 flex-col">
        <MergeEditor merged={merge.merged} onChange={merge.setMerged} />
        <ConflictActions
          onKeepLocal={() => merge.resolveWithSide("local")}
          onKeepRemote={() => merge.resolveWithSide("remote")}
          onSave={merge.saveMerge}
          pending={merge.pending}
          disabled={busy}
        />
      </section>
      <ConflictLinePane
        titleKey="sync.remotePane"
        content={file.remote}
        onAddLine={merge.addLine}
        onAppendAll={merge.appendAll}
        disabled={busy}
      />
    </div>
  );
}
