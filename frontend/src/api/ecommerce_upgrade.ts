/**
 * E-Commerce Upgrade API client — B2B companies, loyalty programmes,
 * subscriptions, blog/content, bulk import, and AI-driven features.
 *
 * Exports plain Axios helper objects (no TanStack Query wrappers) for the
 * E-Commerce module's upgrade tier. Uses the global `/api/v1` base URL with
 * no shared auth interceptor — callers must supply tokens where required.
 * Backend prefix: `/api/v1/ecommerce`.
 *
 * Key exports:
 *   - b2bApi — B2B company registration, approval, members, and pricing tiers
 *   - loyaltyApi — loyalty programme rules, point earn/redeem
 *   - subscriptionApi — recurring subscription plan and billing management
 *   - blogApi — storefront blog post CRUD
 *   - importApi — bulk product/customer CSV import utilities
 *   - ecomAiApi — AI product description generation and recommendation engine
 */
import axios from 'axios';

const API = '/api/v1';

// ── B2B ───────────────────────────────────────────────────────────────────────

export const b2bApi = {
  listCompanies: (params?: { is_approved?: boolean; skip?: number; limit?: number }) =>
    axios.get(`${API}/ecommerce/b2b/companies`, { params }).then(r => r.data),

  getCompany: (id: string) =>
    axios.get(`${API}/ecommerce/b2b/companies/${id}`).then(r => r.data),

  registerCompany: (data: Record<string, unknown>) =>
    axios.post(`${API}/ecommerce/b2b/companies`, data).then(r => r.data),

  updateCompany: (id: string, data: Record<string, unknown>) =>
    axios.put(`${API}/ecommerce/b2b/companies/${id}`, data).then(r => r.data),

  approveCompany: (id: string, data: { is_approved: boolean; credit_limit?: number; payment_terms?: string }) =>
    axios.put(`${API}/ecommerce/b2b/companies/${id}/approve`, data).then(r => r.data),

  addMember: (companyId: string, data: { customer_id: string; role?: string }) =>
    axios.post(`${API}/ecommerce/b2b/companies/${companyId}/members`, data).then(r => r.data),

  listPricingTiers: (params?: { company_id?: string }) =>
    axios.get(`${API}/ecommerce/b2b/pricing-tiers`, { params }).then(r => r.data),

  createPricingTier: (data: Record<string, unknown>) =>
    axios.post(`${API}/ecommerce/b2b/pricing-tiers`, data).then(r => r.data),

  updatePricingTier: (id: string, data: Record<string, unknown>) =>
    axios.put(`${API}/ecommerce/b2b/pricing-tiers/${id}`, data).then(r => r.data),

  deletePricingTier: (id: string) =>
    axios.delete(`${API}/ecommerce/b2b/pricing-tiers/${id}`),

  listQuotes: (params?: { status?: string; company_id?: string; skip?: number; limit?: number }) =>
    axios.get(`${API}/ecommerce/b2b/quotes`, { params }).then(r => r.data),

  getQuote: (id: string) =>
    axios.get(`${API}/ecommerce/b2b/quotes/${id}`).then(r => r.data),

  createQuote: (data: Record<string, unknown>) =>
    axios.post(`${API}/ecommerce/b2b/quotes`, data).then(r => r.data),

  reviewQuote: (id: string, data: Record<string, unknown>) =>
    axios.put(`${API}/ecommerce/b2b/quotes/${id}/review`, data).then(r => r.data),

  convertQuote: (id: string) =>
    axios.post(`${API}/ecommerce/b2b/quotes/${id}/convert`).then(r => r.data),
};

// ── Loyalty ───────────────────────────────────────────────────────────────────

export const loyaltyApi = {
  getAccount: () =>
    axios.get(`${API}/ecommerce/loyalty/account`).then(r => r.data),

  getTiers: () =>
    axios.get(`${API}/ecommerce/loyalty/tiers`).then(r => r.data),

  getTransactions: (params?: { skip?: number; limit?: number }) =>
    axios.get(`${API}/ecommerce/loyalty/transactions`, { params }).then(r => r.data),

  redeemPoints: (data: { points: number; order_id?: string }) =>
    axios.post(`${API}/ecommerce/loyalty/redeem`, data).then(r => r.data),

  getReferralCode: () =>
    axios.get(`${API}/ecommerce/loyalty/referral-code`).then(r => r.data),

  getProgram: () =>
    axios.get(`${API}/ecommerce/loyalty/program`).then(r => r.data),

  updateProgram: (data: Record<string, unknown>) =>
    axios.put(`${API}/ecommerce/loyalty/program`, data).then(r => r.data),

  getLeaderboard: () =>
    axios.get(`${API}/ecommerce/loyalty/leaderboard`).then(r => r.data),

  adjustPoints: (data: { customer_id: string; points: number; note: string }) =>
    axios.post(`${API}/ecommerce/loyalty/adjust`, data).then(r => r.data),
};

// ── Subscriptions ─────────────────────────────────────────────────────────────

export const subscriptionsApi = {
  create: (data: { product_id: string; quantity: number; frequency_days: number; shipping_address_id?: string }) =>
    axios.post(`${API}/ecommerce/subscriptions`, data).then(r => r.data),

  list: () =>
    axios.get(`${API}/ecommerce/subscriptions`).then(r => r.data),

  listAdmin: (params?: { status?: string; skip?: number; limit?: number }) =>
    axios.get(`${API}/ecommerce/subscriptions/admin`, { params }).then(r => r.data),

  get: (id: string) =>
    axios.get(`${API}/ecommerce/subscriptions/${id}`).then(r => r.data),

  pause: (id: string) =>
    axios.put(`${API}/ecommerce/subscriptions/${id}/pause`).then(r => r.data),

  resume: (id: string) =>
    axios.put(`${API}/ecommerce/subscriptions/${id}/resume`).then(r => r.data),

  skip: (id: string) =>
    axios.put(`${API}/ecommerce/subscriptions/${id}/skip`).then(r => r.data),

  cancel: (id: string) =>
    axios.delete(`${API}/ecommerce/subscriptions/${id}`).then(r => r.data),
};

