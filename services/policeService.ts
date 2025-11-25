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
  // Police API allows POST but frequently errors (500) if > 100 points.
  // We reduce strictly to ~45 points to ensure high reliability.
  const MAX_POINTS = 45; 
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

export const fetchAvailableDates = async (): Promise<string[]> => {
    try {
        const response = await fetch(`${POLICE_API_BASE}/crimes-street-dates`);
        if (!response.ok) throw new Error("Failed to fetch dates");
        const data = await response.json();
        
        // API returns [{ date: '2024-05' }, { date: '2024-04' } ...]
        if (Array.isArray(data) && data.length > 0) {
            return data.map((d: any) => d.date); 
        }
        
        // Fallback if array is empty
        return generateFallbackDates();
    } catch (e) {
        console.warn("Error fetching available dates, defaulting to fallback list", e);
        return generateFallbackDates();
    }
}

// Helper to generate last 12 months as fallback
const generateFallbackDates = (): string[] => {
    const dates: string[] = [];
    const d = new Date();
    // Start 2 months ago
    d.setMonth(d.getMonth() - 2);
    
    for (let i = 0; i < 12; i++) {
        dates.push(d.toISOString().slice(0, 7));
        d.setMonth(d.getMonth() - 1);
    }
    return dates;
};

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
      // Try to get error text, but don't fail if we can't
      let errorDetails = `Status ${response.status}`;
      try {
          const text = await response.text();
          // API sometimes returns HTML for 500s, clip it
          if (text) errorDetails = text.slice(0, 200); 
      } catch (e) { /* ignore text parse error */ }
      
      throw new Error(`Police API Error: ${errorDetails}`);
    }

    const crimes: Crime[] = await response.json();
    return crimes;
  } catch (error) {
    console.error("Failed to fetch crimes:", error);
    throw error;
  }
};