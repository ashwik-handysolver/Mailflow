import { VariableToken } from '../ui/Badge';

/** Renders text with {{variables}} shown as tokens. */
export function TokenizedText({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*(?:name|company|email|phone)\s*\}\})/gi);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{\{\s*(\w+)\s*\}\}$/);
        return m ? <VariableToken key={i} name={m[1].toLowerCase()} /> : <span key={i}>{part}</span>;
      })}
    </>
  );
}
