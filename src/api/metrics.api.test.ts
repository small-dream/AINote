import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./client", () => ({ call: client.call }));

import { metricsApi, recordMetric } from "./metrics.api";

beforeEach(() => {
  client.call.mockReset();
});

describe("metricsApi", () => {
  it("读取快照走 metrics_read", async () => {
    client.call.mockResolvedValue({ totals: [] });
    await metricsApi.read();
    expect(client.call).toHaveBeenCalledWith("metrics_read");
  });

  it("记录与清空分别走 metrics_record / metrics_clear", async () => {
    client.call.mockResolvedValue(undefined);
    await metricsApi.record("note_created");
    expect(client.call).toHaveBeenCalledWith("metrics_record", { event: "note_created" });
    await metricsApi.clear();
    expect(client.call).toHaveBeenCalledWith("metrics_clear");
  });

  it("recordMetric 失败时静默，不影响调用方", async () => {
    client.call.mockRejectedValue(new Error("io failed"));
    expect(() => recordMetric("sync_failed")).not.toThrow();
    await Promise.resolve();
    expect(client.call).toHaveBeenCalledWith("metrics_record", { event: "sync_failed" });
  });
});
