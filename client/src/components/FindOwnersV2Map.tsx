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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [parcels, setParcels] = useState<FindOwnersV2ViewportProperty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPolygon, setHasPolygon] = useState(false);
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
    });

    map.addControl(draw, "top-left");

    const handlePolygonChange = (event: any) => {
      const feature = event.features && event.features[0];
      if (!feature) {
        return;
      }
      setHasPolygon(true);
      if (onPolygonDrawn) {
        onPolygonDrawn(JSON.stringify(feature.geometry));
      }
    };

    const handlePolygonDelete = () => {
      setHasPolygon(false);
      if (onPolygonDeleted) {
        onPolygonDeleted();
      }
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

    const map = mapRef.current;

    const handleClick = (event: any) => {
      if (!event.features || event.features.length === 0 || !onPinSelect) {
        return;
      }
      onPinSelect(event.features[0].properties.pin);
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", PARCELS_LAYER_ID, handleClick);
    map.on("mouseenter", PARCELS_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", PARCELS_LAYER_ID, handleMouseLeave);

    return () => {
      map.off("click", PARCELS_LAYER_ID, handleClick);
      map.off("mouseenter", PARCELS_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", PARCELS_LAYER_ID, handleMouseLeave);
    };
  }, [isMapReady, onPinSelect]);

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
