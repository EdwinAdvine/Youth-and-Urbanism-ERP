import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const api = axios.create({ baseURL: "/api/v1" });

interface CustomField {
  id: string;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  options: string[] | null;
  default_value: string | null;
}

const ENTITY_TYPES = [
  { value: "invoice", label: "Invoice" },
  { value: "expense", label: "Expense" },
  { value: "vendor_bill", label: "Vendor Bill" },
  { value: "vendor", label: "Vendor" },
  { value: "customer", label: "Customer" },
];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "textarea", label: "Textarea" },
];

const TYPE_BADGE: Record<string, string> = {
  text: "bg-blue-50 text-blue-700",
  number: "bg-purple-50 text-purple-700",
  date: "bg-orange-50 text-orange-700",
  dropdown: "bg-green-50 text-green-700",
  checkbox: "bg-gray-100 text-gray-700",
  textarea: "bg-indigo-50 text-indigo-700",
};

const emptyForm = {
  entity_type: "invoice",
  field_name: "",
  field_label: "",
  field_type: "text",
  is_required: false,
  sort_order: 0,
  options: "",
  default_value: "",
};

export default function CustomFieldsAdmin() {
  const queryClient = useQueryClient();
  const [filterEntity, setFilterEntity] = useState("invoice");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data, isLoading } = useQuery({
    queryKey: ["custom-fields", filterEntity],
    queryFn: () =>
      api.get("/finance/custom-fields", { params: { entity_type: filterEntity } }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post("/finance/custom-fields", {
        ...payload,
        options: payload.options
          ? payload.options.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        default_value: payload.default_value || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/custom-fields/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-fields"] }),
  });

  const fields: CustomField[] = data?.items || [];
  const maxFields = 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Fields</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define up to {maxFields} custom fields per entity type for invoices, expenses, bills, and more
          </p>
        </div>
        <Button
          className="bg-[#51459d] hover:bg-[#41358d]"
          onClick={() => setShowCreate(true)}
          disabled={fields.length >= maxFields}
        >
          + New Field
        </Button>
      </div>

      {/* Entity type filter */}
      <div className="flex gap-2 flex-wrap">
        {ENTITY_TYPES.map((et) => (
          <button
            key={et.value}
            onClick={() => setFilterEntity(et.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterEntity === et.value
                ? "bg-[#51459d] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {et.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="bg-white rounded-[10px] border border-gray-200 p-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{fields.length}</span> / {maxFields} fields defined for{" "}
          <span className="font-medium">
            {ENTITY_TYPES.find((e) => e.value === filterEntity)?.label}
          </span>
        </div>
        <div className="w-40 bg-gray-100 rounded-full h-2">
          <div
            className="bg-[#51459d] h-2 rounded-full"
            style={{ width: `${(fields.length / maxFields) * 100}%` }}
          />
        </div>
      </div>

      {/* Fields list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : fields.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[10px] border border-gray-200 text-gray-400">
          <div className="text-4xl mb-3">🏷️</div>
          <p className="font-medium">No custom fields yet</p>
          <p className="text-sm mt-1">Add fields to capture additional data on {filterEntity}s</p>
          <Button className="mt-4 bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowCreate(true)}>
            Add First Field
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-[10px] border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-gray-500 font-medium">Field Name</th>
                <th className="text-left p-3 text-gray-500 font-medium">Label</th>
                <th className="text-left p-3 text-gray-500 font-medium">Type</th>
                <th className="text-left p-3 text-gray-500 font-medium">Required</th>
                <th className="text-left p-3 text-gray-500 font-medium">Order</th>
                <th className="text-left p-3 text-gray-500 font-medium">Options</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs text-gray-700">{f.field_name}</td>
                  <td className="p-3 text-gray-900">{f.field_label}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_BADGE[f.field_type] || "bg-gray-100 text-gray-700"}`}>
                      {f.field_type}
                    </span>
                  </td>
                  <td className="p-3">
                    {f.is_required ? (
                      <Badge className="bg-red-100 text-red-700 text-xs">Required</Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">Optional</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-500">{f.sort_order}</td>
                  <td className="p-3 text-gray-400 text-xs">
                    {f.options?.join(", ") || "—"}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-600"
                      onClick={() => confirm("Delete this custom field?") && deleteMutation.mutate(f.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Custom Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Entity Type</Label>
                <Select
                  value={form.entity_type}
                  onValueChange={(v: string) => setForm((f) => ({ ...f, entity_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        {et.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Field Type</Label>
                <Select
                  value={form.field_type}
                  onValueChange={(v: string) => setForm((f) => ({ ...f, field_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((ft) => (
                      <SelectItem key={ft.value} value={ft.value}>
                        {ft.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Field Name (API key) *</Label>
              <Input
                value={form.field_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({
                    ...f,
                    field_name: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
                  }))
                }
                placeholder="e.g. purchase_order_number"
              />
              <p className="text-xs text-gray-400">Lowercase letters, numbers, underscores only</p>
            </div>
            <div className="space-y-1">
              <Label>Field Label (display) *</Label>
              <Input
                value={form.field_label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, field_label: e.target.value }))}
                placeholder="e.g. Purchase Order #"
              />
            </div>
            {form.field_type === "dropdown" && (
              <div className="space-y-1">
                <Label>Options (comma-separated)</Label>
                <Input
                  value={form.options}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, options: e.target.value }))}
                  placeholder="Option A, Option B, Option C"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>Default Value</Label>
              <Input
                value={form.default_value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, default_value: e.target.value }))}
                placeholder="Optional default"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_required}
                onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, is_required: v }))}
              />
              <Label>Required field</Label>
            </div>
            <div className="space-y-1">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-24"
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
              disabled={createMutation.isPending || !form.field_name || !form.field_label}
            >
              {createMutation.isPending ? "Creating…" : "Create Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
