import React, { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

import APIClient from "./APIClient";
import { FindOwnersV2ViewportProperty } from "./APIDataTypes";

const CARTO_DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const MIN_ZOOM_FOR_PARCELS = 11;
const DEBOUNCE_MS = 300;
const PARCELS_SOURCE_ID = "find-owners-v2-parcels";
const PARCELS_LAYER_ID = "find-owners-v2-parcels-layer";
const DRAW_COLOR = "#3bb2d0";
const DRAW_ACTIVE_COLOR = "#fbb03b";
const PARCEL_MARKER_COLOR = "#ff6b6b";
const SELECTED_PARCEL_MARKER_COLOR = "#00b4ff";

const DRAW_STYLES = [
  {
    id: "gl-draw-polygon-fill-inactive",
    type: "fill",
    filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"], ["==", "mode", "simple_select"]],
    paint: {
      "fill-color": DRAW_COLOR,
      "fill-opacity": 0.1,
    },
  },
  {
    id: "gl-draw-polygon-fill-active",
    type: "fill",
    filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
    paint: {
      "fill-color": DRAW_ACTIVE_COLOR,
      "fill-opacity": 0.1,
    },
  },
  {
    id: "gl-draw-polygon-stroke-inactive",
    type: "line",
    filter: [
      "all",
      ["==", "active", "false"],
      ["any", ["==", "$type", "Polygon"], ["==", "$type", "LineString"]],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": DRAW_COLOR,
      "line-width": 2,
      "line-dasharray": [2, 0],
    },
  },
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: [
      "all",
      ["==", "active", "true"],
      ["any", ["==", "$type", "Polygon"], ["==", "$type", "LineString"]],
    ],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": DRAW_ACTIVE_COLOR,
      "line-width": 2,
      "line-dasharray": [0.2, 2],
    },
  },
  {
    id: "gl-draw-point-inactive",
    type: "circle",
    filter: ["all", ["==", "meta", "feature"], ["==", "$type", "Point"], ["==", "active", "false"]],
    paint: {
      "circle-radius": 5,
      "circle-color": DRAW_COLOR,
    },
  },
  {
    id: "gl-draw-point-active",
    type: "circle",
    filter: ["all", ["==", "meta", "feature"], ["==", "$type", "Point"], ["==", "active", "true"]],
    paint: {
      "circle-radius": 7,
      "circle-color": DRAW_ACTIVE_COLOR,
    },
  },
  {
    id: "gl-draw-vertex-halo-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 7,
      "circle-color": "#ffffff",
    },
  },
  {
    id: "gl-draw-vertex-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 5,
      "circle-color": DRAW_ACTIVE_COLOR,
    },
  },
  {
    id: "gl-draw-midpoint",
    type: "circle",
    filter: ["all", ["==", "meta", "midpoint"], ["==", "$type", "Point"]],
    paint: {
      "circle-radius": 3,
      "circle-color": DRAW_ACTIVE_COLOR,
    },
  },
];

export interface FindOwnersV2MapProps {
  onPolygonDrawn?: (geojson: string) => void;
  onPolygonDeleted?: () => void;
  selectedPin?: string | null;
  onPinSelect?: (pin: string | null) => void;
}

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: any;
    properties: {
      pin: string;
      address?: string | null;
      owner_name?: string | null;
    };
  }>;
};

const emptyFeatureCollection = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

