import { deduplicateArticles } from '@/lib/deduplication';
import { scoreArticle } from '@/lib/scoring';
import { validateArticle } from '@/lib/quality-gate';
import type { Article } from '@/lib/types';

describe('Deduplication', () => {
  const baseArticle: Article = {
    title: 'OpenAI Releases New AI Model',
    description: 'OpenAI has released a new AI model',
    url: 'https://example.com/article1',
    source: 'TechCrunch',
    publishedAt: new Date('2024-01-15'),
    author: 'John Doe',
    imageUrl: null,
    rawContent: null,
  };

  test('removes duplicate by URL', () => {
    const articles: Article[] = [
      baseArticle,
      { ...baseArticle, url: 'https://example.com/article1' },
      { ...baseArticle, url: 'https://example.com/article2' },
    ];

    const result = deduplicateArticles(articles);
    expect(result).toHaveLength(2);
  });

  test('removes similar titles', () => {
    const articles: Article[] = [
      baseArticle,
      {
        ...baseArticle,
        title: 'OpenAI releases NEW AI model',
        url: 'https://example.com/article2',
      },
    ];

    const result = deduplicateArticles(articles);
    expect(result).toHaveLength(1);
  });

  test('keeps articles with different titles', () => {
    const articles: Article[] = [
      baseArticle,
      {
        ...baseArticle,
        title: 'Google Announces Gemini Update',
        url: 'https://example.com/article2',
      },
    ];

    const result = deduplicateArticles(articles);
    expect(result).toHaveLength(2);
  });

  test('handles empty array', () => {
    const result = deduplicateArticles([]);
    expect(result).toHaveLength(0);
  });

  test('handles single article', () => {
    const result = deduplicateArticles([baseArticle]);
    expect(result).toHaveLength(1);
  });
});

describe('Scoring', () => {
  test('rejects non-AI content', () => {
    const article: Article = {
      title: 'Best Cryptocurrency Trading Tips',
      description: 'Learn how to trade crypto',
      url: 'https://example.com/crypto',
      source: 'CryptoNews',
      publishedAt: new Date(),
      author: null,
      imageUrl: null,
      rawContent: null,
    };

    const result = scoreArticle(article);
    expect(result.finalScore).toBe(0);
    expect(result.rejectionReason).toBe('Not AI-related content');
  });

  test('rejects spam content', () => {
    const article: Article = {
      title: 'AI Bitcoin Trading Signals - Make Money Fast!',
      description: 'Click here for free crypto signals',
      url: 'https://example.com/spam',
      source: 'CryptoSpam',
      publishedAt: new Date(),
      author: null,
      imageUrl: null,
      rawContent: null,
    };

    const result = scoreArticle(article);
    expect(result.finalScore).toBe(0);
    expect(result.rejectionReason).toBe('Spam or low-quality content detected');
  });

  test('rejects old articles', () => {
    const article: Article = {
      title: 'OpenAI Releases New AI Model',
      description: 'A description of the new model',
      url: 'https://example.com/old',
      source: 'TechCrunch',
      publishedAt: new Date('2020-01-01'),
      author: 'John Doe',
      imageUrl: null,
      rawContent: null,
    };

    const result = scoreArticle(article);
    expect(result.finalScore).toBe(0);
    expect(result.rejectionReason).toBe('Article is older than 7 days');
  });

  test('scores high for recent AI news from quality source', () => {
    const article: Article = {
      title: 'OpenAI Announces New AI Research Breakthrough',
      description: 'OpenAI researchers have published new findings on machine learning',
      url: 'https://techcrunch.com/openai',
      source: 'TechCrunch',
      publishedAt: new Date(),
      author: 'Sarah Johnson',
      imageUrl: 'https://example.com/image.jpg',
      rawContent: 'Full article content here...',
    };

    const result = scoreArticle(article);
    expect(result.aiRelevanceScore).toBeGreaterThan(5);
    expect(result.credibilityScore).toBeGreaterThan(5);
    expect(result.finalScore).toBeGreaterThanOrEqual(7);
  });

  test('rejects articles below threshold', () => {
    const article: Article = {
      title: 'Random Tech News',
      description: 'Some tech news without AI focus',
      url: 'https://example.com/random',
      source: 'Unknown Blog',
      publishedAt: new Date(),
      author: null,
      imageUrl: null,
      rawContent: null,
    };

    const result = scoreArticle(article);
    if (result.finalScore < 7) {
      expect(result.rejectionReason).toBeTruthy();
    }
  });

  test('scores novelty based on age', () => {
    const todayArticle: Article = {
      title: 'Anthropic Claude Update',
      description: 'New Claude features announced',
      url: 'https://example.com/today',
      source: 'TechCrunch',
      publishedAt: new Date(),
      author: 'Author',
      imageUrl: null,
      rawContent: null,
    };

    const weekOldArticle: Article = {
      title: 'Anthropic Claude Update',
      description: 'New Claude features announced',
      url: 'https://example.com/week',
      source: 'TechCrunch',
      publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      author: 'Author',
      imageUrl: null,
      rawContent: null,
    };

    const todayResult = scoreArticle(todayArticle);
    const weekResult = scoreArticle(weekOldArticle);

    expect(todayResult.noveltyScore).toBeGreaterThanOrEqual(weekResult.noveltyScore);
  });
});

describe('Quality Gate', () => {
  test('passes valid AI article', async () => {
    const article: Article = {
      title: 'OpenAI Launches New AI Assistant',
      description: 'A helpful AI assistant for everyone',
      url: 'https://techcrunch.com/openai',
      source: 'TechCrunch',
      publishedAt: new Date(),
      author: 'Author Name',
      imageUrl: null,
      rawContent: 'Article content',
    };

    const result = await validateArticle(article);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  test('fails for non-AI article', async () => {
    const article: Article = {
      title: 'Sports Championship Results',
      description: 'The results are in',
      url: 'https://sports.com/results',
      source: 'Sports News',
      publishedAt: new Date(),
      author: null,
      imageUrl: null,
      rawContent: null,
    };

    const result = await validateArticle(article);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('Not AI-related content');
  });

  test('fails for old article', async () => {
    const article: Article = {
      title: 'OpenAI AI News',
      description: 'Some news',
      url: 'https://example.com/old',
      source: 'TechCrunch',
      publishedAt: new Date('2020-01-01'),
      author: null,
      imageUrl: null,
      rawContent: null,
    };

    const result = await validateArticle(article);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('Article is older than 7 days');
  });

  test('marks as needs_review for missing source', async () => {
    const article: Article = {
      title: 'AI News',
      description: 'Description',
      url: 'https://example.com/news',
      source: '',
      publishedAt: new Date(),
      author: null,
      imageUrl: null,
      rawContent: null,
    };

    const result = await validateArticle(article);
    expect(result.needsReview).toBe(true);
  });

  test('fails for invalid URL', async () => {
    const article: Article = {
      title: 'AI News',
      description: 'Description',
      url: 'not-a-valid-url',
      source: 'TechCrunch',
      publishedAt: new Date(),
      author: null,
      imageUrl: null,
      rawContent: null,
    };

    const result = await validateArticle(article);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('Invalid or missing URL');
  });
});