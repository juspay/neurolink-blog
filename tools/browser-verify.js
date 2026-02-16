// Comprehensive blog post verification script
// Run this in browser console to verify GIFs and mermaid diagrams

const postsToVerify = [
  'advanced-rag',
  'rag-implementation',
  'streaming-best-practices',
  'function-calling-patterns',
  'mcp-tools-integration',
  'mcp-server-tutorial',
  'workflow-engine',
  'what-is-neurolink-unified-sdk',
  'provider-abstraction',
  'multi-model-consensus',
  'event-system',
  'how-we-built-mcp-integration',
  'rag-application-typescript-tutorial',
  'mcp-usb-c-of-ai'
];

async function verifyPost(slug) {
  const url = `http://localhost:4000/posts/${slug}/`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        slug,
        status: 'ERROR',
        httpStatus: response.status,
        message: `HTTP ${response.status}`
      };
    }

    const html = await response.text();

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Count GIFs
    const gifImages = Array.from(doc.querySelectorAll('img')).filter(img =>
      img.src && img.src.includes('.gif')
    );

    // Count mermaid diagrams
    const mermaidCode = doc.querySelectorAll('code.language-mermaid');

    return {
      slug,
      status: 'OK',
      httpStatus: 200,
      gifs: gifImages.length,
      gifSrcs: gifImages.map(img => img.src.split('/').pop()),
      mermaidBlocks: mermaidCode.length
    };

  } catch (error) {
    return {
      slug,
      status: 'ERROR',
      message: error.message
    };
  }
}

async function verifyAll() {
  console.log('Starting verification of', postsToVerify.length, 'posts...\n');

  const results = [];
  for (const slug of postsToVerify) {
    const result = await verifyPost(slug);
    results.push(result);

    const status = result.status === 'OK' ? '✅' : '❌';
    console.log(`${status} ${slug}: ${result.gifs || 0} GIFs, ${result.mermaidBlocks || 0} mermaid`);
  }

  console.log('\n=== Summary ===');
  const ok = results.filter(r => r.status === 'OK').length;
  const errors = results.filter(r => r.status === 'ERROR');

  console.log(`✅ ${ok}/${results.length} posts verified`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => {
      console.log(`  - ${e.slug}: ${e.message}`);
    });
  }

  return results;
}

// Run verification
verifyAll();
