import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const api = axios.create({ baseURL: "/api/v1" });

interface ComplianceEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  jurisdiction: string | null;
  due_date: string;
  status: string;
  recurrence: string | null;
  reminder_days: number[];
  assigned_to_id: string | null;
}

const CATEGORIES = [
  { value: "tax_filing", label: "Tax Filing" },
  { value: "regulatory", label: "Regulatory" },
  { value: "payroll", label: "Payroll" },
  { value: "annual_return", label: "Annual Return" },
  { value: "audit", label: "Audit" },
  { value: "other", label: "Other" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  in_progress: "bg-blue-100 text-blue-700",
};

function daysUntil(dateStr: string) {
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

const emptyForm = {
  title: "",
  description: "",
  category: "tax_filing",
  jurisdiction: "",
  due_date: "",
  recurrence: "",
  reminder_days: [30, 7, 1],
};

export default function ComplianceCalendarPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState({ ...emptyForm });

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ["compliance-events", filterStatus],
    queryFn: () =>
      api
        .get("/finance/compliance-events", {
          params: filterStatus ? { status: filterStatus } : {},
        })
        .then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post("/finance/compliance-events", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-events"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/finance/compliance-events/${id}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance-events"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/compliance-events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compliance-events"] }),
  });

  const events: ComplianceEvent[] = eventsData?.items || [];

  const pending = events.filter((e) => e.status === "pending");
  const overdue = events.filter((e) => daysUntil(e.due_date) < 0 && e.status === "pending");
  const dueSoon = events.filter((e) => {
    const d = daysUntil(e.due_date);
    return d >= 0 && d <= 30 && e.status === "pending";
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track tax filings, regulatory deadlines, and compliance events
          </p>
        </div>
        <Button className="bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowCreate(true)}>
          + New Event
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Overdue", value: overdue.length, color: "#ff3a6e" },
          { label: "Due within 30 days", value: dueSoon.length, color: "#ffa21d" },
          { label: "Total Pending", value: pending.length, color: "#51459d" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-[10px] border border-gray-200 p-4">
            <div className="text-2xl font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["", "pending", "completed", "in_progress"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterStatus === s
                ? "bg-[#51459d] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-[10px] border border-gray-200">
          <div className="text-4xl mb-3">📅</div>
          <p className="font-medium">No compliance events</p>
          <p className="text-sm mt-1">Add tax filings, regulatory deadlines, and more</p>
          <Button className="mt-4 bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowCreate(true)}>
            Add First Event
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => {
            const days = daysUntil(evt.due_date);
            const urgency = days < 0 ? "overdue" : days <= 7 ? "critical" : days <= 30 ? "soon" : "normal";
            return (
              <div
                key={evt.id}
                className={`bg-white rounded-[10px] border p-4 ${
                  urgency === "overdue"
                    ? "border-red-200"
                    : urgency === "critical"
                    ? "border-orange-200"
                    : urgency === "soon"
                    ? "border-yellow-200"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-gray-900">{evt.title}</span>
                      <Badge className={STATUS_COLORS[evt.status] || "bg-gray-100 text-gray-700"}>
                        {evt.status}
                      </Badge>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                        {CATEGORIES.find((c) => c.value === evt.category)?.label || evt.category}
                      </span>
                      {evt.jurisdiction && (
                        <span className="text-xs text-gray-400">{evt.jurisdiction}</span>
                      )}
                    </div>
                    {evt.description && (
                      <p className="text-sm text-gray-500 mt-1">{evt.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-gray-500">Due: {evt.due_date}</span>
                      {evt.status === "pending" && (
                        <span
                          className={
                            days < 0
                              ? "text-red-600 font-medium"
                              : days <= 7
                              ? "text-orange-600 font-medium"
                              : days <= 30
                              ? "text-yellow-600"
                              : "text-gray-400"
                          }
                        >
                          {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`}
                        </span>
                      )}
                      {evt.recurrence && (
                        <span className="text-gray-400 text-xs">↻ {evt.recurrence}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {evt.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => completeMutation.mutate(evt.id)}
                      >
                        Mark Done
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-600"
                      onClick={() => confirm("Delete this compliance event?") && deleteMutation.mutate(evt.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Compliance Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Q1 VAT Filing"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Jurisdiction</Label>
                <Input
                  value={form.jurisdiction}
                  onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                  placeholder="e.g. US-CA, EU, UK"
                />
              </div>
              <div className="space-y-1">
                <Label>Recurrence</Label>
                <Select
                  value={form.recurrence || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Optional details about this compliance obligation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#51459d] hover:bg-[#41358d]"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.title || !form.due_date}
            >
              {createMutation.isPending ? "Creating…" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
