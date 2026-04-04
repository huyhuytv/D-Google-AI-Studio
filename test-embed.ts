import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: ['hello', 'world']
  });
  console.log('Number of embeddings:', result.embeddings?.length);
  if (result.embeddings) {
    console.log('Embedding 0 length:', result.embeddings[0].values?.length);
  }
}
run().catch(console.error);
