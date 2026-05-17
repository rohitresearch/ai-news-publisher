import { Article, ScoringResult } from './types';

const AI_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'neural network',
  'openai',
  'anthropic',
  'google deepmind',
  'chatgpt',
  'claude',
  'gemini',
  'llama',
  'gpt',
  'llm',
  'generative ai',
  'ai agent',
  'automation',
  'language model',
];

const HIGH_QUALITY_SOURCES = [
  'techcrunch',
  'the verge',
  'wired',
  'ars technica',
  'mit technology review',
  'nature',
  'science',
  'bloomberg technology',
  'reuters tech',
  'associated press tech',
  'bbc tech',
  'bloomberg',
  'reuters',
  'associated press',
];

const SPAM_INDICATORS = [
  'crypto',
  'bitcoin',
  'ethereum',
  'binance',
  'trading signal',
  'investment opportunity',
  'make money fast',
  'click here',
  'act now',
  'limited time',
  'free gift',
];

function isAIRelated(article: Article): boolean {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();
  return AI_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isSpam(article: Article): boolean {
  const text = `${article.title} ${article.description || ''} ${article.rawContent || ''}`.toLowerCase();
  return SPAM_INDICATORS.some((indicator) => text.includes(indicator));
}

function isRecentArticle(article: Article): boolean {
  const daysOld = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysOld <= 7;
}

function getSourceCredibility(source: string): number {
  const sourceLower = source.toLowerCase();
  if (HIGH_QUALITY_SOURCES.some((s) => sourceLower.includes(s))) {
    return 9;
  }
  return 6;
}

function calculateRelevanceScore(article: Article): number {
  let score = 5;
  const text = `${article.title} ${article.description || ''}`.toLowerCase();

  const aiMentions = AI_KEYWORDS.filter((kw) => text.includes(kw)).length;
  score += Math.min(aiMentions * 2, 5);

  if (text.includes('announcement') || text.includes('launch') || text.includes('release')) {
    score += 1;
  }
  if (text.includes('research') || text.includes('study') || text.includes('paper')) {
    score += 1;
  }

  return Math.min(score, 10);
}

function calculateNoveltyScore(article: Article): number {
  let score = 7;

  const daysOld = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld <= 1) {
    score += 3;
  } else if (daysOld <= 3) {
    score += 1;
  } else {
    score -= 2;
  }

  return Math.max(1, Math.min(score, 10));
}

function calculateCredibilityScore(article: Article): number {
  let score = getSourceCredibility(article.source);

  if (!article.author) {
    score -= 1;
  }

  if (article.description && article.description.length > 50) {
    score += 1;
  }

  if (article.rawContent && article.rawContent.length > 200) {
    score += 1;
  }

  return Math.max(1, Math.min(score, 10));
}

function calculateAudienceValueScore(article: Article): number {
  let score = 5;
  const text = `${article.title} ${article.description || ''}`.toLowerCase();

  if (text.includes('how to') || text.includes('tutorial') || text.includes('guide')) {
    score += 2;
  }
  if (text.includes('comparison') || text.includes('vs') || text.includes('versus')) {
    score += 1;
  }
  if (text.includes('benchmark') || text.includes('performance') || text.includes('results')) {
    score += 2;
  }

  return Math.min(score, 10);
}

function calculateViralityScore(article: Article): number {
  let score = 5;
  const text = `${article.title} ${article.description || ''}`.toLowerCase();

  if (
    text.includes('breakthrough') ||
    text.includes('revolutionary') ||
    text.includes('world first') ||
    text.includes('record')
  ) {
    score += 3;
  }
  if (
    text.includes('open source') ||
    text.includes('free') ||
    text.includes('available')
  ) {
    score += 2;
  }
  if (article.imageUrl) {
    score += 1;
  }

  return Math.min(score, 10);
}

function calculateFinalScore(scores: Omit<ScoringResult, 'finalScore' | 'rejectionReason'>): number {
  const weights = {
    aiRelevanceScore: 0.35,
    noveltyScore: 0.15,
    credibilityScore: 0.25,
    audienceValueScore: 0.15,
    viralityScore: 0.1,
  };

  return (
    scores.aiRelevanceScore * weights.aiRelevanceScore +
    scores.noveltyScore * weights.noveltyScore +
    scores.credibilityScore * weights.credibilityScore +
    scores.audienceValueScore * weights.audienceValueScore +
    scores.viralityScore * weights.viralityScore
  );
}

export function scoreArticle(article: Article): ScoringResult {
  if (!isAIRelated(article)) {
    return {
      aiRelevanceScore: 0,
      noveltyScore: 0,
      credibilityScore: 0,
      audienceValueScore: 0,
      viralityScore: 0,
      finalScore: 0,
      rejectionReason: 'Not AI-related content',
    };
  }

  if (isSpam(article)) {
    return {
      aiRelevanceScore: 2,
      noveltyScore: 2,
      credibilityScore: 2,
      audienceValueScore: 2,
      viralityScore: 2,
      finalScore: 0,
      rejectionReason: 'Spam or low-quality content detected',
    };
  }

  if (!isRecentArticle(article)) {
    return {
      aiRelevanceScore: 5,
      noveltyScore: 1,
      credibilityScore: 5,
      audienceValueScore: 3,
      viralityScore: 2,
      finalScore: 0,
      rejectionReason: 'Article is older than 7 days',
    };
  }

  const aiRelevanceScore = calculateRelevanceScore(article);
  const noveltyScore = calculateNoveltyScore(article);
  const credibilityScore = calculateCredibilityScore(article);
  const audienceValueScore = calculateAudienceValueScore(article);
  const viralityScore = calculateViralityScore(article);

  const finalScore = calculateFinalScore({
    aiRelevanceScore,
    noveltyScore,
    credibilityScore,
    audienceValueScore,
    viralityScore,
  });

  if (finalScore < 7) {
    return {
      aiRelevanceScore,
      noveltyScore,
      credibilityScore,
      audienceValueScore,
      viralityScore,
      finalScore,
      rejectionReason: `Score below threshold: ${finalScore.toFixed(1)}/10`,
    };
  }

  return {
    aiRelevanceScore,
    noveltyScore,
    credibilityScore,
    audienceValueScore,
    viralityScore,
    finalScore,
  };
}