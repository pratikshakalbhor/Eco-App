import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("API_URL configuration", () => {
  it("uses VITE_API_URL when it is set", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    const { API_URL } = await import("../config.js");
    expect(API_URL).toBe("https://api.example.com");
  });

  it("falls back to localhost in development", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubEnv("PROD", false);
    vi.resetModules();
    const { API_URL } = await import("../config.js");
    expect(API_URL).toBe("http://localhost:8080");
  });

  it("fails loudly in a production build without VITE_API_URL", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubEnv("PROD", true);
    vi.resetModules();
    await expect(import("../config.js")).rejects.toThrow(/VITE_API_URL is not set/);
  });
});
