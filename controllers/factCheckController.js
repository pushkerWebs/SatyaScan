import { compareClaimWithSources } from "../utils/genai.js";

const NEWS_API_URL = "https://newsapi.org/v2/everything";
const FACT_CHECK_API_URL =
  "https://factchecktools.googleapis.com/v1alpha1/claims:search";

const fetchNewsSources = async (claim) => {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.warn("NEWS_API_KEY is not configured; skipping NewsAPI lookup");
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: claim,
      pageSize: "10",
      sortBy: "relevancy",
      apiKey,
    });

    const response = await fetch(`${NEWS_API_URL}?${params.toString()}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`NewsAPI error (${response.status}): ${errorBody}`);
      return [];
    }

    const data = await response.json();
    return (data.articles || [])
      .filter((article) => article.title && article.url)
      .map((article) => ({
        title: article.title,
        url: article.url,
        source: article.source?.name || "Unknown",
      }));
  } catch (error) {
    console.warn(`NewsAPI request failed: ${error.message}`);
    return [];
  }
};

const fetchFactCheckSources = async (claim) => {
  const apiKey = process.env.FACT_CHECK_API_KEY;
  if (!apiKey) {
    console.warn(
      "FACT_CHECK_API_KEY is not configured; skipping Fact Check API lookup"
    );
    return [];
  }

  try {
    const params = new URLSearchParams({
      query: claim,
      key: apiKey,
    });

    const response = await fetch(`${FACT_CHECK_API_URL}?${params.toString()}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`Fact Check API error (${response.status}): ${errorBody}`);
      return [];
    }

    const data = await response.json();
    const sources = [];

    for (const item of data.claims || []) {
      for (const review of item.claimReview || []) {
        if (!review.url) continue;

        sources.push({
          title: review.title || item.text || claim,
          url: review.url,
          source: review.publisher?.name || "Fact Check",
        });
      }
    }

    return sources;
  } catch (error) {
    console.warn(`Fact Check API request failed: ${error.message}`);
    return [];
  }
};

const dedupeSources = (sources) => {
  const seen = new Set();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
};

export const verifyClaim = async (claim) => {
  if (!claim?.trim()) {
    throw new Error("Claim is required");
  }

  const trimmedClaim = claim.trim();

  const [newsSources, factCheckSources] = await Promise.all([
    fetchNewsSources(trimmedClaim),
    fetchFactCheckSources(trimmedClaim),
  ]);

  const sources = dedupeSources([...factCheckSources, ...newsSources]);

  const { verdict, reasoning } = await compareClaimWithSources(
    trimmedClaim,
    sources
  );

  return {
    claim: trimmedClaim,
    verdict,
    reasoning,
    sources,
  };
};
