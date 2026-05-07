import React, { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import APIClient from "./APIClient";
import { FindOwnersV2ViewportProperty } from "./APIDataTypes";

const CARTO_DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const MIN_ZOOM_FOR_PARCELS = 11;
const DEBOUNCE_MS = 300;

export interface FindOwnersV2MapProps {
  onPolygonDrawn?: (geojson: string) => void;
  onPolygonDeleted?: () => void;
  selectedPin?: string | null;
  onPinSelect?: (pin: string | null) => void;
}

const FindOwnersV2Map: React.FC<FindOwnersV2MapProps> = ({
  onPolygonDrawn,
  onPolygonDeleted,
  selectedPin,
  onPinSelect,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const draw = useRef<any>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [parcels, setParcels] = useState<FindOwnersV2ViewportProperty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPolygon, setHasPolygon] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const newMap = new maplibregl.Map({
      container: mapContainer.current,
      style: CARTO_DARK_STYLE,
      center: [-87.63, 41.88],
      zoom: 11,
      attributionControl: false,
    });

    newMap.addControl(new maplibregl.AttributionControl({ compact: true }));
    newMap.addControl(new maplibregl.NavigationControl(), "top-right");

    // Add draw control
    const newDraw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
    });
    newMap.addControl(newDraw, "top-left");
    draw.current = newDraw;

    // Handle draw events
    newMap.on("draw.create", (e: any) => {
      if (e.features.length > 0) {
        const geojson = JSON.stringify(e.features[0].geometry);
        setHasPolygon(true);
        if (onPolygonDrawn) {
          onPolygonDrawn(geojson);
        }
      }
    });

    newMap.on("draw.delete", () => {
      setHasPolygon(false);
      if (onPolygonDeleted) {
        onPolygonDeleted();
      }
    });

    newMap.on("draw.update", (e: any) => {
      if (e.features.length > 0) {
        const geojson = JSON.stringify(e.features[0].geometry);
        if (onPolygonDrawn) {
          onPolygonDrawn(geojson);
        }
      }
    });

    map.current = newMap;

    return () => {
      newMap.remove();
      map.current = null;
    };
  }, [onPolygonDrawn, onPolygonDeleted]);

  // Fetch parcels on viewport change
  const fetchParcels = useCallback(async () => {
    if (!map.current || hasPolygon) return;

    const bounds = map.current.getBounds();
    const zoom = map.current.getZoom();

    if (zoom < MIN_ZOOM_FOR_PARCELS) {
      setParcels([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await APIClient.findOwnersV2Viewport({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        zoom: Math.round(zoom),
      });
      setParcels(results.result);
    } catch (err) {
      console.error("Failed to fetch viewport parcels:", err);
    } finally {
      setIsLoading(false);
    }
  }, [hasPolygon]);

  // Debounced viewport fetch
  useEffect(() => {
    if (!map.current) return;

    const handleMoveEnd = () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        fetchParcels();
      }, DEBOUNCE_MS);
    };

    map.current.on("moveend", handleMoveEnd);

    // Initial fetch
    handleMoveEnd();

    return () => {
      if (map.current) {
        map.current.off("moveend", handleMoveEnd);
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fetchParcels]);

  // Update parcel markers
  useEffect(() => {
    if (!map.current) return;

    const sourceId = "parcels-source";
    const layerId = "parcels-layer";

    // Remove existing layer and source
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    if (parcels.length === 0) return;

    const geojson = {
      type: "FeatureCollection",
      features: parcels.map((p) => ({
        type: "Feature",
        geometry: p.geojson || {
          type: "Point",
          coordinates: [p.lng, p.lat],
        },
        properties: {
          pin: p.pin,
          address: p.address,
          owner_name: p.owner_name,
        },
      })),
    };

    map.current.addSource(sourceId, {
      type: "geojson",
      data: geojson as any,
    });

    map.current.addLayer({
      id: layerId,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-radius": 6,
        "circle-color": "#ff6b6b",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.8,
      },
    });

    // Click handler for parcels
    const handleClick = (e: any) => {
      if (e.features.length > 0) {
        const pin = e.features[0].properties.pin;
        if (onPinSelect) {
          onPinSelect(pin);
        }
      }
    };

    map.current.on("click", layerId, handleClick);
    map.current.on("mouseenter", layerId, () => {
      map.current!.getCanvas().style.cursor = "pointer";
    });
    map.current.on("mouseleave", layerId, () => {
      map.current!.getCanvas().style.cursor = "";
    });

    return () => {
      if (map.current) {
        map.current.off("click", layerId, handleClick);
      }
    };
  }, [parcels, onPinSelect]);

  // Highlight selected pin
  useEffect(() => {
    if (!map.current || !selectedPin) return;

    const parcel = parcels.find((p) => p.pin === selectedPin);
    if (parcel && parcel.lat && parcel.lng) {
      map.current.flyTo({
        center: [parcel.lng, parcel.lat],
        zoom: 16,
        essential: true,
      });
    }
  }, [selectedPin, parcels]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "8px 12px",
            borderRadius: 4,
            fontSize: 12,
            zIndex: 1000,
          }}
        >
          Loading parcels...
        </div>
      )}
      {!hasPolygon && parcels.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "8px 12px",
            borderRadius: 4,
            fontSize: 12,
            zIndex: 1000,
          }}
        >
          {parcels.length} parcels shown
        </div>
      )}
    </div>
  );
};

export default FindOwnersV2Map;
