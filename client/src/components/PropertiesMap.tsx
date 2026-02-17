import React from "react";
import { withMachineInStateProps } from "state-machine";
import { AddressPageRoutes } from "routes";
import { AddressRecord } from "./APIDataTypes";
import { Trans } from "@lingui/macro";
import "styles/PropertiesMap.css";
import "leaflet/dist/leaflet.css";
// @ts-ignore react-leaflet v1 does not provide complete TS types in this repo.
import { Map as LeafletMap, TileLayer, CircleMarker, Popup } from "react-leaflet";
// @ts-ignore leaflet runtime is available via dependency.
import L from "leaflet";

type Coordinates = { lat: number; lng: number };

type MappableAddress = AddressRecord & Coordinates;

const SEARCH_MARKER_COLOR = "#00b4ff";
const ASSOC_MARKER_COLOR = "#111111";

function toCoordinates(addr: AddressRecord): Coordinates | null {
  const lat =
    typeof addr.lat === "number" ? addr.lat : addr.lat ? Number.parseFloat(String(addr.lat)) : NaN;
  const lng =
    typeof addr.lng === "number" ? addr.lng : addr.lng ? Number.parseFloat(String(addr.lng)) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

function addressLabel(addr: AddressRecord): string {
  return addr.address || [addr.housenumber, addr.streetname].filter(Boolean).join(" ") || addr.pin;
}

const PropertiesMap: React.FC<
  withMachineInStateProps<"portfolioFound"> & {
    addrs?: AddressRecord[];
    onAddrChange: (pin: string) => void;
    isVisible: boolean;
    addressPageRoutes: AddressPageRoutes;
    location: "overview" | "portfolio";
  }
> = ({ state, addrs, onAddrChange, isVisible }) => {
  const mapRef = React.useRef<any>(null);
  const selectedPin = state.context.portfolioData.detailAddr.pin;
  const searchPin = state.context.searchAddrPin;

  const mappableAddrs = React.useMemo<MappableAddress[]>(() => {
    return (addrs || state.context.portfolioData.assocAddrs)
      .map((addr) => {
        const coords = toCoordinates(addr);
        if (!coords) return null;
        return { ...addr, ...coords };
      })
      .filter((addr): addr is MappableAddress => addr !== null);
  }, [addrs, state.context.portfolioData.assocAddrs]);

  React.useEffect(() => {
    if (!isVisible) return;
    if (!mapRef.current || mappableAddrs.length === 0) return;
    const map = mapRef.current.leafletElement;
    map.invalidateSize();
    if (mappableAddrs.length === 1) {
      map.setView([mappableAddrs[0].lat, mappableAddrs[0].lng], 16);
      return;
    }
    const bounds = L.latLngBounds(mappableAddrs.map((addr) => [addr.lat, addr.lng]));
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  }, [isVisible, mappableAddrs]);

  if (mappableAddrs.length === 0) {
    return (
      <div className="PropertiesMap">
        <div className="PropertiesMap__error">
          <h4>
            <Trans>No map coordinates available for this portfolio.</Trans>
          </h4>
        </div>
      </div>
    );
  }

  const searchAddr = mappableAddrs.find((addr) => addr.pin === searchPin) || mappableAddrs[0];

  return (
    <div className="PropertiesMap">
      <LeafletMap
        ref={mapRef}
        center={[searchAddr.lat, searchAddr.lng]}
        zoom={14}
        scrollWheelZoom
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mappableAddrs.map((addr) => {
          const isSearchAddr = addr.pin === searchPin;
          const isSelected = addr.pin === selectedPin;
          return (
            <CircleMarker
              key={addr.pin}
              center={[addr.lat, addr.lng]}
              radius={isSelected ? 9 : isSearchAddr ? 8 : 6}
              color={isSearchAddr ? SEARCH_MARKER_COLOR : ASSOC_MARKER_COLOR}
              fillColor={isSearchAddr ? SEARCH_MARKER_COLOR : ASSOC_MARKER_COLOR}
              fillOpacity={isSelected ? 1 : 0.7}
              weight={isSelected ? 3 : 1}
              onClick={() => onAddrChange(addr.pin)}
            >
              <Popup>
                <div>
                  <strong>{addressLabel(addr)}</strong>
                  <br />
                  {addr.owner_name || ""}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </LeafletMap>
      <div className="PropertiesMap__legend">
        <p>
          <span>
            <Trans>Map Legend</Trans>
          </span>
        </p>
        <div className="legend-entry-container">
          <div className="addr-search">
            <Trans>Search address</Trans>
          </div>
          <div className="addr-assoc">
            <Trans>Associated parcel</Trans>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertiesMap;
