import OpenAI from "openai";

export const EVALUATION_PROMPT_VERSION = "v1";

export const EVALUATION_SYSTEM_PROMPT = `You are evaluating a short-form video for inclusion in a dataset used to build a "counter-recommendation" system.
Return ONLY valid JSON matching the schema.`;

export const EVALUATION_USER_PROMPT = (
  title: string,
  description: string,
  transcript: string
) => `
The system will eventually recommend short videos that provide relevant factual information, context, alternative perspectives, or bridge-building responses to Israel/Jewish-related narratives encountered elsewhere online.

Evaluate the VIDEO based on its transcript and metadata.

IMPORTANT:
The fact that a video discusses an anti-Israel, anti-Jewish, pro-Palestinian, or otherwise hostile narrative does NOT make it irrelevant. A video can be highly relevant if it responds to, debunks, contextualizes, or challenges such a narrative.

Likewise, a video should not be considered relevant merely because it mentions Israel or Jews.

Evaluate the actual informational value of the video.

Return JSON with this exact structure:
{
  "projectRelevanceScore": 0.0,
  "projectRelevance": "high | medium | low | none",

  "relevanceTypes": [
    "debunking",
    "fact_checking",
    "context",
    "history",
    "israel_advocacy",
    "jewish_perspective",
    "israeli_perspective",
    "personal_testimony",
    "human_story",
    "bridge_building",
    "media_analysis",
    "antisemitism",
    "current_events",
    "other"
  ],

  "contentOrientation": "counter_narrative | neutral_context | advocacy | personal_story | unrelated",

  "targetNarratives": [
    "brief description of the narrative or claims this video addresses"
  ],

  "recommendationValueScore": 0.0,

  "recommendationValue": "excellent | useful | limited | unsuitable",

  "reason": "Brief explanation.",

  "exclude": true,

  "excludeReason": "Brief explanation or null"
}

Scoring:

projectRelevanceScore:
0.0-0.2 = unrelated to the project's purpose
0.2-0.4 = only marginally relevant
0.4-0.6 = somewhat relevant
0.6-0.8 = clearly relevant
0.8-1.0 = highly relevant

recommendationValueScore:
Estimate how useful this video would be as a recommendation to someone who has just encountered a relevant Israel/Jewish-related claim or narrative.

Consider:
- Does it address a recognizable claim or narrative?
- Does it provide useful facts or context?
- Does it offer a meaningful alternative perspective?
- Is the information understandable in short-form format?
- Is it likely to be useful to someone who does not already agree with the creator?
- Does it avoid relying entirely on unsupported assertions or emotional rhetoric?

Do NOT fact-check the video's claims at this stage.
Evaluate whether the video is relevant and potentially useful, not whether every statement in it is true.

Examples:

A video explaining why a viral claim about Israel is misleading:
-> high relevance, debunking.

A video explaining Israeli history or Jewish historical connection to the region:
-> potentially high relevance, context/history.

A personal story from an Israeli civilian:
-> potentially high relevance, personal_testimony.

A video criticizing Israel's government while providing useful context:
-> potentially relevant. Do not exclude it simply because it is critical of Israel.

A video from an Israeli creator discussing an unrelated vacation, food, fitness routine, or celebrity:
-> low/none.

A video responding to an anti-Israel video and explaining why its claims are misleading:
-> potentially highly relevant.

A generic political video that happens to mention Israel once:
-> low relevance.

Return ONLY valid JSON.

Title: ${title}

Description: ${description}

Transcript:
${transcript}
`;

export interface EvaluationResult {
  projectRelevanceScore: number;
  projectRelevance: "high" | "medium" | "low" | "none";
  relevanceTypes: string[];
  contentOrientation:
    | "counter_narrative"
    | "neutral_context"
    | "advocacy"
    | "personal_story"
    | "unrelated";
  targetNarratives: string[];
  recommendationValueScore: number;
  recommendationValue: "excellent" | "useful" | "limited" | "unsuitable";
  reason: string;
  exclude: boolean;
  excludeReason: string | null;
}

export interface EvaluationWithCost {
  result: EvaluationResult;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

function defaultResult(): EvaluationResult {
  return {
    projectRelevanceScore: 0,
    projectRelevance: "none",
    relevanceTypes: [],
    contentOrientation: "unrelated",
    targetNarratives: [],
    recommendationValueScore: 0,
    recommendationValue: "unsuitable",
    reason: "",
    exclude: true,
    excludeReason: "Model response could not be parsed",
  };
}

export async function evaluateForRecommendation(
  title: string,
  description: string,
  transcript: string
): Promise<EvaluationWithCost> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.EVALUATION_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: EVALUATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: EVALUATION_USER_PROMPT(title, description || "", transcript),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const rawContent = response.choices[0]?.message?.content || "{}";
  let result: EvaluationResult;

  try {
    result = { ...defaultResult(), ...JSON.parse(rawContent) };
  } catch {
    result = defaultResult();
  }

  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const estimatedCost = inputTokens * 0.00000015 + outputTokens * 0.0000006;

  return { result, model, inputTokens, outputTokens, estimatedCost };
}
