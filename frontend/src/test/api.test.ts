/**
 * API client smoke tests — verifies MSW mock server is wired correctly
 * and that API response shapes match what the frontend expects.
 */
import { describe, it, expect } from "vitest";
import axios from "axios";

const client = axios.create({ baseURL: "http://localhost:8000/api/v1" });

describe("Auth API", () => {
  it("POST /auth/login returns tokens and user", async () => {
    const res = await client.post("/auth/login", {
      username: "admin@test.com",
      password: "password",
    });
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("access_token");
    expect(res.data).toHaveProperty("user");
    expect(res.data.user).toHaveProperty("email");
  });
});

describe("Finance API", () => {
  it("GET /finance/invoices returns paginated list", async () => {
    const res = await client.get("/finance/invoices");
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("items");
    expect(Array.isArray(res.data.items)).toBe(true);
    expect(res.data).toHaveProperty("total");
  });
});

describe("HR API", () => {
  it("GET /hr/employees returns paginated list", async () => {
    const res = await client.get("/hr/employees");
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("items");
    expect(Array.isArray(res.data.items)).toBe(true);
  });
});

describe("Projects API", () => {
  it("GET /projects returns paginated list", async () => {
    const res = await client.get("/projects");
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("items");
  });
});

describe("CRM API", () => {
  it("GET /crm/contacts returns paginated list", async () => {
    const res = await client.get("/crm/contacts");
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("items");
  });
});
