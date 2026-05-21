"use client";

import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeZip } from "@/lib/zip-lookup";

type ZipAutofillGroupProps = {
  prefix: "pickup" | "delivery";
  title: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  onFieldChange?: () => void;
};

export function ZipAutofillGroup({
  prefix,
  title,
  address,
  city,
  state,
  zip,
  onFieldChange,
}: ZipAutofillGroupProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [replaceOffer, setReplaceOffer] = useState<{ city: string; state: string } | null>(null);

  const cityId = `${prefix}City`;
  const stateId = `${prefix}State`;
  const zipId = `${prefix}Zip`;
  const addressId = `${prefix}Address`;

  async function lookupZip(replaceExisting = false) {
    setMessage(null);
    setReplaceOffer(null);

    const zipInput = document.getElementById(zipId) as HTMLInputElement | null;
    const cityInput = document.getElementById(cityId) as HTMLInputElement | null;
    const stateInput = document.getElementById(stateId) as HTMLInputElement | null;
    if (!zipInput || !cityInput || !stateInput) return;

    const normalized = normalizeZip(zipInput.value);
    if (!normalized) {
      setMessage("Enter a valid 5-digit ZIP code.");
      return;
    }

    const existingCity = cityInput.value.trim();
    const existingState = stateInput.value.trim();
    if (!replaceExisting && (existingCity || existingState)) {
      setPending(true);
      try {
        const response = await fetch(`/api/zip-lookup?zip=${normalized}`);
        const data = (await response.json()) as { city?: string; state?: string; error?: string };
        if (!response.ok || !data.city || !data.state) {
          setMessage(data.error ?? "ZIP lookup did not find a match.");
          return;
        }
        setReplaceOffer({ city: data.city, state: data.state });
        setMessage("City/state already filled. Replace with ZIP lookup result?");
      } catch {
        setMessage("ZIP lookup is temporarily unavailable.");
      } finally {
        setPending(false);
      }
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/zip-lookup?zip=${normalized}`);
      const data = (await response.json()) as { city?: string; state?: string; error?: string };
      if (!response.ok || !data.city || !data.state) {
        setMessage(data.error ?? "ZIP lookup did not find a match.");
        return;
      }
      cityInput.value = data.city;
      stateInput.value = data.state;
      cityInput.dispatchEvent(new Event("input", { bubbles: true }));
      stateInput.dispatchEvent(new Event("input", { bubbles: true }));
      setMessage(`Filled ${data.city}, ${data.state}. Verify before sending.`);
      onFieldChange?.();
    } catch {
      setMessage("ZIP lookup is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  function applyReplace() {
    if (!replaceOffer) return;
    const cityInput = document.getElementById(cityId) as HTMLInputElement | null;
    const stateInput = document.getElementById(stateId) as HTMLInputElement | null;
    if (!cityInput || !stateInput) return;
    cityInput.value = replaceOffer.city;
    stateInput.value = replaceOffer.state;
    cityInput.dispatchEvent(new Event("input", { bubbles: true }));
    stateInput.dispatchEvent(new Event("input", { bubbles: true }));
    setReplaceOffer(null);
    setMessage(`Updated to ${replaceOffer.city}, ${replaceOffer.state}. Verify before sending.`);
    onFieldChange?.();
  }

  function handleZipBlur() {
    const zipInput = document.getElementById(zipId) as HTMLInputElement | null;
    const cityInput = document.getElementById(cityId) as HTMLInputElement | null;
    const stateInput = document.getElementById(stateId) as HTMLInputElement | null;
    if (!zipInput || !cityInput || !stateInput) return;
    if (!normalizeZip(zipInput.value)) return;
    if (cityInput.value.trim() || stateInput.value.trim()) return;
    void lookupZip(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={addressId}>Street address</Label>
          <Input id={addressId} name={addressId} defaultValue={address} onInput={onFieldChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={zipId}>ZIP</Label>
          <Input id={zipId} name={zipId} defaultValue={zip} inputMode="numeric" onBlur={handleZipBlur} onInput={onFieldChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={cityId}>City</Label>
          <Input id={cityId} name={cityId} defaultValue={city} onInput={onFieldChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={stateId}>State</Label>
          <Input id={stateId} name={stateId} defaultValue={state} maxLength={2} onInput={onFieldChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void lookupZip(false)}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Lookup city/state
        </Button>
        {replaceOffer ? (
          <Button type="button" variant="secondary" size="sm" onClick={applyReplace}>
            Replace with {replaceOffer.city}, {replaceOffer.state}
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">ZIP lookup is a convenience tool. Verify city/state before sending.</p>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
