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

const formatMonth = (dateStr: string): string => {
  if (!dateStr) return '-';
  if (dateStr.includes(' to ')) {
    const [start, end] = dateStr.split(' to ');
    const fmt = (s: string) => {
      const [year, month] = s.split('-').map(Number);
      return new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    };
    return `${fmt(start)} to ${fmt(end)}`;
  }
  const [year, month] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const buildClientFallbackReport = (
  date: string,
  summary: CrimeSummary,
  crimes: Crime[]
): string => {
  const formattedDate = formatMonth(date);
  const total = summary.total;
  const topCategory = summary.mostFrequentCategory || 'None';

  const streetCounts: Record<string, number> = {};
  (crimes || []).forEach((c) => {
    const street = (c.location?.street?.name || 'Unknown Location').replace('On or near ', '');
    streetCounts[street] = (streetCounts[street] || 0) + 1;
  });

  const topStreets = Object.entries(streetCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `- **${name}**: ${count} ${count === 1 ? 'incident' : 'incidents'}`);

  let advice = 'Remain vigilant and report any suspicious activity immediately to Wiltshire Police via 101 (or 999 in emergencies).';
  const lowerCat = topCategory.toLowerCase();
  if (lowerCat.includes('anti-social') || lowerCat.includes('public order')) {
    advice = 'Report persistent disturbances or antisocial behaviour to Wiltshire Police via 101 or the local community policing team to help target evening patrols.';
  } else if (lowerCat.includes('burglary') || lowerCat.includes('theft') || lowerCat.includes('vehicle')) {
    advice = 'Ensure all outbuildings, sheds, and vehicles remain securely locked, and consider motion sensor lighting or CCTV coverage on driveways.';
  } else if (lowerCat.includes('violence') || lowerCat.includes('sexual')) {
    advice = 'If you witness or experience threats or assault, seek safety immediately and call 999. Support is also available through local Wiltshire victim support services.';
  } else if (total === 0) {
    advice = 'No crimes were officially logged by Wiltshire Police in Codford Parish for this reporting period. Continue good community vigilance.';
  }

  const categoryLines = summary.byCategory.length > 0
    ? summary.byCategory.map(c => `- **${c.name}**: ${c.value} incident${c.value === 1 ? '' : 's'}`).join('\n')
    : '- No incidents recorded.';

  const streetLines = topStreets.length > 0
    ? topStreets.join('\n')
    : '- No specific street cluster identified.';

  return `### ${total} Incident${total === 1 ? '' : 's'} Reported in ${formattedDate}

**Executive Summary:** Official Wiltshire Police records log **${total}** total incident${total === 1 ? '' : 's'} in Codford Parish for ${formattedDate}. The primary incident type was **${topCategory}**.

#### Recorded Incident Categories:
${categoryLines}

#### Notable Locations / Hotspots:
${streetLines}

#### Community Safety Advice:
${advice}

*(Note: Parish Statistical Analysis fallback mode active.)*`;
};

const buildClientFallbackAssessment = (
  date: string,
  summary: CrimeSummary
): string => {
  const formattedDate = formatMonth(date);
  const total = summary.total;
  const topCat = summary.mostFrequentCategory || 'minor incident';

  return `Evening All,

Taking a steady look at the numbers for ${formattedDate}, Codford recorded ${total} incident${total === 1 ? '' : 's'} (${topCat.toLowerCase()}). While any incident in our village is naturally noticeable, putting these numbers into true perspective gives a reassuring picture.

Wiltshire consistently remains one of the safest police force areas anywhere in England and Wales, with an annual rate of around 56 incidents per 1,000 residents compared to the national average of approximately 89 per 1,000. In a small rural parish of about 700 people like Codford, one or two incidents can create statistical blips on paper, but they do not signify an escalation in everyday community risk. 

Our actual day-to-day risk level remains very low. Staying neighbourly, keeping outbuildings and vehicles secured, and reporting any suspicious activity ensures Codford continues to be the peaceful Wylye Valley haven we all appreciate.

Don't have nightmares!`;
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
        report: data.report || buildClientFallbackReport(date, summary, crimes),
        source: 'statistical_fallback_quota',
        isQuotaExhausted: true,
        message: data.message || 'Gemini API tokens or rate limit per minute reached.',
      };
    }

    if (!response.ok) {
      return {
        report: data.report || buildClientFallbackReport(date, summary, crimes),
        source: 'statistical_fallback_error',
        message: data.message || `Server returned status ${response.status}`,
      };
    }

    return {
      report: data.report || buildClientFallbackReport(date, summary, crimes),
      source: data.source || 'gemini-3.8-flash',
      warning: data.warning,
    };
  } catch (error: any) {
    console.error('Failed to communicate with report API:', error);
    return {
      report: buildClientFallbackReport(date, summary, crimes),
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
        assessment: data.assessment || buildClientFallbackAssessment(date, summary),
        source: 'statistical_fallback_quota',
        isQuotaExhausted: true,
        message: data.message || 'Rate limit reached. Displaying baseline risk benchmark.',
      };
    }

    if (!response.ok) {
      return {
        assessment: data.assessment || buildClientFallbackAssessment(date, summary),
        source: 'statistical_fallback_error',
        message: data.message || `Server returned status ${response.status}`,
      };
    }

    return {
      assessment: data.assessment || buildClientFallbackAssessment(date, summary),
      source: data.source || 'gemini-3.8-flash',
    };
  } catch (error: any) {
    console.error('Failed to communicate with risk assessment API:', error);
    return {
      assessment: buildClientFallbackAssessment(date, summary),
      source: 'statistical_fallback_error',
      message: error.message || 'Network error contacting assessment server',
    };
  }
};
