import OpenAI from "openai";

export const CLAIM_TAXONOMY = [
  {
    id: "1.1",
    name: "Gaza War / Humanitarian Situation",
    topics: ["water supply", "blockade", "borders", "building destruction", "civilian casualties", "aid"],
  },
  {
    id: "1.2",
    name: "Hostages and Captivity",
    topics: ["hostage-taking", "conditions of release"],
  },
  {
    id: "1.3",
    name: "Peace Negotiations and Territorial Offers",
    topics: ["West Bank", "Gaza Strip", "rejection of past peace offers"],
  },
  {
    id: "1.4",
    name: "Role of Egypt",
    topics: ["border", "acceptance/rejection of refugees", "size comparison"],
  },
  {
    id: "2.1",
    name: "1948 War / War of Independence",
    topics: ["Arab armies", "question of British/American support", "refugees"],
  },
  {
    id: "2.2",
    name: "Land Ownership Disputes",
    topics: ["whether land was stolen from Arabs"],
  },
  {
    id: "2.3",
    name: "British Mandate Era",
    topics: ["immigration restrictions", "Al-Husseini and the Nazis"],
  },
  {
    id: "3",
    name: "Holocaust-Related Claims",
    topics: ["death toll", "question of rounding", "relevance to the current conflict"],
  },
  {
    id: "4.1",
    name: "Democracy and Equal Rights",
    topics: ["Arab citizens", "Arab politicians", "judges"],
  },
  { id: "4.2", name: "LGBT Rights", topics: [] },
  { id: "4.3", name: "Freedom of Religion", topics: ["churches, mosques (count)"] },
] as const;

export const TAXONOMY_PROMPT = CLAIM_TAXONOMY.map(
  (category) => `${category.id} ${category.name}: ${category.topics.join(", ") || "general claims"}`
).join("\n");

export type TaxonomyClassification = {
  index: number;
  categoryId: string | null;
  topic: string | null;
};

export async function classifyClaims(
  claims: { index: number; text: string }[]
): Promise<TaxonomyClassification[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.CLAIM_TAXONOMY_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Classify each claim into the single most specific matching taxonomy category and topic. " +
          "Use null categoryId and topic when no category fits. Never invent category IDs or topics. " +
          "Return only valid JSON.",
      },
      {
        role: "user",
        content: `Taxonomy:\n${TAXONOMY_PROMPT}\n\nClaims:\n${JSON.stringify(claims)}\n\nReturn exactly: { "classifications": [{ "index": 0, "categoryId": "1.1", "topic": "aid" }] }`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    return Array.isArray(parsed.classifications) ? parsed.classifications : [];
  } catch {
    return [];
  }
}