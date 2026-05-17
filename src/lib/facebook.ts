import { createPublishingLog } from './database';

const FACEBOOK_API_VERSION = 'v18.0';

interface FacebookPagePostResponse {
  id: string;
  message?: string;
}

interface FacebookErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

export class FacebookPublishingError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly fbtraceId?: string
  ) {
    super(message);
    this.name = 'FacebookPublishingError';
  }
}

export async function publishToFacebookPage(
  message: string,
  options?: {
    articleId?: string;
    postId?: string;
    imageUrl?: string;
  }
): Promise<{ facebookPostId: string; success: boolean }> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new FacebookPublishingError(
      'Facebook Page ID or Access Token not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in environment variables.'
    );
  }

  try {
    const endpoint = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/feed`;

    const body = new URLSearchParams();
    body.append('message', message);
    body.append('access_token', accessToken);

    if (options?.imageUrl) {
      body.append('url', options.imageUrl);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json() as FacebookPagePostResponse | FacebookErrorResponse;

    if (!response.ok || 'error' in data) {
      const errorData = data as FacebookErrorResponse;
      const error = new FacebookPublishingError(
        errorData.error.message,
        errorData.error.code,
        errorData.error.fbtrace_id
      );

      await createPublishingLog({
        articleId: options?.articleId,
        postId: options?.postId,
        action: 'publish_to_facebook',
        status: 'failed',
        requestPayload: { messageLength: message.length, imageUrl: options?.imageUrl },
        responsePayload: errorData as unknown as Record<string, unknown>,
        errorMessage: errorData.error.message,
      });

      throw error;
    }

    await createPublishingLog({
      articleId: options?.articleId,
      postId: options?.postId,
      action: 'publish_to_facebook',
      status: 'success',
      requestPayload: { messageLength: message.length, imageUrl: options?.imageUrl },
      responsePayload: data as unknown as Record<string, unknown>,
    });

    return {
      facebookPostId: data.id,
      success: true,
    };
  } catch (error) {
    if (error instanceof FacebookPublishingError) {
      throw error;
    }

    const unexpectedError = new FacebookPublishingError(
      `Unexpected error during Facebook publishing: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    await createPublishingLog({
      articleId: options?.articleId,
      postId: options?.postId,
      action: 'publish_to_facebook',
      status: 'failed',
      requestPayload: { messageLength: message.length },
      errorMessage: unexpectedError.message,
    });

    throw unexpectedError;
  }
}

export async function deleteFacebookPost(postId: string): Promise<boolean> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!accessToken) {
    throw new FacebookPublishingError('Facebook Access Token not configured');
  }

  try {
    const endpoint = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${postId}`;
    const body = new URLSearchParams();
    body.append('access_token', accessToken);

    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();

    return response.ok && data.success === true;
  } catch (error) {
    console.error('Failed to delete Facebook post:', error);
    return false;
  }
}

export async function getFacebookPost(postId: string) {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!accessToken) {
    throw new FacebookPublishingError('Facebook Access Token not configured');
  }

  try {
    const endpoint = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${postId}?fields=id,message,created_time,full_picture&access_token=${accessToken}`;

    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new FacebookPublishingError(data.error?.message || 'Failed to fetch post');
    }

    return data;
  } catch (error) {
    console.error('Failed to get Facebook post:', error);
    throw error;
  }
}