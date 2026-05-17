import { NextRequest, NextResponse } from 'next/server';
import { getArticleById, getPostsByArticleId, updateArticleStatus } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await getArticleById(id);

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const post = await getPostsByArticleId(id);

    return NextResponse.json({ article, post });
  } catch (error) {
    console.error('Failed to fetch article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    await updateArticleStatus(id, status);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update article:', error);
    return NextResponse.json(
      { error: 'Failed to update article' },
      { status: 500 }
    );
  }
}