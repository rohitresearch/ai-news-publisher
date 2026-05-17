import { NextRequest, NextResponse } from 'next/server';
import { getArticleById, getPostsByArticleId, updatePostStatus } from '@/lib/database';
import { publishToFacebookPage, FacebookPublishingError } from '@/lib/facebook';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const post = await getPostsByArticleId(id);

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found. Generate a draft first.' },
        { status: 404 }
      );
    }

    if (post.status === 'published') {
      return NextResponse.json(
        { error: 'Post already published', facebookPostId: post.facebook_post_id },
        { status: 400 }
      );
    }

    const article = await getArticleById(id);

    const result = await publishToFacebookPage(post.content, {
      articleId: id,
      postId: post.id,
      imageUrl: article?.image_url || undefined,
    });

    await updatePostStatus(id, 'published', {
      facebook_post_id: result.facebookPostId,
      published_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      facebookPostId: result.facebookPostId,
    });
  } catch (error) {
    console.error('Failed to publish:', error);

    if (error instanceof FacebookPublishingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to publish to Facebook' },
      { status: 500 }
    );
  }
}