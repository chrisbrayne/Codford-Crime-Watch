import { GoogleGenAI } from "@google/genai";
import { Crime, CrimeSummary } from '../types';

// Lazy initialization to prevent crash if API key is missing on load
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (ai) return ai;
  
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  
  try {
    ai = new GoogleGenAI({ apiKey });
    return ai;
  } catch (e) {
    console.error("Failed to initialize Gemini client:", e);
    return null;
  }
};

export const generateCrimeReport = async (
  date: string, 
  summary: CrimeSummary, 
  crimes: Crime[]
): Promise<string> => {
  
  const client = getAiClient();
  
  if (!client) {
    return "AI Report Unavailable: API Key is missing or invalid. Please configure the API_KEY in your deployment settings.";
  }

  const prompt = `
    You are a crime analyst for the Civil Parish of Codford, Wiltshire.
    Generate a professional, concise, yet detailed monthly crime report for ${date}.
    
    Data Summary:
    - Total Crimes: ${summary.total}
    - Most Frequent Category: ${summary.mostFrequentCategory}
    
    Breakdown by Category:
    ${summary.byCategory.map(c => `- ${c.name}: ${c.value}`).join('\n')}
    
    Notable Incidents (Raw Data Sample):
    ${JSON.stringify(crimes.slice(0, 10).map(c => ({ category: c.category, street: c.location.street.name, outcome: c.outcome_status?.category || 'Under investigation' })))}
    
    Instructions:
    1. Write a headline summarizing the month's safety status.
    2. Provide a narrative overview of the trends.
    3. Highlight specific areas (streets) if they appear frequently in the raw data.
    4. Conclude with community safety advice based on the types of crimes (e.g., if burglary is high, suggest locking doors).
    5. Format with Markdown.
    6. Keep the tone objective but reassuring where possible.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Report generation unavailable.";
  } catch (error: any) {
    console.error("Gemini generation failed:", error);
    // Return the actual error message so the user can debug (e.g. 401, 503, Quota Exceeded)
    const errorMsg = error.message || error.toString();
    return `Unable to generate AI report. Error details: ${errorMsg}`;
  }
};