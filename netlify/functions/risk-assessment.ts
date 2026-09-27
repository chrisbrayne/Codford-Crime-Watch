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

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { date, summary } = JSON.parse(event.body || '{}');

    if (!date || !summary) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing date or summary in request payload' }),
      };
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      const fallback = generateRiskAssessmentFallback(date, summary);
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
    const formattedDate = formatMonth(date);

    const prompt = `
You are a calm, experienced community safety advisor assessing crime in the rural Civil Parish of Codford, Wiltshire, UK.

BENCHMARKS & CONTEXT:
- Codford Parish Population: approx 700 residents (Wylye Valley rural community).
- Wiltshire County Average: ~56 crimes per 1,000 residents per year (~4.7 per month per 1,000). Wiltshire consistently ranks among the top 5 safest police force areas in England and Wales.
- England & Wales National Average: ~89 crimes per 1,000 residents per year (~7.4 per month per 1,000).
- Codford Recorded Data for ${formattedDate}: Total of ${summary.total} incidents recorded by Wiltshire Police. Top category: ${summary.mostFrequentCategory}. Breakdown: ${(summary.byCategory || []).map((c: any) => `${c.name} (${c.value})`).join(', ') || 'None'}.

TASK:
Provide a reasoned, objective, and reassuring assessment of the actual local crime risk level for Codford residents compared to Wiltshire county and national averages.
Explain how small population numbers can make even 1 or 2 minor incidents appear magnified in percentage terms, but confirm that Codford remains a genuinely low-crime, peaceful rural setting.

CRITICAL FORMAT RULES (STRICT COMPLIANCE REQUIRED):
1. The response MUST BEGIN with the exact words: "Evening All" (a nod to PC George Dixon in Dixon of Dock Green).
2. The response MUST END with the exact words: "Don't have nightmares!" (the classic Nick Ross catchphrase from BBC Crimewatch).
3. Keep the tone warm, grounded, reassuring, and articulate (2 to 3 paragraphs).
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: { temperature: 0.3 },
    });

    let text = (response.text || '').trim();
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
        source: 'gemini-3.8-flash',
      }),
    };
  } catch (error: any) {
    console.error('Netlify function error in risk-assessment:', error);
    const { date, summary } = JSON.parse(event.body || '{}');
    const fallback = generateRiskAssessmentFallback(date || '', summary || { total: 0, byCategory: [], mostFrequentCategory: 'None' });
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
