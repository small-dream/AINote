import type { NavBadgeTone } from "@/components/atoms/NavCountBadge";
import { useTranslation } from "@/i18n";
import { useTaskBoardQuery } from "@/queries/task.queries";
import { buildTodoOverview } from "../utils/overview";

/** 待办入口的到期压力：未完成的「逾期 + 今天到期」 */
export interface TodoAlertCounts {
  overdue: number;
  dueToday: number;
  total: number;
}

/** 入口角标的渲染参数（无待处理任务时为 null，入口名与角标都保持原样） */
export interface TodoNavBadge {
  count: number;
  tone: NavBadgeTone;
  /** 带数量的入口名：按钮的可访问名字用，屏幕阅读器也能听到数量 */
  ariaLabel: string;
}

/**
 * 待办看板的到期计数：口径与待办分组一致（复用 buildTodoOverview）。
 * 与待办列表一样每次渲染现算——条目量级小，换来的是数字永远跟着任务板走。
 */
export function useTodoAlertCounts(repoPath: string | null): TodoAlertCounts {
  const { data: board } = useTaskBoardQuery(repoPath);
  const overview = buildTodoOverview(board?.tasks ?? [], new Date());
  return { overdue: overview.overdue, dueToday: overview.dueToday, total: overview.overdue + overview.dueToday };
}

/** 桌面导航轨与移动底部导航共用的「待办」入口角标 */
export function useTodoNavBadge(repoPath: string | null): TodoNavBadge | null {
  const { t } = useTranslation();
  const { overdue, total } = useTodoAlertCounts(repoPath);
  if (total === 0) return null;
  return {
    count: total,
    tone: overdue > 0 ? "danger" : "warning",
    ariaLabel: t("todo.badgeAria", { label: t("todo.title"), count: total }),
  };
}