const FindOwnersV2Map: React.FC<FindOwnersV2MapProps> = ({
  onPolygonDrawn,
  onPolygonDeleted,
  selectedPin,
  onPinSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const drawRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [parcels, setParcels] = useState<FindOwnersV2ViewportProperty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const buildParcelFeatureCollection = useCallback((): FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: parcels
        .filter((parcel) => parcel.lat != null && parcel.lng != null)
        .map((parcel) => ({
          type: "Feature",
          geometry:
            parcel.geojson || {
              type: "Point",
              coordinates: [parcel.lng, parcel.lat],
            },
          properties: {
            pin: parcel.pin,
            address: parcel.address,
            owner_name: parcel.owner_name,
          },
        })),
    };
  }, [parcels]);

  const clearPolygon = useCallback(() => {
    if (!drawRef.current) {
      return;
    }

    drawRef.current.deleteAll();
    setIsDrawing(false);
    setHasPolygon(false);
    if (onPolygonDeleted) {
      onPolygonDeleted();
    }
  }, [onPolygonDeleted]);

  const startDrawing = useCallback(() => {
    if (!drawRef.current) {
      return;
    }

    drawRef.current.deleteAll();
    drawRef.current.changeMode("draw_polygon");
    setHasPolygon(false);
    setIsDrawing(true);
    if (onPolygonDeleted) {
      onPolygonDeleted();
    }
  }, [onPolygonDeleted]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: CARTO_DARK_STYLE,
      center: [-87.63, 41.88],
      zoom: 11,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      styles: DRAW_STYLES as any,
    });

    map.addControl(draw, "top-left");

    const handlePolygonChange = (event: any) => {
      const feature = event.features && event.features[0];
      if (!feature) {
        return;
      }
      setHasPolygon(true);
      setIsDrawing(false);
      if (onPolygonDrawn) {
        onPolygonDrawn(JSON.stringify(feature.geometry));
      }
    };

    const handlePolygonDelete = () => {
      setHasPolygon(false);
      setIsDrawing(false);
      if (onPolygonDeleted) {
        onPolygonDeleted();
      }
    };

    const handleModeChange = (event: any) => {
      setIsDrawing(event.mode === "draw_polygon");
    };

    const handleLoad = () => {
      if (!map.getSource(PARCELS_SOURCE_ID)) {
        map.addSource(PARCELS_SOURCE_ID, {
          type: "geojson",
          data: emptyFeatureCollection() as any,
        });
      }

      if (!map.getLayer(PARCELS_LAYER_ID)) {
        map.addLayer({
          id: PARCELS_LAYER_ID,
          type: "circle",
          source: PARCELS_SOURCE_ID,
          paint: {
            "circle-radius": 6,
            "circle-color": "#ff6b6b",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.8,
          },
        });
      }

      setIsMapReady(true);
    };

    map.on("load", handleLoad);
    map.on("draw.create", handlePolygonChange);
    map.on("draw.update", handlePolygonChange);
    map.on("draw.delete", handlePolygonDelete);
    map.on("draw.modechange", handleModeChange);

    mapRef.current = map;
    drawRef.current = draw;

    return () => {
      setIsMapReady(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      map.off("load", handleLoad);
      map.off("draw.create", handlePolygonChange);
      map.off("draw.update", handlePolygonChange);
      map.off("draw.delete", handlePolygonDelete);
      map.off("draw.modechange", handleModeChange);
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [onPolygonDeleted, onPolygonDrawn]);

  const fetchParcels = useCallback(async () => {
    if (!mapRef.current || !isMapReady || hasPolygon) {
      return;
    }

    const bounds = mapRef.current.getBounds();
    const zoom = mapRef.current.getZoom();

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
      setParcels(results.result || []);
    } catch (error) {
      console.error("Failed to fetch viewport parcels:", error);
      setParcels([]);
    } finally {
      setIsLoading(false);
    }
  }, [hasPolygon, isMapReady]);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return;
    }

    const handleMoveEnd = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchParcels();
      }, DEBOUNCE_MS);
    };

    const map = mapRef.current;
    map.on("moveend", handleMoveEnd);
    handleMoveEnd();

    return () => {
      map.off("moveend", handleMoveEnd);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchParcels, isMapReady]);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return;
    }

    const source = mapRef.current.getSource(PARCELS_SOURCE_ID) as any;
    if (source && typeof source.setData === "function") {
      source.setData(buildParcelFeatureCollection() as any);
    }
  }, [buildParcelFeatureCollection, isMapReady]);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return;
    }

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    if (isDrawing) {
      return () => {
        markerRefs.current.forEach((marker) => marker.remove());
        markerRefs.current = [];
      };
    }

    parcels
      .filter((parcel) => parcel.lat != null && parcel.lng != null)
      .forEach((parcel) => {
        const markerElement = document.createElement("button");
        const isSelected = parcel.pin === selectedPin;

        markerElement.type = "button";
        markerElement.setAttribute("aria-label", parcel.address || parcel.pin);
        markerElement.style.width = isSelected ? "16px" : "12px";
        markerElement.style.height = isSelected ? "16px" : "12px";
        markerElement.style.borderRadius = "9999px";
        markerElement.style.border = isSelected ? "3px solid #ffffff" : "2px solid #ffffff";
        markerElement.style.background = isSelected
          ? SELECTED_PARCEL_MARKER_COLOR
          : PARCEL_MARKER_COLOR;
        markerElement.style.boxShadow = "0 0 0 1px rgba(0, 0, 0, 0.15)";
        markerElement.style.cursor = "pointer";
        markerElement.style.padding = "0";

        markerElement.onclick = () => {
          if (onPinSelect) {
            onPinSelect(parcel.pin);
          }
        };

        const marker = new mapboxgl.Marker({ element: markerElement, anchor: "center" })
          .setLngLat([parcel.lng as number, parcel.lat as number])
          .addTo(mapRef.current);

        markerRefs.current.push(marker);
      });

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
    };
  }, [isDrawing, isMapReady, onPinSelect, parcels, selectedPin]);

  useEffect(() => {
    if (!mapRef.current || !selectedPin) {
      return;
    }

    const selectedParcel = parcels.find((parcel) => parcel.pin === selectedPin);
    if (selectedParcel && selectedParcel.lat != null && selectedParcel.lng != null) {
      mapRef.current.flyTo({
        center: [selectedParcel.lng, selectedParcel.lat],
        zoom: 16,
        essential: true,
      });
    }
  }, [parcels, selectedPin]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      {isLoading ? (
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
      ) : null}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 1000,
          maxWidth: 220,
        }}
      >
        <button
          type="button"
          onClick={startDrawing}
          style={{
            background: isDrawing ? DRAW_ACTIVE_COLOR : "#ffffff",
            color: isDrawing ? "#111111" : "#111111",
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 600,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          {hasPolygon ? "Redraw area" : isDrawing ? "Drawing area..." : "Draw area"}
        </button>
        {(hasPolygon || isDrawing) && (
          <button
            type="button"
            onClick={clearPolygon}
            style={{
              background: "rgba(17,17,17,0.85)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 14,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            Clear area
          </button>
        )}
        <div
          style={{
            background: "rgba(17,17,17,0.8)",
            color: "#ffffff",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {isDrawing
            ? "Tap the map to add corners. Tap the first point again to finish the shape."
            : "Tap Draw area, then tap the map to outline your search area."}
        </div>
      </div>
      {!hasPolygon && parcels.length > 0 ? (
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
      ) : null}
    </div>
  );
};

export default FindOwnersV2Map;
