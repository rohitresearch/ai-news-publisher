import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mkdir } from 'fs/promises';

const OUTPUT_DIR = join(process.cwd(), 'public', 'generated-posts');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { headline, bodyText, hashtags, source, date, articleUrl } = body;

    if (!headline) {
      return NextResponse.json({ error: 'Headline is required' }, { status: 400 });
    }

    // Ensure output directory exists
    await mkdir(OUTPUT_DIR, { recursive: true });

    // Read the HTML template
    const templatePath = join(process.cwd(), 'src', 'lib', 'social-template.html');
    let html = readFileSync(templatePath, 'utf-8');

    // Replace placeholders with actual content
    html = html.replace('Loading headline...', escapeHtml(headline));
    html = html.replace('Loading content...', escapeHtml(bodyText || ''));

    // Handle hashtags
    if (hashtags && Array.isArray(hashtags)) {
      const hashtagsHtml = hashtags
        .map(tag => `<span class="hashtag">#${escapeHtml(tag)}</span>`)
        .join('');
      html = html.replace('<div class="hashtags" id="hashtags"></div>', `<div class="hashtags">${hashtagsHtml}</div>`);
    }

    // Set source info
    html = html.replace('id="source-icon">A</div>', `id="source-icon">${source?.charAt(0)?.toUpperCase() || 'A'}</div>`);
    html = html.replace('id="source-name">Source</div>', `id="source-name">${escapeHtml(source || 'News Source')}</div>`);
    html = html.replace('id="article-date">Date</div>', `id="article-date">${escapeHtml(date || new Date().toLocaleDateString())}</div>`);

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `fb-post-${timestamp}.png`;
    const outputPath = join(OUTPUT_DIR, filename);

    // Launch Puppeteer and generate screenshot
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // Set viewport to 1080x1080
      await page.setViewport({
        width: 1080,
        height: 1080,
        deviceScaleFactor: 2, // High quality (2x = 2160x2160 rendered, then scaled)
      });

      // Set content and wait for fonts to load
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Wait for fonts to be fully loaded
      await page.evaluateHandle('document.fonts.ready');

      // Additional wait for any animations/rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      // Take screenshot
      await page.screenshot({
        path: outputPath,
        type: 'png',
        fullPage: true,
      });

      const publicUrl = `/generated-posts/${filename}`;

      return NextResponse.json({
        success: true,
        imageUrl: publicUrl,
        filename,
        message: 'Image generated successfully',
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('Failed to generate image:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}