import { GoogleGenAI } from "@google/genai";
import { Crime, CrimeSummary } from '../types';

// Lazy initialization to prevent crash if API key is missing on load
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (ai) return ai;
  
  // Access the API key injected by Vite
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Make sure API_KEY is set in your Netlify Environment Variables.");
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

const formatMonth = (dateStr: string) => {
  const [year, month] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

export const generateCrimeReport = async (
  date: string, 
  summary: CrimeSummary, 
  crimes: Crime[]
): Promise<string> => {
  
  const client = getAiClient();
  
  if (!client) {
    return "AI Report Unavailable: API Key is missing. Please check your Netlify Site Settings > Environment Variables.";
  }

  const formattedDate = formatMonth(date);

  // 1. Calculate Street Statistics explicitly in code to ensure numeric accuracy
  const streetCounts: Record<string, number> = {};
  crimes.forEach(c => {
    // "On or near High Street" -> "High Street" for cleaner reporting
    const street = c.location.street.name.replace('On or near ', '');
    streetCounts[street] = (streetCounts[street] || 0) + 1;
  });

  const topStreets = Object.entries(streetCounts)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, 5) // Top 5 locations
    .map(([name, count]) => `- ${name}: ${count} ${count === 1 ? 'incident' : 'incidents'}`)
    .join('\n');

  // 2. Prepare a concise text list of incidents (up to 50 to fit comfortably in context window)
  const incidentList = crimes.slice(0, 50).map(c => 
    `* ${c.category.replace(/-/g, ' ')} at ${c.location.street.name}`
  ).join('\n');

  const prompt = `
    You are a data reporting assistant for the Civil Parish of Codford, Wiltshire.
    
    TASK: Write a factual monthly crime report based EXCLUSIVELY on the provided dataset below.
    
    *** CRITICAL RULES ***
    1. You MUST use the "Official Total Incidents" count provided below. 
    2. If "Official Total Incidents" is > 0, you MUST NOT write "Zero crimes" or "No crimes".
    3. If the date is in the future relative to your training data, ignore that and treat the provided data as the absolute truth for that month.
    
    --- DATASET (TRUTH) ---
    Report Month: ${formattedDate}
    Official Total Incidents: ${summary.total}
    Most Frequent Category: ${summary.mostFrequentCategory}
    
    Category Breakdown:
    ${summary.byCategory.map(c => `- ${c.name}: ${c.value}`).join('\n')}
    
    Top Locations (Hotspots):
    ${topStreets.length > 0 ? topStreets : "No specific hotspots identified."}
    
    --- INCIDENT SAMPLE (For context only) ---
    ${incidentList}
    ${crimes.length > 50 ? `...and ${crimes.length - 50} more incidents not listed here.` : ''}
    
    --- REPORT FORMAT ---
    1. **Headline**: 3-6 words summarizing the activity (e.g., "${summary.total} Incidents Reported in ${formattedDate}" or "Main Issue: ${summary.mostFrequentCategory}").
    2. **Executive Summary**: State the total (${summary.total}) and the main category.
    3. **Location Analysis**: Mention the top streets if applicable.
    4. **Community Advice**: One brief safety tip relevant to the top category.
    
    Tone: Professional, Objective, Local Government style.
    Output: Markdown.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2, // Lower temperature for more deterministic/factual output
      }
    });
    return response.text || "Report generation unavailable.";
  } catch (error: any) {
    console.error("Gemini generation failed:", error);
    
    // Check for specific API Key restriction errors
    // The error object might differ between environments, so we stringify it to search for the code.
    const errString = JSON.stringify(error, Object.getOwnPropertyNames(error));

    // If the error mentions Referrer Blocking, permissions are wrong.
    if (errString.includes("API_KEY_HTTP_REFERRER_BLOCKED") || errString.includes("Requests from referer")) {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'this website';
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
        
        return `### ⚠️ API Key Permissions Error
      
The AI system could not generate a report because the **Google Cloud settings** for your API Key are blocking this website.

**Current Origin:** \`${origin}\`

**Why is this happening?**
You have "Website Restrictions" enabled on your API Key, but this specific URL is not in the allowed list.

**How to Fix:**
1. Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials).
2. Click on the API Key you are using.
3. Under "Application restrictions":
   - Ensure \`${origin}/*\` is added to the list.
   ${isLocalhost ? '- **Note for Testing:** Since you are running on Localhost, you must specifically add `http://localhost:5173/*` (or your specific port) to the list.' : ''}
   - Or, temporarily set it to "None" to verify it works.
4. **Wait 5 Minutes:** Google Cloud changes can take a few minutes to propagate.`;
    }

    const errorMsg = error.message || error.toString();
    return `Unable to generate AI report. Error details: ${errorMsg}`;
  }
};