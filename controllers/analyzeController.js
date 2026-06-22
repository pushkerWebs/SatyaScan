import fs from "fs/promises";
import Check from "../models/Check.js";
import { verifyClaim } from "./factCheckController.js";
import {
  detectAIContent,
  detectAndTranslate,
  extractClaims,
} from "../utils/genai.js";
import { extractTextFromImage } from "../utils/ocr.js";
import { scrapeArticleFromUrl } from "../utils/scraper.js";
import {
  calculateTrustScore,
  getDomainCredibility,
} from "../utils/scoring.js";
import { generateHash, getFromCache, setCache } from "../utils/cache.js";

const ANALYSIS_TIMEOUT_MS = 60_000;
const DEFAULT_SOURCE_CREDIBILITY = 60;
const DEFAULT_AI_LIKELIHOOD = 50;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Analysis timed out after 60 seconds")),
        ms
      );
    }),
  ]);

const safeStep = async (label, fn, fallback) => {
  try {
    return await fn();
  } catch (error) {
    console.error(`${label} failed:`, error.message);
    return fallback;
  }
};

const resolveInputText = async (type, content, file) => {
  if (type === "text") {
    if (!content?.trim()) {
      throw new Error("Content is required for type 'text'");
    }
    return content.trim();
  }

  if (type === "url") {
    if (!content?.trim()) {
      throw new Error("Content URL is required for type 'url'");
    }
    return scrapeArticleFromUrl(content.trim());
  }

  if (type === "image") {
    if (!file?.path) {
      throw new Error("Image file is required for type 'image'");
    }
    try {
      return await extractTextFromImage(file.path);
    } finally {
      await fs.unlink(file.path).catch((error) => {
        console.warn(`Failed to delete uploaded image: ${error.message}`);
      });
    }
  }

  throw new Error('Invalid type. Must be "text", "url", or "image"');
};

const runAnalysis = async (req) => {
  const type = req.body.type;
  const content = req.body.content;
  const inputUrl = type === "url" ? content?.trim() : null;

  const rawText = await resolveInputText(type, content, req.file);
  if (!rawText) {
    throw new Error("No text could be extracted from the provided input");
  }

  const { language, translatedText } = await safeStep(
    "detectAndTranslate",
    () => detectAndTranslate(rawText),
    { language: "unknown", translatedText: rawText }
  );

  const extractedClaims = await safeStep(
    "extractClaims",
    () => extractClaims(translatedText),
    []
  );

  const verifiedClaims = await Promise.all(
    extractedClaims.map(async (item) => {
      const claimText = item.claim;
      return safeStep(
        `verifyClaim("${claimText}")`,
        () => verifyClaim(claimText),
        {
          claim: claimText,
          verdict: "Unverified",
          reasoning: "Verification unavailable due to an upstream error",
          sources: [],
        }
      );
    })
  );

  const { aiLikelihood, reasoning: aiReasoning } = await safeStep(
    "detectAIContent",
    () => detectAIContent(translatedText),
    {
      aiLikelihood: DEFAULT_AI_LIKELIHOOD,
      reasoning: "AI detection unavailable; using a neutral estimate",
    }
  );

  const sourceCredibility = inputUrl
    ? await safeStep(
        "getDomainCredibility",
        () => getDomainCredibility(inputUrl),
        DEFAULT_SOURCE_CREDIBILITY
      )
    : DEFAULT_SOURCE_CREDIBILITY;

  let trustScore = DEFAULT_SOURCE_CREDIBILITY;
  let aiScore = 100 - aiLikelihood;
  let sourceScore = sourceCredibility;

  if (verifiedClaims.length > 0) {
    const scores = calculateTrustScore(
      verifiedClaims,
      aiLikelihood,
      sourceCredibility
    );
    trustScore = scores.trustScore;
    aiScore = scores.aiScore;
    sourceScore = scores.sourceScore;
  } else {
    trustScore = Math.round(
      aiScore * 0.25 + sourceScore * 0.25 + 50 * 0.5
    );
  }

  const claimsForResponse = verifiedClaims.map(
    ({ claim, verdict, reasoning, sources }) => ({
      text: claim,
      verdict,
      reasoning,
      sources,
    })
  );

  const check = await Check.create({
    userId: req.user?._id ?? null,
    inputType: type,
    originalText: rawText,
    language,
    claims: verifiedClaims.map(({ claim, verdict, sources }) => ({
      text: claim,
      verdict,
      sources: sources.map((source) => source.url),
    })),
    aiScore,
    sourceScore,
    trustScore,
  });

  return {
    language,
    claims: claimsForResponse,
    aiLikelihood,
    aiReasoning,
    sourceCredibility,
    trustScore,
    checkId: check._id,
  };
};

export const analyze = async (req, res) => {
  try {
    const type = req.body.type;

    if (!type || !["text", "url", "image"].includes(type)) {
      return res.status(400).json({
        message: 'Invalid or missing type. Must be "text", "url", or "image"',
      });
    }

    // Generate cache key based on input content
    const content = req.body.content || "";
    const cacheKey = generateHash(`${type}:${content}`);

    // Check cache first
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      console.log(`[${new Date().toISOString()}] Cache hit for analyze request`);
      return res.status(200).json(cachedResult);
    }

    console.log(`[${new Date().toISOString()}] Cache miss for analyze request, running analysis`);

    const result = await withTimeout(runAnalysis(req), ANALYSIS_TIMEOUT_MS);

    // Cache the result
    setCache(cacheKey, result);
    console.log(`[${new Date().toISOString()}] Analysis result cached with key: ${cacheKey}`);

    res.status(200).json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Analyze request failed:`, error.message);

    if (error.message.includes("timed out")) {
      return res.status(504).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Analysis failed",
    });
  }
};
