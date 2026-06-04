"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function ShareLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-white px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-muted/40 active:scale-[0.98]"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          링크 복사됨
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          공유 링크 복사
        </>
      )}
    </button>
  );
}
