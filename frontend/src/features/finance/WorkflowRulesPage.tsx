import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const api = axios.create({ baseURL: "/api/v1" });

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  conditions: Array<{ field: string; operator: string; value: string }>;
  actions: Array<{ type: string; params: Record<string, unknown> }>;
  priority: number;
  is_active: boolean;
  trigger_count: number;
  last_triggered_at: string | null;
}

const TRIGGER_EVENTS = [
  "expense.submitted",
  "expense.approved",
  "invoice.sent",
  "invoice.overdue",
  "invoice.paid",
  "bill.received",
  "bill.approved",
  "budget.exceeded",
  "asset.purchased",
  "asset.depreciated",
];

const _ACTION_TYPES = [
  { value: "notify", label: "Send notification" },
  { value: "send_email", label: "Send email" },
  { value: "require_approval", label: "Require approval" },
  { value: "auto_approve", label: "Auto-approve" },
  { value: "create_task", label: "Create task" },
  { value: "escalate", label: "Escalate" },
] as const;
void _ACTION_TYPES;

export default function WorkflowRulesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    trigger_event: "expense.submitted",
    conditions: [] as Array<{ field: string; operator: string; value: string }>,
    actions: [{ type: "notify", params: { title: "", message: "" } as Record<string, unknown> }],
    priority: 10,
    is_active: true,
  });

  const { data: rulesData } = useQuery({
    queryKey: ["workflow-rules"],
    queryFn: () => api.get("/finance/workflow-rules").then((r) => r.data),
  });

  const { data: templatesData } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: () => api.get("/finance/workflow-rules/templates").then((r) => r.data),
    enabled: showTemplates,
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof newRule) => api.post("/finance/workflow-rules", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-rules"] });
      setShowCreate(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/finance/workflow-rules/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/workflow-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-rules"] }),
  });

  const applyTemplate = (tpl: WorkflowRule) => {
    setNewRule({
      ...tpl,
      name: tpl.name,
      description: tpl.description || "",
      trigger_event: tpl.trigger_event,
      conditions: (tpl.conditions as Array<{ field: string; operator: string; value: string }>) || [],
      actions: (tpl.actions as Array<{ type: string; params: Record<string, unknown> }>) || [],
      priority: tpl.priority || 10,
      is_active: true,
    });
    setShowTemplates(false);
    setShowCreate(true);
  };

  const addCondition = () =>
    setNewRule((r) => ({ ...r, conditions: [...r.conditions, { field: "amount", operator: "gt", value: "0" }] }));

  const rules: WorkflowRule[] = rulesData?.items || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Rules</h1>
          <p className="text-sm text-gray-500 mt-1">Automate approvals, notifications, and actions based on finance events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            Templates
          </Button>
          <Button className="bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowCreate(true)}>
            + New Rule
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Rules", value: rules.length },
          { label: "Active", value: rules.filter((r) => r.is_active).length },
          { label: "Total Triggers", value: rules.reduce((s, r) => s + (r.trigger_count || 0), 0) },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-[10px] border border-gray-200 p-4">
            <div className="text-2xl font-bold text-[#51459d]">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-[10px] border border-gray-200">
            <div className="text-4xl mb-3">⚡</div>
            <p className="font-medium">No workflow rules yet</p>
            <p className="text-sm mt-1">Create rules to automate approvals, notifications, and more</p>
            <Button className="mt-4 bg-[#51459d] hover:bg-[#41358d]" onClick={() => setShowTemplates(true)}>
              Use a Template
            </Button>
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-white rounded-[10px] border p-4 ${rule.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{rule.name}</span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full font-mono">
                      {rule.trigger_event}
                    </span>
                    <span className="text-xs text-gray-400">Priority: {rule.priority}</span>
                    {rule.trigger_count > 0 && (
                      <span className="text-xs text-gray-400">{rule.trigger_count} triggers</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(rule.conditions || []).map((c, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {c.field} {c.operator} {c.value}
                      </span>
                    ))}
                    {(rule.actions || []).map((a, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">
                        → {a.type}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(v: boolean) => toggleMutation.mutate({ id: rule.id, is_active: v })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-600"
                    onClick={() => confirm("Delete this rule?") && deleteMutation.mutate(rule.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Workflow Templates</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(templatesData?.templates || []).map((tpl: WorkflowRule, i: number) => (
              <div key={i} className="border border-gray-200 rounded-[10px] p-4 hover:border-[#51459d] cursor-pointer transition-colors"
                onClick={() => applyTemplate(tpl)}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">{tpl.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{tpl.description}</div>
                    <div className="mt-2 flex gap-2">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">{tpl.trigger_event}</span>
                      {(tpl.actions || []).map((a: { type: string }, j: number) => (
                        <span key={j} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">→ {a.type}</span>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="outline">Use</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Rule Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>New Workflow Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Rule Name</Label>
              <Input value={newRule.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRule((r) => ({ ...r, name: e.target.value }))} placeholder="e.g. High-value expense approval" />
            </div>
            <div className="space-y-1">
              <Label>Trigger Event</Label>
              <Select value={newRule.trigger_event} onValueChange={(v: string) => setNewRule((r) => ({ ...r, trigger_event: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((evt) => <SelectItem key={evt} value={evt}>{evt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Conditions (AND logic)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCondition}>+ Add</Button>
              </div>
              {newRule.conditions.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="field (e.g. amount)"
                    value={c.field}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRule((r) => ({ ...r, conditions: r.conditions.map((cc, j) => j === i ? { ...cc, field: e.target.value } : cc) }))}
                    className="flex-1"
                  />
                  <Select value={c.operator} onValueChange={(v: string) => setNewRule((r) => ({ ...r, conditions: r.conditions.map((cc, j) => j === i ? { ...cc, operator: v } : cc) }))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["eq", "ne", "gt", "gte", "lt", "lte", "contains"].map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="value"
                    value={c.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRule((r) => ({ ...r, conditions: r.conditions.map((cc, j) => j === i ? { ...cc, value: e.target.value } : cc) }))}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={newRule.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewRule((r) => ({ ...r, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              className="bg-[#51459d] hover:bg-[#41358d]"
              onClick={() => createMutation.mutate(newRule)}
              disabled={createMutation.isPending || !newRule.name}
            >
              {createMutation.isPending ? "Creating…" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
