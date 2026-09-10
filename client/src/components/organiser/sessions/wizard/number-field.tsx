import { useEffect, useRef, useState } from "react";
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

// Two real bugs made "change 0 to 1" painful enough that clicking the
// native up/down arrows felt like the only reliable option:
//
// 1) type="number" - .select() on focus (the old fix attempt) silently
//    does nothing in some browsers (Firefox has never supported the
//    text-selection API on number-type inputs), so the "0" never got
//    selected to be typed over.
// 2) Being a plain controlled input tied 1:1 to the numeric value meant
//    every keystroke immediately re-derived a number and fed it straight
//    back into `value=`, snapping an emptied field back to "0" the
//    instant you backspaced it out - the field could never actually go
//    blank while you typed a fresh number.
//
// Fix: keep the input's own text as local state (so it can be "", "-",
// or mid-typing) and only translate to/from a real number at the
// boundaries - syncing in from the external value when it changes
// elsewhere (but never while this field is focused, so it doesn't fight
// what's being typed), and committing out via onChange as soon as the
// text parses, falling back to min (or 0) on blur if it's left empty.
export function NumberField({ value, onChange, min, max, step, placeholder, ...rest }: NumberFieldProps) {
  const [text, setText] = useState(() => (Number.isNaN(value) ? "" : String(value)));
  const isFocused = useRef(false);

  useEffect(() => {
    if (isFocused.current) return;
    setText(Number.isNaN(value) ? "" : String(value));
  }, [value]);

  const commit = (raw: string) => {
    if (raw === "" || raw === "-") {
      const fallback = min ?? 0;
      setText(String(fallback));
      onChange(fallback);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    setText(String(clamped));
    onChange(clamped);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="-?[0-9]*"
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        isFocused.current = true;
        e.target.select();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // Let the field hold any in-progress text (including empty, or
        // just "-") without forcing a number yet - only digits and a
        // single leading minus are allowed through at all.
        if (raw !== "" && !/^-?\d*$/.test(raw)) return;
        setText(raw);
        if (raw !== "" && raw !== "-" && !Number.isNaN(Number(raw))) {
          onChange(Number(raw));
        }
      }}
      onBlur={() => {
        isFocused.current = false;
        commit(text);
      }}
      data-testid={rest["data-testid"]}
    />
  );
}
