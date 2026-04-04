import { GoogleGenAI } from '@google/genai';

async function run() {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    console.log('URL:', url);
    console.log('Body:', options.body);
    return new Response(JSON.stringify({
      embeddings: [{values: [1]}, {values: [2]}]
    }), {status: 200});
  };

  const ai = new GoogleGenAI({ apiKey: 'dummy' });
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: ['hello', 'world']
  });
  console.log('Number of embeddings:', result.embeddings?.length);
}
run().catch(console.error);
