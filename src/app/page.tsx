'use client';

import { useEffect, useState, useCallback, memo } from 'react';

interface Article {
  id: string;
  title: string;
  description: string | null;
  url: string;
  source: string;
  published_at: string;
  ai_relevance_score: number;
  novelty_score: number;
  credibility_score: number;
  audience_value_score: number;
  virality_score: number;
  final_score: number;
  rejection_reason: string | null;
  status: string;
  image_url: string | null;
}

interface Post {
  id: string;
  content: string;
  status: string;
  facebook_post_id: string | null;
  needs_review: boolean;
}

interface FetchResult {
  fetched: number;
  deduplicated: number;
  scored: number;
  drafted: number;
  skipped: number;
  errors: string[];
}

const STATUS_COLORS: Record<string, string> = {
  fetched: 'bg-blue-100 text-blue-700',
  scored: 'bg-yellow-100 text-yellow-700',
  drafted: 'bg-purple-100 text-purple-700',
  needs_review: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  published: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-gray-100 text-gray-700',
};

// Memoized article card component
const ArticleCard = memo(({ article, isSelected, onClick }: {
  article: Article;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    className={`p-4 cursor-pointer transition-colors border-l-4 ${
      isSelected
        ? 'bg-indigo-50 border-indigo-500'
        : 'border-transparent hover:bg-slate-50'
    }`}
  >
    <h3 className="font-medium text-slate-800 line-clamp-2 text-sm">
      {article.title}
    </h3>
    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
      <span className="font-medium truncate">{article.source}</span>
      <span>•</span>
      <span>{new Date(article.published_at).toLocaleDateString()}</span>
    </div>
    <div className="mt-2 flex items-center justify-between">
      <div className="flex items-center gap-3 text-xs">
        <span className="font-medium text-indigo-600">
          {article.ai_relevance_score?.toFixed(1) || '0'}
        </span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-600">
          {article.final_score?.toFixed(1) || '0'}
        </span>
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[article.status] || 'bg-gray-100'}`}>
        {article.status}
      </span>
    </div>
  </div>
));

ArticleCard.displayName = 'ArticleCard';

function Dashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [editContent, setEditContent] = useState('');
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFetchingNews, setIsFetchingNews] = useState(false);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/articles' : `/api/articles?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch {
      showNotification('error', 'Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleFetchNews = useCallback(async () => {
    setIsFetchingNews(true);
    setFetchResult(null);
    try {
      const res = await fetch('/api/cron/daily-news-agent');
      const data = await res.json();

      if (!res.ok) {
        showNotification('error', data.error || 'Failed to fetch news');
        return;
      }

      setFetchResult(data.stats);
      showNotification('success', `Fetched ${data.stats?.drafted || 0} new post drafts!`);
      await fetchArticles();
      setFilter('drafted');
    } catch {
      showNotification('error', 'Failed to fetch news from API');
    } finally {
      setIsFetchingNews(false);
    }
  }, [fetchArticles]);

  const selectArticle = useCallback(async (article: Article) => {
    if (articleLoading) return;
    setSelectedArticle(article);
    setSelectedPost(null);
    setEditContent('');
    setIsEditing(false);
    setArticleLoading(true);

    try {
      const res = await fetch(`/api/articles/${article.id}`);
      const data = await res.json();
      if (data.post) {
        setSelectedPost(data.post);
        setEditContent(data.post.content);
      }
    } catch {
      console.error('Failed to fetch post');
    } finally {
      setArticleLoading(false);
    }
  }, [articleLoading]);

  const handleApprove = useCallback(async (postId: string) => {
    try {
      await fetch(`/api/posts/${postId}/approve`, { method: 'POST' });
      showNotification('success', 'Post approved!');
      await fetchArticles();
      if (selectedArticle) {
        const res = await fetch(`/api/articles/${selectedArticle.id}`);
        const data = await res.json();
        if (data.post) {
          setSelectedPost(data.post);
          setEditContent(data.post.content);
        }
      }
    } catch {
      showNotification('error', 'Failed to approve post');
    }
  }, [fetchArticles, selectedArticle]);

  const handleReject = useCallback(async (postId: string) => {
    try {
      await fetch(`/api/posts/${postId}/reject`, { method: 'POST' });
      showNotification('info', 'Post rejected');
      await fetchArticles();
      if (selectedArticle) {
        const res = await fetch(`/api/articles/${selectedArticle.id}`);
        const data = await res.json();
        if (data.post) {
          setSelectedPost(data.post);
          setEditContent(data.post.content);
        }
      }
    } catch {
      showNotification('error', 'Failed to reject post');
    }
  }, [fetchArticles, selectedArticle]);

  const handlePublish = useCallback(async (articleId: string) => {
    try {
      const res = await fetch(`/api/posts/${articleId}/publish`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        showNotification('error', data.error || 'Failed to publish');
        return;
      }

      showNotification('success', `Published! Post ID: ${data.facebookPostId}`);
      await fetchArticles();
      if (selectedArticle) {
        const res = await fetch(`/api/articles/${selectedArticle.id}`);
        const data = await res.json();
        if (data.post) {
          setSelectedPost(data.post);
          setEditContent(data.post.content);
        }
      }
    } catch {
      showNotification('error', 'Failed to publish to Facebook');
    }
  }, [fetchArticles, selectedArticle]);

  const handleSaveEdit = useCallback(async (articleId: string) => {
    try {
      await fetch(`/api/posts/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      showNotification('success', 'Post updated!');
      setIsEditing(false);
      if (selectedArticle) {
        const res = await fetch(`/api/articles/${selectedArticle.id}`);
        const data = await res.json();
        if (data.post) {
          setSelectedPost(data.post);
          setEditContent(data.post.content);
        }
      }
    } catch {
      showNotification('error', 'Failed to update post');
    }
  }, [editContent, selectedArticle]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  function showNotification(type: string, message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }

  const filteredArticles = filter === 'all' ? articles : articles.filter((a) => a.status === filter);

  const stats = {
    total: articles.length,
    drafted: articles.filter((a) => a.status === 'drafted').length,
    approved: articles.filter((a) => a.status === 'approved').length,
    published: articles.filter((a) => a.status === 'published').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-500 text-white' :
          notification.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <span>{notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}</span>
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">AI News Publisher</h1>
                <p className="text-xs text-slate-500">Facebook content automation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFetchNews}
                disabled={isFetchingNews}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetchingNews ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <span>📡</span>
                    <span>Fetch News</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {fetchResult && (
          <div className="mb-4 bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-slate-500">Fetched:</span>
                <span className="ml-2 font-bold text-slate-800">{fetchResult.fetched}</span>
              </div>
              <div>
                <span className="text-slate-500">Generated:</span>
                <span className="ml-2 font-bold text-purple-600">{fetchResult.drafted}</span>
              </div>
              <div>
                <span className="text-slate-500">Errors:</span>
                <span className="ml-2 font-bold text-red-600">{fetchResult.errors?.length || 0}</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <span className="text-2xl">📰</span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Drafts</p>
                <p className="text-2xl font-bold text-purple-600">{stats.drafted}</p>
              </div>
              <span className="text-2xl">✍️</span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Published</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.published}</p>
              </div>
              <span className="text-2xl">🚀</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { key: 'all', label: 'All' },
            { key: 'drafted', label: 'Drafts' },
            { key: 'approved', label: 'Approved' },
            { key: 'published', label: 'Published' },
            { key: 'rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <span>📰</span> Articles
                <span className="ml-auto text-xs text-slate-400">{filteredArticles.length}</span>
              </h2>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                      <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <p className="font-medium">No articles</p>
                  <p className="text-sm text-slate-400 mt-1">Click &quot;Fetch News&quot; to get started</p>
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    isSelected={selectedArticle?.id === article.id}
                    onClick={() => selectArticle(article)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <span>📝</span> Post Details
              </h2>
            </div>
            {selectedArticle ? (
              <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <div>
                  <h3 className="font-bold text-slate-800">{selectedArticle.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedArticle.source} • {new Date(selectedArticle.published_at).toLocaleDateString()}
                  </p>
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 text-sm hover:underline mt-1 inline-block"
                  >
                    View Article →
                  </a>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-indigo-600">
                      {selectedArticle.ai_relevance_score?.toFixed(1) || '0'}
                    </div>
                    <div className="text-xs text-slate-500">AI Score</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {selectedArticle.novelty_score?.toFixed(1) || '0'}
                    </div>
                    <div className="text-xs text-slate-500">Novelty</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-emerald-600">
                      {selectedArticle.final_score?.toFixed(1) || '0'}
                    </div>
                    <div className="text-xs text-slate-500">Final</div>
                  </div>
                </div>

                {selectedPost ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700">Generated Post</label>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            selectedPost.status === 'approved' ? 'bg-green-100 text-green-700' :
                            selectedPost.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            selectedPost.status === 'published' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {selectedPost.status}
                          </span>
                          {isEditing ? null : (
                            <button
                              onClick={() => setIsEditing(true)}
                              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full h-40 p-3 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setIsEditing(false);
                                setEditContent(selectedPost.content);
                              }}
                              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEdit(selectedArticle.id)}
                              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-4">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedPost.content}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedPost.status !== 'approved' && selectedPost.status !== 'published' && (
                        <button
                          onClick={() => handleApprove(selectedPost.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                        >
                          ✓ Approve
                        </button>
                      )}
                      {selectedPost.status !== 'rejected' && selectedPost.status !== 'published' && (
                        <button
                          onClick={() => handleReject(selectedPost.id)}
                          className="px-4 py-2 bg-slate-200 text-slate-700 rounded text-sm font-medium hover:bg-slate-300"
                        >
                          ✕ Reject
                        </button>
                      )}
                      {selectedPost.status === 'approved' && (
                        <button
                          onClick={() => handlePublish(selectedArticle.id)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
                        >
                          🚀 Publish
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p>No post generated yet</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <p>Select an article to view details</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;