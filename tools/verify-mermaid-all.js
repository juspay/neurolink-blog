#!/usr/bin/env node
/**
 * Comprehensive Mermaid Diagram Verification Script
 *
 * This script verifies all mermaid diagrams across all blog posts
 * by actually navigating to each page and checking the rendered SVG.
 *
 * Usage: Run this in the browser console or via Chrome DevTools Protocol
 */

const ALL_POSTS_WITH_MERMAID = [
  'advanced-rag', 'ai-claims-processing-insurance', 'ai-content-localization-media',
  'ai-ethics-responsible-use', 'ai-farm-advisory-agricultural-rag',
  'ai-maintenance-knowledge-base-manufacturing', 'ai-recruitment-pipeline',
  'ai-sdk-landscape-2026', 'ai-security-checklist-owasp-top-10-llm',
  'ai-streaming-react-sse-websockets', 'ai-tutoring-platform',
  'anthropic-claude-guide', 'auditable-ai-pipelines', 'aws-sagemaker-custom-models',
  'batch-processing', 'build-vs-buy-ai-abstraction', 'building-ai-agents',
  'building-slack-bot-with-ai', 'caching-strategies', 'case-study-fintech',
  'cicd-for-ai-applications', 'cli-automation', 'community-contributions',
  'community-showcase', 'compliant-ai-citizen-services-government',
  'configuration-deep-dive', 'context-compaction', 'contributor-to-maintainer',
  'conversation-memory-guide', 'debugging-ai-applications',
  'ecommerce-recommendation-guide', 'embeddings-vector-operations',
  'enterprise-customer-support-bot', 'enterprise-security-guide',
  'eu-ai-act-compliance', 'event-driven-ai', 'event-system',
  'extended-thinking', 'factory-registry-pattern', 'framework-comparison',
  'full-stack-ai-chatbot-nextjs-neurolink', 'function-calling-patterns',
  'future-of-ai-sdks', 'generating-10k-descriptions-cost-optimized-pipelines',
  'getting-started-first-ai-app', 'google-ai-studio-gemini-integration',
  'healthcare-ai-assistant-guide', 'hitl-guardrails-guide',
  'how-we-built-mcp-integration', 'how-we-built-multi-provider-failover',
  'how-we-built-rag-pipeline', 'how-we-built-streaming-tool-calls',
  'how-we-scaled-provider-registry', 'hugging-face-integration',
  'image-generation-neurolink', 'legal-document-analysis-guide',
  'litellm-unified-routing', 'mcp-server-tutorial', 'mcp-tools-integration',
  'mcp-usb-c-of-ai', 'microservices-with-ai', 'middleware-system',
  'mistral-ai-integration', 'model-evaluation-scoring', 'monitoring-observability',
  'multi-agent-networks', 'multi-model-consensus', 'multi-model-future',
  'multi-provider-ai-agent-typescript', 'multi-tenant-ai-saas',
  'multimodal-document-processing', 'neurolink-cli-mastery',
  'neurolink-docusaurus', 'neurolink-quickstart-10-things',
  'neurolink-vs-portkey-helicone', 'ollama-local-llm-guide',
  'openai-compatible-endpoints', 'openai-integration-guide',
  'openapi-generation', 'openrouter-integration-guide',
  'orchestrating-supply-chain-ai', 'powerpoint-generation-ai',
  'processing-any-document-50-file-types', 'prompt-engineering-neurolink',
  'prompt-versioning-management', 'provider-abstraction',
  'provider-comparison-matrix', 'provider-failover-patterns',
  'rag-application-typescript-tutorial', 'rag-implementation',
  'rate-limiting-strategies', 'raw-data-to-reports-automating-bi-with-ai',
  'real-estate-lease-abstraction-ai', 'reduce-llm-costs-smart-model-routing',
  'sdk-vs-gateway', 'server-adapters', 'serverless-ai',
  'speech-to-text-neurolink', 'streaming-best-practices',
  'structured-output-json', 'structured-output-llm-json-schema-typescript',
  'testing-ai-applications', 'tts-integration-guide',
  'typescript-best-practices', 'v9-release-migration-guide',
  'vector-database-guide', 'version-migration-guide',
  'video-generation-veo', 'voice-first-hotel-concierge',
  'what-is-neurolink-unified-sdk', 'workflow-engine',
  'zero-to-production-neurolink'
];

