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
  notes: E2eNoteSeed[];
  /** 仓库相对路径 → data-uri，用于图片加载测试 */
  assets?: Record<string, string>;
  versions?: Record<string, E2eVersionSeed[]>;
  conflicted?: boolean;
  conflicts?: E2eConflictSeed[];
}

export interface E2eRecord {
  cmd: string;
  args: Record<string, unknown>;
}
