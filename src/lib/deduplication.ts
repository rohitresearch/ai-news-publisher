import { Article } from './types';

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function calculateSimilarity(a: string, b: string): number {
  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);

  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  return 1 - distance / maxLength;
}

export function deduplicateArticles(articles: Article[]): Article[] {
  const seenUrls = new Set<string>();
  const seenTitles: { title: string; article: Article }[] = [];
  const SIMILARITY_THRESHOLD = 0.85;

  return articles.filter((article) => {
    if (seenUrls.has(article.url)) {
      return false;
    }
    seenUrls.add(article.url);

    const normalizedTitle = normalizeString(article.title);
    for (const { title } of seenTitles) {
      const similarity = calculateSimilarity(normalizedTitle, title);
      if (similarity >= SIMILARITY_THRESHOLD) {
        return false;
      }
    }

    seenTitles.push({ title: normalizedTitle, article: article });
    return true;
  });
}

export function extractCanonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}