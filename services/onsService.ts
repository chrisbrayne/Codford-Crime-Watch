import { GeoResponse, GeoFeature } from '../types';

// ONS Code for Codford
const CODFORD_ONS_CODE = 'E04011682';

interface EndpointConfig {
  year: string;
  url: string;
  fields: {
    name: string;
    code: string;
  };
}

// Extensive list of potential endpoints to try. 
// ONS frequently moves services or changes layer IDs.
// We prioritize recent years and try both FeatureServer and MapServer variants.
const ENDPOINTS: EndpointConfig[] = [
  // 2024 May (Newest potential)
  {
    year: '2024-MAY-BGC',
    url: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Parishes_May_2024_Boundaries_EW_BGC/FeatureServer/0/query",
    fields: { name: 'PAR24NM', code: 'PAR24CD' }
  },
  // 2023 December - Standard FeatureServer
  {
    year: '2023-BGC',
    url: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Parishes_December_2023_Boundaries_EW_BGC/FeatureServer/0/query",
    fields: { name: 'PAR23NM', code: 'PAR23CD' }
  },
  // 2023 December - MapServer (Often more reliable for read-only)
  {
    year: '2023-BGC-Map',
    url: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Parishes_December_2023_Boundaries_EW_BGC/MapServer/0/query",
    fields: { name: 'PAR23NM', code: 'PAR23CD' }
  },
  // 2023 Full Clipped (More detailed, use if BGC fails)
  {
    year: '2023-BFC',
    url: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Parishes_December_2023_Boundaries_EW_BFC/FeatureServer/0/query",
    fields: { name: 'PAR23NM', code: 'PAR23CD' }
  },
  // 2022 December
  {
    year: '2022-BGC',
    url: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Parishes_December_2022_Boundaries_EW_BGC/FeatureServer/0/query",
    fields: { name: 'PAR22NM', code: 'PAR22CD' }
  },
  // 2021 December (Archive)
  {
    year: '2021-BGC',
    url: "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Parishes_December_2021_Boundaries_EW_BGC/FeatureServer/0/query",
    fields: { name: 'PAR21NM', code: 'PAR21CD' }
  }
];

// Fallback boundary (approximate bounding box for Codford)
const FALLBACK_BOUNDARY: GeoFeature = {
  type: "Feature",
  properties: { 
    PAR23NM: "Codford (Offline Fallback)", 
    PAR23CD: CODFORD_ONS_CODE 
  },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-2.085, 51.135],
      [-2.025, 51.135],
      [-2.025, 51.185],
      [-2.085, 51.185],
      [-2.085, 51.135]
    ]]
  }
};

const executeQuery = async (url: string, whereClause: string): Promise<GeoFeature | null> => {
    const params = new URLSearchParams({
        where: whereClause,
        outFields: '*', // Request all fields to ensure we get the geometry
        outSR: '4326', // Request WGS84
        f: 'geojson',
        returnGeometry: 'true'
    });

    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json, application/geo+json'
            }
        });

        if (!response.ok) {
            return null;
        }

        const data: any = await response.json();

        // Check for ArcGIS error response even with 200 OK
        if (data.error) {
            console.warn(`ONS API returned application error: ${data.error.message || data.error.code}`);
            return null;
        }

        if (data.features && data.features.length > 0) {
            return data.features[0] as GeoFeature;
        }
    } catch (error) {
        // Silent catch for individual endpoint failures to avoid console spam
    }
    return null;
};

export const fetchCodfordBoundary = async (): Promise<GeoFeature> => {
  console.log("Starting ONS Boundary Search...");

  for (const endpoint of ENDPOINTS) {
    // Strategy 1: Search by ONS Code (Most Precise)
    let feature = await executeQuery(endpoint.url, `${endpoint.fields.code} = '${CODFORD_ONS_CODE}'`);
    
    if (feature) {
      console.log(`Found boundary in ${endpoint.year} using Code.`);
      return feature;
    }

    // Strategy 2: Search by Name (Backup if codes changed)
    // We strictly use 'Codford' to avoid matching 'Codford St Peter' separately if merged
    feature = await executeQuery(endpoint.url, `${endpoint.fields.name} = 'Codford'`);
    
    if (feature) {
      console.log(`Found boundary in ${endpoint.year} using Name.`);
      return feature;
    }
  }

  console.error("All ONS API endpoints failed. Using fallback boundary.");
  return FALLBACK_BOUNDARY;
};