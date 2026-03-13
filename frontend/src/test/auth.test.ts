import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../store/auth";

describe("Auth store", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it("starts unauthenticated", () => {
    const { isAuthenticated, user, token } = useAuthStore.getState();
    expect(isAuthenticated).toBe(false);
    expect(user).toBeNull();
    expect(token).toBeNull();
  });

  it("setAuth updates state correctly", () => {
    const mockUser = {
      id: "test-id",
      email: "admin@test.com",
      full_name: "Test Admin",
      is_superadmin: true,
      is_active: true,
    };
    useAuthStore.getState().setAuth(mockUser as any, "test-token", "test-refresh");

    const { isAuthenticated, user, token, refreshToken } = useAuthStore.getState();
    expect(isAuthenticated).toBe(true);
    expect(user?.email).toBe("admin@test.com");
    expect(token).toBe("test-token");
    expect(refreshToken).toBe("test-refresh");
  });

  it("logout clears all state", () => {
    const mockUser = { id: "1", email: "x@x.com", full_name: "X", is_superadmin: false, is_active: true };
    useAuthStore.getState().setAuth(mockUser as any, "token123");
    useAuthStore.getState().logout();

    const { isAuthenticated, user, token } = useAuthStore.getState();
    expect(isAuthenticated).toBe(false);
    expect(user).toBeNull();
    expect(token).toBeNull();
  });
});
