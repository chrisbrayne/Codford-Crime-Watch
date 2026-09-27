import { GoogleGenAI } from '@google/genai';

interface CrimeSummaryItem {
  name: string;
  value: number;
}

interface CrimeSummary {
  total: number;
  byCategory: CrimeSummaryItem[];
  mostFrequentCategory: string;
}

const formatMonth = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [year, month] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const generateStatisticalFallback = (
  date: string,
  summary: CrimeSummary,
  topStreets: string[]
): string => {
  const formattedDate = formatMonth(date);
  const total = summary.total;
  const topCategory = summary.mostFrequentCategory || 'None';

  let advice = 'Remain vigilant and report any suspicious activity immediately to Wiltshire Police via 101 or 999 in emergencies.';
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
    : '- No specific street hotspots identified.';

  return `### ${total} Incident${total === 1 ? '' : 's'} Reported in ${formattedDate}

**Executive Summary:** During ${formattedDate}, official Wiltshire Police data recorded **${total}** total incident${total === 1 ? '' : 's'} within the Civil Parish of Codford. The predominant incident category was **${topCategory}**.

#### Recorded Incident Categories:
${categoryLines}

#### Notable Locations / Hotspots:
${streetLines}

#### Community Safety Advice:
${advice}

*(Note: Generated via Parish Statistical Analysis fallback mode.)*`;
};

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { date, summary, crimes } = JSON.parse(event.body || '{}');

    if (!date || !summary) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing date or summary in request payload' }),
      };
    }

    const streetCounts: Record<string, number> = {};
    if (Array.isArray(crimes)) {
      crimes.forEach((c) => {
        const street = (c.location?.street?.name || 'Unknown Location').replace('On or near ', '');
        streetCounts[street] = (streetCounts[street] || 0) + 1;
      });
    }

    const topStreets = Object.entries(streetCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `- **${name}**: ${count} ${count === 1 ? 'incident' : 'incidents'}`);

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      const fallback = generateStatisticalFallback(date, summary, topStreets);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: fallback,
          source: 'statistical_fallback',
          warning: 'API Key not configured in Netlify environment variables.',
        }),
      };
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          Referer: event.headers?.referer || 'https://codfordcrimewatch.netlify.app/',
        },
      },
    });
    const formattedDate = formatMonth(date);
    const incidentList = (crimes || []).slice(0, 50).map((c: any) => 
      `* ${c.category.replace(/-/g, ' ')} at ${c.location?.street?.name || 'Codford'}`
    ).join('\n');

    const prompt = `
You are a data reporting assistant for the Civil Parish of Codford, Wiltshire, UK.

TASK: Write a concise, factual monthly crime activity report based EXCLUSIVELY on the provided dataset.

*** CRITICAL RULES ***
1. You MUST use the "Official Total Incidents" count: ${summary.total}.
2. If "Official Total Incidents" is > 0, you MUST NOT claim "zero crimes" or "no crime".
3. Provide realistic, measured rural community safety context for Codford Parish.

--- PARISH DATASET ---
Report Month: ${formattedDate}
Official Total Incidents: ${summary.total}
Most Frequent Category: ${summary.mostFrequentCategory}

Category Breakdown:
${summary.byCategory.map((c: any) => `- ${c.name}: ${c.value}`).join('\n')}

Top Locations (Hotspots):
${topStreets.length > 0 ? topStreets.join('\n') : 'No specific street cluster identified.'}

Incident Details (Sample):
${incidentList || 'None recorded'}

--- FORMAT ---
1. **Headline**: 3-6 words summarizing the activity.
2. **Executive Summary**: State the total (${summary.total}) and the top incident type.
3. **Location Analysis**: Mention top streets if applicable.
4. **Parish Safety Advice**: One brief, practical community advice tip relevant to the top category.

Tone: Professional, Objective, Local Council / Parish Watch style.
Output: Clean Markdown.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { temperature: 0.2 },
    });

    const reportText = response.text || generateStatisticalFallback(date, summary, topStreets);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: reportText,
        source: 'gemini-3.8-flash',
      }),
    };
  } catch (error: any) {
    console.error('Netlify function error in crime-report:', error);
    const { date, summary, crimes } = JSON.parse(event.body || '{}');
    const streetCounts: Record<string, number> = {};
    if (Array.isArray(crimes)) {
      crimes.forEach((c) => {
        const street = (c.location?.street?.name || 'Unknown Location').replace('On or near ', '');
        streetCounts[street] = (streetCounts[street] || 0) + 1;
      });
    }
    const topStreets = Object.entries(streetCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `- **${name}**: ${count} ${count === 1 ? 'incident' : 'incidents'}`);

    const fallback = generateStatisticalFallback(date || '', summary || { total: 0, byCategory: [], mostFrequentCategory: 'None' }, topStreets);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: fallback,
        source: 'statistical_fallback',
        warning: `AI generation notice: ${error.message || 'Falling back to parish statistical report.'}`,
      }),
    };
  }
};
