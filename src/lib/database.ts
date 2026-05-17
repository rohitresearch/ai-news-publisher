import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export function getSupabaseClient() {
  return getSupabase();
}

export async function getArticles(status?: string, limit = 50, offset = 0) {
  const supabase = getSupabase();
  let query = supabase
    .from('articles')
    .select('*')
    .order('final_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getArticleById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function upsertArticle(article: {
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  description?: string | null;
  author?: string | null;
  imageUrl?: string | null;
  rawContent?: string | null;
}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('articles')
    .upsert(
      {
        title: article.title,
        url: article.url,
        source: article.source,
        published_at: article.publishedAt.toISOString(),
        description: article.description,
        author: article.author,
        image_url: article.imageUrl,
        raw_content: article.rawContent,
      },
      { onConflict: 'url' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateArticleScore(
  id: string,
  scores: {
    aiRelevanceScore: number;
    noveltyScore: number;
    credibilityScore: number;
    audienceValueScore: number;
    viralityScore: number;
    finalScore: number;
    rejectionReason?: string;
  }
) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('articles')
    .update({
      ai_relevance_score: scores.aiRelevanceScore,
      novelty_score: scores.noveltyScore,
      credibility_score: scores.credibilityScore,
      audience_value_score: scores.audienceValueScore,
      virality_score: scores.viralityScore,
      final_score: scores.finalScore,
      rejection_reason: scores.rejectionReason,
      status: scores.finalScore >= 7 ? 'scored' : 'rejected',
    })
    .eq('id', id);
  if (error) throw error;
}

export async function updateArticleStatus(id: string, status: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('articles')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function getPostsByArticleId(articleId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('generated_posts')
    .select('*')
    .eq('article_id', articleId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertPost(post: {
  articleId: string;
  content: string;
  needsReview?: boolean;
  qualityNotes?: string;
}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('generated_posts')
    .upsert(
      {
        article_id: post.articleId,
        content: post.content,
        needs_review: post.needsReview ?? false,
        quality_notes: post.qualityNotes,
        status: 'drafted',
      },
      { onConflict: 'article_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePostStatus(id: string, status: string, extra?: Record<string, unknown>) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('generated_posts')
    .update({ status, ...extra })
    .eq('id', id);
  if (error) throw error;
}

export async function approvePost(id: string, approvedBy?: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('generated_posts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function getRecentPublishedTopics(days = 7): Promise<string[]> {
  const supabase = getSupabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const { data, error } = await supabase
    .from('generated_posts')
    .select('content')
    .eq('status', 'published')
    .gte('published_at', cutoff.toISOString());

  if (error) throw error;
  return (data || []).map((p) => p.content.toLowerCase());
}

export async function createPublishingLog(log: {
  articleId?: string;
  postId?: string;
  action: string;
  status: 'success' | 'failed';
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
}) {
  const supabase = getSupabase();
  const { error } = await supabase.from('publishing_logs').insert({
    article_id: log.articleId,
    post_id: log.postId,
    action: log.action,
    status: log.status,
    request_payload: log.requestPayload,
    response_payload: log.responsePayload,
    error_message: log.errorMessage,
  });
  if (error) throw error;
}

export async function getAppSetting(key: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.value ?? null;
}