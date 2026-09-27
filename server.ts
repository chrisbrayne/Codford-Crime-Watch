import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
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

interface IncidentItem {
  category: string;
  location: {
    street: {
      name: string;
    };
  };
}

const formatMonth = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [year, month] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

// Generates a deterministic statistical report when tokens are exhausted or offline
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

// Generates reassuring risk assessment fallback starting with "Evening All" and ending with "Don't have nightmares!"
const generateRiskAssessmentFallback = (
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // Cache previously generated monthly reports and risk assessments to prevent token depletion
  const reportCache = new Map<string, string>();
  const riskAssessmentCache = new Map<string, string>();

  // Initialize server-side Gemini client
  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) return null;

    try {
      return new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (err) {
      console.error('Failed to instantiate GoogleGenAI client:', err);
      return null;
    }
  };

  // Health and Token Diagnostics endpoint
  app.get('/api/diagnostics', (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    res.json({
      status: 'online',
      geminiKeyConfigured: !!apiKey,
      keySource: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : process.env.API_KEY ? 'API_KEY' : 'NONE',
      cachedMonths: Array.from(reportCache.keys()),
      cachedRiskAssessments: Array.from(riskAssessmentCache.keys()),
      modelInUse: 'gemini-3.8-flash',
    });
  });

  // Clear report cache endpoint if user requests fresh generation
  app.post('/api/clear-cache', (req, res) => {
    const { date } = req.body;
    if (date) {
      reportCache.delete(date);
      riskAssessmentCache.delete(date);
    } else {
      reportCache.clear();
      riskAssessmentCache.clear();
    }
    res.json({ success: true, message: 'Cache cleared' });
  });

  // Main Report Generation endpoint
  app.post('/api/crime-report', async (req, res) => {
    const { date, summary, crimes, forceRefresh } = req.body as {
      date: string;
      summary: CrimeSummary;
      crimes: IncidentItem[];
      forceRefresh?: boolean;
    };

    if (!date || !summary) {
      return res.status(400).json({ error: 'Missing date or summary in request payload' });
    }

    // 1. Check in-memory cache to save token usage
    if (!forceRefresh && reportCache.has(date)) {
      return res.json({
        report: reportCache.get(date),
        source: 'cache',
      });
    }

    // Prepare location hotspots
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

    const client = getAiClient();

    // If no API key configured, return clean statistical fallback
    if (!client) {
      const fallback = generateStatisticalFallback(date, summary, topStreets);
      reportCache.set(date, fallback);
      return res.json({
        report: fallback,
        source: 'statistical_fallback',
        warning: 'Gemini API key is not configured. Statistical summary generated from parish records.',
      });
    }

    const formattedDate = formatMonth(date);
    const incidentList = (crimes || []).slice(0, 50).map(c => 
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
${summary.byCategory.map(c => `- ${c.name}: ${c.value}`).join('\n')}

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

    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });

      const reportText = response.text || generateStatisticalFallback(date, summary, topStreets);
      reportCache.set(date, reportText);

      return res.json({
        report: reportText,
        source: 'gemini-3.8-flash',
      });
    } catch (error: any) {
      console.error('Gemini API Error in /api/crime-report:', error);

      const errString = JSON.stringify(error, Object.getOwnPropertyNames(error)) + ' ' + (error?.message || '');
      const isQuotaError = 
        errString.includes('429') ||
        errString.includes('RESOURCE_EXHAUSTED') ||
        errString.includes('Quota exceeded') ||
        errString.includes('tokens per minute') ||
        errString.includes('tokens per day') ||
        errString.includes('rate limit');

      const fallbackReport = generateStatisticalFallback(date, summary, topStreets);

      if (isQuotaError) {
        return res.status(429).json({
          error: 'QUOTA_EXHAUSTED',
          message: 'The Gemini API token limit or rate quota has been reached.',
          details: error.message || '429 Quota Exceeded',
          report: fallbackReport,
          source: 'statistical_fallback_quota',
        });
      }

      return res.status(500).json({
        error: 'GENERATION_FAILED',
        message: error.message || 'Gemini report generation failed',
        report: fallbackReport,
        source: 'statistical_fallback_error',
      });
    }
  });

  // Dedicated Risk Assessment & National/County Benchmark Endpoint
  app.post('/api/risk-assessment', async (req, res) => {
    const { date, summary, forceRefresh } = req.body as {
      date: string;
      summary: CrimeSummary;
      forceRefresh?: boolean;
    };

    if (!date || !summary) {
      return res.status(400).json({ error: 'Missing date or summary in request payload' });
    }

    // 1. Check in-memory cache to save tokens
    if (!forceRefresh && riskAssessmentCache.has(date)) {
      return res.json({
        assessment: riskAssessmentCache.get(date),
        source: 'cache',
      });
    }

    const client = getAiClient();
    if (!client) {
      const fallback = generateRiskAssessmentFallback(date, summary);
      riskAssessmentCache.set(date, fallback);
      return res.json({
        assessment: fallback,
        source: 'statistical_fallback',
      });
    }

    const formattedDate = formatMonth(date);
    const prompt = `
You are a calm, experienced community safety advisor assessing crime in the rural Civil Parish of Codford, Wiltshire, UK.

BENCHMARKS & CONTEXT:
- Codford Parish Population: approx 700 residents (Wylye Valley rural community).
- Wiltshire County Average: ~56 crimes per 1,000 residents per year (~4.7 per month per 1,000). Wiltshire consistently ranks among the top 5 safest police force areas in England and Wales.
- England & Wales National Average: ~89 crimes per 1,000 residents per year (~7.4 per month per 1,000).
- Codford Recorded Data for ${formattedDate}: Total of ${summary.total} incidents recorded by Wiltshire Police. Top category: ${summary.mostFrequentCategory}. Breakdown: ${summary.byCategory.map(c => `${c.name} (${c.value})`).join(', ') || 'None'}.

TASK:
Provide a reasoned, objective, and reassuring assessment of the actual local crime risk level for Codford residents compared to Wiltshire county and national averages.
Explain how small population numbers can make even 1 or 2 minor incidents appear magnified in percentage terms, but confirm that Codford remains a genuinely low-crime, peaceful rural setting.

CRITICAL FORMAT RULES (STRICT COMPLIANCE REQUIRED):
1. The response MUST BEGIN with the exact words: "Evening All" (a nod to PC George Dixon in Dixon of Dock Green).
2. The response MUST END with the exact words: "Don't have nightmares!" (the classic Nick Ross catchphrase from BBC Crimewatch).
3. Keep the tone warm, grounded, reassuring, and articulate (2 to 3 paragraphs).
`;

    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
        },
      });

      let text = (response.text || '').trim();

      // Enforce the required catchphrases if the model omitted or altered them slightly
      if (!text.toLowerCase().startsWith('evening all')) {
        text = `Evening All,\n\n${text}`;
      }
      if (!text.toLowerCase().endsWith("don't have nightmares!")) {
        text = `${text}\n\nDon't have nightmares!`;
      }

      riskAssessmentCache.set(date, text);

      return res.json({
        assessment: text,
        source: 'gemini-3.8-flash',
      });
    } catch (error: any) {
      console.error('Gemini API Error in /api/risk-assessment:', error);
      const fallback = generateRiskAssessmentFallback(date, summary);

      const errString = JSON.stringify(error, Object.getOwnPropertyNames(error)) + ' ' + (error?.message || '');
      const isQuotaError = 
        errString.includes('429') ||
        errString.includes('RESOURCE_EXHAUSTED') ||
        errString.includes('Quota exceeded');

      if (isQuotaError) {
        return res.status(429).json({
          error: 'QUOTA_EXHAUSTED',
          message: 'The Gemini API token limit or rate quota has been reached.',
          assessment: fallback,
          source: 'statistical_fallback_quota',
        });
      }

      return res.status(500).json({
        error: 'ASSESSMENT_FAILED',
        assessment: fallback,
        source: 'statistical_fallback_error',
      });
    }
  });

  // Mount Vite middleware in development or static serve in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Codford Crime Watch server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
