import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `You are an expert social media content creator specializing in AI news for Facebook Pages.

Create engaging, original Facebook posts about AI news articles. Follow these rules:
- Do NOT copy article text verbatim
- Write in a clear, engaging tone
- Always attribute the source
- Include 3-6 relevant hashtags
- Keep it under 1,200 characters
- Avoid clickbait, hype, or false claims
- Avoid spammy hashtag stuffing
- Make the post useful and informative
- Focus on what happened and why it matters`;

export async function generateFacebookPost(
  article: {
    title: string;
    description: string | null;
    url: string;
    source: string;
    publishedAt: Date;
  }
): Promise<string> {
  const prompt = `Create a Facebook Page post about this AI news article:

Title: ${article.title}
Source: ${article.source}
${article.description ? `Description: ${article.description}` : ''}
URL: ${article.url}
Published: ${article.publishedAt.toLocaleDateString()}

Format your post with:
1. A compelling hook (first line)
2. What happened (brief explanation)
3. Why it matters
4. Source attribution
5. 3-6 relevant hashtags

Make it engaging, original, and under 1,200 characters.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  throw new Error('Unexpected response format from Anthropic');
}

export async function regeneratePost(
  article: {
    title: string;
    description: string | null;
    url: string;
    source: string;
    publishedAt: Date;
  },
  feedback?: string
): Promise<string> {
  const prompt = `Regenerate a Facebook Page post about this AI news article:

Title: ${article.title}
Source: ${article.source}
${article.description ? `Description: ${article.description}` : ''}
URL: ${article.url}
Published: ${article.publishedAt.toLocaleDateString()}
${feedback ? `\nFeedback to incorporate: ${feedback}` : ''}

Format your post with:
1. A compelling hook (first line)
2. What happened (brief explanation)
3. Why it matters
4. Source attribution
5. 3-6 relevant hashtags

Make it engaging, original, and under 1,200 characters.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  throw new Error('Unexpected response format from Anthropic');
}