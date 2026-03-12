import React, { memo, useState, useEffect, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { animate } from "motion/react";
import { provinceData } from "../data";

const geoUrl =
  "https://raw.githubusercontent.com/longwosion/geojson-map-china/master/china.json";

interface ChinaMapProps {
  onProvinceClick: (provinceId: string) => void;
  selectedProvinceId: string | null;
}

const ChinaMap: React.FC<ChinaMapProps> = ({ onProvinceClick, selectedProvinceId }) => {
  const [position, setPosition] = useState({ coordinates: [104, 38] as [number, number], zoom: 1 });
  const positionRef = useRef(position);
  const animationRef = useRef<any>(null);

  // Keep ref in sync with state (e.g., when user drags the map)
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const zoomTo = (targetCoordinates: [number, number], targetZoom: number) => {
    const startCoordinates = positionRef.current.coordinates;
    const startZoom = positionRef.current.zoom;

    if (
      startCoordinates[0] === targetCoordinates[0] &&
      startCoordinates[1] === targetCoordinates[1] &&
      startZoom === targetZoom
    ) {
      return;
    }

    if (animationRef.current) {
      animationRef.current.stop();
    }

    animationRef.current = animate(0, 1, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1], // Custom ease out for smooth deceleration
      onUpdate: (progress) => {
        const newPos = {
          coordinates: [
            startCoordinates[0] + (targetCoordinates[0] - startCoordinates[0]) * progress,
            startCoordinates[1] + (targetCoordinates[1] - startCoordinates[1]) * progress
          ] as [number, number],
          zoom: startZoom + (targetZoom - startZoom) * progress
        };
        setPosition(newPos);
        positionRef.current = newPos;
      }
    });
  };

  useEffect(() => {
    if (!selectedProvinceId) {
      // Shift center slightly north (higher latitude) to move the map down,
      // making room for the top header text.
      zoomTo([104, 38], 1);
    }
  }, [selectedProvinceId]);

  return (
    <div className="w-full h-full bg-[#0a0502] flex items-center justify-center relative overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 650,
          center: [104, 38] // Center of China, shifted slightly north
        }}
        className="w-full h-full outline-none"
      >
        <ZoomableGroup 
          zoom={position.zoom} 
          center={position.coordinates}
          onMoveEnd={(pos) => {
            setPosition(pos as { coordinates: [number, number], zoom: number });
          }}
          minZoom={1} 
          maxZoom={4}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const provinceName = geo.properties.name;
                const hasBands = !!provinceData[provinceName];
                const isSelected = selectedProvinceId === provinceName;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => {
                      if (hasBands) {
                        const centroid = geoCentroid(geo);
                        
                        // Calculate offset based on screen width
                        // If screen is wide enough for the side panel (md breakpoint is 768px),
                        // shift the map to the left by adding to the longitude.
                        // If on mobile, shift the map up by subtracting from the latitude.
                        const isDesktop = window.innerWidth >= 768;
                        const longitudeOffset = isDesktop ? 6 : 0;
                        const latitudeOffset = isDesktop ? 0 : -8;
                        
                        zoomTo([centroid[0] + longitudeOffset, centroid[1] + latitudeOffset], 2.5);
                        onProvinceClick(provinceName);
                      }
                    }}
                    style={{
                      default: {
                        fill: isSelected ? "#ff4e00" : hasBands ? "#3a1510" : "#1a1a1a",
                        stroke: "#333333",
                        strokeWidth: 0.5 / position.zoom,
                        outline: "none",
                        transition: "fill 250ms, stroke 250ms"
                      },
                      hover: {
                        fill: hasBands ? "#ff4e00" : "#222222",
                        stroke: "#555555",
                        strokeWidth: 1 / position.zoom,
                        outline: "none",
                        cursor: hasBands ? "pointer" : "default",
                        transition: "fill 250ms, stroke 250ms"
                      },
                      pressed: {
                        fill: "#cc3e00",
                        stroke: "#777777",
                        strokeWidth: 1 / position.zoom,
                        outline: "none"
                      }
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      
      {/* Atmosphere effects */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(10, 5, 2, 0.8) 100%)'
      }} />
    </div>
  );
};

export default memo(ChinaMap);
