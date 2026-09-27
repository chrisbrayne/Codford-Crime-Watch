import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { GeoFeature, Crime } from '../types';

interface CrimeMapProps {
  boundary: GeoFeature;
  crimes: Crime[];
  hoveredCrimeId: number | null;
}

const CrimeMap: React.FC<CrimeMapProps> = ({ boundary, crimes, hoveredCrimeId }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  // Use a FeatureGroup to hold all data layers. This allows us to clear specific content
  // without risking the removal of the base tile layer.
  const dataLayerRef = useRef<L.FeatureGroup | null>(null);
  const markersRef = useRef<{ [id: number]: L.CircleMarker }>({});

  // Initialize Map (Run Once)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
        zoomControl: false 
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Create a feature group for our data and add it to the map
    const dataLayer = new L.FeatureGroup();
    dataLayer.addTo(map);
    
    mapInstanceRef.current = map;
    dataLayerRef.current = dataLayer;

    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
            dataLayerRef.current = null;
        }
    };
  }, []);

  // Update Data Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const dataLayer = dataLayerRef.current;
    if (!map || !dataLayer || !boundary) return;

    // Clear only our specific data layers, leaving the tile map intact
    dataLayer.clearLayers();
    markersRef.current = {};

    // 1. Render Boundary
    const boundaryLayer = L.geoJSON(boundary as any, {
      style: {
        color: '#1e40af', // Blue-800
        weight: 2,
        opacity: 1,
        fillColor: '#3b82f6', // Blue-500
        fillOpacity: 0.1,
      }
    });
    
    boundaryLayer.addTo(dataLayer);

    if (boundaryLayer.getBounds().isValid()) {
        map.fitBounds(boundaryLayer.getBounds(), { padding: [20, 20] });
    }

    // 2. Render Crime Markers
    crimes.forEach((crime) => {
      const lat = parseFloat(crime.location.latitude);
      const lng = parseFloat(crime.location.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        const marker = L.circleMarker([lat, lng], {
          radius: 6,
          fillColor: "#ef4444", // Red-500
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        });

        marker.bindTooltip(`
          <div class="font-sans text-xs">
            <strong class="block mb-1 text-slate-800">${crime.category.replace(/-/g, ' ')}</strong>
            <span class="text-slate-600">${crime.location.street.name}</span><br/>
            <em class="text-slate-500">${crime.outcome_status?.category || 'Status unavailable'}</em>
          </div>
        `, { direction: 'top', offset: [0, -5] });
        
        marker.addTo(dataLayer);
        markersRef.current[crime.id] = marker;
      }
    });

  }, [boundary, crimes]);

  // Handle Highlighting efficiently without rebuilding map
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const marker = m as L.CircleMarker;
      const isHovered = parseInt(id) === hoveredCrimeId;
      
      if (isHovered) {
        marker.setStyle({
          fillColor: '#fbbf24', // Amber-400
          color: '#000',
          weight: 3,
          radius: 9,
          fillOpacity: 1
        });
        marker.bringToFront();
        marker.openTooltip();
      } else {
        marker.setStyle({
          fillColor: '#ef4444', // Red-500
          color: '#ffffff',
          weight: 2,
          radius: 6,
          fillOpacity: 0.9
        });
        marker.closeTooltip();
      }
    });
  }, [hoveredCrimeId]);

  return (
    <div className="w-full h-[400px] bg-slate-100 rounded-xl shadow-sm border border-slate-200 overflow-hidden relative z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

export default CrimeMap;