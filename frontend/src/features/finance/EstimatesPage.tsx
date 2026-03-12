import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const api = axios.create({ baseURL: "/api/v1" });

interface Estimate {
  id: string;
  estimate_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'converted';
  customer_name: string;
  customer_email: string;
  issue_date: string;
  expiry_date: string;
  total: number;
  currency: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
};

export default function EstimatesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showConvert, setShowConvert] = useState<string | null>(null);
  const [dueDays, setDueDays] = useState(30);

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    issue_date: new Date().toISOString().split("T")[0],
    expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    currency: "USD",
    notes: "",
    terms: "",
    items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 0 }],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["estimates", statusFilter],
    queryFn: () =>
      api.get("/finance/estimates", { params: { status: statusFilter || undefined, limit: 50 } }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/finance/estimates", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      setShowCreate(false);
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/finance/estimates/${id}/send`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["estimates"] }),
  });

  const convertMutation = useMutation({
    mutationFn: ({ id, dueDays }: { id: string; dueDays: number }) =>
      api.post(`/finance/estimates/${id}/convert-to-invoice`, { due_days: dueDays }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowConvert(null);
      alert(`Converted! Invoice ${data.data.invoice_number} created.`);
    },
  });

  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { description: "", quantity: 1, unit_price: 0, tax_rate: 0 }] }));

  const updateItem = (idx: number, field: string, value: string | number) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));

  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const subtotal = form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax = form.items.reduce((s, i) => s + i.quantity * i.unit_price * (i.tax_rate / 100), 0);
  const total = subtotal + tax;

  const estimates: Estimate[] = data?.items || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates & Quotes</h1>
          <p className="text-sm text-gray-500 mt-1">Create professional estimates, send to customers, convert to invoices</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#51459d] hover:bg-[#41358d]">
          + New Estimate
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">{estimates.length} estimates</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[10px] border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estimate #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Issue Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expiry</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : estimates.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No estimates found</td></tr>
            ) : (
              estimates.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-[#51459d]">{e.estimate_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{e.customer_name}</div>
                    <div className="text-xs text-gray-400">{e.customer_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.issue_date}</td>
                  <td className="px-4 py-3 text-gray-600">{e.expiry_date}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {e.currency} {e.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] || "bg-gray-100"}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {e.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => sendMutation.mutate(e.id)}>
                          Send
                        </Button>
                      )}
                      {(e.status === "accepted" || e.status === "sent" || e.status === "draft") && (
                        <Button
                          size="sm"
                          className="bg-[#6fd943] text-white hover:bg-[#5bc938]"
                          onClick={() => setShowConvert(e.id)}
                        >
                          → Invoice
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Estimate Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Customer Name</Label>
                <Input value={form.customer_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Customer Email</Label>
                <Input type="email" value={form.customer_email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, customer_email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Issue Date</Label>
                <Input type="date" value={form.issue_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiry_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Item</Button>
              </div>
              <div className="border rounded-[10px] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Description</th>
                      <th className="text-right px-3 py-2 w-16 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 w-24 font-medium">Unit Price</th>
                      <th className="text-right px-3 py-2 w-16 font-medium">Tax %</th>
                      <th className="text-right px-3 py-2 w-20 font-medium">Amount</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          <Input
                            className="border-0 shadow-none p-0 h-7"
                            value={item.description}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, "description", e.target.value)}
                            placeholder="Item description"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="border-0 shadow-none p-0 h-7 text-right"
                            type="number"
                            value={item.quantity}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="border-0 shadow-none p-0 h-7 text-right"
                            type="number"
                            value={item.unit_price}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            className="border-0 shadow-none p-0 h-7 text-right"
                            type="number"
                            value={item.tax_rate}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(idx, "tax_rate", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {(item.quantity * item.unit_price * (1 + item.tax_rate / 100)).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none"
                          >×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-medium">Subtotal</td>
                      <td className="px-3 py-2 text-right font-semibold">{subtotal.toFixed(2)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-medium">Tax</td>
                      <td className="px-3 py-2 text-right font-semibold">{tax.toFixed(2)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-bold text-[#51459d]">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-[#51459d]">{total.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Terms & Conditions</Label>
              <Textarea value={form.terms} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, terms: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="bg-[#51459d] hover:bg-[#41358d]"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create Estimate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Invoice Dialog */}
      <Dialog open={!!showConvert} onOpenChange={() => setShowConvert(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convert to Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">This will create a new draft invoice from this estimate.</p>
            <div className="space-y-1">
              <Label>Payment due in (days)</Label>
              <Input
                type="number"
                value={dueDays}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDays(parseInt(e.target.value) || 30)}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvert(null)}>Cancel</Button>
            <Button
              className="bg-[#6fd943] text-white hover:bg-[#5bc938]"
              onClick={() => showConvert && convertMutation.mutate({ id: showConvert, dueDays })}
              disabled={convertMutation.isPending}
            >
              {convertMutation.isPending ? "Converting…" : "Convert to Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
