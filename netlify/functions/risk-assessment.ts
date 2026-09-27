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

const parseDurationMonths = (dateStr: string): number => {
  if (!dateStr) return 1;
  if (dateStr.includes(' to ')) {
    const [start, end] = dateStr.split(' to ');
    const [sY, sM] = start.split('-').map(Number);
    const [eY, eM] = end.split('-').map(Number);
    if (!isNaN(sY) && !isNaN(sM) && !isNaN(eY) && !isNaN(eM)) {
      return Math.max(1, (eY - sY) * 12 + (eM - sM) + 1);
    }
  }
  return 1;
};

const formatPeriodDisplay = (dateStr: string): string => {
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
  return new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const calculateMetrics = (dateStr: string, summary: CrimeSummary) => {
  const durationMonths = parseDurationMonths(dateStr);
  const total = summary?.total || 0;
  const monthlyAverage = Number((total / durationMonths).toFixed(2));
  const annualizedTotal = Number(((total / durationMonths) * 12).toFixed(1));
  const population = 700;
  const codfordRatePerThousand = Number(((annualizedTotal / population) * 1000).toFixed(1));
  const codfordMonthlyPerThousand = Number(((monthlyAverage / population) * 1000).toFixed(2));

  const wiltshireAnnualRate = 56.2;
  const nationalAnnualRate = 89.3;

  const percentLowerWiltshire = Math.round(((wiltshireAnnualRate - codfordRatePerThousand) / wiltshireAnnualRate) * 100);
  const percentLowerNational = Math.round(((nationalAnnualRate - codfordRatePerThousand) / nationalAnnualRate) * 100);

  let violentCount = 0;
  let propertyCount = 0;
  let asbCount = 0;

  (summary?.byCategory || []).forEach((c) => {
    const n = c.name.toLowerCase();
    if (n.includes('violence') || n.includes('weapon') || n.includes('robbery') || n.includes('public order')) {
      violentCount += c.value;
    } else if (n.includes('burglary') || n.includes('vehicle') || n.includes('theft') || n.includes('damage')) {
      propertyCount += c.value;
    } else if (n.includes('anti-social') || n.includes('antisocial')) {
      asbCount += c.value;
    }
  });

  return {
    durationMonths,
    total,
    monthlyAverage,
    annualizedTotal,
    codfordRatePerThousand,
    codfordMonthlyPerThousand,
    percentLowerWiltshire,
    percentLowerNational,
    violentCount,
    propertyCount,
    asbCount,
  };
};

const generateDynamicRiskAssessment = (
  dateStr: string,
  summary: CrimeSummary,
  seed = 0
): string => {
  const metrics = calculateMetrics(dateStr, summary);
  const formattedPeriod = formatPeriodDisplay(dateStr);
  const {
    durationMonths,
    total,
    monthlyAverage,
    codfordRatePerThousand,
    percentLowerWiltshire,
    percentLowerNational,
    violentCount,
    propertyCount,
    asbCount,
  } = metrics;

  const topCategory = summary?.mostFrequentCategory || 'None';

  const periodText = durationMonths === 1
    ? `the month of ${formattedPeriod}`
    : `the ${durationMonths}-month span of ${formattedPeriod}`;

  let compText = '';
  if (percentLowerWiltshire > 0) {
    compText = `On an annualized basis, this represents **${codfordRatePerThousand} crimes per 1,000 residents**, which is **${percentLowerWiltshire}% lower than the Wiltshire county average** (~56/1,000) and **${percentLowerNational}% below the England & Wales national benchmark** (~89/1,000).`;
  } else {
    compText = `This represents an annualized rate of ${codfordRatePerThousand} crimes per 1,000 residents.`;
  }

  let personalSafetyText = '';
  if (violentCount === 0) {
    personalSafetyText = `Personal safety remains rock solid: official records logged **zero incidents of robbery, knife crime, or serious violence** across ${periodText}.`;
  } else {
    personalSafetyText = `On the personal safety front, ${violentCount} incident${violentCount === 1 ? '' : 's'} fell into violence or public order categories. In a rural parish of our size, these typically reflect isolated interpersonal disputes rather than predatory street hazards.`;
  }

  let propertyText = '';
  if (propertyCount === 0 && asbCount === 0) {
    propertyText = `No burglaries, vehicle thefts, or anti-social behaviour reports were filed during this period.`;
  } else {
    const parts: string[] = [];
    if (propertyCount > 0) parts.push(`${propertyCount} acquisitive or property crime${propertyCount === 1 ? '' : 's'} (chiefly ${topCategory.toLowerCase()})`);
    if (asbCount > 0) parts.push(`${asbCount} anti-social behaviour incident${asbCount === 1 ? '' : 's'}`);
    propertyText = `Regarding property and village amenities, police logged ${parts.join(' and ')}. Keeping sheds, garages, and vehicles locked remains the most effective practical defence.`;
  }

  let context = '';
  if (durationMonths > 1) {
    context = `Averaging **${monthlyAverage} incident${monthlyAverage === 1 ? '' : 's'} per month** over ${durationMonths} months confirms long-term rural stability across Codford Parish.`;
  } else {
    context = `In a small village of around 700 residents, even a single incident can momentarily inflate mathematical averages without reflecting any systemic deterioration in community safety.`;
  }

  const signoffSeed = seed % 2 === 0 ? '' : ' ';

  return `Evening All,

Taking an objective, evidence-based look at Wiltshire Police figures for ${periodText}, Codford recorded **${total} official incident${total === 1 ? '' : 's'}**. ${compText}

${personalSafetyText} ${propertyText}

${context} Staying watchful, keeping outbuildings fastened, and looking out for our neighbours continues to keep Codford safe.

Don't have nightmares!${signoffSeed}`;
};

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { date, summary, forceRefresh } = JSON.parse(event.body || '{}');

    if (!date || !summary) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing date or summary in request payload' }),
      };
    }

    const metrics = calculateMetrics(date, summary);
    const formattedPeriod = formatPeriodDisplay(date);
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      const fallback = generateDynamicRiskAssessment(date, summary, forceRefresh ? Date.now() : 0);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment: fallback,
          source: 'statistical_fallback',
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

    const prompt = `
You are a calm, experienced community safety advisor assessing crime in the rural Civil Parish of Codford, Wiltshire, UK.

DATASET & CALCULATED PARISH METRICS:
- Period: ${formattedPeriod} (${metrics.durationMonths} month${metrics.durationMonths === 1 ? '' : 's'})
- Total Incidents: ${metrics.total}
- Monthly Average: ${metrics.monthlyAverage} per month
- Codford Annualized Crime Rate: ${metrics.codfordRatePerThousand} per 1,000 residents (Codford population: ~700)
- Wiltshire County Average: ~56.2 per 1,000 residents per year (~4.7/month per 1,000). (Codford is ${metrics.percentLowerWiltshire}% lower than Wiltshire).
- England & Wales National Average: ~89.3 per 1,000 residents per year (~7.4/month per 1,000). (Codford is ${metrics.percentLowerNational}% lower than national average).
- Categorical Breakdown:
  * Violent / Public Order: ${metrics.violentCount}
  * Property / Acquisitive / Burglary / Vehicle: ${metrics.propertyCount}
  * Anti-social behaviour: ${metrics.asbCount}
  * Most frequent category: ${summary.mostFrequentCategory}
  * All categories: ${(summary.byCategory || []).map((c: any) => `${c.name}: ${c.value}`).join(', ')}

TASK:
Provide a reasoned, objective, and reassuring assessment of the actual local crime risk level for Codford residents based on these exact figures.
- Explicitly state whether this represents a 1-month snapshot or a ${metrics.durationMonths}-month trend.
- CITE THE SPECIFIC NUMBERS: Mention the ${metrics.total} incidents, the ${metrics.codfordRatePerThousand} per 1,000 rate, and how it compares to Wiltshire (${metrics.percentLowerWiltshire}% difference) and National (${metrics.percentLowerNational}% difference).
- Comment specifically on the categories recorded: ${metrics.violentCount} violent/public order, ${metrics.propertyCount} property/vehicle, ${metrics.asbCount} ASB.
- Explain the small population effect (~700 people) and give grounded rural security advice.

CRITICAL FORMAT RULES:
1. MUST BEGIN with: "Evening All" (PC George Dixon greeting).
2. MUST END with: "Don't have nightmares!" (Nick Ross catchphrase).
3. 2 to 3 paragraphs. Professional, reassuring, factual.
`;

    let assessmentText: string | null = null;
    let source = 'gemini-3.8-flash';

    // 1. Try gemini-3.8-flash
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: { temperature: 0.7 },
      });
      assessmentText = response.text || null;
    } catch (err38: any) {
      console.warn('gemini-3.8-flash failed, attempting gemini-2.5-flash fallback:', err38?.message);
      // 2. Try gemini-2.5-flash
      try {
        const response2 = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { temperature: 0.7 },
        });
        assessmentText = response2.text || null;
        source = 'gemini-2.5-flash';
      } catch (err25: any) {
        console.warn('gemini-2.5-flash failed, using dynamic parish risk synthesis:', err25?.message);
      }
    }

    if (!assessmentText) {
      assessmentText = generateDynamicRiskAssessment(date, summary, forceRefresh ? Date.now() : 0);
      source = 'statistical_fallback';
    }

    let text = assessmentText.trim();
    if (!text.toLowerCase().startsWith('evening all')) {
      text = `Evening All,\n\n${text}`;
    }
    if (!text.toLowerCase().endsWith("don't have nightmares!")) {
      text = `${text}\n\nDon't have nightmares!`;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessment: text,
        source,
      }),
    };
  } catch (error: any) {
    console.error('Netlify function error in risk-assessment:', error);
    const { date, summary, forceRefresh } = JSON.parse(event.body || '{}');
    const fallback = generateDynamicRiskAssessment(
      date || '',
      summary || { total: 0, byCategory: [], mostFrequentCategory: 'None' },
      forceRefresh ? Date.now() : 0
    );
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessment: fallback,
        source: 'statistical_fallback_error',
      }),
    };
  }
};
