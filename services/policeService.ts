import { Crime, GeoFeature } from '../types';

const POLICE_API_BASE = "https://data.police.uk/api";

// Helper to convert GeoJSON Polygon to Police API format (lat,lng:lat,lng)
const convertGeoJSONToPolyString = (feature: GeoFeature): string => {
  let coords: number[][] = [];

  if (feature.geometry.type === 'Polygon') {
    coords = (feature.geometry.coordinates as number[][][])[0];
  } else if (feature.geometry.type === 'MultiPolygon') {
     // Take the largest polygon (usually the first in simple GeoJSON, but we assume [0][0])
    coords = (feature.geometry.coordinates as number[][][][])[0][0];
  }

  // Algorithm: Simple stride reduction to keep point count manageable
  // Police API can handle ~150-200 points reliably via POST.
  const MAX_POINTS = 150; 
  if (coords.length > MAX_POINTS) {
      const step = Math.ceil(coords.length / MAX_POINTS);
      coords = coords.filter((_, i) => i % step === 0);
  }

  // Ensure closure
  if (coords.length > 0) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
          coords.push(first);
      }
  }

  // Format: "lat,lng:lat,lng"
  // Important: Limit decimal places to 5 (approx 1 meter precision) to reduce string length
  return coords
    .map(coord => `${Number(coord[1]).toFixed(5)},${Number(coord[0]).toFixed(5)}`)
    .join(':');
};

export const fetchLatestAvailableDate = async (): Promise<string> => {
    try {
        const response = await fetch(`${POLICE_API_BASE}/crimes-street-dates`);
        if (!response.ok) throw new Error("Failed to fetch dates");
        const dates = await response.json();
        if (dates && dates.length > 0) {
            return dates[0].date; // Returns YYYY-MM
        }
        
        // Fallback if array is empty
        const d = new Date();
        d.setMonth(d.getMonth() - 2);
        return d.toISOString().slice(0, 7); 
    } catch (e) {
        console.warn("Error fetching available dates, defaulting to 2 months ago", e);
        // Fallback to 2 months ago (Police data is typically 2 months behind)
        // e.g., if it is May, latest data is usually March.
        const d = new Date();
        d.setMonth(d.getMonth() - 2);
        return d.toISOString().slice(0, 7);
    }
}

export const fetchCrimesInBoundary = async (boundary: GeoFeature, date: string): Promise<Crime[]> => {
  const polyString = convertGeoJSONToPolyString(boundary);
  
  if (!polyString) {
      throw new Error("Invalid boundary data: Unable to generate polygon string.");
  }

  const formData = new FormData();
  formData.append('poly', polyString);
  formData.append('date', date);

  try {
    const response = await fetch(`${POLICE_API_BASE}/crimes-street/all-crime`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
      let errorDetails = response.statusText;
      try {
          const text = await response.text();
          if (text) errorDetails = text;
      } catch (e) { /* ignore text parse error */ }
      
      throw new Error(`Police API Error ${response.status}: ${errorDetails}`);
    }

    const crimes: Crime[] = await response.json();
    return crimes;
  } catch (error) {
    console.error("Failed to fetch crimes:", error);
    throw error;
  }
};