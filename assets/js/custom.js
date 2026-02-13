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
});
