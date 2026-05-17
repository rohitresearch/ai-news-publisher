-- Enable RLS on tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for development)
-- You can tighten these later for production

-- Articles policies
CREATE POLICY "Allow all articles" ON articles FOR ALL USING (true) WITH CHECK (true);

-- Generated posts policies
CREATE POLICY "Allow all posts" ON generated_posts FOR ALL USING (true) WITH CHECK (true);

-- Publishing logs policies
CREATE POLICY "Allow all logs" ON publishing_logs FOR ALL USING (true) WITH CHECK (true);

-- App settings policies
CREATE POLICY "Allow all settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);

-- Public read access for articles (for the API)
CREATE POLICY "Public read articles" ON articles FOR SELECT USING (true);

-- Public read access for generated posts
CREATE POLICY "Public read posts" ON generated_posts FOR SELECT USING (true);