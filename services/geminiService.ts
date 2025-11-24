import { GoogleGenAI } from "@google/genai";
import { Crime, CrimeSummary } from '../types';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateCrimeReport = async (
  date: string, 
  summary: CrimeSummary, 
  crimes: Crime[]
): Promise<string> => {
  
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
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Report generation unavailable.";
  } catch (error) {
    console.error("Gemini generation failed:", error);
    return "Unable to generate AI report at this time due to a connection error.";
  }
};
