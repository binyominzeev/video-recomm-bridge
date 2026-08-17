import OpenAI from "openai";

export const EXTRACTION_PROMPT_VERSION = "v1";

export const EXTRACTION_SYSTEM_PROMPT = `You are an analyst extracting structured information from video transcripts.
Extract atomic claims - split compound statements into separate claims.
Do NOT judge whether claims are true or false.
Return ONLY valid JSON matching the schema.`;

export const EXTRACTION_USER_PROMPT = (transcript: string) => `
Analyze this video transcript and return JSON with this exact structure:
{
  "summary": "2-3 sentence summary",
  "claims": [
    {
      "text": "atomic claim text",
      "type": "factual|historical|legal|causal|statistical|opinion|attitude",
      "importance": 0.0
    }
  ],
  "topics": ["topic1", "topic2"],
  "contentTypes": ["debunking", "education", "commentary", "news", "personal_story"],
  "rhetoricalTechniques": ["technique1"]
}

Transcript:
${transcript}
`;

export interface ExtractionResult {
  summary: string;
  claims: Array<{
    text: string;
    type: string;
    importance: number;
  }>;
  topics: string[];
  contentTypes: string[];
  rhetoricalTechniques: string[];
}

export interface ExtractionWithCost {
  result: ExtractionResult;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export async function extractFromTranscript(
  transcript: string
): Promise<ExtractionWithCost> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.EXTRACTION_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: EXTRACTION_USER_PROMPT(transcript) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const rawContent = response.choices[0]?.message?.content || "{}";
  let result: ExtractionResult;

  try {
    result = JSON.parse(rawContent) as ExtractionResult;
  } catch {
    result = {
      summary: "",
      claims: [],
      topics: [],
      contentTypes: [],
      rhetoricalTechniques: [],
    };
  }

  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const estimatedCost = inputTokens * 0.00000015 + outputTokens * 0.0000006;

  return { result, model, inputTokens, outputTokens, estimatedCost };
}