async function checkMermaidOnPage(slug) {
  const url = `http://localhost:4000/posts/${slug}/`;

  // Create hidden iframe to load the page
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);

  return new Promise((resolve) => {
    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;

        // Wait for mermaid to render
        setTimeout(() => {
          const mermaidSvgs = doc.querySelectorAll('svg[id^="mermaid"]');
          const mermaidCode = doc.querySelectorAll('code.language-mermaid');

          const errors = [];

          mermaidSvgs.forEach((svg, index) => {
            const ariaRole = svg.getAttribute('aria-roledescription');
            if (ariaRole === 'error') {
              const textElements = svg.querySelectorAll('text, tspan');
              const errorTexts = [];
              textElements.forEach(el => {
                const text = el.textContent.trim();
                if (text && !text.startsWith('mermaid version')) {
                  errorTexts.push(text);
                }
              });
              errors.push({
                diagramIndex: index,
                errorText: errorTexts.join(', ')
              });
            }
          });

          document.body.removeChild(iframe);

          resolve({
            slug,
            mermaidCode: mermaidCode.length,
            mermaidSvg: mermaidSvgs.length,
            hasErrors: errors.length > 0,
            errors
          });
        }, 1000); // Wait 1s for mermaid rendering

      } catch (error) {
        document.body.removeChild(iframe);
        resolve({
          slug,
          status: 'ERROR',
          error: error.message
        });
      }
    };

    iframe.onerror = () => {
      document.body.removeChild(iframe);
      resolve({
        slug,
        status: 'HTTP_ERROR'
      });
    };

    // Timeout after 5 seconds
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
        resolve({
          slug,
          status: 'TIMEOUT'
        });
      }
    }, 5000);
  });
}

async function verifyAllMermaidDiagrams() {
  console.log(`🔍 Verifying ${ALL_POSTS_WITH_MERMAID.length} posts with mermaid diagrams...`);

  const results = [];
  const errors = [];

  for (let i = 0; i < ALL_POSTS_WITH_MERMAID.length; i++) {
    const slug = ALL_POSTS_WITH_MERMAID[i];
    console.log(`[${i + 1}/${ALL_POSTS_WITH_MERMAID.length}] Checking ${slug}...`);

    const result = await checkMermaidOnPage(slug);
    results.push(result);

    if (result.hasErrors) {
      errors.push(result);
      console.log(`  ❌ ${slug}: ${result.errors.length} diagram(s) with errors`);
      result.errors.forEach(err => {
        console.log(`     - Diagram ${err.diagramIndex}: ${err.errorText}`);
      });
    } else if (result.status === 'ERROR' || result.status === 'TIMEOUT' || result.status === 'HTTP_ERROR') {
      errors.push(result);
      console.log(`  ⚠️  ${slug}: ${result.status}${result.error ? ' - ' + result.error : ''}`);
    } else {
      console.log(`  ✅ ${slug}: ${result.mermaidCode} diagrams OK`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 SUMMARY`);
  console.log('='.repeat(80));
  console.log(`Total posts checked: ${results.length}`);
  console.log(`Posts with errors: ${errors.length}`);
  console.log(`Success rate: ${((results.length - errors.length) / results.length * 100).toFixed(1)}%`);

  if (errors.length > 0) {
    console.log('\n❌ POSTS WITH ERRORS:');
    errors.forEach(err => {
      console.log(`  - ${err.slug}${err.errors ? ` (${err.errors.length} diagrams)` : ''}`);
    });
  }

  return {
    total: results.length,
    errors: errors.length,
    results,
    errorDetails: errors
  };
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  verifyAllMermaidDiagrams();
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { verifyAllMermaidDiagrams, checkMermaidOnPage, ALL_POSTS_WITH_MERMAID };
}
