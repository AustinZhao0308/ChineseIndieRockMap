import React, { memo, useState, useEffect, useRef, useMemo } from "react";
import { geoMercator, geoPath, geoCentroid } from "d3-geo";
import { select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity, ZoomTransform } from "d3-zoom";
import "d3-transition";
import chinaGeoJson from "../china.json";
import { Province } from "../data";

interface ChinaMapProps {
  onProvinceClick: (provinceId: string) => void;
  selectedProvinceId: string | null;
  provinceData: Record<string, Province>;
}

const normalizeProvinceName = (name: string) => {
  return name.replace(/(省|市|维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区)$/, '');
};

const ChinaMap: React.FC<ChinaMapProps> = ({ onProvinceClick, selectedProvinceId, provinceData }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  // Set up projection
  const projection = useMemo(() => {
    return geoMercator()
      .scale(650)
      .center([104, 38])
      .translate([400, 300]); // Center of 800x600 viewBox
  }, []);

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  // Calculate maximum items across all provinces for dynamic heatmap scaling
  const maxItems = useMemo(() => {
    let max = 0;
    Object.values(provinceData).forEach(prov => {
      let total = 0;
      prov.cities.forEach(c => {
        total += c.bands?.length || 0;
        total += c.venues?.length || 0;
        total += c.rehearsalRooms?.length || 0;
        total += c.spots?.length || 0;
      });
      if (total > max) max = total;
    });
    return max || 1; // prevent division by zero
  }, [provinceData]);

  // Set up d3-zoom
  const zoomBehavior = useMemo(() => {
    return d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 4])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });
  }, []);

  useEffect(() => {
    if (svgRef.current) {
      select(svgRef.current).call(zoomBehavior);
    }
  }, [zoomBehavior]);

  const zoomTo = (targetCoordinates: [number, number], targetZoom: number) => {
    if (!svgRef.current) return;
    
    // Calculate the pixel coordinates of the target center
    const [x, y] = projection(targetCoordinates) || [400, 300];
    
    // Calculate the transform to center (x, y) at the middle of the SVG (400, 300)
    const tx = 400 - x * targetZoom;
    const ty = 300 - y * targetZoom;
    
    const targetTransform = zoomIdentity.translate(tx, ty).scale(targetZoom);
    
    select(svgRef.current)
      .transition()
      .duration(800)
      .call(zoomBehavior.transform, targetTransform);
  };

  useEffect(() => {
    if (!selectedProvinceId) {
      // Reset to default view
      zoomTo([104, 38], 1);
    }
  }, [selectedProvinceId]);

  return (
    <div className="w-full h-full bg-[#0a0502] flex items-center justify-center relative overflow-hidden">
      <svg
        ref={svgRef}
        viewBox="0 0 800 600"
        className="w-full h-full outline-none"
        style={{ width: "100%", height: "100%", touchAction: "none" }}
      >
        <g transform={transform.toString()}>
          {chinaGeoJson.features.map((geo: any, index: number) => {
            const rawName = geo.properties.name;
            const provinceName = normalizeProvinceName(rawName);
            
            // Check if there are any bands, venues, rehearsal rooms, or spots in this province
            const provData = provinceData[provinceName];
            let totalItems = 0;
            if (provData) {
              provData.cities.forEach(c => {
                totalItems += c.bands?.length || 0;
                totalItems += c.venues?.length || 0;
                totalItems += c.rehearsalRooms?.length || 0;
                totalItems += c.spots?.length || 0;
              });
            }
            const hasBands = totalItems > 0;
            
            const isSelected = selectedProvinceId === provinceName;
            const isHovered = hoveredProvince === provinceName;

            // Determine styles based on item count (Dynamic Heatmap effect)
            let fill = "#1a1a1a";
            if (isSelected) {
              fill = "#ff4e00";
            } else if (isHovered && hasBands) {
              fill = "#ff4e00";
            } else if (isHovered && !hasBands) {
              fill = "#222222";
            } else if (hasBands) {
              // Calculate ratio relative to maxItems (using sqrt for better distribution of skewed data)
              const ratio = maxItems > 1 ? Math.sqrt(totalItems / maxItems) : 1;
              
              // Interpolate between dark orange/brown (#3a1510) and bright orange (#f24a00)
              // #3a1510 = rgb(58, 21, 16)
              // #f24a00 = rgb(242, 74, 0)
              // We use a minimum intensity so even 1 item is visible
              const minIntensity = 0.15;
              const intensity = minIntensity + (1 - minIntensity) * ratio;
              
              const r = Math.round(58 + (242 - 58) * intensity);
              const g = Math.round(21 + (74 - 21) * intensity);
              const b = Math.round(16 + (0 - 16) * intensity);
              
              fill = `rgb(${r}, ${g}, ${b})`;
            }

            return (
              <path
                key={geo.properties.id || index}
                d={pathGenerator(geo) || ""}
                fill={fill}
                stroke={isHovered ? "#555555" : "#333333"}
                strokeWidth={(isHovered ? 1 : 0.5) / transform.k}
                style={{
                  cursor: hasBands ? "pointer" : "default",
                  transition: "fill 250ms, stroke 250ms",
                  outline: "none"
                }}
                onMouseEnter={() => setHoveredProvince(provinceName)}
                onMouseLeave={() => setHoveredProvince(null)}
                onClick={() => {
                  if (hasBands) {
                    const centroid = geoCentroid(geo);
                    const isDesktop = window.innerWidth >= 768;
                    const longitudeOffset = isDesktop ? 6 : 0;
                    const latitudeOffset = isDesktop ? 0 : -8;
                    
                    zoomTo([centroid[0] + longitudeOffset, centroid[1] + latitudeOffset], 2.5);
                    onProvinceClick(provinceName);
                  }
                }}
              />
            );
          })}
        </g>
      </svg>
      
      {/* Atmosphere effects */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(10, 5, 2, 0.8) 100%)'
      }} />
    </div>
  );
};

export default memo(ChinaMap);
