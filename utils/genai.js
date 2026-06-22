import { getFallback } from "./fallbacks.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_RETRIES = 2;

const stripCodeFences = (text) => {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
};

const parseJsonResponse = (content, context) => {
  try {
    return JSON.parse(stripCodeFences(content));
  } catch (error) {
    throw new Error(
      `Failed to parse AI ${context} response as JSON: ${error.message}`
    );
  }
};

const chatCompletion = async (systemPrompt, userContent, functionName = "chatCompletion") => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        lastError = error;
        
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] API failure (attempt ${attempt}/${MAX_RETRIES + 1}) for ${functionName}: ${error.message}`);
        
        if (attempt <= MAX_RETRIES) {
          const delay = attempt * 1000; // Exponential backoff: 1s, 2s
          console.error(`[${timestamp}] Retrying ${functionName} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        const error = new Error("OpenAI API returned an empty response");
        lastError = error;
        
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] API failure (attempt ${attempt}/${MAX_RETRIES + 1}) for ${functionName}: ${error.message}`);
        
        if (attempt <= MAX_RETRIES) {
          const delay = attempt * 1000;
          console.error(`[${timestamp}] Retrying ${functionName} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }

      return content;
    } catch (error) {
      lastError = error;
      
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] API failure (attempt ${attempt}/${MAX_RETRIES + 1}) for ${functionName}: ${error.message}`);
      
      if (attempt <= MAX_RETRIES) {
        const delay = attempt * 1000;
        console.error(`[${timestamp}] Retrying ${functionName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  // If all retries failed, log and throw
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] All ${MAX_RETRIES + 1} attempts failed for ${functionName}. Using fallback response.`);
  throw lastError;
};

export const extractClaims = async (text) => {
  if (!text?.trim()) {
    throw new Error("Text is required to extract claims");
  }

  const systemPrompt = `You extract factual claims from articles for fact-checking.

Given the article text, identify 3 to 7 distinct, specific, checkable factual claims.
Each claim must be a standalone statement that can be verified against external sources.
Do not include opinions, predictions, or vague statements.

Respond ONLY with a valid JSON array in this exact format, with no other text:
[{ "claim": "..." }]`;

  try {
    const content = await chatCompletion(systemPrompt, text, "extractClaims");
    const parsed = parseJsonResponse(content, "claim extraction");

    if (!Array.isArray(parsed)) {
      throw new Error("Claim extraction response must be a JSON array");
    }

    if (parsed.length < 3 || parsed.length > 7) {
      throw new Error(
        `Expected 3-7 claims, but received ${parsed.length}`
      );
    }

    for (const item of parsed) {
      if (!item?.claim || typeof item.claim !== "string") {
        throw new Error('Each claim item must be an object with a "claim" string field');
      }
    }

    return parsed;
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] extractClaims failed after retries, using fallback`);
    return getFallback("extractClaims");
  }
};

export const detectAndTranslate = async (text) => {
  if (!text?.trim()) {
    throw new Error("Text is required for language detection");
  }

  const systemPrompt = `You detect the language of text and translate it to English when needed.

Rules:
- Detect the ISO 639-1 language code (e.g. "en", "hi", "es").
- If the text is already in English, set translatedText to the original text unchanged.
- If not English, provide an accurate English translation in translatedText.

Respond ONLY with valid JSON in this exact format, with no other text:
{ "language": "hi", "translatedText": "..." }`;

  try {
    const content = await chatCompletion(systemPrompt, text, "detectAndTranslate");
    const parsed = parseJsonResponse(content, "language detection");

    if (
      !parsed ||
      typeof parsed.language !== "string" ||
      typeof parsed.translatedText !== "string"
    ) {
      throw new Error(
        'Language detection response must be an object with "language" and "translatedText" string fields'
      );
    }

    return {
      language: parsed.language.toLowerCase(),
      translatedText: parsed.translatedText,
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] detectAndTranslate failed after retries, using fallback`);
    return getFallback("detectAndTranslate");
  }
};

const VALID_VERDICTS = ["Supported", "Contradicted", "Unverified"];

export const compareClaimWithSources = async (claim, sources) => {
  if (!claim?.trim()) {
    throw new Error("Claim is required for comparison");
  }

  const systemPrompt = `You are a fact-checking assistant for TruthLens.

Given a factual claim and a list of reference sources, determine whether the claim is supported, contradicted, or unverified based on the available evidence.

Rules:
- "Supported": credible sources clearly support the claim.
- "Contradicted": credible sources clearly contradict the claim.
- "Unverified": sources are insufficient, ambiguous, or do not directly address the claim.
- Base your verdict only on the provided sources; do not invent facts.
- Keep reasoning concise (1-3 sentences).

Respond ONLY with valid JSON in this exact format, with no other text:
{ "verdict": "Supported" | "Contradicted" | "Unverified", "reasoning": "short explanation" }`;

  try {
    const userContent = JSON.stringify({ claim, sources }, null, 2);
    const content = await chatCompletion(systemPrompt, userContent, "compareClaimWithSources");
    const parsed = parseJsonResponse(content, "claim comparison");

    if (
      !parsed ||
      typeof parsed.reasoning !== "string" ||
      !VALID_VERDICTS.includes(parsed.verdict)
    ) {
      throw new Error(
        'Claim comparison response must include verdict ("Supported", "Contradicted", or "Unverified") and reasoning'
      );
    }

    return {
      verdict: parsed.verdict,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] compareClaimWithSources failed after retries, using fallback`);
    return getFallback("compareClaimWithSources");
  }
};

export const detectAIContent = async (text) => {
  if (!text?.trim()) {
    throw new Error("Text is required for AI content detection");
  }

  const systemPrompt = `You analyze text for patterns commonly associated with AI-generated writing.

Look for signals such as:
- Repetitiveness or redundant phrasing
- Generic, vague language with little specific detail
- Overly uniform sentence structure or rhythm
- Formulaic transitions and list-like exposition
- Lack of personal voice, concrete examples, or idiosyncratic word choice

Important:
- This is a heuristic estimate only, not a definitive determination.
- Human-written text can share these traits, and AI-written text can appear natural.
- Be honest about uncertainty in your reasoning.

Respond ONLY with valid JSON in this exact format, with no other text:
{ "aiLikelihood": 75, "reasoning": "short explanation in plain English" }

Rules for aiLikelihood:
- Must be an integer from 0 to 100
- 0 = very likely human-written, 100 = very likely AI-generated`;

  try {
    const content = await chatCompletion(systemPrompt, text, "detectAIContent");
    const parsed = parseJsonResponse(content, "AI content detection");

    if (
      !parsed ||
      typeof parsed.reasoning !== "string" ||
      typeof parsed.aiLikelihood !== "number" ||
      parsed.aiLikelihood < 0 ||
      parsed.aiLikelihood > 100
    ) {
      throw new Error(
        'AI content detection response must include aiLikelihood (0-100) and reasoning string fields'
      );
    }

    return {
      aiLikelihood: Math.round(parsed.aiLikelihood),
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] detectAIContent failed after retries, using fallback`);
    return getFallback("detectAIContent");
  }
};
