import React from "react";
import { Trans } from "@lingui/macro";
import "leaflet/dist/leaflet.css";
import "styles/OverviewMap.css";
// @ts-ignore react-leaflet v1 does not provide complete TS types in this repo.
import { Map as LeafletMap, TileLayer, CircleMarker, Popup } from "react-leaflet";
// @ts-ignore leaflet runtime is available via dependency.
import L from "leaflet";
import { AddressRecord, OverviewMapProperty } from "./APIDataTypes";

export type OverviewBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
};

type MappablePoint = {
  pin: string;
  address: string;
  owner_name?: string | null;
  lat: number;
  lng: number;
};

type Props = {
  properties: OverviewMapProperty[];
  highlightedAddrs: AddressRecord[];
  selectedPin?: string | null;
  isLoading: boolean;
  truncated: boolean;
  onMarkerClick: (pin: string) => void;
  onViewportChange: (bounds: OverviewBounds) => void;
};

const CHICAGO_CENTER: [number, number] = [41.8781, -87.6298];
const CHICAGO_ZOOM = 11;
const BASE_MARKER_COLOR = "#454d5d";
const HIGHLIGHT_MARKER_COLOR = "#ff813a";
const SELECTED_MARKER_COLOR = "#00b4ff";

function pointLabel(point: {
  address?: string | null;
  housenumber?: string | null;
  streetname?: string | null;
  pin: string;
}) {
  return (
    point.address || [point.housenumber, point.streetname].filter(Boolean).join(" ") || point.pin
  );
}

function toHighlightedPoint(addr: AddressRecord): MappablePoint | null {
  const lat = typeof addr.lat === "number" ? addr.lat : Number.parseFloat(String(addr.lat));
  const lng = typeof addr.lng === "number" ? addr.lng : Number.parseFloat(String(addr.lng));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return {
    pin: addr.pin,
    address: pointLabel(addr),
    owner_name: addr.owner_name,
    lat,
    lng,
  };
}

const OverviewMap: React.FC<Props> = ({
  properties,
  highlightedAddrs,
  selectedPin,
  isLoading,
  truncated,
  onMarkerClick,
  onViewportChange,
}) => {
  const mapRef = React.useRef<any>(null);

  const highlightedPoints = React.useMemo(
    () =>
      highlightedAddrs
        .map(toHighlightedPoint)
        .filter((addr): addr is MappablePoint => addr !== null),
    [highlightedAddrs]
  );

  const markers = React.useMemo(() => {
    const merged = new Map<string, MappablePoint>();

    properties.forEach((property) => {
      if (property.lat == null || property.lng == null) return;
      merged.set(property.pin, {
        pin: property.pin,
        address: pointLabel(property),
        owner_name: property.owner_name,
        lat: property.lat,
        lng: property.lng,
      });
    });

    highlightedPoints.forEach((point) => {
      if (!merged.has(point.pin)) {
        merged.set(point.pin, point);
      }
    });

    return Array.from(merged.values());
  }, [properties, highlightedPoints]);

  const highlightedPins = React.useMemo(() => new Set(highlightedPoints.map((addr) => addr.pin)), [
    highlightedPoints,
  ]);

  React.useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.leafletElement;
    const emitBounds = () => {
      const bounds = map.getBounds();
      onViewportChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        zoom: map.getZoom(),
      });
    };

    emitBounds();
    map.on("moveend", emitBounds);
    map.on("zoomend", emitBounds);

    return () => {
      map.off("moveend", emitBounds);
      map.off("zoomend", emitBounds);
    };
  }, [onViewportChange]);

  React.useEffect(() => {
    if (!mapRef.current || highlightedPoints.length === 0) return;
    const map = mapRef.current.leafletElement;
    const bounds = L.latLngBounds(highlightedPoints.map((addr) => [addr.lat, addr.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [highlightedPoints]);

  return (
    <div className="OverviewMap">
      <LeafletMap
        ref={mapRef}
        center={CHICAGO_CENTER}
        zoom={CHICAGO_ZOOM}
        scrollWheelZoom
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker) => {
          const isSelected = marker.pin === selectedPin;
          const isHighlighted = highlightedPins.has(marker.pin);
          const color = isSelected
            ? SELECTED_MARKER_COLOR
            : isHighlighted
            ? HIGHLIGHT_MARKER_COLOR
            : BASE_MARKER_COLOR;
          return (
            <CircleMarker
              key={marker.pin}
              center={[marker.lat, marker.lng]}
              radius={isSelected ? 8 : isHighlighted ? 6 : 4}
              color={color}
              fillColor={color}
              fillOpacity={isSelected ? 1 : 0.8}
              weight={isSelected ? 3 : isHighlighted ? 2 : 1}
              onClick={() => onMarkerClick(marker.pin)}
            >
              <Popup>
                <div>
                  <strong>{marker.address}</strong>
                  <br />
                  {marker.owner_name || "Unknown owner"}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </LeafletMap>

      {(isLoading || truncated) && (
        <div className="OverviewMap__status">
          {isLoading && (
            <p>
              <Trans>Loading parcels in view...</Trans>
            </p>
          )}
          {truncated && (
            <p>
              <Trans>
                Too many parcels in view. Zoom in for a denser, more complete result set.
              </Trans>
            </p>
          )}
        </div>
      )}

      <div className="OverviewMap__legend">
        <p>
          <span>
            <Trans>Map Legend</Trans>
          </span>
        </p>
        <div className="OverviewMap__legendEntries">
          <div className="overview-marker">
            <Trans>Parcels in view</Trans>
          </div>
          <div className="portfolio-marker">
            <Trans>Selected portfolio</Trans>
          </div>
          <div className="selected-marker">
            <Trans>Selected property</Trans>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewMap;
