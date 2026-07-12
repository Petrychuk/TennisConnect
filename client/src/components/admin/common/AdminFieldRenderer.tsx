import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { AdminFieldDef } from "@/lib/adminFields";

export type { AdminFieldDef };

interface AdminFieldRendererProps {
  fields: AdminFieldDef[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;

  // Fields to render as a labelled Switch card (name -> helper description)
  // instead of a plain checkbox. Matches the existing "Featured Package"
  // treatment used for Travel Packages.
  switchFields?: Record<string, string>;

  // Optionally hide a field based on the current values (e.g. Articles'
  // legalType select, only shown when category === "Legal").
  isFieldVisible?: (field: AdminFieldDef, values: Record<string, any>) => boolean;
}

/**
 * Renders a list of AdminFieldDef fields exactly the way the original
 * generic admin Dialog form did, extracted so it can be reused by the new
 * dedicated 2-step Travel/Article forms as their "step 1" (details).
 */
export function AdminFieldRenderer({
  fields,
  values,
  onChange,
  switchFields,
  isFieldVisible,
}: AdminFieldRendererProps) {
  return (
    <div className="space-y-4" data-testid="admin-field-renderer">
      {fields.map((f) => {
        if (isFieldVisible && !isFieldVisible(f, values)) {
          return null;
        }

        return (
          <div key={f.name}>
            <Label htmlFor={f.name} className="capitalize">
              {f.name.replace(/([A-Z])/g, " $1")}
              {f.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>

            {f.type === "checkbox" && switchFields?.[f.name] ? (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor={f.name}>{f.label || f.name}</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {switchFields[f.name]}
                  </p>
                </div>

                <Switch
                  checked={!!values[f.name]}
                  onCheckedChange={(checked) => onChange(f.name, checked)}
                />
              </div>
            ) : f.type === "textarea" ? (
              <Textarea
                id={f.name}
                value={values[f.name] || ""}
                onChange={(e) => onChange(f.name, e.target.value)}
                rows={5}
                data-testid={`admin-field-${f.name}`}
              />
            ) : f.type === "select" ? (
              <select
                id={f.name}
                value={values[f.name] || ""}
                onChange={(e) => onChange(f.name, e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid={`admin-field-${f.name}`}
              >
                <option value="">Select...</option>

                {f.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : f.type === "checkbox" ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  id={f.name}
                  type="checkbox"
                  checked={!!values[f.name]}
                  onChange={(e) => onChange(f.name, e.target.checked)}
                  className="h-4 w-4"
                  data-testid={`admin-field-${f.name}`}
                />
              </div>
            ) : (
              <Input
                id={f.name}
                type={f.type === "number" ? "number" : "text"}
                value={values[f.name] || ""}
                onChange={(e) => onChange(f.name, e.target.value)}
                data-testid={`admin-field-${f.name}`}
              />
            )}

            {f.help && (
              <p className="text-xs text-muted-foreground mt-1">{f.help}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
