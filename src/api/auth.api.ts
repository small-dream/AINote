import { call } from "./client";
import type { AuthStatusDto, LoginDto } from "./types";

/** 认证相关 IPC（P0-1 授权） */
export const authApi = {
  /** 保存指定托管平台的令牌到本地安全存储（前端不落盘明文） */
  saveToken: (provider: string, token: string, login?: string) =>
    call<null>("save_token", { provider, token, login }),
  /** 调平台 API 校验令牌，返回账号名 */
  validateToken: (provider: string, token: string) =>
    call<LoginDto>("validate_token", { provider, token }),
  /** 查询认证与绑定状态（启动时路由守卫用） */
  status: () => call<AuthStatusDto>("auth_status"),
  /**
   * 登出：不传平台时清除全部凭证与本地配置（含仓库绑定）；
   * 传平台时只断开该平台账号，保留仓库绑定。
   */
  logout: (provider?: string) => call<null>("logout", { provider }),
};
