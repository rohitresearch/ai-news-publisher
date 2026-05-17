import { NextRequest, NextResponse } from 'next/server';
import { approvePost, updatePostStatus } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const approvedBy = body.approvedBy || 'admin';

    await approvePost(id, approvedBy);

    return NextResponse.json({ success: true, status: 'approved' });
  } catch (error) {
    console.error('Failed to approve post:', error);
    return NextResponse.json(
      { error: 'Failed to approve post' },
      { status: 500 }
    );
  }
}