import { GoogleGenAI } from '@google/genai';

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: ['hello', 'world']
  });
  console.log('Number of embeddings:', result.embeddings?.length);
}
run().catch(console.error);
