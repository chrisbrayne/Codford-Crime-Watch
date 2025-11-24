// Data models for the application

export interface Crime {
  category: string;
  location_type: string;
  location: {
    latitude: string;
    longitude: string;
    street: {
      id: number;
      name: string;
    };
  };
  context: string;
  outcome_status: {
    category: string;
    date: string;
  } | null;
  persistent_id: string;
  id: number;
  location_subtype: string;
  month: string;
}

export interface GeoFeature {
  type: "Feature";
  properties: {
    PAR23NM: string; // Parish Name 2023
    [key: string]: any;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoResponse {
  type: "FeatureCollection";
  features: GeoFeature[];
}

export interface CrimeSummary {
  total: number;
  byCategory: { name: string; value: number }[];
  mostFrequentCategory: string;
}
