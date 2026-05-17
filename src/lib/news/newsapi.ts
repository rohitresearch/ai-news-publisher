import { Article } from '../types';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

interface NewsAPIArticle {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  source: { name: string };
  publishedAt: string;
  author: string | null;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  articles: NewsAPIArticle[];
}

export async function fetchFromNewsAPI(keywords: string[]): Promise<Article[]> {
  if (!NEWS_API_KEY) {
    console.warn('NEWS_API_KEY not configured, skipping NewsAPI');
    return [];
  }

  try {
    const query = keywords.join(' OR ');
    const url = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=50&apiKey=${NEWS_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status} ${response.statusText}`);
    }

    const data: NewsAPIResponse = await response.json();

    return data.articles.map((article) => ({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source.name,
      publishedAt: new Date(article.publishedAt),
      author: article.author,
      imageUrl: article.urlToImage,
      rawContent: article.content,
    }));
  } catch (error) {
    console.error('NewsAPI fetch failed:', error);
    return [];
  }
}