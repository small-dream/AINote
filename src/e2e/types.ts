/** E2E 种子与记录类型（src/e2e/ipcMock.ts 与 e2e/ 测试共享）。 */

export interface E2eNoteSeed {
  path: string;
  kind?: "markdown" | "richText";
  content: string;
}

export interface E2eVersionSeed {
  path: string;
  id: string;
  message: string;
  content: string;
}

export interface E2eConflictSeed {
  path: string;
  local: string;
  remote: string;
}

export interface E2eState {
  repoPath: string;
  /** 当前安装版本（`plugin:app|version`，移动端更新检查用） */
  appVersion?: string;
  /** 本地指标开关初始状态（默认开启） */
  metricsEnabled?: boolean;
  notes: E2eNoteSeed[];
  /** 仓库相对路径 → data-uri，用于图片加载测试 */
  assets?: Record<string, string>;
  versions?: Record<string, E2eVersionSeed[]>;
  conflicted?: boolean;
  conflicts?: E2eConflictSeed[];
  /** 注入一次同步失败（用于验证失败态 UI 与恢复入口） */
  syncFailure?: {
    code: string;
    kind: string;
    message: string;
    retriable: boolean;
    /** 后端定位到的失败阶段（E4-T4） */
    stage?: "commit" | "pull" | "push";
    /** 后端定位到的失败文件（E4-T4） */
    files?: string[];
    /** 后端建议码（E4-T4） */
    hint?: "retry" | "relogin" | "checkPermission" | "resolveConflicts";
  };
  /** 注入一次「拉取自动重试中」：进度下发后保持挂起，直到用户取消 */
  syncRetry?: { retry: number; maxRetries: number; delayMs: number };
}

export interface E2eRecord {
  cmd: string;
  args: Record<string, unknown>;
}
