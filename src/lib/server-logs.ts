import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { logs, SeverityNumber, type Logger } from "@opentelemetry/api-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { APIContext, MiddlewareHandler } from "astro";

let initialized = false;
let logger: Logger | undefined;

function getLogger(): Logger | undefined {
    if (initialized) return logger;
    initialized = true;
    const token = process.env.POSTHOG_LOGS_TOKEN;
    if (!token) {
        console.warn("PostHog Logs désactivé : POSTHOG_LOGS_TOKEN absent.");
        return;
    }
    if (!/^phc_[A-Za-z0-9_-]+$/.test(token)) {
        console.error("PostHog Logs désactivé : POSTHOG_LOGS_TOKEN doit être un jeton de projet phc_.");
        return;
    }
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
    const sdk = new NodeSDK({
        resource: resourceFromAttributes({ "service.name": "central-portal" }),
        instrumentations: [],
        spanProcessors: [],
        metricReaders: [],
        autoDetectResources: false,
        logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({
            url: "https://eu.i.posthog.com/i/v1/logs",
            headers: { Authorization: `Bearer ${token}` },
            timeoutMillis: 5000
        }), scheduledDelayMillis: 1000, exportTimeoutMillis: 5000, maxQueueSize: 2048 })]
    });
    try {
        sdk.start();
        logger = logs.getLogger("http-server");
        logger.emit({ severityNumber: SeverityNumber.INFO, severityText: "INFO", body: "Server logging initialized" });
    } catch (cause) {
        console.error("Initialisation PostHog Logs impossible :", cause);
        return;
    }
    let shutdown: Promise<void> | undefined;
    const flush = () => shutdown ??= sdk.shutdown().catch(cause => {
        console.error("Arrêt PostHog Logs impossible :", cause);
    });
    process.once("beforeExit", () => { void flush(); });
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
        process.once(signal, () => {
            void flush().finally(() => { process.kill(process.pid, signal); });
        });
    }
    return logger;
}

export function emitRequestLog(
    target: Pick<Logger, "emit">,
    method: string,
    routePattern: string,
    status: number,
    duration: number,
    failed = false
) {
    const severity = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
    target.emit({
        severityText: severity,
        severityNumber: severity === "ERROR" ? SeverityNumber.ERROR : severity === "WARN" ? SeverityNumber.WARN : SeverityNumber.INFO,
        body: failed ? "HTTP request failed" : "HTTP request completed",
        attributes: {
            "http.request.method": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(method) ? method : "OTHER",
            "http.route": routePattern || "unmatched",
            "http.response.status_code": status,
            "http.server.duration_ms": Math.max(0, Math.round(duration))
        }
    });
}

export async function logRequest(
    target: Pick<Logger, "emit">,
    context: Pick<APIContext, "request" | "routePattern">,
    next: () => Promise<Response>
): Promise<Response> {
    const start = performance.now();
    try {
        const response = await next();
        emitRequestLog(target, context.request.method, context.routePattern, response.status, performance.now() - start);
        return response;
    } catch (cause) {
        emitRequestLog(target, context.request.method, context.routePattern, 500, performance.now() - start, true);
        throw cause;
    }
}

export const serverLogsMiddleware: MiddlewareHandler = async (context, next) => {
    const target = getLogger();
    return target ? logRequest(target, context, next) : next();
};
