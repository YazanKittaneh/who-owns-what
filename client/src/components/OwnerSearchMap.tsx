import React from "react";
import { Trans } from "@lingui/macro";
import "leaflet/dist/leaflet.css";
import "styles/OwnerSearchMap.css";
// @ts-ignore react-leaflet v1 does not provide complete TS types in this repo.
import { Map as LeafletMap, TileLayer, CircleMarker, Popup, Circle } from "react-leaflet";
// @ts-ignore leaflet runtime is available via dependency.
import L from "leaflet";

import { OwnerAreaSearchOwner, OwnerAreaSearchSeed } from "./APIDataTypes";

type Props = {
  seed: OwnerAreaSearchSeed;
  owners: OwnerAreaSearchOwner[];
  radiusM: number;
  onParcelClick: (pin: string) => void;
};

const CENTER_COLOR = "#00b4ff";
const SAME_OWNER_COLOR = "#ff813a";
const OWNER_COLOR = "#454d5d";

const OwnerSearchMap: React.FC<Props> = ({ seed, owners, radiusM, onParcelClick }) => {
  const mapRef = React.useRef<any>(null);

  const parcels = React.useMemo(
    () =>
      owners.flatMap((owner) =>
        owner.parcels.filter(
          (parcel) => typeof parcel.lat === "number" && typeof parcel.lng === "number"
        )
      ),
    [owners]
  );

  React.useEffect(() => {
    if (!mapRef.current || seed.lat == null || seed.lng == null) {
      return;
    }

    const map = mapRef.current.leafletElement;
    map.invalidateSize();

    const points = [[seed.lat, seed.lng] as [number, number]].concat(
      parcels.map((parcel) => [parcel.lat as number, parcel.lng as number] as [number, number])
    );

    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
  }, [seed.lat, seed.lng, parcels, radiusM]);

  if (seed.lat == null || seed.lng == null) {
    return (
      <div className="OwnerSearchMap OwnerSearchMap--empty">
        <p>
          <Trans>No map coordinates are available for this search address.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="OwnerSearchMap">
      <LeafletMap ref={mapRef} center={[seed.lat, seed.lng]} zoom={15} scrollWheelZoom preferCanvas>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle center={[seed.lat, seed.lng]} radius={radiusM} color={CENTER_COLOR} fill={false} />
        <CircleMarker
          center={[seed.lat, seed.lng]}
          radius={8}
          color={CENTER_COLOR}
          fillColor={CENTER_COLOR}
          fillOpacity={1}
          weight={2}
        >
          <Popup>
            <div>
              <strong>{seed.address || seed.pin}</strong>
              <br />
              <Trans>Search center</Trans>
            </div>
          </Popup>
        </CircleMarker>
        {parcels.map((parcel) => {
          const color = parcel.same_owner ? SAME_OWNER_COLOR : OWNER_COLOR;
          return (
            <CircleMarker
              key={parcel.pin}
              center={[parcel.lat as number, parcel.lng as number]}
              radius={parcel.same_owner ? 7 : 5}
              color={color}
              fillColor={color}
              fillOpacity={0.85}
              weight={1}
              onClick={() => onParcelClick(parcel.pin)}
            >
              <Popup>
                <div>
                  <strong>{parcel.address || parcel.pin}</strong>
                  <br />
                  {parcel.building_type_label || ""}
                  {parcel.distance_m != null ? ` • ${parcel.distance_m}m` : ""}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </LeafletMap>
      <div className="OwnerSearchMap__legend">
        <div className="OwnerSearchMap__legendEntry OwnerSearchMap__legendEntry--center">
          <Trans>Search center</Trans>
        </div>
        <div className="OwnerSearchMap__legendEntry OwnerSearchMap__legendEntry--sameOwner">
          <Trans>Same owner as search property</Trans>
        </div>
        <div className="OwnerSearchMap__legendEntry OwnerSearchMap__legendEntry--owner">
          <Trans>Matching nearby parcel</Trans>
        </div>
      </div>
    </div>
  );
};

export default OwnerSearchMap;
