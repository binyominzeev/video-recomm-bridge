export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER || "openai";

  if (provider === "openai") {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  }

  throw new Error(`Unknown embedding provider: ${provider}`);
}

// OpenAI accepts up to 2048 inputs per embeddings request; texts are truncated like generateEmbedding.
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider = process.env.EMBEDDING_PROVIDER || "openai";
  if (provider !== "openai") {
    throw new Error(`Unknown embedding provider: ${provider}`);
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const batchSize = 100;
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const chunk = texts.slice(i, i + batchSize).map((text) => text.slice(0, 8000));
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });
    for (const item of response.data) embeddings.push(item.embedding);
  }
  return embeddings;
}
