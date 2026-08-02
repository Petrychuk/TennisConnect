import { Input } from "@/components/ui/input";

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  "data-testid"?: string;
}

// Plain type="number" inputs are fiddly to edit - you have to select
// or backspace out the existing value before typing a new one, and on
// mobile the spinner arrows eat into an already-narrow field. This
// selects the whole value on focus (type immediately replaces it) and
// hints a numeric keyboard on mobile via inputMode.
export function NumberField({ value, onChange, min, max, step, placeholder, ...rest }: NumberFieldProps) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={Number.isNaN(value) ? "" : value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const next = e.target.value === "" ? 0 : Number(e.target.value);
        onChange(next);
      }}
      data-testid={rest["data-testid"]}
    />
  );
}
