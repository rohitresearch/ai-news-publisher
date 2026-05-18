'use client';

import { useEffect, useState } from 'react';

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

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  fetched: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: '📥' },
  scored: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', icon: '📊' },
  drafted: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', icon: '✍️' },
  needs_review: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: '👀' },
  approved: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', icon: '✅' },
  published: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: '🚀' },
  rejected: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: '❌' },
  failed: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: '⚠️' },
};

export default function Dashboard() {
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

  useEffect(() => {
    fetchArticles();
  }, [filter]);

  async function fetchArticles() {
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
  }

  async function handleFetchNews() {
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
      fetchArticles();
      setFilter('drafted');
    } catch {
      showNotification('error', 'Failed to fetch news from API');
    } finally {
      setIsFetchingNews(false);
    }
  }

  async function selectArticle(article: Article) {
    setSelectedArticle(article);
    setSelectedPost(null);
    setEditContent('');
    setIsEditing(false);

    try {
      const res = await fetch(`/api/articles/${article.id}`);
      const data = await res.json();
      if (data.post) {
        setSelectedPost(data.post);
        setEditContent(data.post.content);
      }
    } catch {
      console.error('Failed to fetch post');
    }
  }

  async function handleApprove(postId: string) {
    try {
      await fetch(`/api/posts/${postId}/approve`, { method: 'POST' });
      showNotification('success', 'Post approved successfully!');
      fetchArticles();
      if (selectedArticle) selectArticle(selectedArticle);
    } catch {
      showNotification('error', 'Failed to approve post');
    }
  }

  async function handleReject(postId: string) {
    try {
      await fetch(`/api/posts/${postId}/reject`, { method: 'POST' });
      showNotification('info', 'Post rejected');
      fetchArticles();
      if (selectedArticle) selectArticle(selectedArticle);
    } catch {
      showNotification('error', 'Failed to reject post');
    }
  }

  async function handlePublish(articleId: string) {
    try {
      const res = await fetch(`/api/posts/${articleId}/publish`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        showNotification('error', data.error || 'Failed to publish');
        return;
      }

      showNotification('success', `Published to Facebook! Post ID: ${data.facebookPostId}`);
      fetchArticles();
      if (selectedArticle) selectArticle(selectedArticle);
    } catch {
      showNotification('error', 'Failed to publish to Facebook');
    }
  }

  async function handleSaveEdit(articleId: string) {
    try {
      await fetch(`/api/posts/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      showNotification('success', 'Post updated successfully!');
      setIsEditing(false);
      if (selectedArticle) selectArticle(selectedArticle);
    } catch {
      showNotification('error', 'Failed to update post');
    }
  }

  function showNotification(type: string, message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }

  const filteredArticles = filter === 'all' ? articles : articles.filter((a) => a.status === filter);

  const stats = {
    total: articles.length,
    drafted: articles.filter((a) => a.status === 'drafted').length,
    approved: articles.filter((a) => a.status === 'approved').length,
    published: articles.filter((a) => a.status === 'published').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {notification && (
        <div
          className={`fixed top-6 right-6 px-5 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 animate-slide-in ${
            notification.type === 'success'
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
              : notification.type === 'error'
              ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
              : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
          }`}
        >
          <span className="text-lg">{notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}</span>
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  AI News Publisher
                </h1>
                <p className="text-slate-500 text-sm">Automate your AI news content on Facebook</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleFetchNews}
                disabled={isFetchingNews}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-70"
              >
                {isFetchingNews ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Fetching News...</span>
                  </>
                ) : (
                  <>
                    <span>📡</span>
                    <span>Fetch News</span>
                  </>
                )}
              </button>
              <button
                onClick={fetchArticles}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <span className={loading ? 'animate-spin' : ''}>↻</span>
                <span className="text-sm font-medium text-slate-700">Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {fetchResult && (
          <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span>📊</span> Fetch Results
            </h3>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{fetchResult.fetched}</div>
                <div className="text-xs text-slate-500">Articles Fetched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{fetchResult.drafted}</div>
                <div className="text-xs text-slate-500">Posts Generated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{fetchResult.scored}</div>
                <div className="text-xs text-slate-500">Articles Scored</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{fetchResult.skipped}</div>
                <div className="text-xs text-slate-500">Duplicates Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{fetchResult.errors?.length || 0}</div>
                <div className="text-xs text-slate-500">Errors</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Articles', value: stats.total, icon: '📰', color: 'from-slate-500 to-slate-600' },
            { label: 'Drafts Ready', value: stats.drafted, icon: '✍️', color: 'from-purple-500 to-purple-600' },
            { label: 'Approved', value: stats.approved, icon: '✅', color: 'from-green-500 to-green-600' },
            { label: 'Published', value: stats.published, icon: '🚀', color: 'from-emerald-500 to-emerald-600' },
          ].map((stat, i) => (
            <div key={i} className={`bg-gradient-to-br ${stat.color} rounded-2xl p-5 text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <span className="text-4xl opacity-80">{stat.icon}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All Articles', icon: '📋' },
            { key: 'drafted', label: 'Drafts', icon: '✍️' },
            { key: 'approved', label: 'Approved', icon: '✅' },
            { key: 'published', label: 'Published', icon: '🚀' },
            { key: 'rejected', label: 'Rejected', icon: '❌' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                filter === tab.key
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <span>📰</span> Articles
                <span className="ml-auto text-sm text-slate-400 font-normal">{filteredArticles.length}</span>
              </h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📭</span>
                  </div>
                  <p className="text-slate-500 font-medium">No articles found</p>
                  <p className="text-slate-400 text-sm mt-1">Click "Fetch News" to get started</p>
                </div>
              ) : (
                filteredArticles.map((article) => {
                  const statusConfig = STATUS_CONFIG[article.status] || STATUS_CONFIG.fetched;
                  return (
                    <div
                      key={article.id}
                      onClick={() => selectArticle(article)}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-all group ${
                        selectedArticle?.id === article.id
                          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500'
                          : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-medium text-slate-800 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                          {article.title}
                        </h3>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium">{article.source}</span>
                        <span>•</span>
                        <span>{new Date(article.published_at).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">AI</span>
                            <span className="text-sm font-bold text-indigo-600">
                              {article.ai_relevance_score?.toFixed(1) || '0'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">Score</span>
                            <span className="text-sm font-bold text-slate-700">
                              {article.final_score?.toFixed(1) || '0'}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                        >
                          {article.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <span>📝</span> Post Preview
              </h2>
            </div>
            {selectedArticle ? (
              <div className="p-6 space-y-5">
                <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl p-5 border border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                      {selectedArticle.source.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 text-lg leading-snug">{selectedArticle.title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                        <span className="font-medium">{selectedArticle.source}</span>
                        <span>•</span>
                        <span>{new Date(selectedArticle.published_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 text-sm hover:text-indigo-700 mt-3 font-medium"
                  >
                    View Original Article →
                  </a>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'AI Relevance', value: selectedArticle.ai_relevance_score?.toFixed(1) || '0', color: 'text-indigo-600' },
                    { label: 'Novelty', value: selectedArticle.novelty_score?.toFixed(1) || '0', color: 'text-purple-600' },
                    { label: 'Final Score', value: selectedArticle.final_score?.toFixed(1) || '0', color: 'text-emerald-600' },
                  ].map((score) => (
                    <div key={score.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                      <div className={`text-2xl font-bold ${score.color}`}>{score.value}</div>
                      <div className="text-xs text-slate-500 mt-1">{score.label}</div>
                    </div>
                  ))}
                </div>

                {selectedArticle.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    <span className="font-semibold">Rejection Reason:</span> {selectedArticle.rejection_reason}
                  </div>
                )}

                {selectedPost ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-700">Generated Facebook Post</label>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
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
                        <div className="space-y-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full h-56 p-4 border-2 border-indigo-200 rounded-xl text-sm leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Write your Facebook post here..."
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">{editContent.length}/1200 characters</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setIsEditing(false);
                                  if (selectedArticle) selectArticle(selectedArticle);
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(selectedArticle.id)}
                                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                      {selectedPost.status !== 'approved' && selectedPost.status !== 'published' && (
                        <button
                          onClick={() => handleApprove(selectedPost.id)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-green-500/30 transition-all"
                        >
                          <span>✓</span> Approve Post
                        </button>
                      )}
                      {selectedPost.status !== 'rejected' && selectedPost.status !== 'published' && (
                        <button
                          onClick={() => handleReject(selectedPost.id)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors"
                        >
                          <span>✕</span> Reject
                        </button>
                      )}
                      {selectedPost.status === 'approved' && (
                        <button
                          onClick={() => handlePublish(selectedArticle.id)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                        >
                          <span>🚀</span> Publish to Facebook
                        </button>
                      )}
                    </div>

                    {selectedPost.facebook_post_id && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                        <span className="text-emerald-500 text-xl">✓</span>
                        <div>
                          <p className="text-emerald-700 font-medium">Successfully Published!</p>
                          <p className="text-emerald-600 text-sm">Facebook Post ID: {selectedPost.facebook_post_id}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-4xl">✍️</span>
                    </div>
                    <p className="text-slate-500 font-medium">No post draft generated</p>
                    <p className="text-slate-400 text-sm mt-1">Click "Fetch News" to generate Facebook posts</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">👈</span>
                </div>
                <p className="text-slate-500 font-medium">Select an article</p>
                <p className="text-slate-400 text-sm mt-1">Click on an article from the left to view and edit its Facebook post</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}