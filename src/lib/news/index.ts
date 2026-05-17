import { Article } from '../types';
import { fetchFromNewsAPI } from './newsapi';
import { fetchFromCurrentsAPI } from './currents';
import { fetchFromMultipleFeeds } from './rss';

const DEFAULT_KEYWORDS = [
  'AI',
  'artificial intelligence',
  'OpenAI',
  'Anthropic',
  'Google DeepMind',
  'ChatGPT',
  'Claude',
  'Gemini',
  'Llama',
  'AI agents',
  'machine learning',
];

const DEFAULT_RSS_FEEDS = [
  'https://feeds.feedburner.com/TechCrunch/',
  'https://rss.ai.com/',
];

function getKeywords(): string[] {
  const env = process.env.AI_KEYWORDS;
  if (env) {
    return env.split(',').map((k) => k.trim()).filter(Boolean);
  }
  return DEFAULT_KEYWORDS;
}

function getRssFeeds(): string[] {
  const env = process.env.RSS_FEED_URLS;
  if (env) {
    return env.split(',').map((u) => u.trim()).filter(Boolean);
  }
  return DEFAULT_RSS_FEEDS;
}

export async function fetchAllNews(): Promise<Article[]> {
  const keywords = getKeywords();
  const rssFeeds = getRssFeeds();

  const [newsApiArticles, currentsArticles, rssArticles] = await Promise.all([
    fetchFromNewsAPI(keywords),
    fetchFromCurrentsAPI(keywords),
    fetchFromMultipleFeeds(rssFeeds),
  ]);

  const allArticles = [...newsApiArticles, ...currentsArticles, ...rssArticles];

  const seen = new Set<string>();
  return allArticles.filter((article) => {
    if (seen.has(article.url)) return false;
    seen.add(article.url);
    return true;
  });
}