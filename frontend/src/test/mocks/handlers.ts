import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000/api/v1";

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      token_type: "bearer",
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "admin@test.com",
        full_name: "Test Admin",
        is_superadmin: true,
        is_active: true,
      },
    })
  ),
  http.post(`${BASE}/auth/logout`, () => HttpResponse.json({ detail: "Logged out" })),
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({
      id: "00000000-0000-0000-0000-000000000001",
      email: "admin@test.com",
      full_name: "Test Admin",
      is_superadmin: true,
      is_active: true,
    })
  ),

  // Finance — invoices
  http.get(`${BASE}/finance/invoices`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, per_page: 20 })
  ),
  http.post(`${BASE}/finance/invoices`, () =>
    HttpResponse.json({ id: "inv-001", status: "draft", total: 0 }, { status: 201 })
  ),

  // HR — employees
  http.get(`${BASE}/hr/employees`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, per_page: 20 })
  ),

  // Projects
  http.get(`${BASE}/projects`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, per_page: 20 })
  ),

  // CRM — contacts
  http.get(`${BASE}/crm/contacts`, () =>
    HttpResponse.json({ items: [], total: 0, page: 1, per_page: 20 })
  ),
];
