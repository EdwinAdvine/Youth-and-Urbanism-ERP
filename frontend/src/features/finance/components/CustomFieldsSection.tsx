/**
 * CustomFieldsSection — renders dynamic custom fields for a given entity type.
 *
 * Usage:
 *   const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({})
 *   <CustomFieldsSection entityType="expense" values={customFieldValues} onChange={setCustomFieldValues} />
 *
 * On form submit, pass customFieldValues as custom_fields in the API payload.
 */
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const api = axios.create({ baseURL: "/api/v1" });

interface CustomField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  options: string[] | null;
  default_value: string | null;
  sort_order: number;
}

interface Props {
  entityType: "invoice" | "expense" | "vendor_bill" | "vendor" | "customer";
  values: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}

export function CustomFieldsSection({ entityType, values, onChange }: Props) {
  const { data, isLoading } = useQuery<{ items: CustomField[] }>({
    queryKey: ["custom-fields", entityType],
    queryFn: () =>
      api.get("/finance/custom-fields", { params: { entity_type: entityType } }).then((r) => r.data),
    staleTime: 60_000,
  });

  const fields = data?.items ?? [];

  if (isLoading || fields.length === 0) return null;

  function set(name: string, val: unknown) {
    onChange({ ...values, [name]: val });
  }

  return (
    <div className="border-t border-gray-200 pt-4 mt-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Additional Fields
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...fields].sort((a, b) => a.sort_order - b.sort_order).map((field) => {
          const val = values[field.field_name] ?? field.default_value ?? "";
          return (
            <div key={field.id} className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {field.field_label}
                {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {field.field_type === "text" && (
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-[10px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
                  value={String(val)}
                  onChange={(e) => set(field.field_name, e.target.value)}
                  required={field.is_required}
                />
              )}

              {field.field_type === "textarea" && (
                <textarea
                  className="w-full border border-gray-300 rounded-[10px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
                  rows={2}
                  value={String(val)}
                  onChange={(e) => set(field.field_name, e.target.value)}
                  required={field.is_required}
                />
              )}

              {field.field_type === "number" && (
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-[10px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
                  value={String(val)}
                  onChange={(e) => set(field.field_name, e.target.value ? Number(e.target.value) : "")}
                  required={field.is_required}
                />
              )}

              {field.field_type === "date" && (
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-[10px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
                  value={String(val)}
                  onChange={(e) => set(field.field_name, e.target.value)}
                  required={field.is_required}
                />
              )}

              {field.field_type === "dropdown" && field.options && (
                <select
                  className="w-full border border-gray-300 rounded-[10px] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] bg-white"
                  value={String(val)}
                  onChange={(e) => set(field.field_name, e.target.value)}
                  required={field.is_required}
                >
                  <option value="">Select…</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.field_type === "checkbox" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
                    checked={!!val}
                    onChange={(e) => set(field.field_name, e.target.checked)}
                  />
                  <span className="text-sm text-gray-600">{field.field_label}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
