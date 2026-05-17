# AI News Facebook Page Publisher

An AI Agent that fetches recent AI-related news from free APIs/RSS feeds, filters and scores relevant AI news, generates Facebook Page post drafts, allows human approval, and publishes approved posts to a Facebook Page using Meta Graph API.

## Tech Stack

- **Next.js** with TypeScript
- **Supabase** Postgres
- **Tailwind CSS**
- **Server-side API routes**
- **Meta Graph API** for Facebook publishing

## Features

1. **News Ingestion** - Fetches from NewsAPI, Currents API, and RSS feeds with configurable AI keywords
2. **Deduplication** - Prevents duplicate articles by URL and title similarity
3. **AI Relevance Scoring** - Scores articles on AI relevance, novelty, credibility, audience value, and virality
4. **Post Generation** - LLM-powered Facebook post generation with hook, explanation, hashtags
5. **Quality Gate** - Validates articles and posts for relevance, recency, and authenticity
6. **Admin Dashboard** - Full-featured UI for managing articles, editing posts, and publishing
7. **Facebook Publishing** - Uses official Meta Graph API for safe, compliant publishing

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Facebook Graph API
FACEBOOK_PAGE_ID=your_facebook_page_id
FACEBOOK_PAGE_ACCESS_TOKEN=your_facebook_page_access_token

# News APIs
NEWS_API_KEY=your_newsapi_key
CURRENTS_API_KEY=your_currents_api_key

# Anthropic API (for post generation)
ANTHROPIC_API_KEY=your_anthropic_api_key

# RSS Feed URLs (comma-separated)
RSS_FEED_URLS=https://feeds.feedburner.com/TechCrunch/,https://rss.ai.com/

# AI Keywords (comma-separated)
AI_KEYWORDS=AI,artificial intelligence,OpenAI,Anthropic,Google DeepMind,ChatGPT,Claude,Gemini,Llama,AI agents,machine learning

# Optional: Secret for cron endpoint
CRON_SECRET=your_cron_secret
```

### 3. Set Up Supabase Database

Run the schema in `supabase/schema.sql` on your Supabase project:

1. Go to your Supabase project SQL Editor
2. Copy and paste the contents of `supabase/schema.sql`
3. Execute the SQL

This creates:
- `articles` table - stores fetched news articles with scores
- `generated_posts` table - stores Facebook post drafts
- `publishing_logs` table - tracks all publishing attempts
- `app_settings` table - key-value store for configuration

### 4. Get Facebook Page Credentials

1. Create a Facebook App at https://developers.facebook.com
2. Add Facebook Login product to your app
3. Generate a Page Access Token with `pages_manage_posts` permission
4. Note your Page ID from your Facebook Page settings

### 5. Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000 to see the dashboard.

## Usage

### Running the Daily News Agent (Cron)

Trigger the cron endpoint to fetch, score, and generate post drafts:

```bash
curl -X GET http://localhost:3000/api/cron/daily-news-agent
```

With authentication:
```bash
curl -X GET http://localhost:3000/api/cron/daily-news-agent \
  -H "Authorization: Bearer your_cron_secret"
```

Set up a cron job in your hosting provider to run this daily.

### Dashboard Workflow

1. **Fetch Articles** - Run the cron job to fetch and score articles
2. **Review Drafts** - Go to the dashboard to see articles with post drafts
3. **Edit Posts** - Click an article to edit the generated post
4. **Approve** - Click Approve when the post looks good
5. **Publish** - Click Publish to Facebook to post to your page

## API Endpoints

- `GET /api/articles` - List all articles (optional `?status=` filter)
- `GET /api/articles/[id]` - Get article with generated post
- `PATCH /api/articles/[id]` - Update article status
- `POST /api/posts/[id]/approve` - Approve a post draft
- `POST /api/posts/[id]/reject` - Reject a post draft
- `POST /api/posts/[id]/publish` - Publish approved post to Facebook
- `PUT /api/posts/[id]` - Update/edit post content
- `GET /api/cron/daily-news-agent` - Trigger news fetching pipeline

## Scoring System

Articles are scored 0-10 on:
- **AI Relevance Score** - How related to AI is the content?
- **Novelty Score** - How recent and fresh is the information?
- **Credibility Score** - How trustworthy is the source?
- **Audience Value Score** - How useful/interesting for readers?
- **Virality Score** - How shareable is this content?

**Final Score** = weighted average (AI Relevance 35%, Credibility 25%, Novelty 15%, Audience 15%, Virality 10%)

**Threshold**: Articles below 7/10 are automatically rejected.

## Safety & Compliance

- Does NOT scrape Facebook
- Uses ONLY official Meta Graph API
- Does NOT generate misleading claims
- Does NOT use excessive hashtags
- Does NOT post duplicate content
- Always attributes original sources

## Project Structure

```
ai-news-publisher/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── articles/
│   │   │   │   ├── route.ts          # GET articles list
│   │   │   │   └── [id]/route.ts     # GET/PATCH single article
│   │   │   ├── posts/
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts      # PUT update post
│   │   │   │       ├── approve/     # POST approve
│   │   │   │       ├── reject/      # POST reject
│   │   │   │       └── publish/     # POST publish to FB
│   │   │   └── cron/
│   │   │       └── daily-news-agent/ # GET daily pipeline
│   │   ├── page.tsx                 # Dashboard UI
│   │   └── layout.tsx
│   └── lib/
│       ├── types.ts                  # TypeScript interfaces
│       ├── database.ts               # Supabase client & queries
│       ├── deduplication.ts          # URL & title similarity
│       ├── scoring.ts                # Article scoring
│       ├── quality-gate.ts            # Article/post validation
│       ├── post-generation.ts        # LLM post generation
│       ├── facebook.ts               # Meta Graph API client
│       └── news/
│           ├── index.ts              # News aggregation
│           ├── newsapi.ts            # NewsAPI client
│           ├── currents.ts          # Currents API client
│           └── rss.ts               # RSS feed parser
├── supabase/
│   └── schema.sql                    # Database schema
├── .env.example                      # Environment template
├── package.json
└── README.md
```

## Testing

```bash
npm test
```

Tests cover:
- Deduplication logic (URL and title similarity)
- Scoring function
- Quality gate validation