import { describe, expect, it } from "vitest";
import { authorizeTestLogin, DEFAULT_TEST_EMAIL, isTestLoginEnabled } from "@/lib/testLogin";

const SECRET = "a-long-enough-preview-secret-123";
const preview = { VERCEL_ENV: "preview", TEST_LOGIN_SECRET: SECRET };

describe("isTestLoginEnabled", () => {
  it("is on for Vercel previews with a long secret", () => {
    expect(isTestLoginEnabled(preview)).toBe(true);
  });
  it("is on for next dev with a secret", () => {
    expect(isTestLoginEnabled({ NODE_ENV: "development", TEST_LOGIN_SECRET: SECRET })).toBe(true);
  });
  it("is never on in production, even with a secret", () => {
    expect(isTestLoginEnabled({ VERCEL_ENV: "production", TEST_LOGIN_SECRET: SECRET })).toBe(false);
    expect(isTestLoginEnabled({ VERCEL_ENV: "production", NODE_ENV: "development", TEST_LOGIN_SECRET: SECRET })).toBe(false);
    expect(isTestLoginEnabled({ NODE_ENV: "production", TEST_LOGIN_SECRET: SECRET })).toBe(false);
  });
  it("is off without a secret or with a short one", () => {
    expect(isTestLoginEnabled({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isTestLoginEnabled({ VERCEL_ENV: "preview", TEST_LOGIN_SECRET: "short" })).toBe(false);
  });
});

describe("authorizeTestLogin", () => {
  it("returns the test user for the right secret", () => {
    expect(authorizeTestLogin(SECRET, preview)?.email).toBe(DEFAULT_TEST_EMAIL);
  });
  it("uses TEST_LOGIN_EMAIL when set", () => {
    expect(authorizeTestLogin(SECRET, { ...preview, TEST_LOGIN_EMAIL: "Tester@Gmail.com" })?.email).toBe("tester@gmail.com");
  });
  it("rejects a wrong, missing or non-string secret", () => {
    expect(authorizeTestLogin("wrong", preview)).toBeNull();
    expect(authorizeTestLogin(SECRET + "x", preview)).toBeNull();
    expect(authorizeTestLogin(undefined, preview)).toBeNull();
    expect(authorizeTestLogin(["x"], preview)).toBeNull();
  });
  it("rejects in production even with the right secret", () => {
    expect(authorizeTestLogin(SECRET, { ...preview, VERCEL_ENV: "production" })).toBeNull();
  });
  it("still applies ALLOWED_EMAIL_DOMAINS", () => {
    expect(authorizeTestLogin(SECRET, { ...preview, ALLOWED_EMAIL_DOMAINS: "gmail.com" })).toBeNull();
    expect(authorizeTestLogin(SECRET, { ...preview, ALLOWED_EMAIL_DOMAINS: "gmail.com", TEST_LOGIN_EMAIL: "t@gmail.com" })?.email).toBe("t@gmail.com");
  });
});
