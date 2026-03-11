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

interface Dimension {
  id: string;
  name: string;
  code: string | null;
  dimension_type: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
}

const DIMENSION_TYPES = [
  { value: "class", label: "Class", description: "P&L segmentation (e.g. Product Line, Business Unit)" },
  { value: "location", label: "Location", description: "Multi-site tracking (e.g. Warehouse, Office)" },
  { value: "department", label: "Department", description: "Departmental cost allocation" },
  { value: "project", label: "Project", description: "Project-based tracking" },
  { value: "custom", label: "Custom", description: "User-defined dimension" },
];

const TYPE_COLORS: Record<string, string> = {
  class: "bg-purple-50 text-purple-700",
  location: "bg-blue-50 text-blue-700",
  department: "bg-green-50 text-green-700",
  project: "bg-orange-50 text-orange-700",
  custom: "bg-gray-100 text-gray-700",
};

const emptyForm = {
  name: "",
  code: "",
  dimension_type: "class",
  description: "",
  parent_id: "",
};

export default function DimensionsAdmin() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("class");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data, isLoading } = useQuery({
    queryKey: ["finance-dimensions", filterType],
    queryFn: () =>
      api.get("/finance/dimensions", { params: { dimension_type: filterType } }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post("/finance/dimensions", {
        ...payload,
        code: payload.code || null,
        description: payload.description || null,
        parent_id: payload.parent_id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-dimensions"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/dimensions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-dimensions"] }),
  });

  const dimensions: Dimension[] = data?.items || [];
  const currentType = DIMENSION_TYPES.find((t) => t.value === filterType);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dimensions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage Classes, Locations, Departments, and custom dimensions for transaction tagging
          </p>
        </div>
        <Button className="bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowCreate(true)}>
          + New Dimension
        </Button>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 flex-wrap">
        {DIMENSION_TYPES.map((dt) => (
          <button
            key={dt.value}
            onClick={() => setFilterType(dt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterType === dt.value
                ? "bg-[#51459d] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {dt.label}
          </button>
        ))}
      </div>

      {/* Description card */}
      {currentType && (
        <div className="bg-purple-50 border border-purple-100 rounded-[10px] p-4 text-sm text-purple-700">
          <strong>{currentType.label}:</strong> {currentType.description}
        </div>
      )}

      {/* Dimensions list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : dimensions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[10px] border border-gray-200 text-gray-400">
          <div className="text-4xl mb-3">🏷️</div>
          <p className="font-medium">No {currentType?.label} dimensions yet</p>
          <p className="text-sm mt-1">{currentType?.description}</p>
          <Button className="mt-4 bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowCreate(true)}>
            Add First {currentType?.label}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {dimensions.map((dim) => (
            <div
              key={dim.id}
              className={`bg-white rounded-[10px] border border-gray-200 p-4 flex items-center justify-between ${
                !dim.is_active ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                {dim.code && (
                  <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {dim.code}
                  </span>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{dim.name}</span>
                    <Badge className={`text-xs ${TYPE_COLORS[dim.dimension_type] || "bg-gray-100 text-gray-700"}`}>
                      {dim.dimension_type}
                    </Badge>
                    {!dim.is_active && (
                      <Badge className="bg-gray-100 text-gray-500 text-xs">Inactive</Badge>
                    )}
                  </div>
                  {dim.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{dim.description}</p>
                  )}
                  {dim.parent_id && (
                    <p className="text-xs text-gray-400 mt-0.5">Parent: {dim.parent_id}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-600"
                onClick={() => confirm("Delete this dimension?") && deleteMutation.mutate(dim.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Dimensions used info */}
      <div className="bg-gray-50 rounded-[10px] border border-gray-200 p-4 text-sm text-gray-600">
        <p className="font-medium mb-1">How to use dimensions</p>
        <p>
          When creating invoices, expenses, or journal entries, you can tag transactions with one or more dimensions.
          This enables multi-dimensional P&L reporting — filter reports by Class, Location, Department, or Project.
        </p>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Dimension</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Dimension Type *</Label>
              <Select
                value={form.dimension_type}
                onValueChange={(v) => setForm((f) => ({ ...f, dimension_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIMENSION_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. North America"
                />
              </div>
              <div className="space-y-1">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase().replace(/\s+/g, "-"),
                    }))
                  }
                  placeholder="e.g. NA"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-1">
              <Label>Parent Dimension ID</Label>
              <Input
                value={form.parent_id}
                onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
                placeholder="UUID of parent (optional)"
              />
              <p className="text-xs text-gray-400">Leave empty for top-level dimensions</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#51459d] hover:bg-[#41358d]"
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name}
            >
              {createMutation.isPending ? "Creating…" : "Create Dimension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
