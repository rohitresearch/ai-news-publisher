import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabaseUrl = 'https://yevkomqrazxmixhfxzzq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldmtvbXFyYXp4bWl4aGZ4enpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0NDQ5MiwiZXhwIjoyMDk0NjIwNDkyfQ._12lE0aTz0Rvx3_ngbBP-tstoeJKt9wHSzc0U2K1cdw';

const client = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-opm-YVn3EFAXIb1P6B5twqG1opeCiSuFd1pF' });

async function fixExistingArticles() {
  console.log('Finding scored articles without generated posts...\n');

  // Get all articles with score >= 7 that don't have a generated post
  const { data: scoredArticles } = await client
    .from('articles')
    .select('*')
    .gte('final_score', 7)
    .eq('status', 'scored');

  console.log(`Found ${scoredArticles?.length || 0} scored articles without drafts\n`);

  if (!scoredArticles || scoredArticles.length === 0) {
    console.log('No articles to fix.');
    return;
  }

  for (const article of scoredArticles) {
    // Check if it already has a post
    const { data: existingPost } = await client
      .from('generated_posts')
      .select('id')
      .eq('article_id', article.id)
      .single();

    if (existingPost) {
      console.log(`Skipping ${article.title.substring(0, 40)}... - already has post`);
      continue;
    }

    console.log(`Processing: ${article.title.substring(0, 50)}...`);

    try {
      // Generate Facebook post
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: `You are an expert social media content creator specializing in AI news for Facebook Pages.
Create engaging Facebook posts. Rules:
- Do NOT copy article text verbatim
- Write in a clear, engaging tone
- Always attribute the source
- Include 3-6 relevant hashtags
- Keep it under 1,200 characters`,
        messages: [{
          role: 'user',
          content: `Create a Facebook Page post about this AI news article:
Title: ${article.title}
Source: ${article.source}
Description: ${article.description || 'N/A'}
URL: ${article.url}
Published: ${new Date(article.published_at).toLocaleDateString()}
Format: Hook + explanation + why it matters + source + 3-6 hashtags`
        }],
      });

      let postContent = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          postContent = block.text;
          break;
        }
      }

      // Save post
      await client
        .from('generated_posts')
        .insert({
          article_id: article.id,
          content: postContent,
          needs_review: true,
          status: 'drafted',
        });

      // Update article status to drafted
      await client
        .from('articles')
        .update({ status: 'drafted' })
        .eq('id', article.id);

      console.log(`✅ Created draft for: ${article.title.substring(0, 40)}...\n`);
    } catch (err) {
      console.log(`❌ Failed: ${err}\n`);
    }
  }

  console.log('\n✅ Done fixing existing articles!');
}

fixExistingArticles().catch(console.error);