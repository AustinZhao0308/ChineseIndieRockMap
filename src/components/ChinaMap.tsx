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

// Helper to interpolate between two hex colors
const interpolateColor = (color1: string, color2: string, factor: number) => {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;
  
  // Clamp factor between 0 and 1
  const clampedFactor = Math.max(0, Math.min(1, factor));
  
  const r = Math.round(c1.r + clampedFactor * (c2.r - c1.r));
  const g = Math.round(c1.g + clampedFactor * (c2.g - c1.g));
  const b = Math.round(c1.b + clampedFactor * (c2.b - c1.b));
  
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const ChinaMap: React.FC<ChinaMapProps> = ({ onProvinceClick, selectedProvinceId, provinceData }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  // Calculate total counts for each province and the maximum count
  const { provinceCounts, maxCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let max = 0;
    
    Object.entries(provinceData).forEach(([provinceName, provData]) => {
      let total = 0;
      provData.cities.forEach(c => {
        total += (c.bands?.length || 0);
        total += (c.venues?.length || 0);
        total += (c.rehearsalRooms?.length || 0);
        total += (c.spots?.length || 0);
      });
      counts[provinceName] = total;
      if (total > max) {
        max = total;
      }
    });
    
    return { provinceCounts: counts, maxCount: max };
  }, [provinceData]);

  // Set up projection
  const projection = useMemo(() => {
    return geoMercator()
      .scale(650)
      .center([104, 38])
      .translate([400, 300]); // Center of 800x600 viewBox
  }, []);

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

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
            
            const count = provinceCounts[provinceName] || 0;
            const hasData = count > 0;
            
            const isSelected = selectedProvinceId === provinceName;
            const isHovered = hoveredProvince === provinceName;

            // Determine styles
            let fill = "#1a1a1a"; // Default no data
            
            if (isSelected) {
              fill = "#ff4e00"; // Selected highlight
            } else if (isHovered && hasData) {
              fill = "#ff4e00"; // Hover highlight
            } else if (isHovered && !hasData) {
              fill = "#222222"; // Hover no data
            } else if (hasData) {
              // Dynamic color interpolation for unselected state with data
              // Use square root compression to ensure most provinces stay closer to the dark base color
              // while still showing differences.
              const ratio = maxCount > 0 ? count / maxCount : 0;
              const factor = Math.pow(ratio, 0.5); 
              
              // Min color: #2c100b, Max color: #8a2e00
              fill = interpolateColor("#2c100b", "#8a2e00", factor);
            }

            return (
              <path
                key={geo.properties.id || index}
                d={pathGenerator(geo) || ""}
                fill={fill}
                stroke={isHovered ? "#555555" : "#333333"}
                strokeWidth={(isHovered ? 1 : 0.5) / transform.k}
                style={{
                  cursor: hasData ? "pointer" : "default",
                  transition: "fill 250ms, stroke 250ms",
                  outline: "none"
                }}
                onMouseEnter={() => setHoveredProvince(provinceName)}
                onMouseLeave={() => setHoveredProvince(null)}
                onClick={() => {
                  if (hasData) {
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
