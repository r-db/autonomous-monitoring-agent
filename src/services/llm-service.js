const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { query } = require('../config/database');

/**
 * Multi-LLM Service with Provider Selection
 * Supports: Claude (Anthropic), GPT-4 (OpenAI), and extensible for others
 */

class LLMService {
  constructor() {
    this.providers = {
      claude: null,
      openai: null
    };

    // Initialize based on available API keys
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.claude = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }

    if (process.env.OPENAI_API_KEY) {
      this.providers.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  /**
   * Get active LLM provider from database config
   */
  async getActiveProvider() {
    const { rows } = await query(
      "SELECT value FROM system_config WHERE key = 'active_llm_provider'",
      []
    );

    if (rows.length > 0) {
      const config = rows[0].value;
      return config.provider || 'claude';
    }

    return 'claude'; // Default
  }

  /**
   * Get model configuration for provider
   */
  async getModelConfig() {
    const { rows } = await query(
      "SELECT value FROM system_config WHERE key = 'llm_model_config'",
      []
    );

    if (rows.length > 0) {
      return rows[0].value;
    }

    // Defaults
    return {
      claude: {
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0.7
      },
      openai: {
        model: 'gpt-4-turbo-preview',
        maxTokens: 4096,
        temperature: 0.7
      }
    };
  }

  /**
   * Generate fix for error using selected LLM
   */
  async generateFix(incident, context = {}) {
    const provider = await this.getActiveProvider();
    const modelConfig = await getModelConfig();

    console.log(`[LLM] Using provider: ${provider}`);

    // Build comprehensive context
    const promptContext = await this.buildContext(incident, context);

    if (provider === 'claude') {
      return await this.generateWithClaude(incident, promptContext, modelConfig.claude);
    } else if (provider === 'openai') {
      return await this.generateWithOpenAI(incident, promptContext, modelConfig.openai);
    }

    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  /**
   * Build comprehensive context from knowledge base
   */
  async buildContext(incident, additionalContext = {}) {
    // Get relevant documentation from RAG
    const relevantDocs = await this.searchKnowledgeBase(incident);

    // Get similar past incidents
    const similarIncidents = await this.findSimilarIncidents(incident);

    // Get application state
    const appState = await this.getApplicationState();

    return {
      incident: {
        id: incident.incident_id,
        title: incident.title,
        error_message: incident.error_message,
        error_type: incident.error_type,
        severity: incident.severity,
        stack_trace: incident.stack_trace,
        context: incident.context
      },
      relevantDocs,
      similarIncidents,
      appState,
      ...additionalContext
    };
  }

  /**
   * Search knowledge base using vector similarity
   */
  async searchKnowledgeBase(incident) {
    // Get embedding for incident
    const embedding = await this.getEmbedding(incident.error_message);

    // Search error_knowledge table using pgvector
    const { rows } = await query(
      `SELECT
        title,
        error_pattern,
        solution,
        code_fix,
        context,
        embedding <=> $1::vector as distance
       FROM error_knowledge
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [embedding]
    );

    return rows;
  }

  /**
   * Find similar past incidents
   */
  async findSimilarIncidents(incident) {
    const { rows } = await query(
      `SELECT
        incident_id,
        title,
        error_message,
        resolution,
        resolved_at
       FROM incidents
       WHERE status = 'resolved'
         AND error_type = $1
       ORDER BY resolved_at DESC
       LIMIT 5`,
      [incident.error_type]
    );

    return rows;
  }

  /**
   * Get current application state
   */
  async getApplicationState() {
    // Get recent monitoring checks
    const { rows: recentChecks } = await query(
      `SELECT check_type, target, status, COUNT(*) as count
       FROM monitoring_checks
       WHERE timestamp > NOW() - INTERVAL '10 minutes'
       GROUP BY check_type, target, status
       ORDER BY count DESC
       LIMIT 20`,
      []
    );

    return {
      recentChecks,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate fix using Claude
   */
  async generateWithClaude(incident, context, config) {
    if (!this.providers.claude) {
      throw new Error('Claude API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(incident, context);

    const response = await this.providers.claude.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    return this.parseResponse(response.content[0].text, 'claude');
  }

  /**
   * Generate fix using OpenAI
   */
  async generateWithOpenAI(incident, context, config) {
    if (!this.providers.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(incident, context);

    const response = await this.providers.openai.chat.completions.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    return this.parseResponse(response.choices[0].message.content, 'openai');
  }

  /**
   * Build system prompt with comprehensive knowledge
   */
  buildSystemPrompt(context) {
    return `You are an autonomous error-fixing agent for the IB365 admin console system.

TECH STACK:
- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, PostgreSQL (Neon)
- Deployment: Railway (backend), Vercel (frontend)
- Auth: Clerk
- Database: Neon PostgreSQL with pgvector
- Monitoring: Playwright, cron jobs

YOUR CAPABILITIES:
- Analyze errors from production systems
- Search knowledge base for solutions
- Generate code fixes
- Deploy fixes automatically (when approved)
- Verify fixes work correctly

CURRENT APPLICATION STATE:
${JSON.stringify(context.appState, null, 2)}

RELEVANT DOCUMENTATION:
${context.relevantDocs.map(doc => `
Title: ${doc.title}
Pattern: ${doc.error_pattern}
Solution: ${doc.solution}
`).join('\n')}

SIMILAR PAST INCIDENTS:
${context.similarIncidents.map(inc => `
${inc.title}: ${inc.resolution}
`).join('\n')}

RESPONSE FORMAT:
You must respond in JSON format:
{
  "analysis": "Brief analysis of the error",
  "root_cause": "Identified root cause",
  "solution": "Proposed solution",
  "confidence": "HIGH/MEDIUM/LOW",
  "requires_approval": true/false,
  "steps": [
    {
      "action": "description",
      "code": "code to execute (if applicable)",
      "file": "file path (if applicable)",
      "verification": "how to verify this step"
    }
  ],
  "risks": ["list of potential risks"],
  "rollback_plan": "how to undo if this fails"
}`;
  }

  /**
   * Build user prompt with incident details
   */
  buildUserPrompt(incident, context) {
    return `INCIDENT DETAILS:
ID: ${incident.incident_id}
Title: ${incident.title}
Error: ${incident.error_message}
Type: ${incident.error_type}
Severity: ${incident.severity}

${incident.stack_trace ? `Stack Trace:\n${incident.stack_trace}` : ''}

${incident.context ? `Context:\n${JSON.stringify(incident.context, null, 2)}` : ''}

Please analyze this error and provide a fix following the response format specified in your system prompt.`;
  }

  /**
   * Parse LLM response and extract fix
   */
  parseResponse(content, provider) {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, structure the response
      return {
        analysis: content,
        root_cause: 'Unable to parse structured response',
        solution: content,
        confidence: 'LOW',
        requires_approval: true,
        steps: [],
        risks: ['Response parsing failed - manual review required'],
        rollback_plan: 'Manual intervention required'
      };
    } catch (error) {
      console.error(`[LLM] Failed to parse ${provider} response:`, error);
      throw error;
    }
  }

  /**
   * Get embedding for text (for RAG search)
   */
  async getEmbedding(text) {
    const provider = await this.getActiveProvider();

    if (provider === 'openai' && this.providers.openai) {
      const response = await this.providers.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      });
      return `[${response.data[0].embedding.join(',')}]`;
    }

    // For Claude or if OpenAI not available, use a simple hash-based approach
    // In production, you'd use a dedicated embedding service
    return null;
  }

  /**
   * Update LLM configuration
   */
  async updateConfig(provider, model) {
    await query(
      `UPDATE system_config
       SET value = jsonb_set(value, '{provider}', to_jsonb($2::text))
       WHERE key = 'active_llm_provider'`,
      [null, provider]
    );

    await query(
      `UPDATE system_config
       SET value = jsonb_set(value, '{${provider}, model}', to_jsonb($2::text))
       WHERE key = 'llm_model_config'`,
      [null, model]
    );

    console.log(`[LLM] Configuration updated: ${provider} - ${model}`);
  }
}

module.exports = new LLMService();
