import { useState } from "react";
import type { TaskBoardDto, TaskListDto } from "@/api/types";

interface TodoPanelState {
  lists: TaskListDto[];
  /** 当前选中清单；未选或已被删除时回退第一个清单 */
  activeListId: string | null;
  selectList: (listId: string) => void;
  /** 正在展开编辑的任务 */
  editingTaskId: string | null;
  toggleEditing: (taskId: string) => void;
  closeEditor: () => void;
}

/** Todo 面板局部态编排：选中清单、展开编辑。 */
export function useTodoPanel(board: TaskBoardDto | undefined): TodoPanelState {
  const lists = board?.lists ?? [];
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const activeListId = lists.some((list) => list.id === selectedListId)
    ? selectedListId
    : (lists[0]?.id ?? null);

  return {
    lists,
    activeListId,
    selectList: setSelectedListId,
    editingTaskId,
    toggleEditing: (taskId) => setEditingTaskId((current) => (current === taskId ? null : taskId)),
    closeEditor: () => setEditingTaskId(null),
  };
}
