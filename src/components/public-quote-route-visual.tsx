import type { GeoCoordinate } from "@/lib/geo";
import { formatApproxRouteDistance, haversineMiles } from "@/lib/geo";
import { TransportRouteBoard } from "@/components/transport-route-board";
import type { FormattedRouteLocation } from "@/lib/route-format";

export function PublicQuoteRouteVisual({
  pickup,
  delivery,
  routeSummary,
  isKeener,
  pickupCoordinate,
  deliveryCoordinate,
  transportType,
}: {
  pickup: FormattedRouteLocation;
  delivery: FormattedRouteLocation;
  routeSummary: string;
  isKeener: boolean;
  pickupCoordinate?: GeoCoordinate | null;
  deliveryCoordinate?: GeoCoordinate | null;
  transportType?: string | null;
}) {
  const estimatedDistance =
    pickupCoordinate && deliveryCoordinate
      ? formatApproxRouteDistance(haversineMiles(pickupCoordinate, deliveryCoordinate))
      : null;

  return (
    <TransportRouteBoard
      pickup={pickup}
      delivery={delivery}
      routeSummary={routeSummary}
      isKeener={isKeener}
      transportType={transportType}
      estimatedDistance={estimatedDistance}
    />
  );
}
