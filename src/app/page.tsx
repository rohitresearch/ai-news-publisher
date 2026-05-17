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

const STATUS_COLORS: Record<string, string> = {
  fetched: 'bg-blue-100 text-blue-800',
  scored: 'bg-yellow-100 text-yellow-800',
  drafted: 'bg-purple-100 text-purple-800',
  needs_review: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  published: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  failed: 'bg-gray-100 text-gray-800',
};

export default function Dashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [editContent, setEditContent] = useState('');
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

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

  async function selectArticle(article: Article) {
    setSelectedArticle(article);
    setSelectedPost(null);
    setEditContent('');

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
      showNotification('success', 'Post approved!');
      fetchArticles();
      if (selectedArticle) selectArticle(selectedArticle);
    } catch {
      showNotification('error', 'Failed to approve post');
    }
  }

  async function handleReject(postId: string) {
    try {
      await fetch(`/api/posts/${postId}/reject`, { method: 'POST' });
      showNotification('success', 'Post rejected');
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

      showNotification('success', `Published! Facebook Post ID: ${data.facebookPostId}`);
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
      showNotification('success', 'Post updated!');
      if (selectedArticle) selectArticle(selectedArticle);
    } catch {
      showNotification('error', 'Failed to update post');
    }
  }

  function showNotification(type: string, message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }

  const filteredArticles = filter === 'all'
    ? articles
    : articles.filter((a) => a.status === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg z-50 ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">AI News Publisher Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and publish AI news to your Facebook Page</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4 mb-6 flex-wrap">
          {['all', 'scored', 'drafted', 'approved', 'published', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                filter === status
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status === 'all' ? 'All Articles' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-700">Articles ({filteredArticles.length})</h2>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : filteredArticles.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No articles found</div>
              ) : (
                filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => selectArticle(article)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                      selectedArticle?.id === article.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900 line-clamp-2">{article.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ml-2 shrink-0 ${STATUS_COLORS[article.status] || 'bg-gray-100'}`}>
                        {article.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                      <span>{article.source}</span>
                      <span>•</span>
                      <span>{new Date(article.published_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      <span title="AI Relevance">AI: {article.ai_relevance_score?.toFixed(1) || '0'}</span>
                      <span title="Final Score">Score: {article.final_score?.toFixed(1) || '0'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-700">Post Details</h2>
            </div>
            {selectedArticle ? (
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="font-bold text-lg">{selectedArticle.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {selectedArticle.source} • {new Date(selectedArticle.published_at).toLocaleDateString()}
                  </p>
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm hover:underline mt-1 inline-block"
                  >
                    View Original →
                  </a>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'AI Score', value: selectedArticle.ai_relevance_score?.toFixed(1) || '0' },
                    { label: 'Novelty', value: selectedArticle.novelty_score?.toFixed(1) || '0' },
                    { label: 'Final', value: selectedArticle.final_score?.toFixed(1) || '0' },
                  ].map((score) => (
                    <div key={score.label} className="bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-500">{score.label}</div>
                      <div className="font-bold text-lg">{score.value}</div>
                    </div>
                  ))}
                </div>

                {selectedArticle.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                    Rejected: {selectedArticle.rejection_reason}
                  </div>
                )}

                {selectedPost ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Generated Post</label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-48 p-3 border rounded-lg text-sm font-mono"
                        placeholder="No post generated yet"
                      />
                      <div className="text-xs text-gray-400 mt-1">{editContent.length}/1200 characters</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSaveEdit(selectedArticle.id)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Save Edit
                      </button>
                      <button
                        onClick={() => handleApprove(selectedPost.id)}
                        disabled={selectedPost.status === 'approved' || selectedPost.status === 'published'}
                        className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(selectedPost.id)}
                        disabled={selectedPost.status === 'rejected' || selectedPost.status === 'published'}
                        className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handlePublish(selectedArticle.id)}
                        disabled={selectedPost.status === 'published' || selectedPost.status !== 'approved'}
                        className="px-3 py-1.5 bg-gray-900 text-white rounded text-sm hover:bg-black disabled:opacity-50"
                      >
                        Publish to Facebook
                      </button>
                    </div>

                    {selectedPost.facebook_post_id && (
                      <div className="text-sm text-gray-500">
                        Published Post ID: <code className="bg-gray-100 px-1 rounded">{selectedPost.facebook_post_id}</code>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No post draft generated yet.</p>
                    <p className="text-sm mt-1">Run the cron job to generate drafts.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                Select an article to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}