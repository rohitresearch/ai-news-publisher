export interface Article {
  id?: string;
  title: string;
  description: string | null;
  url: string;
  source: string;
  publishedAt: Date;
  author: string | null;
  imageUrl: string | null;
  rawContent: string | null;
  aiRelevanceScore?: number;
  noveltyScore?: number;
  credibilityScore?: number;
  audienceValueScore?: number;
  viralityScore?: number;
  finalScore?: number;
  rejectionReason?: string | null;
  status?: ArticleStatus;
  fetchedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ArticleStatus =
  | 'fetched'
  | 'scored'
  | 'drafted'
  | 'needs_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'failed';

export interface GeneratedPost {
  id?: string;
  articleId: string;
  content: string;
  needsReview?: boolean;
  qualityNotes?: string | null;
  status?: PostStatus;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  facebookPostId?: string | null;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PostStatus = 'drafted' | 'approved' | 'rejected' | 'published' | 'failed';

export interface PublishingLog {
  id?: string;
  articleId?: string | null;
  postId?: string | null;
  action: string;
  status: 'success' | 'failed';
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt?: Date;
}

export interface ScoringResult {
  aiRelevanceScore: number;
  noveltyScore: number;
  credibilityScore: number;
  audienceValueScore: number;
  viralityScore: number;
  finalScore: number;
  rejectionReason?: string | null;
}

export interface NewsSource {
  name: string;
  type: 'newsapi' | 'currents' | 'rss';
  url?: string;
  apiKey?: string;
}

export interface QualityGateResult {
  passed: boolean;
  needsReview: boolean;
  reasons: string[];
}