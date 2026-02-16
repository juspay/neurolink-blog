/* ============================================================
   NeuroLink Blog -- Custom JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', function() {
  /* --- Lazy loading for images --- */
  document.querySelectorAll('.post-content img, .page-content img, .content img').forEach(function(img) {
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
    if (!img.hasAttribute('decoding')) {
      img.setAttribute('decoding', 'async');
    }
  });

  /* --- Mermaid accessibility: add role="img" and aria-label for screen readers --- */
  document.querySelectorAll('pre.mermaid').forEach(function(diagram) {
    diagram.setAttribute('role', 'img');

    // Try to extract a meaningful label from the diagram content
    var textContent = diagram.textContent || '';
    var ariaLabel = 'Diagram';

    // Look for common diagram types in the mermaid source
    if (textContent.includes('flowchart') || textContent.includes('graph')) {
      ariaLabel = 'Flowchart diagram';
    } else if (textContent.includes('sequenceDiagram')) {
      ariaLabel = 'Sequence diagram';
    } else if (textContent.includes('classDiagram')) {
      ariaLabel = 'Class diagram';
    } else if (textContent.includes('erDiagram')) {
      ariaLabel = 'Entity relationship diagram';
    } else if (textContent.includes('gantt')) {
      ariaLabel = 'Gantt chart';
    } else if (textContent.includes('journey')) {
      ariaLabel = 'User journey diagram';
    } else if (textContent.includes('pie')) {
      ariaLabel = 'Pie chart';
    } else if (textContent.includes('gitGraph')) {
      ariaLabel = 'Git graph diagram';
    }

    diagram.setAttribute('aria-label', ariaLabel);
    diagram.setAttribute('tabindex', '0'); // Make focusable for keyboard users
  });

  /* --- Mermaid: brand theme applied via _includes/js-selector.html ---
     The inline script in js-selector.html wraps the frozen mermaid API object
     with a thin delegate that forces our brand themeVariables on every call to
     mermaid.initialize().  This intercepts both Chirpy's initial loadMermaid()
     and its theme-switch re-initialization.  No re-rendering needed here. */
});
