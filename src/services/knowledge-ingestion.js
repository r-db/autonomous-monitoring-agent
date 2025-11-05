const axios = require('axios');
const { query } = require('../config/database');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const fs = require('fs').promises;
const path = require('path');

/**
 * Knowledge Base Ingestion System
 * Automatically fetches and updates documentation from various sources
 */

class KnowledgeIngestion {
  constructor() {
    this.sources = [
      // Next.js
      {
        name: 'Next.js',
        type: 'docs',
        urls: [
          'https://nextjs.org/docs',
          'https://nextjs.org/docs/app',
          'https://nextjs.org/docs/pages/building-your-application/routing'
        ],
        category: 'frontend'
      },
      // Railway
      {
        name: 'Railway',
        type: 'docs',
        urls: [
          'https://docs.railway.app',
          'https://docs.railway.app/reference/cli-api',
          'https://docs.railway.app/deploy/deployments'
        ],
        category: 'deployment'
      },
      // Neon
      {
        name: 'Neon',
        type: 'docs',
        urls: [
          'https://neon.tech/docs',
          'https://neon.tech/docs/postgresql/query-reference',
          'https://neon.tech/docs/connect/connection-pooling'
        ],
        category: 'database'
      },
      // Clerk
      {
        name: 'Clerk',
        type: 'docs',
        urls: [
          'https://clerk.com/docs',
          'https://clerk.com/docs/authentication/overview',
          'https://clerk.com/docs/authentication/nextjs'
        ],
        category: 'auth'
      },
      // React
      {
        name: 'React',
        type: 'docs',
        urls: [
          'https://react.dev/learn',
          'https://react.dev/reference/react/hooks'
        ],
        category: 'frontend'
      }
    ];
  }

  /**
   * Ingest all documentation sources
   */
  async ingestAll() {
    console.log('[KNOWLEDGE] Starting full documentation ingestion...');

    const results = {
      successful: 0,
      failed: 0,
      total: 0
    };

    for (const source of this.sources) {
      for (const url of source.urls) {
        results.total++;
        try {
          await this.ingestDocument(url, source);
          results.successful++;
          console.log(`[KNOWLEDGE] ✅ Ingested: ${url}`);
        } catch (error) {
          results.failed++;
          console.error(`[KNOWLEDGE] ❌ Failed: ${url}`, error.message);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Ingest local master build documentation
    await this.ingestMasterBuildDocs();

    console.log(`[KNOWLEDGE] Ingestion complete: ${results.successful}/${results.total} successful`);
    return results;
  }

  /**
   * Ingest single document
   */
  async ingestDocument(url, source) {
    // Fetch HTML
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'IB365-Autonomous-Monitor/1.0'
      }
    });

    // Parse with Readability
    const dom = new JSDOM(response.data, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      throw new Error('Failed to parse document');
    }

    // Extract metadata
    const metadata = {
      url,
      source: source.name,
      category: source.category,
      fetched_at: new Date().toISOString(),
      title: article.title,
      length: article.textContent.length
    };

    // Store in database
    await query(
      `INSERT INTO error_knowledge (
        title,
        error_pattern,
        error_type,
        solution,
        category,
        context,
        source_url,
        last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (source_url) DO UPDATE
      SET solution = EXCLUDED.solution,
          last_updated = NOW()`,
      [
        article.title,
        `Documentation: ${source.name}`,
        'documentation',
        article.textContent.substring(0, 10000), // Store first 10KB
        source.category,
        JSON.stringify(metadata),
        url
      ]
    );

    return { success: true, url, title: article.title };
  }

  /**
   * Ingest master build documentation
   */
  async ingestMasterBuildDocs() {
    console.log('[KNOWLEDGE] Ingesting master build documentation...');

    const masterBuildPath = '/Users/riscentrdb/Desktop/liaison/MASTER_BUILD_DOCUMENT.md';

    try {
      const content = await fs.readFile(masterBuildPath, 'utf-8');

      // Parse sections
      const sections = this.parseMasterBuild(content);

      for (const section of sections) {
        await query(
          `INSERT INTO error_knowledge (
            title,
            error_pattern,
            error_type,
            solution,
            category,
            context,
            source_url,
            last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (source_url) DO UPDATE
          SET solution = EXCLUDED.solution,
              last_updated = NOW()`,
          [
            section.title,
            'Master Build Documentation',
            'application_knowledge',
            section.content,
            'application',
            JSON.stringify({ section: section.title }),
            `master-build#${section.id}`
          ]
        );
      }

      console.log(`[KNOWLEDGE] Ingested ${sections.length} master build sections`);
    } catch (error) {
      console.error('[KNOWLEDGE] Failed to ingest master build:', error);
    }
  }

  /**
   * Parse master build document into sections
   */
  parseMasterBuild(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;

    for (const line of lines) {
      // Detect section headers
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          id: line.substring(3).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: line.substring(3).trim(),
          content: ''
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Ingest known issues from GitHub
   */
  async ingestGitHubIssues(repo) {
    console.log(`[KNOWLEDGE] Fetching issues from ${repo}...`);

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${repo}/issues`,
        {
          params: {
            state: 'all',
            labels: 'bug',
            per_page: 100
          },
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'IB365-Autonomous-Monitor/1.0'
          }
        }
      );

      for (const issue of response.data) {
        await query(
          `INSERT INTO error_knowledge (
            title,
            error_pattern,
            error_type,
            solution,
            category,
            context,
            source_url,
            last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (source_url) DO UPDATE
          SET solution = EXCLUDED.solution,
              last_updated = NOW()`,
          [
            issue.title,
            `GitHub Issue #${issue.number}`,
            'known_issue',
            issue.body || 'No description',
            'github_issues',
            JSON.stringify({
              repo,
              number: issue.number,
              state: issue.state,
              labels: issue.labels.map(l => l.name)
            }),
            issue.html_url
          ]
        );
      }

      console.log(`[KNOWLEDGE] Ingested ${response.data.length} issues from ${repo}`);
    } catch (error) {
      console.error(`[KNOWLEDGE] Failed to fetch issues from ${repo}:`, error.message);
    }
  }

  /**
   * Schedule automatic updates
   */
  scheduleUpdates() {
    // Update documentation daily at 3 AM
    const cron = require('node-cron');

    cron.schedule('0 3 * * *', async () => {
      console.log('[KNOWLEDGE] Starting scheduled documentation update...');
      try {
        await this.ingestAll();
        console.log('[KNOWLEDGE] Scheduled update complete');
      } catch (error) {
        console.error('[KNOWLEDGE] Scheduled update failed:', error);
      }
    });

    console.log('[KNOWLEDGE] Scheduled daily updates at 3 AM');
  }

  /**
   * Get knowledge base statistics
   */
  async getStats() {
    const { rows } = await query(
      `SELECT
        category,
        COUNT(*) as count,
        MAX(last_updated) as last_updated
       FROM error_knowledge
       GROUP BY category
       ORDER BY count DESC`,
      []
    );

    return rows;
  }
}

module.exports = new KnowledgeIngestion();
