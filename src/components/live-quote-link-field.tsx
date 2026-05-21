"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LiveQuoteLinkField({
  url,
  label = "Live quote link",
  helperText = "Use this live quote link as the primary customer-facing quote. PDF is optional.",
  inputId = "liveQuoteLink",
}: {
  url: string;
  label?: string;
  helperText?: string;
  inputId?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; user can still select the read-only field.
    }
  }

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      {helperText ? <p className="text-sm text-muted-foreground">{helperText}</p> : null}
      <div className="flex gap-2">
        <Input id={inputId} readOnly value={url} className="font-mono text-xs" aria-label="Live quote link URL" />
        <Button type="button" variant="secondary" onClick={copyLink} aria-label="Copy live quote link">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button asChild type="button" variant="outline" aria-label="Open live quote link">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
