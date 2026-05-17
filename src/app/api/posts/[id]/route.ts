import { NextRequest, NextResponse } from 'next/server';
import { getArticleById, getPostsByArticleId, upsertPost } from '@/lib/database';
import { regeneratePost } from '@/lib/post-generation';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (content !== undefined) {
      await upsertPost({
        articleId: id,
        content,
        needsReview: false,
        qualityNotes: 'Manually edited',
      });

      return NextResponse.json({ success: true, content });
    }

    const article = await getArticleById(id);
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const post = await getPostsByArticleId(id);
    const feedback = body.feedback;

    const newContent = await regeneratePost(
      {
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source,
        publishedAt: new Date(article.published_at),
      },
      feedback
    );

    await upsertPost({
      articleId: id,
      content: newContent,
      needsReview: false,
      qualityNotes: feedback ? `Regenerated with feedback: ${feedback}` : 'Regenerated',
    });

    return NextResponse.json({ success: true, content: newContent });
  } catch (error) {
    console.error('Failed to update post:', error);
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}