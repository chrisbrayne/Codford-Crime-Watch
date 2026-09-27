import { Crime, CrimeSummary } from '../types';

export interface CrimeReportResponse {
  report: string;
  source: 'gemini-3.8-flash' | 'cache' | 'statistical_fallback' | 'statistical_fallback_quota' | 'statistical_fallback_error';
  isQuotaExhausted?: boolean;
  message?: string;
  warning?: string;
}

export interface RiskAssessmentResponse {
  assessment: string;
  source: string;
  isQuotaExhausted?: boolean;
  message?: string;
}

export interface DiagnosticsResponse {
  status: string;
  geminiKeyConfigured: boolean;
  keySource: string;
  cachedMonths: string[];
  cachedRiskAssessments?: string[];
  modelInUse: string;
}

export const fetchDiagnostics = async (): Promise<DiagnosticsResponse | null> => {
  try {
    const res = await fetch('/api/diagnostics');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
};

export const clearReportCache = async (date?: string): Promise<boolean> => {
  try {
    const res = await fetch('/api/clear-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
};

export const generateCrimeReport = async (
  date: string,
  summary: CrimeSummary,
  crimes: Crime[],
  forceRefresh = false
): Promise<CrimeReportResponse> => {
  try {
    const response = await fetch('/api/crime-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date,
        summary,
        crimes,
        forceRefresh,
      }),
    });

    const data = await response.json();

    if (response.status === 429) {
      return {
        report: data.report || 'Token limit reached. Please view the statistical breakdown above.',
        source: 'statistical_fallback_quota',
        isQuotaExhausted: true,
        message: data.message || 'Gemini API tokens or rate limit per minute reached.',
      };
    }

    if (!response.ok) {
      return {
        report: data.report || 'Unable to generate analysis. Review the statistics and crime log below.',
        source: 'statistical_fallback_error',
        message: data.message || `Server returned status ${response.status}`,
      };
    }

    return {
      report: data.report || 'No analysis available.',
      source: data.source || 'gemini-3.8-flash',
      warning: data.warning,
    };
  } catch (error: any) {
    console.error('Failed to communicate with report API:', error);
    
    // Client-side emergency fallback if server call is unreachable
    const topCategory = summary.mostFrequentCategory || 'None';
    return {
      report: `### ${summary.total} Incidents Recorded in ${date}\n\n**Executive Summary:** Official Wiltshire Police records log **${summary.total}** incidents for Codford Parish. Primary category: **${topCategory}**.\n\n*(Note: Generated via Local Offline Statistical Summary)*`,
      source: 'statistical_fallback_error',
      message: error.message || 'Network error while contacting report server',
    };
  }
};

export const generateRiskAssessment = async (
  date: string,
  summary: CrimeSummary,
  forceRefresh = false
): Promise<RiskAssessmentResponse> => {
  try {
    const response = await fetch('/api/risk-assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date,
        summary,
        forceRefresh,
      }),
    });

    const data = await response.json();

    if (response.status === 429) {
      return {
        assessment: data.assessment || "Evening All,\n\nCodford continues to maintain a very low crime profile compared to county and national benchmarks.\n\nDon't have nightmares!",
        source: 'statistical_fallback_quota',
        isQuotaExhausted: true,
        message: data.message,
      };
    }

    if (!response.ok) {
      return {
        assessment: data.assessment || "Evening All,\n\nCodford remains an exceptionally low-risk rural parish compared to county and national averages.\n\nDon't have nightmares!",
        source: 'statistical_fallback_error',
        message: data.message,
      };
    }

    return {
      assessment: data.assessment,
      source: data.source || 'gemini-3.8-flash',
    };
  } catch (error: any) {
    console.error('Failed to communicate with risk assessment API:', error);
    return {
      assessment: `Evening All,\n\nOfficial records log ${summary.total} incident(s) for Codford in this reporting month. Wiltshire remains one of England's safest counties (~56/1,000 per year) and sits far below the national average (~89/1,000). Everyday crime risk in our parish is very low.\n\nDon't have nightmares!`,
      source: 'statistical_fallback_error',
      message: error?.message,
    };
  }
};
