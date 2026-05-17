import { Article } from '../types';

const CURRENTS_API_KEY = process.env.CURRENTS_API_KEY;
const BASE_URL = 'https://api.currentsapi.services/api/v1';

interface CurrentsArticle {
  title: string;
  description: string;
  url: string;
  image: string;
  source: string;
  published: string;
  author: string | null;
  content: string | null;
}

interface CurrentsResponse {
  status: string;
  news: CurrentsArticle[];
}

export async function fetchFromCurrentsAPI(keywords: string[]): Promise<Article[]> {
  if (!CURRENTS_API_KEY) {
    console.warn('CURRENTS_API_KEY not configured, skipping Currents API');
    return [];
  }

  try {
    const results: Article[] = [];

    for (const keyword of keywords.slice(0, 5)) {
      const url = `${BASE_URL}/search?keywords=${encodeURIComponent(keyword)}&language=en&api_key=${CURRENTS_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`Currents API error for keyword "${keyword}": ${response.status}`);
        continue;
      }

      const data: CurrentsResponse = await response.json();

      const articles = data.news.map((article) => ({
        title: article.title,
        description: article.description || null,
        url: article.url,
        source: article.source,
        publishedAt: new Date(article.published),
        author: article.author,
        imageUrl: article.image || null,
        rawContent: article.content,
      }));

      results.push(...articles);
    }

    return results;
  } catch (error) {
    console.error('Currents API fetch failed:', error);
    return [];
  }
}