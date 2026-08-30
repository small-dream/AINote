import { useSessionStore } from "@/stores/session.store";

/** 工作区：三栏布局骨架（目录树 | 笔记列表 | 编辑器），feature 组件就绪后在此组装 */
export function WorkspacePage() {
  const repoPath = useSessionStore((s) => s.repoPath);

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r border-bg-secondary bg-bg-secondary p-4">
        <p className="text-sm text-text-secondary">
          {repoPath ? `仓库：${repoPath}` : "尚未绑定仓库"}
        </p>
      </aside>
      <section className="w-72 border-r border-bg-secondary p-4">
        <p className="text-sm text-text-secondary">笔记列表</p>
      </section>
      <main className="flex-1 p-6">
        <p className="text-text-secondary">选择或新建一篇笔记开始写作</p>
      </main>
    </div>
  );
}
