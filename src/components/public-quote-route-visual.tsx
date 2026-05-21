import type { GeoCoordinate } from "@/lib/geo";
import { UsaRouteMapVisual } from "@/components/usa-route-map-visual";
import { PublicQuoteRouteCardVisual } from "@/components/public-quote-route-card-visual";
import type { FormattedRouteLocation } from "@/lib/route-format";

export function PublicQuoteRouteVisual({
  pickup,
  delivery,
  routeSummary,
  isKeener,
  pickupCoordinate,
  deliveryCoordinate,
}: {
  pickup: FormattedRouteLocation;
  delivery: FormattedRouteLocation;
  routeSummary: string;
  isKeener: boolean;
  pickupCoordinate?: GeoCoordinate | null;
  deliveryCoordinate?: GeoCoordinate | null;
}) {
  const pickupLabel = pickup.lines[0] ?? "Pickup";
  const deliveryLabel = delivery.lines[0] ?? "Delivery";

  if (pickupCoordinate && deliveryCoordinate) {
    return (
      <UsaRouteMapVisual
        pickup={pickupCoordinate}
        delivery={deliveryCoordinate}
        routeSummary={routeSummary}
        pickupLabel={pickupLabel}
        deliveryLabel={deliveryLabel}
        isKeener={isKeener}
      />
    );
  }

  return (
    <PublicQuoteRouteCardVisual
      pickup={pickup}
      delivery={delivery}
      routeSummary={routeSummary}
      isKeener={isKeener}
    />
  );
}
