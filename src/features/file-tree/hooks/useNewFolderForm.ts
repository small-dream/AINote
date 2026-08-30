import { useState, type FormEvent } from "react";
import { messageOf } from "@/api";
import { normalizeFolderPath } from "../utils/path";

/** 新建文件夹表单编排：路径 + pending/error + 提交校验 */
export function useNewFolderForm(dir: string, onCreate: (path: string) => Promise<void>) {
  const [path, setPath] = useState(() => (dir ? `${dir}/` : ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function changePath(value: string) {
    setPath(value);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeFolderPath(path);
    if (!normalized) {
      setError("请输入文件夹路径");
      return;
    }
    if (normalized.endsWith(".md")) {
      setError("文件夹名不应以 .md 结尾");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCreate(normalized);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  }

  return { path, error, pending, changePath, submit };
}
