import { useEffect, useState } from "react";
import { useTaskBoardQuery } from "@/queries/task.queries";
import { useUiStore } from "@/stores/ui.store";
import { buildStartupDigest, digestDateKey, msUntilNextLocalDay, type StartupDigest } from "../utils/startupDigest";
import { hasPromptedDigest, markDigestPrompted } from "../utils/startupDigestLog";

export interface TaskStartupDigest {
  digest: StartupDigest;
  /** 打开待办并定位到最紧要的一条 */
  onView: () => void;
  /** 收起卡片；「当天不再提示」由展示时的记录保证 */
  onDismiss: () => void;
}

/** 窗口不可见时不提示：避免应用在后台跨过午夜就把当天的提示用掉 */
function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

/**
 * 本次运行该按哪个 key 展示摘要卡：没有可选任务、窗口不可见或当天已提示过时返回 null。
 * 一旦展示过就直接沿用（用户没点关闭前不会因为记录落盘而中途消失）。
 */
function resolveShownKey(key: string | null, hasDigest: boolean, shownKey: string | null): string | null {
  if (key === null || !hasDigest || !isDocumentVisible()) return null;
  if (shownKey === key) return key;
  return hasPromptedDigest(key) ? null : key;
}

/**
 * 启动摘要：每天首次进入工作区时，若有「已逾期或今天到期」的任务就展示一张摘要卡。
 *
 * 只维护「本次运行是否已展示」这一个状态，计数与条目每次渲染从任务板重算，
 * 因此勾完 / 删完会自己收起；「当天已提示」落在本机记录里，重启或重进当天不再打扰。
 */
export function useTaskStartupDigest(repoPath: string | null): TaskStartupDigest | null {
  const { data: board } = useTaskBoardQuery(repoPath);
  const setSidebarTab = useUiStore((state) => state.setSidebarTab);
  const focusTask = useUiStore((state) => state.focusTask);
  const [shownKey, setShownKey] = useState<string | null>(null);
  // 两个触发器：回到前台会重新判断；跨过本地午夜则换一天，定时器触发后重挂到再下一个午夜
  const [, setAwakeTick] = useState(0);
  const [dayTick, setDayTick] = useState(0);
  const tasks = board?.tasks ?? [];
  const now = new Date();
  const digest = repoPath === null ? null : buildStartupDigest(tasks, now);
  const visibleKey = resolveShownKey(repoPath === null ? null : digestDateKey(repoPath, now), digest !== null, shownKey);

  // 渲染期派生「本次运行是否已展示」：React 允许在渲染中按外部输入调整 state，
  // 放在 effect 里会被 react-hooks 判为级联渲染（set-state-in-effect）。
  if (visibleKey !== null && visibleKey !== shownKey) setShownKey(visibleKey);

  // 展示即记「当天已提示」：不点任何按钮也不再重复弹出，跨天后按新日期重新判断
  useEffect(() => {
    if (shownKey !== null) markDigestPrompted(shownKey, new Date());
  }, [shownKey]);

  // 回到前台（窗口聚焦 / 从后台切回）时重新判断一次：跨天后的第二次进入走这里
  useEffect(() => {
    const onAwake = () => { if (isDocumentVisible()) setAwakeTick((value) => value + 1); };
    document.addEventListener("visibilitychange", onAwake);
    window.addEventListener("focus", onAwake);
    return () => {
      document.removeEventListener("visibilitychange", onAwake);
      window.removeEventListener("focus", onAwake);
    };
  }, []);

  // 挂机跨过本地午夜后重新判断；触发后重挂到再下一个午夜，长驻应用不会漏掉后续几天
  useEffect(() => {
    const handle = window.setTimeout(() => setDayTick((value) => value + 1), msUntilNextLocalDay(new Date()));
    return () => window.clearTimeout(handle);
  }, [dayTick]);

  if (visibleKey === null || digest === null) return null;

  return {
    digest,
    onView: () => {
      const first = digest.items[0];
      setShownKey(null);
      if (first) focusTask(first.id);
      setSidebarTab("todo");
    },
    onDismiss: () => setShownKey(null),
  };
}
