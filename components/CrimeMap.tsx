import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { GeoFeature, Crime } from '../types';

interface CrimeMapProps {
  boundary: GeoFeature;
  crimes: Crime[];
}

const CrimeMap: React.FC<CrimeMapProps> = ({ boundary, crimes }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Initialize Map (Run Once)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
        zoomControl: false // We can add this back or move it if needed
    });

    // Add Zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
  }, []);

  // Update Data Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !boundary) return;

    // Clear existing overlay layers (GeoJSON and Markers)
    // We iterate backwards or check types to avoid removing tiles
    map.eachLayer((layer) => {
        if (layer instanceof L.GeoJSON || layer instanceof L.CircleMarker) {
            map.removeLayer(layer);
        }
    });

    // 1. Render Boundary
    const boundaryLayer = L.geoJSON(boundary as any, {
      style: {
        color: '#1e40af', // Blue-800
        weight: 2,
        opacity: 1,
        fillColor: '#3b82f6', // Blue-500
        fillOpacity: 0.15,
      }
    });
    
    boundaryLayer.addTo(map);

    // Fit map to boundary with some padding
    if (boundaryLayer.getBounds().isValid()) {
        map.fitBounds(boundaryLayer.getBounds(), { padding: [20, 20] });
    }

    // 2. Render Crime Markers
    crimes.forEach((crime) => {
      const lat = parseFloat(crime.location.latitude);
      const lng = parseFloat(crime.location.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        L.circleMarker([lat, lng], {
          radius: 6,
          fillColor: "#ef4444", // Red-500
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        })
        .bindTooltip(`
          <div class="font-sans text-xs">
            <strong class="block mb-1 text-slate-800">${crime.category.replace(/-/g, ' ')}</strong>
            <span class="text-slate-600">${crime.location.street.name}</span><br/>
            <em class="text-slate-500">${crime.outcome_status?.category || 'Status unavailable'}</em>
          </div>
        `, { direction: 'top', offset: [0, -5] })
        .addTo(map);
      }
    });

    // Fix for potential rendering glitches on resize
    setTimeout(() => map.invalidateSize(), 200);

  }, [boundary, crimes]);

  return (
    <div className="w-full h-[400px] bg-slate-100 rounded-xl shadow-sm border border-slate-200 overflow-hidden relative z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

export default CrimeMap;