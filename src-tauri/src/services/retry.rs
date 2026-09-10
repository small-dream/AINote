//! 幂等操作的自动重试策略：指数退避 + 抖动 + 上限。
//!
//! 只允许用在幂等操作上（`pull` / `fetch` / `ls_remote`）；`push` 非幂等，
//! 一律由用户显式重试，绝不进入这里。策略与等待计算都是纯函数，等待与进度回调可注入。

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crate::domain::error::AppError;

/// 重试策略：首次等待 `base_delay_ms`，之后每次翻倍，单次不超过 `max_delay_ms`。
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct RetryPolicy {
    pub(crate) base_delay_ms: u64,
    pub(crate) max_delay_ms: u64,
    /// 最大重试次数（不含首次尝试）
    pub(crate) max_retries: u32,
    /// 抖动幅度，0.25 表示落在等待时间的 ±25%
    pub(crate) jitter_ratio: f64,
}

impl RetryPolicy {
    /// 网络类同步操作：3 次重试，0.5s 起、8s 封顶、±25% 抖动（合计等待 ≈ 3.5s）。
    pub(crate) fn network() -> Self {
        Self {
            base_delay_ms: 500,
            max_delay_ms: 8_000,
            max_retries: 3,
            jitter_ratio: 0.25,
        }
    }
}

/// 第 `retry` 次重试的指数等待（未加抖动），按 `max_delay_ms` 封顶（纯函数）。
pub(crate) fn backoff_ms(policy: &RetryPolicy, retry: u32) -> u64 {
    let exponent = retry.saturating_sub(1).min(32);
    policy
        .base_delay_ms
        .saturating_mul(1u64 << exponent)
        .min(policy.max_delay_ms)
}

/// 叠加抖动：`unit ∈ [0,1)` 由调用方提供，结果落在 `delay × [1-r, 1+r]`（纯函数）。
pub(crate) fn jittered_ms(delay_ms: u64, jitter_ratio: f64, unit: f64) -> u64 {
    let ratio = jitter_ratio.clamp(0.0, 1.0);
    let factor = 1.0 - ratio + 2.0 * ratio * unit.clamp(0.0, 1.0);
    ((delay_ms as f64) * factor).round().max(1.0) as u64
}

/// 第 `retry` 次重试的实际等待时间（纯函数）。
pub(crate) fn delay_ms(policy: &RetryPolicy, retry: u32, unit: f64) -> u64 {
    jittered_ms(backoff_ms(policy, retry), policy.jitter_ratio, unit)
}

/// 只有网络类错误值得自动重试：凭证失效要重新登录，远端拒绝要用户决策（纯函数）。
pub(crate) fn should_retry(error: &AppError) -> bool {
    matches!(error, AppError::SyncNetwork(_))
}

/// 一次重试的进度，用于前端展示「重试中（retry/max_retries）」。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct RetryAttempt {
    pub(crate) retry: u32,
    pub(crate) max_retries: u32,
    pub(crate) delay_ms: u64,
}

/// 重试运行环境：取消标志由调用方持有，等待与进度回调可注入（测试传假实现）。
pub(crate) struct RetryContext<'a> {
    pub(crate) cancel: &'a AtomicBool,
    /// `None` 表示真实 `thread::sleep`
    pub(crate) sleep: Option<&'a mut dyn FnMut(u64)>,
    /// `None` 表示不上报进度
    pub(crate) report: Option<&'a mut dyn FnMut(RetryAttempt)>,
}

static NEVER_CANCELLED: AtomicBool = AtomicBool::new(false);

impl<'a> RetryContext<'a> {
    /// 后台上下文：不会被取消、不上报进度，等待用真实 `thread::sleep`。
    pub(crate) fn background() -> Self {
        Self {
            cancel: &NEVER_CANCELLED,
            sleep: None,
            report: None,
        }
    }
}

/// 执行 `operation`，仅对可重试错误按策略退避重试；等待期间可取消。
///
/// 取消只结束等待、不再发起新的尝试，返回最后一次的原始错误，交由用户显式重试。
pub(crate) fn with_retry<T, Op>(
    policy: RetryPolicy,
    ctx: &mut RetryContext<'_>,
    mut operation: Op,
) -> Result<T, AppError>
where
    Op: FnMut() -> Result<T, AppError>,
{
    let mut retries = 0;
    loop {
        match operation() {
            Ok(value) => return Ok(value),
            Err(error) => {
                let give_up = retries >= policy.max_retries
                    || !should_retry(&error)
                    || ctx.cancel.load(Ordering::SeqCst);
                if give_up {
                    return Err(error);
                }
                retries += 1;
                let delay = delay_ms(&policy, retries, random_unit());
                if let Some(report) = ctx.report.as_mut() {
                    report(RetryAttempt {
                        retry: retries,
                        max_retries: policy.max_retries,
                        delay_ms: delay,
                    });
                }
                wait(ctx, delay);
                if ctx.cancel.load(Ordering::SeqCst) {
                    log::info!(target: "ainote::sync", "自动重试已取消 retry={retries}");
                    return Err(error);
                }
            }
        }
    }
}

fn wait(ctx: &mut RetryContext<'_>, delay_ms: u64) {
    match ctx.sleep.as_mut() {
        Some(sleep) => sleep(delay_ms),
        None => std::thread::sleep(Duration::from_millis(delay_ms)),
    }
}

