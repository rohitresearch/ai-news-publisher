import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchAllNews } from '@/lib/news';
import { deduplicateArticles } from '@/lib/deduplication';
import { scoreArticle } from '@/lib/scoring';
import { generateFacebookPost } from '@/lib/post-generation';

export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseClient(): any {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = getSupabaseClient();
    const stats = {
      fetched: 0,
      deduplicated: 0,
      scored: 0,
      drafted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    let articles = await fetchAllNews();
    stats.fetched = articles.length;

    articles = deduplicateArticles(articles);
    stats.deduplicated = articles.length;

    for (const article of articles) {
      try {
        const { data: existing } = await client
          .from('articles')
          .select('id, final_score')
          .eq('url', article.url)
          .single();

        if (existing && existing.final_score && existing.final_score > 0) {
          stats.skipped++;
          continue;
        }

        if (existing) {
          const scoringResult = scoreArticle(article);
          await client
            .from('articles')
            .update({
              title: article.title,
              description: article.description,
              source: article.source,
              published_at: article.publishedAt.toISOString(),
              author: article.author,
              image_url: article.imageUrl,
              raw_content: article.rawContent,
              ai_relevance_score: scoringResult.aiRelevanceScore,
              novelty_score: scoringResult.noveltyScore,
              credibility_score: scoringResult.credibilityScore,
              audience_value_score: scoringResult.audienceValueScore,
              virality_score: scoringResult.viralityScore,
              final_score: scoringResult.finalScore,
              rejection_reason: scoringResult.rejectionReason,
              status: scoringResult.finalScore >= 7 ? 'scored' : 'rejected',
            })
            .eq('id', existing.id);

          if (scoringResult.finalScore >= 7) {
            await generateDraft(client, existing.id, article);
            stats.drafted++;
          }
          stats.scored++;
        } else {
          const scoringResult = scoreArticle(article);
          const { data: newArticle } = await client
            .from('articles')
            .insert({
              title: article.title,
              description: article.description,
              url: article.url,
              source: article.source,
              published_at: article.publishedAt.toISOString(),
              author: article.author,
              image_url: article.imageUrl,
              raw_content: article.rawContent,
              ai_relevance_score: scoringResult.aiRelevanceScore,
              novelty_score: scoringResult.noveltyScore,
              credibility_score: scoringResult.credibilityScore,
              audience_value_score: scoringResult.audienceValueScore,
              virality_score: scoringResult.viralityScore,
              final_score: scoringResult.finalScore,
              rejection_reason: scoringResult.rejectionReason,
              status: scoringResult.finalScore >= 7 ? 'scored' : 'rejected',
            })
            .select()
            .single();

          if (newArticle && scoringResult.finalScore >= 7) {
            await generateDraft(client, newArticle.id, article);
            stats.drafted++;
          }
          stats.scored++;
        }
      } catch (err) {
        stats.errors.push(`Failed to process article: ${article.url}`);
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      message: `Processed ${stats.fetched} articles. Created ${stats.drafted} drafts.`,
    });
  } catch (error) {
    console.error('Daily news agent error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function generateDraft(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  articleId: string,
  article: { title: string; description: string | null; url: string; source: string; publishedAt: Date }
) {
  try {
    const postContent = await generateFacebookPost({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source,
      publishedAt: article.publishedAt,
    });

    await client.from('generated_posts').upsert(
      {
        article_id: articleId,
        content: postContent,
        needs_review: false,
        status: 'drafted',
      },
      { onConflict: 'article_id' }
    );

    await client
      .from('articles')
      .update({ status: 'drafted' })
      .eq('id', articleId);
  } catch (error) {
    console.error(`Failed to generate post for ${article.url}:`, error);
  }
}