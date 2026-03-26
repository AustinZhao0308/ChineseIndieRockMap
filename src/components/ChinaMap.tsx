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

const interpolateColor = (color1: string, color2: string, factor: number) => {
  const hex1 = color1.substring(1);
  const hex2 = color2.substring(1);
  
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
};

const ChinaMap: React.FC<ChinaMapProps> = ({ onProvinceClick, selectedProvinceId, provinceData }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  // Calculate total counts per province to determine heat map colors
  const { provinceCounts, maxCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let max = 0;
    
    Object.entries(provinceData).forEach(([provName, provData]) => {
      let total = 0;
      provData.cities.forEach(city => {
        total += city.bands.length;
        if (city.venues) total += city.venues.length;
        if (city.rehearsalRooms) total += city.rehearsalRooms.length;
        if (city.spots) total += city.spots.length;
      });
      counts[provName] = total;
      if (total > max) max = total;
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
            const hasBands = count > 0;
            
            const isSelected = selectedProvinceId === provinceName;
            const isHovered = hoveredProvince === provinceName;

            // Determine styles
            let fill = "#1a1a1a";
            if (isSelected) fill = "#ff4e00";
            else if (isHovered && hasBands) fill = "#ff4e00";
            else if (isHovered && !hasBands) fill = "#222222";
            else if (hasBands) {
              const ratio = maxCount > 0 ? count / maxCount : 0;
              // 使用更暗的范围：最低值比 #3a1510 略暗，最高值为 #8a2e00（远暗于 #ff4e00）
              fill = interpolateColor("#2c100b", "#8a2e00", ratio);
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
