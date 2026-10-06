/**
 * Conditional observability bootstrap.
 *
 * Nothing here imports a heavy SDK at module load. Real error/APM reporting is
 * initialized only when the corresponding env var is present, so self-hosters
 * pay nothing and the default bundle is unchanged. Swap the no-op bodies for
 * @sentry/react or @opentelemetry/sdk-trace-web calls when wiring a provider.
 */

interface Monitor {
  captureException: (err: unknown, context?: Record<string, unknown>) => void;
  captureMessage: (msg: string, level?: "info" | "warning" | "error") => void;
  readonly enabled: boolean;
  readonly provider: "none" | "sentry" | "otel";
}

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const OTEL_ENDPOINT = import.meta.env.VITE_OTEL_ENDPOINT as string | undefined;

function createMonitor(): Monitor {
  if (SENTRY_DSN) {
    // Integration point: Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1 })
    return {
      provider: "sentry",
      enabled: true,
      captureException: (err, context) => {
        // Sentry.captureException(err, { extra: context })
        console.error("[monitor:sentry]", err, context ?? "");
      },
      captureMessage: (msg, level) => {
        console[level === "error" ? "error" : "log"]("[monitor:sentry]", msg);
      },
    };
  }
  if (OTEL_ENDPOINT) {
    // Integration point: OTel WebTracerProvider + OTLPLogExporter(OTEL_ENDPOINT)
    return {
      provider: "otel",
      enabled: true,
      captureException: (err) => console.error("[monitor:otel]", err),
      captureMessage: (msg) => console.log("[monitor:otel]", msg),
    };
  }
  return {
    provider: "none",
    enabled: false,
    captureException: (err) => console.error(err),
    captureMessage: (msg) => console.warn(msg),
  };
}

export const monitor: Monitor = createMonitor();

/** Global safety net: report uncaught errors and unhandled promise rejections. */
export function registerGlobalErrorHandler(): (() => void) | undefined {
  if (typeof window === "undefined") return undefined;
  const onError = (e: ErrorEvent) => monitor.captureException(e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent) => monitor.captureException(e.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