/// 抖动随机源；取不到随机数时退化为 0.5（等价于不加抖动偏移），不影响重试本身。
fn random_unit() -> f64 {
    let mut bytes = [0u8; 8];
    match getrandom::getrandom(&mut bytes) {
        Ok(()) => ((u64::from_le_bytes(bytes) >> 11) as f64) / ((1u64 << 53) as f64),
        Err(_) => 0.5,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> RetryPolicy {
        RetryPolicy {
            base_delay_ms: 100,
            max_delay_ms: 400,
            max_retries: 3,
            jitter_ratio: 0.0,
        }
    }

    fn net(message: &str) -> AppError {
        AppError::SyncNetwork(message.into())
    }

    #[test]
    fn backoff_grows_exponentially_then_caps() {
        let policy = policy();
        assert_eq!(backoff_ms(&policy, 1), 100);
        assert_eq!(backoff_ms(&policy, 2), 200);
        assert_eq!(backoff_ms(&policy, 3), 400);
        assert_eq!(backoff_ms(&policy, 4), 400, "不超过单次上限");
        assert_eq!(backoff_ms(&policy, 0), 100, "第 0 次按首次等待处理");
    }

    #[test]
    fn jitter_stays_inside_ratio() {
        assert_eq!(jittered_ms(1000, 0.25, 0.0), 750);
        assert_eq!(jittered_ms(1000, 0.25, 0.5), 1000);
        assert_eq!(jittered_ms(1000, 0.25, 1.0), 1250);
        assert_eq!(jittered_ms(1000, 0.0, 0.9), 1000, "抖动为 0 时等于原始等待");
        assert_eq!(jittered_ms(0, 0.25, 0.0), 1, "等待时间恒为正");
    }

    #[test]
    fn only_network_errors_are_retried() {
        assert!(should_retry(&net("timeout")));
        assert!(!should_retry(&AppError::SyncAuth("401".into())));
        assert!(!should_retry(&AppError::SyncRejected("403".into())));
        assert!(!should_retry(&AppError::Conflict("c".into())));
        assert!(!should_retry(&AppError::Git("local".into())));
        assert!(!should_retry(&AppError::Io("disk".into())));
    }

    #[test]
    fn retries_until_success_and_reports_each_attempt() {
        let cancel = AtomicBool::new(false);
        let mut delays: Vec<u64> = Vec::new();
        let mut reports: Vec<RetryAttempt> = Vec::new();
        let mut calls = 0;
        let result = {
            let mut sleep = |ms: u64| delays.push(ms);
            let mut report = |attempt: RetryAttempt| reports.push(attempt);
            let mut ctx = RetryContext {
                cancel: &cancel,
                sleep: Some(&mut sleep),
                report: Some(&mut report),
            };
            with_retry(policy(), &mut ctx, || {
                calls += 1;
                if calls < 3 {
                    Err(net("超时"))
                } else {
                    Ok("已同步")
                }
            })
        };

        assert_eq!(result.unwrap(), "已同步");
        assert_eq!(calls, 3);
        assert_eq!(delays, vec![100, 200]);
        assert_eq!(
            reports,
            vec![
                RetryAttempt { retry: 1, max_retries: 3, delay_ms: 100 },
                RetryAttempt { retry: 2, max_retries: 3, delay_ms: 200 },
            ]
        );
    }

    #[test]
    fn gives_up_after_max_retries_with_last_error() {
        let cancel = AtomicBool::new(false);
        let mut calls = 0;
        let result = {
            let mut ctx = RetryContext { cancel: &cancel, sleep: None, report: None };
            with_retry(policy(), &mut ctx, || -> Result<(), AppError> {
                calls += 1;
                Err(net("仍然超时"))
            })
        };

        assert_eq!(calls, 4, "首次 + 3 次重试");
        assert!(matches!(result, Err(AppError::SyncNetwork(message)) if message == "仍然超时"));
    }

    #[test]
    fn non_retryable_error_fails_fast() {
        let cancel = AtomicBool::new(false);
        let mut calls = 0;
        let result = {
            let mut ctx = RetryContext { cancel: &cancel, sleep: None, report: None };
            with_retry(policy(), &mut ctx, || -> Result<(), AppError> {
                calls += 1;
                Err(AppError::SyncAuth("401".into()))
            })
        };

        assert_eq!(calls, 1, "凭证失效不重试");
        assert!(matches!(result, Err(AppError::SyncAuth(_))));
    }

    #[test]
    fn cancel_during_wait_stops_further_attempts() {
        let cancel = AtomicBool::new(false);
        let mut calls = 0;
        let mut delays: Vec<u64> = Vec::new();
        let result = {
            let mut sleep = |ms: u64| {
                delays.push(ms);
                cancel.store(true, Ordering::SeqCst);
            };
            let mut ctx = RetryContext {
                cancel: &cancel,
                sleep: Some(&mut sleep),
                report: None,
            };
            with_retry(policy(), &mut ctx, || -> Result<(), AppError> {
                calls += 1;
                Err(net("超时"))
            })
        };

        assert_eq!(calls, 1, "取消后不再发起新的尝试");
        assert_eq!(delays, vec![100]);
        assert!(matches!(result, Err(AppError::SyncNetwork(_))));
    }
}
