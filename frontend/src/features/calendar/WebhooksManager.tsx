/**
 * WebhooksManager — Calendar Webhooks & API Keys management UI.
 *
 * Two tabs:
 *  - Webhooks  — create/list/test/delete calendar event webhooks
 *  - API Keys  — generate/list/revoke calendar API keys
 */
import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
  /** Only present in the creation response */
  secret?: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Only present in the creation response */
  raw_key?: string;
}

interface TestResult {
  success: boolean;
  status_code: number | null;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEBHOOK_EVENTS = [
  "event.created",
  "event.updated",
  "event.deleted",
  "booking.created",
  "booking.cancelled",
  "focus.blocked",
];

const API_SCOPES = [
  "calendar:read",
  "calendar:write",
  "bookings:read",
  "bookings:write",
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const api = axios.create({ baseURL: "/api/v1" });

const webhookKeys = {
  all: ["calendar-webhooks"] as const,
  apiKeys: ["calendar-api-keys"] as const,
};

async function fetchWebhooks(): Promise<Webhook[]> {
  const { data } = await api.get("/calendar/webhooks");
  return data;
}

async function fetchApiKeys(): Promise<ApiKey[]> {
  const { data } = await api.get("/calendar/api-keys");
  return data;
}

async function createWebhook(payload: {
  name: string;
  url: string;
  events: string[];
}): Promise<Webhook> {
  const { data } = await api.post("/calendar/webhooks", payload);
  return data;
}

async function deleteWebhook(id: string): Promise<void> {
  await api.delete(`/calendar/webhooks/${id}`);
}

async function toggleWebhook(id: string, is_active: boolean): Promise<Webhook> {
  const { data } = await api.put(`/calendar/webhooks/${id}`, { is_active });
  return data;
}

async function testWebhook(id: string): Promise<TestResult> {
  const { data } = await api.post(`/calendar/webhooks/${id}/test`);
  return data;
}

async function createApiKey(payload: {
  name: string;
  scopes: string[];
  expires_in_days?: number;
}): Promise<ApiKey> {
  const { data } = await api.post("/calendar/api-keys", payload);
  return data;
}

async function revokeApiKey(id: string): Promise<void> {
  await api.delete(`/calendar/api-keys/${id}`);
}

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`cursor-pointer rounded-lg px-4 py-3 text-sm text-white shadow-lg transition-all ${
            t.type === "success"
              ? "bg-green-600"
              : t.type === "error"
              ? "bg-red-600"
              : "bg-blue-600"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const show = (message: string, type: ToastType = "info") => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, show, dismiss };
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "danger" | "warning" }) {
  const cls = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-800",
    danger: "bg-red-100 text-red-800",
    warning: "bg-yellow-100 text-yellow-800",
  }[variant];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function CopyBox({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-2">
      {label && <p className="mb-1 text-sm font-medium text-gray-700">{label}</p>}
      <div className="flex items-center gap-2 rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2">
        <code className="flex-1 break-all text-xs text-gray-800">{value}</code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webhook form
// ---------------------------------------------------------------------------

function WebhookForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (wh: Webhook) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: (data) => onSuccess(data),
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to create webhook.";
      setError(msg);
    },
  });

  const toggleEvent = (ev: string) => {
    setEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !url.trim()) {
      setError("Name and URL are required.");
      return;
    }
    mutation.mutate({ name: name.trim(), url: url.trim(), events });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
        <input
          className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]"
          placeholder="My webhook"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">URL</label>
        <input
          type="url"
          className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]"
          placeholder="https://example.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Events</label>
        <div className="grid grid-cols-2 gap-2">
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[#51459d]"
                checked={events.includes(ev)}
                onChange={() => toggleEvent(ev)}
              />
              <code className="text-xs">{ev}</code>
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        A signing secret will be auto-generated and shown once after creation.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[10px] border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-[10px] bg-[#51459d] px-4 py-2 text-sm font-medium text-white hover:bg-[#44388a] disabled:opacity-60"
        >
          {mutation.isPending ? "Creating..." : "Create Webhook"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Webhooks tab
// ---------------------------------------------------------------------------

function WebhooksTab() {
  const qc = useQueryClient();
  const { toasts, show, dismiss } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newSecret, setNewSecret] = useState<{ name: string; secret: string } | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: webhookKeys.all,
    queryFn: fetchWebhooks,
  });

  const deleteMut = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: webhookKeys.all });
      show("Webhook deleted.", "success");
    },
    onError: () => show("Failed to delete webhook.", "error"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      toggleWebhook(id, is_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: webhookKeys.all });
    },
    onError: () => show("Failed to update webhook.", "error"),
  });

  const testMut = useMutation({
    mutationFn: testWebhook,
    onSuccess: (result) => {
      if (result.success) {
        show(`Test succeeded (${result.status_code}).`, "success");
      } else {
        show(`Test failed: ${result.message}`, "error");
      }
    },
    onError: () => show("Test request failed.", "error"),
  });

  const handleCreated = (wh: Webhook) => {
    qc.invalidateQueries({ queryKey: webhookKeys.all });
    setShowForm(false);
    if (wh.secret) {
      setNewSecret({ name: wh.name, secret: wh.secret });
    }
    show("Webhook created.", "success");
  };

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-gray-500">Loading webhooks…</div>;
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Secret reveal banner */}
      {newSecret && (
        <div className="rounded-[10px] border border-yellow-300 bg-yellow-50 p-4">
          <p className="mb-1 text-sm font-semibold text-yellow-800">
            Secret for "{newSecret.name}" — copy it now, it will not be shown again.
          </p>
          <CopyBox value={newSecret.secret} />
          <button
            className="mt-2 text-xs text-yellow-700 underline"
            onClick={() => setNewSecret(null)}
          >
            I've saved it, dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Webhooks</h3>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-[10px] bg-[#51459d] px-4 py-2 text-sm font-medium text-white hover:bg-[#44388a]"
        >
          + Add Webhook
        </button>
      </div>

      {showForm && (
        <div className="rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-gray-700">New Webhook</h4>
          <WebhookForm
            onSuccess={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
          No webhooks yet. Click "+ Add Webhook" to subscribe to calendar events.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-[10px] border border-gray-200 bg-white">
          {webhooks.map((wh) => (
            <div key={wh.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{wh.name}</span>
                  <Badge variant={wh.is_active ? "success" : "danger"}>
                    {wh.is_active ? "active" : "inactive"}
                  </Badge>
                  {wh.failure_count > 0 && (
                    <Badge variant="warning">{wh.failure_count} failures</Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500" title={wh.url}>
                  {wh.url}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(wh.events || []).map((ev) => (
                    <code key={ev} className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-600">
                      {ev}
                    </code>
                  ))}
                </div>
                {wh.last_triggered_at && (
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    Last triggered: {new Date(wh.last_triggered_at).toLocaleString()}
                    {wh.last_status_code ? ` (${wh.last_status_code})` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() =>
                    toggleMut.mutate({ id: wh.id, is_active: !wh.is_active })
                  }
                  className="rounded-[10px] border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  {wh.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => testMut.mutate(wh.id)}
                  disabled={testMut.isPending}
                  className="rounded-[10px] border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  Test
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete webhook "${wh.name}"?`)) {
                      deleteMut.mutate(wh.id);
                    }
                  }}
                  className="rounded-[10px] border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Key form
