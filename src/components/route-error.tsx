/**
 * Route-level error boundaries. TanStack Router renders these when a route
 * component throws during render. We show a safe, generic message to users
 * (never the raw stack/query/params) and report the real error through the
 * observability layer. A reset lets the user retry without a full reload.
 */
import { useEffect } from "react";
import { monitor } from "@/lib/observability/monitor";

type RouteErrorProps = {
  error: unknown;
  reset: () => void;
};

export function RouteErrorComponent({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    monitor.captureException(error, { scope: "route-render" });
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <h1 className="text-2xl font-semibold text-fg">页面出了点问题</h1>
      <p className="max-w-md text-sm text-muted">
        这一屏加载失败了。你可以重试，或刷新页面回到互动图解。
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          重试
        </button>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-fg"
        >
          返回首页
        </button>
      </div>
    </main>
  );
}

export function RouteNotFoundComponent() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-fg">找不到这个页面</h1>
      <p className="max-w-md text-sm text-muted">
        链接可能已失效。回到首页继续查看出口补贴的互动图解。
      </p>
      <button
        type="button"
        onClick={() => window.location.assign("/")}
        className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        返回首页
      </button>
    </main>
  );
}
