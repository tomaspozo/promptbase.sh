import { Highlight, type PrismTheme } from "prism-react-renderer";
import { cn } from "@/lib/utils";

/**
 * Syntax theme wired to the brand CSS variables, so highlighting follows the
 * editorial palette and adapts to light/dark automatically: green keywords,
 * amber strings/numbers, muted comments + punctuation.
 */
const brandTheme: PrismTheme = {
  plain: { color: "var(--foreground)", backgroundColor: "transparent" },
  styles: [
    {
      types: ["comment", "prolog", "cdata"],
      style: { color: "var(--muted-foreground)", fontStyle: "italic" },
    },
    {
      types: ["keyword", "selector", "changed", "tag", "deleted"],
      style: { color: "var(--primary)" },
    },
    {
      types: ["string", "char", "attr-value", "inserted", "regex"],
      style: { color: "var(--mid)" },
    },
    {
      types: ["number", "boolean", "constant", "symbol"],
      style: { color: "var(--mid)" },
    },
    { types: ["builtin", "attr-name"], style: { color: "var(--primary)" } },
    {
      types: ["punctuation", "operator"],
      style: { color: "var(--muted-foreground)" },
    },
    {
      types: ["function", "class-name", "variable", "property"],
      style: { color: "var(--foreground)" },
    },
  ],
};

export function CodeBlock({
  code,
  language = "tsx",
  className,
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  return (
    <Highlight code={code} language={language} theme={brandTheme}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            "overflow-x-auto rounded-md border border-border bg-secondary p-3 font-mono text-xs leading-relaxed",
            className,
          )}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
