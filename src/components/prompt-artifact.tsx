import { useState } from "react";

/**
 * The landing hero's signature: a live prompt record that demonstrates the
 * product by letting you *use* it. The {{variables}} are real inputs — type a
 * value and both the prompt text and the getPrompt() call below update live,
 * so a non-technical visitor sees variable interpolation happen by their own
 * hand, while the developer sees exactly how those values get passed at runtime.
 */

/** An inline, auto-width variable input styled as a violet token. */
function VarInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Monospace, so 1ch == 1 glyph; size to the longer of value/placeholder.
  const width = `${Math.max(value.length, name.length) + 1}ch`;
  return (
    <input
      aria-label={`${name} variable`}
      value={value}
      placeholder={name}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      style={{ width }}
      className="box-content rounded bg-primary/10 px-1 py-0.5 text-center font-medium text-primary outline-none ring-primary/40 transition-[background-color,box-shadow] placeholder:text-primary/50 hover:bg-primary/15 focus:bg-primary/15 focus:ring-2"
    />
  );
}

export function PromptArtifact() {
  const [name, setName] = useState("Ana");
  const [product, setProduct] = useState("Acme");

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_12px_32px_-12px_rgba(0,0,0,0.18)]">
        {/* header: what this record is + its version */}
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2.5">
          <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            system_prompt
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
            <span className="size-1 rounded-full bg-up" />
            v3 · published
          </span>
        </div>

        {/* body: the editable prompt — variables are real inputs */}
        <div className="px-4 py-4 font-mono text-[13px] leading-[1.9] text-foreground">
          You are a helpful assistant for{" "}
          <VarInput name="name" value={name} onChange={setName} /> at{" "}
          <VarInput name="product" value={product} onChange={setProduct} />.
          Answer concisely, and cite a source whenever you can.
        </div>

        {/* footer: the developer half — the same values, passed at runtime */}
        <div className="border-t border-border bg-secondary/30 px-4 py-3 font-mono text-[11px] leading-[1.7] text-muted-foreground">
          <span className="text-muted-foreground/60">
            {"// read straight from your Supabase, variables passed in"}
          </span>
          <br />
          <span className="text-primary">const</span> {"{ system } = "}
          <span className="text-primary">await</span> getPrompt(
          <span className="text-mid">&apos;onboarding-email&apos;</span>
          {", {"}
          <br />
          {"  "}name: <span className="text-mid">&apos;{name}&apos;</span>,{" "}
          product: <span className="text-mid">&apos;{product}&apos;</span>
          <br />
          {"})"}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground/70">
        Edit the{" "}
        <span className="text-primary">highlighted variables</span> — the prompt
        and the code update live.
      </p>
    </div>
  );
}
