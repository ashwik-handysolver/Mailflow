import { useRef } from 'react';
import { Braces } from 'lucide-react';
import { TemplateVariable } from '../../types/outreach';
import { SUPPORTED_VARIABLES, VARIABLE_LABELS } from '../../utils/personalization';
import { Input } from '../ui/Field';
import { Menu } from '../ui/Menu';
import { VariableToken } from '../ui/Badge';

interface SubjectInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
}

/** Subject line input with a menu that inserts {{variables}} at the caret. */
export function SubjectInput({ id, value, onChange, invalid, placeholder }: SubjectInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<{ start: number; end: number } | null>(null);

  const remember = () => {
    const el = ref.current;
    if (el) caret.current = { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length };
  };

  const insert = (variable: TemplateVariable) => {
    const token = `{{${variable}}}`;
    const { start, end } = caret.current ?? { start: value.length, end: value.length };
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Input
      ref={ref}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={remember}
      onSelect={remember}
      invalid={invalid}
      placeholder={placeholder}
      autoComplete="off"
      trailing={
        <Menu
          width={220}
          items={SUPPORTED_VARIABLES.map((v) => ({
            label: VARIABLE_LABELS[v],
            onSelect: () => insert(v),
            hint: <VariableToken name={v} raw />,
          }))}
          trigger={(p) => (
            <button
              type="button"
              {...p}
              onClick={(e) => {
                remember();
                p.onClick(e);
              }}
              aria-label="Insert variable into subject"
              title="Insert variable"
              className="flex size-6 items-center justify-center rounded text-ink-3 hover:bg-subtle hover:text-accent"
            >
              <Braces className="size-3.5" />
            </button>
          )}
        />
      }
    />
  );
}
