export const handler = async () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'online',
      geminiKeyConfigured: !!apiKey,
      keySource: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : process.env.API_KEY ? 'API_KEY' : 'NONE',
      cachedMonths: [],
      modelInUse: 'gemini-3.8-flash',
    }),
  };
};
