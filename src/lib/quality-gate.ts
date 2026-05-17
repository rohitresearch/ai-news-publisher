import { Article, QualityGateResult } from './types';
import { getRecentPublishedTopics } from './database';

const AI_KEYWORDS = [
  'ai',
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'openai',
  'anthropic',
  'chatgpt',
  'claude',
  'gemini',
  'llama',
  'gpt',
  'llm',
  'generative ai',
];

function isAIRelated(article: Article): boolean {
  const text = `${article.title} ${article.description || ''}`.toLowerCase();
  return AI_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isRecentArticle(article: Article): boolean {
  const daysOld = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysOld <= 7;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasSourceAttribution(content: string): boolean {
  return content.toLowerCase().includes('source:') ||
         content.toLowerCase().includes('via:') ||
         content.toLowerCase().includes('based on') ||
         content.includes('http');
}

function hasExcessiveHashtags(content: string): boolean {
  const hashtagCount = (content.match(/#\w+/g) || []).length;
  return hashtagCount > 6;
}

function hasFalseClaims(content: string): boolean {
  const falseClaimIndicators = [
    'proven fact',
    'scientifically proven',
    '100% accurate',
    'guaranteed',
    'always',
    'never',
  ];
  return falseClaimIndicators.some((indicator) => content.toLowerCase().includes(indicator));
}

async function isDuplicateTopic(content: string): Promise<boolean> {
  const recentTopics = await getRecentPublishedTopics(7);

  const contentWords = content
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);

  for (const topic of recentTopics) {
    const topicWords = topic.split(/\s+/).filter((w) => w.length > 4);
    const overlap = contentWords.filter((w) => topic.includes(w)).length;
    const similarity = overlap / Math.max(contentWords.length, topicWords.length);

    if (similarity > 0.6) {
      return true;
    }
  }

  return false;
}

export async function validateArticle(article: Article): Promise<QualityGateResult> {
  const reasons: string[] = [];
  let needsReview = false;

  if (!isAIRelated(article)) {
    reasons.push('Not AI-related content');
  }

  if (!isRecentArticle(article)) {
    reasons.push('Article is older than 7 days');
  }

  if (!article.source || article.source.trim() === '') {
    reasons.push('Missing source information');
    needsReview = true;
  }

  if (!isValidUrl(article.url)) {
    reasons.push('Invalid or missing URL');
  }

  if (hasExcessiveHashtags(article.rawContent || '')) {
    reasons.push('Excessive hashtags detected');
  }

  return {
    passed: reasons.length === 0,
    needsReview,
    reasons,
  };
}

export async function validatePost(
  article: Article,
  postContent: string
): Promise<QualityGateResult> {
  const reasons: string[] = [];
  let needsReview = false;

  if (!isAIRelated(article)) {
    reasons.push('Post is not AI-related');
    needsReview = true;
  }

  if (!isRecentArticle(article)) {
    reasons.push('Post references old article');
    needsReview = true;
  }

  if (!article.source) {
    reasons.push('Missing source attribution');
  }

  if (!hasSourceAttribution(postContent)) {
    reasons.push('Post lacks source attribution');
    needsReview = true;
  }

  if (hasExcessiveHashtags(postContent)) {
    reasons.push('Post has excessive hashtags');
  }

  if (hasFalseClaims(postContent)) {
    reasons.push('Post contains potentially false claims');
    needsReview = true;
  }

  if (await isDuplicateTopic(postContent)) {
    reasons.push('Similar topic posted in last 7 days');
    needsReview = true;
  }

  if (postContent.length > 1200) {
    reasons.push('Post exceeds 1,200 character limit');
  }

  return {
    passed: reasons.length === 0,
    needsReview,
    reasons,
  };
}