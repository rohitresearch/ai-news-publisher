import Parser from 'rss-parser';
import { Article } from '../types';

const parser = new Parser({
  headers: {
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

export async function fetchFromRSSFeed(feedUrl: string): Promise<Article[]> {
  try {
    const feed = await parser.parseURL(feedUrl);

    return feed.items.map((item) => ({
      title: item.title || 'Untitled',
      description: item.contentSnippet || item.content || null,
      url: item.link || item.guid || '',
      source: feed.title || 'Unknown RSS Feed',
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      author: item.creator || item.author || null,
      imageUrl: item.enclosure?.url || null,
      rawContent: item.content || null,
    }));
  } catch (error) {
    console.error(`RSS fetch failed for ${feedUrl}:`, error);
    return [];
  }
}

export async function fetchFromMultipleFeeds(feedUrls: string[]): Promise<Article[]> {
  const results: Article[] = [];

  for (const url of feedUrls) {
    const articles = await fetchFromRSSFeed(url);
    results.push(...articles);
  }

  return results;
}