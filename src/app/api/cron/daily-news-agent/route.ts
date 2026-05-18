import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchAllNews } from '@/lib/news';
import { deduplicateArticles } from '@/lib/deduplication';
import { scoreArticle } from '@/lib/scoring';
import { generateFacebookPost } from '@/lib/post-generation';

export const maxDuration = 120;

const MAX_POSTS_TO_GENERATE = 5;

function getSupabaseClient() {
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

    // Step 1: Fetch news
    console.log('Fetching news...');
    let articles = await fetchAllNews();
    stats.fetched = articles.length;
    console.log(`Fetched ${articles.length} articles`);

    // Step 2: Deduplicate
    articles = deduplicateArticles(articles);
    stats.deduplicated = articles.length;
    console.log(`After dedup: ${articles.length} articles`);

    // Step 3: Check existing articles in DB (batch query)
    console.log('Checking existing articles...');
    const existingUrls = new Set<string>();
    const { data: existingArticles } = await client
      .from('articles')
      .select('url, final_score')
      .in('url', articles.map(a => a.url));

    existingArticles?.forEach((a: { url: string; final_score: number }) => {
      if (a.final_score > 0) {
        existingUrls.add(a.url);
        stats.skipped++;
      }
    });

    // Filter out already processed articles
    articles = articles.filter(a => !existingUrls.has(a.url));
    console.log(`After filtering existing: ${articles.length} articles`);

    // Step 4: Score all articles in parallel
    console.log('Scoring articles...');
    const scoredArticles = articles.map(article => {
      const scoringResult = scoreArticle(article);
      return {
        article,
        scoringResult,
        status: scoringResult.finalScore >= 7 ? 'qualified' : 'rejected',
      };
    });

    stats.scored = scoredArticles.length;

    // Get qualified articles (score >= 7) sorted by score
    const qualifiedArticles = scoredArticles
      .filter(sa => sa.status === 'qualified')
      .sort((a, b) => b.scoringResult.finalScore - a.scoringResult.finalScore)
      .slice(0, MAX_POSTS_TO_GENERATE);

    console.log(`Qualified articles: ${qualifiedArticles.length}`);

    // Step 5: Insert qualified articles and generate posts in parallel
    if (qualifiedArticles.length > 0) {
      console.log('Generating posts in parallel...');

      const insertPromises = qualifiedArticles.map(async (sa) => {
        const { article, scoringResult } = sa;

        try {
          // Upsert article
          const { data: newArticle } = await client
            .from('articles')
            .upsert({
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
              status: 'drafted',
            }, { onConflict: 'url' })
            .select()
            .single();

          if (newArticle) {
            // Generate Facebook post using AI
            const postContent = await generateFacebookPost({
              title: article.title,
              description: article.description,
              url: article.url,
              source: article.source,
              publishedAt: article.publishedAt,
            });

            // Save the generated post
            await client
              .from('generated_posts')
              .upsert({
                article_id: newArticle.id,
                content: postContent,
                needs_review: true,
                status: 'drafted',
              }, { onConflict: 'article_id' });

            return { success: true, url: article.url };
          }
        } catch (err) {
          console.error(`Failed to process ${article.url}:`, err);
          stats.errors.push(`Failed: ${article.url}`);
          return { success: false, url: article.url };
        }
      });

      // Wait for all insertions to complete
      const results = await Promise.all(insertPromises);
      stats.drafted = results.filter(r => r.success).length;
    }

    // Step 6: Also mark rejected articles in DB (those with score < 7)
    const rejectedArticles = scoredArticles
      .filter(sa => sa.status === 'rejected')
      .slice(0, 20); // Limit to avoid too many writes

    if (rejectedArticles.length > 0) {
      const rejectPromises = rejectedArticles.map(async (sa) => {
        const { article, scoringResult } = sa;
        try {
          await client
            .from('articles')
            .upsert({
              title: article.title,
              description: article.description,
              url: article.url,
              source: article.source,
              published_at: article.publishedAt.toISOString(),
              ai_relevance_score: scoringResult.aiRelevanceScore,
              novelty_score: scoringResult.noveltyScore,
              credibility_score: scoringResult.credibilityScore,
              audience_value_score: scoringResult.audienceValueScore,
              virality_score: scoringResult.viralityScore,
              final_score: scoringResult.finalScore,
              rejection_reason: scoringResult.rejectionReason,
              status: 'rejected',
            }, { onConflict: 'url' });
        } catch (err) {
          // Ignore errors for rejected articles
        }
      });
      await Promise.all(rejectPromises);
    }

    console.log('Done! Stats:', stats);

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