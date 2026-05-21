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
}: {
  url: string;
  label?: string;
  helperText?: string;
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
      <Label htmlFor="liveQuoteLink">{label}</Label>
      <p className="text-sm text-muted-foreground">{helperText}</p>
      <div className="flex gap-2">
        <Input id="liveQuoteLink" readOnly value={url} className="font-mono text-xs" />
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
