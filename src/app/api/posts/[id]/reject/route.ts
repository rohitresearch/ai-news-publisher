import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseClient();

    // Get the post first to find the article_id
    const { data: post } = await supabase
      .from('generated_posts')
      .select('article_id')
      .eq('id', id)
      .single();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Update the post status to rejected
    await supabase
      .from('generated_posts')
      .update({
        status: 'rejected',
        approved_at: null,
        approved_by: null,
      })
      .eq('id', id);

    // Also update the article status to 'rejected'
    if (post.article_id) {
      await supabase
        .from('articles')
        .update({ status: 'rejected' })
        .eq('id', post.article_id);
    }

    return NextResponse.json({ success: true, status: 'rejected' });
  } catch (error) {
    console.error('Failed to reject post:', error);
    return NextResponse.json(
      { error: 'Failed to reject post' },
      { status: 500 }
    );
  }
}