// ---------------------------------------------------------------------------

function ApiKeyForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (key: ApiKey) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => onSuccess(data),
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to create API key.";
      setError(msg);
    },
  });

  const toggleScope = (sc: string) => {
    setScopes((prev) =>
      prev.includes(sc) ? prev.filter((s) => s !== sc) : [...prev, sc]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const payload: { name: string; scopes: string[]; expires_in_days?: number } = {
      name: name.trim(),
      scopes,
    };
    const days = parseInt(expiryDays, 10);
    if (!isNaN(days) && days > 0) {
      payload.expires_in_days = days;
    }
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
        <input
          className="w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]"
          placeholder="My integration"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Scopes</label>
        <div className="grid grid-cols-2 gap-2">
          {API_SCOPES.map((sc) => (
            <label key={sc} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[#51459d]"
                checked={scopes.includes(sc)}
                onChange={() => toggleScope(sc)}
              />
              <code className="text-xs">{sc}</code>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Expires in (days) — optional
        </label>
        <input
          type="number"
          min={1}
          className="w-40 rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]"
          placeholder="Never"
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[10px] border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-[10px] bg-[#51459d] px-4 py-2 text-sm font-medium text-white hover:bg-[#44388a] disabled:opacity-60"
        >
          {mutation.isPending ? "Generating..." : "Generate Key"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// API Keys tab
// ---------------------------------------------------------------------------

function ApiKeysTab() {
  const qc = useQueryClient();
  const { toasts, show, dismiss } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{
    name: string;
    raw_key: string;
  } | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: webhookKeys.apiKeys,
    queryFn: fetchApiKeys,
  });

  const revokeMut = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: webhookKeys.apiKeys });
      show("API key revoked.", "success");
    },
    onError: () => show("Failed to revoke API key.", "error"),
  });

  const handleCreated = (key: ApiKey) => {
    qc.invalidateQueries({ queryKey: webhookKeys.apiKeys });
    setShowForm(false);
    if (key.raw_key) {
      setRevealedKey({ name: key.name, raw_key: key.raw_key });
    }
    show("API key generated.", "success");
  };

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-gray-500">Loading API keys…</div>;
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Raw key reveal banner */}
      {revealedKey && (
        <div className="rounded-[10px] border border-yellow-300 bg-yellow-50 p-4">
          <p className="mb-1 text-sm font-semibold text-yellow-800">
            API key for "{revealedKey.name}" — this is shown only once. Copy it now.
          </p>
          <CopyBox value={revealedKey.raw_key} label="Your API key" />
          <button
            className="mt-2 text-xs text-yellow-700 underline"
            onClick={() => setRevealedKey(null)}
          >
            I've saved it, dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">API Keys</h3>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-[10px] bg-[#51459d] px-4 py-2 text-sm font-medium text-white hover:bg-[#44388a]"
        >
          + Generate Key
        </button>
      </div>

      {showForm && (
        <div className="rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-gray-700">New API Key</h4>
          <ApiKeyForm
            onSuccess={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {apiKeys.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
          No API keys yet. Click "+ Generate Key" to create one.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-[10px] border border-gray-200 bg-white">
          {apiKeys.map((key) => {
            const isExpired =
              key.expires_at !== null &&
              new Date(key.expires_at) < new Date();

            return (
              <div key={key.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{key.name}</span>
                    <Badge variant={key.is_active && !isExpired ? "success" : "danger"}>
                      {isExpired ? "expired" : key.is_active ? "active" : "revoked"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                      {key.key_prefix}…
                    </code>
                    <span className="text-xs text-gray-400">
                      (prefix only — full key not stored)
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(key.scopes || []).map((sc) => (
                      <code
                        key={sc}
                        className="rounded bg-purple-50 px-1 py-0.5 text-[10px] text-purple-700"
                      >
                        {sc}
                      </code>
                    ))}
                  </div>
                  <div className="mt-0.5 flex gap-4 text-[11px] text-gray-400">
                    <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                    {key.last_used_at && (
                      <span>
                        Last used: {new Date(key.last_used_at).toLocaleString()}
                      </span>
                    )}
                    {key.expires_at && (
                      <span>
                        Expires: {new Date(key.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Revoke API key "${key.name}"?`)) {
                      revokeMut.mutate(key.id);
                    }
                  }}
                  className="shrink-0 rounded-[10px] border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Revoke
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

type Tab = "webhooks" | "api-keys";

export default function WebhooksManager() {
  const [activeTab, setActiveTab] = useState<Tab>("webhooks");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Calendar Integrations
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Set up webhook subscriptions to receive real-time calendar events, or
          generate API keys for programmatic access.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-gray-200">
        {(
          [
            { id: "webhooks", label: "Webhooks" },
            { id: "api-keys", label: "API Keys" },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`mr-6 pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-[#51459d] text-[#51459d]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "webhooks" ? <WebhooksTab /> : <ApiKeysTab />}
    </div>
  );
}
