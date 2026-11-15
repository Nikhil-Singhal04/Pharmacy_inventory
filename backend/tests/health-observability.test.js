import request from "supertest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db.js";

const app = createApp();

describe("Phase 3 — Health, Readiness & Observability Tests", () => {
  afterAll(async () => {
    await pool.end();
  });

  describe("Liveness Probe (/health)", () => {
    it("should return 200 OK with uptime and timestamp without checking DB", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(typeof res.body.uptime).toBe("number");
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe("Readiness Probe (/ready)", () => {
    it("should return 200 OK with database: connected when DB is available", async () => {
      const res = await request(app).get("/ready");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ready");
      expect(res.body.database).toBe("connected");
    });
  });

  describe("Prometheus Metrics (/metrics)", () => {
    it("should return 200 with Prometheus text format metrics", async () => {
      const res = await request(app).get("/metrics");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("pharmacy_http_request_duration_seconds");
      expect(res.text).toContain("pharmacy_nodejs_version_info");
    });
  });
});
