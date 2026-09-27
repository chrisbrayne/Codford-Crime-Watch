import { Crime, GeoFeature } from '../types';

const POLICE_API_BASE = "https://data.police.uk/api";

// Helper to convert GeoJSON Polygon to Police API format (lat,lng:lat,lng)
const convertGeoJSONToPolyString = (feature: GeoFeature): string => {
  let coords: number[][] = [];

  // Safety check: Ensure geometry and coordinates exist
  if (!feature.geometry || !feature.geometry.coordinates) {
    console.warn("Invalid geometry object provided to converter");
    return "";
  }

  if (feature.geometry.type === 'Polygon') {
    coords = (feature.geometry.coordinates as number[][][])[0];
  } else if (feature.geometry.type === 'MultiPolygon') {
     // Take the largest polygon (usually the first in simple GeoJSON, but we assume [0][0])
    coords = (feature.geometry.coordinates as number[][][][])[0][0];
  }

  if (!coords || coords.length === 0) return "";

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
            // Sort Descending just in case API order changes
            return data
                .map((d: any) => d.date)
                .sort((a: string, b: string) => b.localeCompare(a));
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

export const getMonthsBetween = (startDate: string, endDate: string, availableDates?: string[]): string[] => {
  if (!startDate || !endDate) return startDate ? [startDate] : endDate ? [endDate] : [];
  const [minDate, maxDate] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  
  if (availableDates && availableDates.length > 0) {
    const filtered = availableDates
      .filter(d => d >= minDate && d <= maxDate)
      .sort((a, b) => b.localeCompare(a));
    if (filtered.length > 0) return filtered;
  }
  
  const months: string[] = [];
  const [startYear, startMonth] = minDate.split('-').map(Number);
  const [endYear, endMonth] = maxDate.split('-').map(Number);
  
  let current = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth - 1, 1);
  
  while (current <= end) {
    months.push(current.toISOString().slice(0, 7));
    current.setMonth(current.getMonth() + 1);
  }
  
  return months.sort((a, b) => b.localeCompare(a));
};

export const fetchCrimesInDateRange = async (
  boundary: GeoFeature,
  months: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<Crime[]> => {
  if (months.length === 0) return [];
  if (months.length === 1) return fetchCrimesInBoundary(boundary, months[0]);

  let loaded = 0;
  const results = await Promise.all(
    months.map(async (month) => {
      try {
        const monthCrimes = await fetchCrimesInBoundary(boundary, month);
        loaded += 1;
        onProgress?.(loaded, months.length);
        return monthCrimes;
      } catch (err) {
        console.warn(`Failed to fetch crimes for month ${month}:`, err);
        loaded += 1;
        onProgress?.(loaded, months.length);
        return [] as Crime[];
      }
    })
  );

  const seenIds = new Set<number>();
  const combined: Crime[] = [];

  for (const monthList of results) {
    for (const crime of monthList) {
      if (!seenIds.has(crime.id)) {
        seenIds.add(crime.id);
        combined.push(crime);
      }
    }
  }

  return combined.sort((a, b) => b.month.localeCompare(a.month));
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