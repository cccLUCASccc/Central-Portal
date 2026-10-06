import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { LogRecord } from "@opentelemetry/api-logs";
import { emitRequestLog, logRequest } from "./server-logs";

test("request logs contain only method, route template, status and duration with correct severity", () => {
    const records: LogRecord[] = [];
    const target = { emit: (record: LogRecord) => { records.push(record); } };
    for (const status of [200, 302, 404, 503]) {
        emitRequestLog(target, "GET", "/boutique/[id]", status, 12.7, status === 503);
    }
    assert.deepEqual(records.map(record => record.severityText), ["INFO", "INFO", "WARN", "ERROR"]);
    assert.deepEqual(records[0].attributes, {
        "http.request.method": "GET", "http.route": "/boutique/[id]",
        "http.response.status_code": 200, "http.server.duration_ms": 13
    });
    assert.equal(records[3].body, "HTTP request failed");
    emitRequestLog(target, "private@example.com", "", 404, -1);
    assert.equal(records[4].attributes?.["http.request.method"], "OTHER");
    assert.equal(records[4].attributes?.["http.route"], "unmatched");
    assert.equal(records[4].attributes?.["http.server.duration_ms"], 0);
    assert.equal(JSON.stringify(records).includes("private@example.com"), false);
});

test("exports an OTLP HTTP log to a local collector with authorization and service resource", async () => {
    let payload = "";
    let authorization: string | undefined;
    const collector = createServer(async (request, response) => {
        authorization = request.headers.authorization;
        for await (const chunk of request) payload += chunk.toString();
        response.setHeader("Content-Type", "application/json");
        response.end("{}");
    });

    collector.listen(0, "127.0.0.1");
    await once(collector, "listening");
    const address = collector.address();
    assert.ok(address && typeof address !== "string");
    const provider = new LoggerProvider({
        resource: resourceFromAttributes({ "service.name": "test-service" }),
        processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({
            url: `http://127.0.0.1:${address.port}/i/v1/logs`,
            headers: { Authorization: "Bearer phc_test" }
        }) })]
    });
    try {
        emitRequestLog(provider.getLogger("http-server"), "GET", "/posthog", 200, 4);
        await provider.forceFlush();
        assert.equal(authorization, "Bearer phc_test");
        const data = JSON.parse(payload);
        assert.equal(data.resourceLogs[0].resource.attributes.find((attribute: { key: string }) => attribute.key === "service.name").value.stringValue, "test-service");
        assert.equal(data.resourceLogs[0].scopeLogs[0].logRecords[0].body.stringValue, "HTTP request completed");
    } finally {
        await provider.shutdown();
        collector.close();
        await once(collector, "close");
    }
});

test("preserves redirects and thrown errors while keeping request secrets out of logs", async () => {
    const records: LogRecord[] = [];
    const target = { emit: (record: LogRecord) => { records.push(record); } };
    const context = {
        request: new Request("https://example.com/users?email=private@example.com", {
            headers: { Cookie: "session=secret", Authorization: "Bearer secret" }
        }),
        routePattern: "/users"
    };
    const redirect = new Response(null, { status: 302, headers: { Location: "/sign-in" } });
    assert.equal(await logRequest(target, context, async () => redirect), redirect);
    const failure = new Error("private@example.com secret");
    await assert.rejects(logRequest(target, context, async () => { throw failure; }), cause => cause === failure);
    assert.equal(records[1].attributes?.["http.response.status_code"], 500);
    assert.equal(records[1].severityText, "ERROR");
    assert.equal(JSON.stringify(records).includes("secret"), false);
    assert.equal(JSON.stringify(records).includes("private@example.com"), false);
});
