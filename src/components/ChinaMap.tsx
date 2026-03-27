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

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const interpolateColor = (color1: string, color2: string, factor: number) => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  
  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));
  
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
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

  // Set up d3-zoom
  const zoomBehavior = useMemo(() => {
    return d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 4])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });
  }, []);

  // Calculate province data counts
  const { provinceCounts, minCount, maxCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let min = Infinity;
    let max = -Infinity;

    Object.entries(provinceData).forEach(([provinceName, provData]) => {
      let count = 0;
      provData.cities.forEach(c => {
        count += c.bands?.length || 0;
        count += c.venues?.length || 0;
        count += c.rehearsalRooms?.length || 0;
        count += c.spots?.length || 0;
      });
      if (count > 0) {
        counts[provinceName] = count;
        if (count < min) min = count;
        if (count > max) max = count;
      }
    });

    return { 
      provinceCounts: counts, 
      minCount: min === Infinity ? 0 : min, 
      maxCount: max === -Infinity ? 0 : max 
    };
  }, [provinceData]);

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
            const count = provinceCounts[provinceName] || 0;
            const hasData = count > 0;
            
            const isSelected = selectedProvinceId === provinceName;
            const isHovered = hoveredProvince === provinceName;

            // Determine styles
            let fill = "#1a1a1a";
            if (isSelected) fill = "#ff4e00";
            else if (isHovered && hasData) fill = "#ff4e00";
            else if (isHovered && !hasData) fill = "#222222";
            else if (hasData) {
              const factor = maxCount > minCount ? (count - minCount) / (maxCount - minCount) : 0;
              fill = interpolateColor("#2c100b", "#732600", factor);
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

          {/* Extra labels for small regions */}
          {(() => {
            const regions = [
              { id: 'Hong Kong', name: '香港', coords: [114.1699, 22.3242] as [number, number], offset: [35, 25] },
              { id: 'Macau', name: '澳门', coords: [113.5437, 22.1484] as [number, number], offset: [5, 35] }
            ];

            return regions.map(region => {
              const count = provinceCounts[region.name] || 0;
              const hasData = count > 0;
              const isSelected = selectedProvinceId === region.name;
              const isHovered = hoveredProvince === region.name;

              // Determine styles
              let fill = "#1a1a1a";
              if (isSelected) fill = "#ff4e00";
              else if (isHovered && hasData) fill = "#ff4e00";
              else if (isHovered && !hasData) fill = "#222222";
              else if (hasData) {
                const factor = maxCount > minCount ? (count - minCount) / (maxCount - minCount) : 0;
                fill = interpolateColor("#2c100b", "#732600", factor);
              }

              const [x, y] = projection(region.coords) || [0, 0];
              if (x === 0 && y === 0) return null;

              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              const sizeMultiplier = isMobile ? 1.6 : 1;

              // Keep label size constant relative to the viewport
              const scale = 1 / transform.k;
              // Slightly extend the offset line on mobile to accommodate the larger label
              const labelX = x + region.offset[0] * scale * (isMobile ? 1.3 : 1);
              const labelY = y + region.offset[1] * scale * (isMobile ? 1.3 : 1);
              
              const rectW = 32 * scale * sizeMultiplier;
              const rectH = 18 * scale * sizeMultiplier;
              const fontSize = 10 * scale * sizeMultiplier;

              return (
                <g 
                  key={region.id}
                  style={{ cursor: hasData ? "pointer" : "default" }}
                  onMouseEnter={() => setHoveredProvince(region.name)}
                  onMouseLeave={() => setHoveredProvince(null)}
                  onClick={() => {
                    if (hasData) {
                      const isDesktop = window.innerWidth >= 768;
                      const longitudeOffset = isDesktop ? 6 : 0;
                      const latitudeOffset = isDesktop ? 0 : -8;
                      zoomTo([region.coords[0] + longitudeOffset, region.coords[1] + latitudeOffset], 2.5);
                      onProvinceClick(region.name);
                    }
                  }}
                >
                  {/* Connection line */}
                  <line 
                    x1={x} 
                    y1={y} 
                    x2={labelX} 
                    y2={labelY} 
                    stroke={isHovered ? "#888" : "#444"} 
                    strokeWidth={1 * scale}
                  />
                  
                  {/* Label background */}
                  <rect 
                    x={labelX - rectW / 2} 
                    y={labelY - rectH / 2} 
                    width={rectW} 
                    height={rectH} 
                    rx={3 * scale}
                    fill={fill}
                    stroke={isHovered ? "#555555" : "#333333"}
                    strokeWidth={(isHovered ? 1.5 : 0.5) * scale}
                    style={{ transition: "fill 250ms, stroke 250ms" }}
                  />
                  
                  {/* Label text */}
                  <text
                    x={labelX}
                    y={labelY + 1 * scale}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill={hasData ? "#ffffff" : "#888888"}
                    fontSize={fontSize}
                    style={{ pointerEvents: "none", transition: "fill 250ms" }}
                  >
                    {region.name}
                  </text>
                </g>
              );
            });
          })()}
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
