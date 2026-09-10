import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportFrontendError } from "../error-report";
import { ErrorFallback } from "./ErrorFallback";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** 渲染期错误边界：捕获子树崩溃，展示可恢复界面并写入本地日志。 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportFrontendError(error, "react-render", info.componentStack ?? "");
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
