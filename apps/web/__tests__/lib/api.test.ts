import axios from "axios";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("api interceptor", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("adds Authorization header when token is present", () => {
    localStorageMock.setItem("decome_token", "test-jwt-token");
    // Re-import api to trigger interceptor setup with mocked localStorage
    jest.resetModules();
    const { default: api } = require("@/lib/api");
    const config = api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers.Authorization).toBe("Bearer test-jwt-token");
  });

  it("does not add Authorization header when no token", () => {
    jest.resetModules();
    const { default: api } = require("@/lib/api");
    const config = api.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});
