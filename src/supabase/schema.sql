-- Articles table: stores fetched news articles
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  url VARCHAR NOT NULL UNIQUE,
  source VARCHAR(200) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  author VARCHAR(200),
  image_url VARCHAR,
  raw_content TEXT,

  -- Scoring
  ai_relevance_score NUMERIC(3,1) DEFAULT 0,
  novelty_score NUMERIC(3,1) DEFAULT 0,
  credibility_score NUMERIC(3,1) DEFAULT 0,
  audience_value_score NUMERIC(3,1) DEFAULT 0,
  virality_score NUMERIC(3,1) DEFAULT 0,
  final_score NUMERIC(3,1) DEFAULT 0,
  rejection_reason TEXT,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'fetched' CHECK (status IN (
    'fetched', 'scored', 'drafted', 'needs_review', 'approved', 'published', 'rejected', 'failed'
  )),
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated posts table: stores Facebook post drafts
CREATE TABLE generated_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,

  -- Quality flags
  needs_review BOOLEAN DEFAULT false,
  quality_notes TEXT,

  -- Approval status
  status VARCHAR(50) DEFAULT 'drafted' CHECK (status IN (
    'drafted', 'approved', 'rejected', 'published', 'failed'
  )),
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(200),

  -- Facebook integration
  facebook_post_id VARCHAR(200),
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Publishing logs: tracks all publishing attempts
CREATE TABLE publishing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  post_id UUID REFERENCES generated_posts(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed')),
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App settings: key-value store for configuration
CREATE TABLE app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_final_score ON articles(final_score DESC);
CREATE INDEX idx_articles_source ON articles(source);
CREATE INDEX idx_generated_posts_article_id ON generated_posts(article_id);
CREATE INDEX idx_generated_posts_status ON generated_posts(status);
CREATE INDEX idx_publishing_logs_article_id ON publishing_logs(article_id);
CREATE INDEX idx_publishing_logs_created_at ON publishing_logs(created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER generated_posts_updated_at
  BEFORE UPDATE ON generated_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();