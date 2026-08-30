import { call } from "./client";
import type { AuthStatusDto, LoginDto } from "./types";

/** 认证相关 IPC（P0-1 授权） */
export const authApi = {
  /** 保存 GitHub Token 到系统钥匙串（前端不落盘明文） */
  saveToken: (token: string) => call<null>("save_token", { token }),
  /** 调 GitHub API 校验 token，返回登录名 */
  validateToken: (token: string) => call<LoginDto>("validate_token", { token }),
  /** 查询认证与绑定状态（启动时路由守卫用） */
  status: () => call<AuthStatusDto>("auth_status"),
  /** 登出：删除钥匙串 token 并清除仓库绑定 */
  logout: () => call<null>("logout"),
};
