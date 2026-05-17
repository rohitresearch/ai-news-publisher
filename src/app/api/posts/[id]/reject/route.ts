import { NextRequest, NextResponse } from 'next/server';
import { updatePostStatus } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await updatePostStatus(id, 'rejected');

    return NextResponse.json({ success: true, status: 'rejected' });
  } catch (error) {
    console.error('Failed to reject post:', error);
    return NextResponse.json(
      { error: 'Failed to reject post' },
      { status: 500 }
    );
  }
}