// ── Abandoned Carts ───────────────────────────────────────────────────────────

export const abandonedCartsApi = {
  list: (params?: { skip?: number; limit?: number }) =>
    axios.get(`${API}/ecommerce/abandoned-carts`, { params }).then(r => r.data),

  getConfig: () =>
    axios.get(`${API}/ecommerce/abandoned-carts/config`).then(r => r.data),

  updateConfig: (data: { abandonment_hours?: number; enable_discount?: boolean; discount_pct?: number }) =>
    axios.put(`${API}/ecommerce/abandoned-carts/config`, data).then(r => r.data),
};

// ── Blog ──────────────────────────────────────────────────────────────────────

export const blogApi = {
  list: (params?: { status?: string; skip?: number; limit?: number }) =>
    axios.get(`${API}/ecommerce/blog`, { params }).then(r => r.data),

  get: (id: string) =>
    axios.get(`${API}/ecommerce/blog/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    axios.post(`${API}/ecommerce/blog`, data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    axios.put(`${API}/ecommerce/blog/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    axios.delete(`${API}/ecommerce/blog/${id}`),

  publish: (id: string) =>
    axios.put(`${API}/ecommerce/blog/${id}/publish`).then(r => r.data),

  unpublish: (id: string) =>
    axios.put(`${API}/ecommerce/blog/${id}/unpublish`).then(r => r.data),

  // Public storefront
  listPublic: () =>
    axios.get(`${API}/storefront/blog`).then(r => r.data),

  getPublicBySlug: (slug: string) =>
    axios.get(`${API}/storefront/blog/${slug}`).then(r => r.data),
};

// ── Import ────────────────────────────────────────────────────────────────────

export const importApi = {
  upload: (file: File, platform: string, storeId: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('source_platform', platform);
    form.append('store_id', storeId);
    return axios.post(`${API}/ecommerce/import/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  start: (jobId: string, mappings?: Record<string, string>) =>
    axios.post(`${API}/ecommerce/import/jobs/${jobId}/start`, { mappings }).then(r => r.data),

  listJobs: () =>
    axios.get(`${API}/ecommerce/import/jobs`).then(r => r.data),

  getJob: (id: string) =>
    axios.get(`${API}/ecommerce/import/jobs/${id}`).then(r => r.data),
};

// ── Bundles ───────────────────────────────────────────────────────────────────

export const bundlesApi = {
  list: () =>
    axios.get(`${API}/ecommerce/bundles`).then(r => r.data),

  get: (id: string) =>
    axios.get(`${API}/ecommerce/bundles/${id}`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    axios.post(`${API}/ecommerce/bundles`, data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    axios.put(`${API}/ecommerce/bundles/${id}`, data).then(r => r.data),

  delete: (id: string) =>
    axios.delete(`${API}/ecommerce/bundles/${id}`),
};

// ── Flash Sales ───────────────────────────────────────────────────────────────

export const flashSalesApi = {
  list: () =>
    axios.get(`${API}/ecommerce/flash-sales`).then(r => r.data),

  create: (data: Record<string, unknown>) =>
    axios.post(`${API}/ecommerce/flash-sales`, data).then(r => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    axios.put(`${API}/ecommerce/flash-sales/${id}`, data).then(r => r.data),
};

// ── Currencies ────────────────────────────────────────────────────────────────

export const currenciesApi = {
  list: () =>
    axios.get(`${API}/ecommerce/currencies`).then(r => r.data),

  create: (data: { code: string; name: string; symbol: string; exchange_rate_to_base: number }) =>
    axios.post(`${API}/ecommerce/currencies`, data).then(r => r.data),

  update: (code: string, data: { exchange_rate_to_base?: number; is_active?: boolean }) =>
    axios.put(`${API}/ecommerce/currencies/${code}`, data).then(r => r.data),
};

// ── AI Features ───────────────────────────────────────────────────────────────

export const ecomAiApi = {
  getRecommendations: () =>
    axios.get(`${API}/ecommerce/recommendations`).then(r => r.data),

  generateDescription: (productId: string, attributes?: Record<string, unknown>) =>
    axios.post(`${API}/ecommerce/products/${productId}/generate-description`, { attributes }).then(r => r.data),

  getPriceSuggestion: (productId: string) =>
    axios.get(`${API}/ecommerce/products/${productId}/price-suggestion`).then(r => r.data),

  getHealthScore: () =>
    axios.get(`${API}/ecommerce/health-score`).then(r => r.data),

  getAdvancedAnalytics: () =>
    axios.get(`${API}/ecommerce/analytics/health-score`).then(r => r.data),

  getRFMSegments: () =>
    axios.get(`${API}/ecommerce/analytics/rfm-segments`).then(r => r.data),

  getDemandForecast: () =>
    axios.get(`${API}/ecommerce/analytics/demand-forecast`).then(r => r.data),

  getCohorts: () =>
    axios.get(`${API}/ecommerce/analytics/cohorts`).then(r => r.data),

  getAiInsights: () =>
    axios.get(`${API}/ecommerce/analytics/ai-insights`).then(r => r.data),
};
