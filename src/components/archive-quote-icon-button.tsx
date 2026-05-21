"use client";

import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
import { archiveQuoteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ArchiveQuoteIconButton({ quoteId }: { quoteId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmArchive() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("quoteId", quoteId);
      await archiveQuoteAction(formData);
    });
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Archive quote"
        title="Archive quote"
      >
        <Archive className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg" role="dialog" aria-modal="true">
            <h3 className="text-lg font-semibold">Archive this quote?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              It will be hidden from active quote lists but will not delete anything in GHL. Customer messages,
              notifications, and sync logs are preserved. You can still open this quote by direct URL.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={confirmArchive} disabled={pending}>
                {pending ? "Archiving…" : "Archive quote"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
