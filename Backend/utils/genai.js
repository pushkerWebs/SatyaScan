import { GoogleGenerativeAI } from "@google/generative-ai";
import { getFallback } from "./fallbacks.js";

// Use the proper AIzaSy-format key for Gemini.
// GEMINI_API_KEY should come from https://aistudio.google.com/app/apikey
// If not set, fall back to FACT_CHECK_API_KEY (same Google API key format).
const getApiKey = () => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const factCheckKey = process.env.FACT_CHECK_API_KEY;

  // AQ. prefix = short-lived gcloud access token, NOT a Gemini API key
  if (geminiKey && !geminiKey.startsWith("AQ.")) return geminiKey;
  if (factCheckKey) return factCheckKey;
  return null;
};

const MODEL_NAME = "gemini-2.0-flash";

const callGemini = async (systemPrompt, userContent, functionName) => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No valid Gemini API key found. Set GEMINI_API_KEY in .env (get one at aistudio.google.com/app/apikey)");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
    generationConfig: { temperature: 0.2 },
  });

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(userContent);
      const text = result.response.text();
      if (!text) throw new Error("Gemini returned empty response");
      return text;
    } catch (err) {
      lastError = err;
      const ts = new Date().toISOString();
      console.error(`[${ts}] ${functionName} attempt ${attempt}/3 failed: ${err.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  throw lastError;
};

// ── JSON helpers ──────────────────────────────────────────────────────────────

const stripFences = (text) => {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  }
  return s.trim();
};

const parseJson = (text, ctx) => {
  try {
    return JSON.parse(stripFences(text));
  } catch (e) {
    throw new Error(`Failed to parse ${ctx} response as JSON: ${e.message}`);
  }
};

// ── Exported functions ────────────────────────────────────────────────────────

export const extractClaims = async (text) => {
  if (!text?.trim()) throw new Error("Text is required");

  const system = `You extract factual claims from articles for fact-checking.
Identify 3 to 7 distinct, specific, checkable factual claims.
Each must be a standalone statement verifiable against external sources.
Do NOT include opinions, predictions, or vague statements.
Respond ONLY with a valid JSON array, no other text:
[{ "claim": "..." }]`;

  try {
    const raw = await callGemini(system, text, "extractClaims");
    const parsed = parseJson(raw, "claim extraction");
    if (!Array.isArray(parsed)) throw new Error("Must be JSON array");
    for (const item of parsed) {
      if (!item?.claim || typeof item.claim !== "string")
        throw new Error('Each item must have a "claim" string field');
    }
    return parsed;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] extractClaims failed: ${err.message}`);
    return getFallback("extractClaims");
  }
};

export const detectAndTranslate = async (text) => {
  if (!text?.trim()) throw new Error("Text is required");

  const system = `Detect the language of the text and translate to English if needed.
Rules:
- Detect the ISO 639-1 language code (e.g. "en", "hi", "es").
- If already English, set translatedText to the original text unchanged.
- If not English, provide an accurate English translation.
Respond ONLY with valid JSON, no other text:
{ "language": "hi", "translatedText": "..." }`;

  try {
    const raw = await callGemini(system, text, "detectAndTranslate");
    const parsed = parseJson(raw, "language detection");
    if (!parsed?.language || !parsed?.translatedText)
      throw new Error("Missing language or translatedText");
    return { language: parsed.language.toLowerCase(), translatedText: parsed.translatedText };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] detectAndTranslate failed: ${err.message}`);
    return getFallback("detectAndTranslate");
  }
};

export const compareClaimWithSources = async (claim, sources) => {
  if (!claim?.trim()) throw new Error("Claim is required");

  const system = `You are a fact-checking assistant.
Given a factual claim and reference sources, determine if the claim is supported, contradicted, or unverified.
- "Supported": credible sources clearly support the claim.
- "Contradicted": credible sources clearly contradict the claim.
- "Unverified": sources are insufficient or don't address the claim.
Keep reasoning to 1-3 sentences.
Respond ONLY with valid JSON, no other text:
{ "verdict": "Supported" | "Contradicted" | "Unverified", "reasoning": "..." }`;

  try {
    const raw = await callGemini(system, JSON.stringify({ claim, sources }, null, 2), "compareClaimWithSources");
    const parsed = parseJson(raw, "claim comparison");
    const validVerdicts = ["Supported", "Contradicted", "Unverified"];
    if (!parsed?.reasoning || !validVerdicts.includes(parsed?.verdict))
      throw new Error("Invalid verdict or missing reasoning");
    return { verdict: parsed.verdict, reasoning: parsed.reasoning };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] compareClaimWithSources failed: ${err.message}`);
    return getFallback("compareClaimWithSources");
  }
};

export const detectAIContent = async (text) => {
  if (!text?.trim()) throw new Error("Text is required");

  const system = `Analyze text for patterns associated with AI-generated writing.
Look for: repetitiveness, generic/vague language, uniform sentence structure, formulaic transitions, lack of personal voice.
Note: this is a heuristic estimate, not definitive.
Respond ONLY with valid JSON, no other text:
{ "aiLikelihood": 75, "reasoning": "short plain-English explanation" }
aiLikelihood must be an integer 0-100. 0 = very likely human, 100 = very likely AI.`;

  try {
    const raw = await callGemini(system, text, "detectAIContent");
    const parsed = parseJson(raw, "AI detection");
    if (typeof parsed?.aiLikelihood !== "number" || parsed.aiLikelihood < 0 || parsed.aiLikelihood > 100)
      throw new Error("aiLikelihood must be 0-100");
    if (typeof parsed?.reasoning !== "string")
      throw new Error("Missing reasoning");
    return { aiLikelihood: Math.round(parsed.aiLikelihood), reasoning: parsed.reasoning };
  } catch (err) {
    console.error(`[${new Date().toISOString()}] detectAIContent failed: ${err.message}`);
    return getFallback("detectAIContent");
  }
};
