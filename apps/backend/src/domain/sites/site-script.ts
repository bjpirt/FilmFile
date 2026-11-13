/**
 * A frame's page (D105): a few lines of plain JavaScript, no dependencies.
 * Every link works without it; it adds the arrow keys and Esc, swiping on a
 * phone, and scrolls the filmstrip to the frame shown.
 */
export const siteScript = `(function () {
  function follow(selector) {
    var link = document.querySelector(selector);
    if (link) window.location.href = link.href;
  }

  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft') follow('.step.previous');
    if (event.key === 'ArrowRight') follow('.step.next');
    if (event.key === 'Escape') follow('.frame-bar .back');
  });

  var stage = document.querySelector('.frame-stage');
  var startX = null;
  if (stage) {
    stage.addEventListener('touchstart', function (event) {
      startX = event.touches[0].clientX;
    });
    stage.addEventListener('touchend', function (event) {
      if (startX === null) return;
      var moved = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(moved) > 50) follow(moved < 0 ? '.step.next' : '.step.previous');
    });
  }

  // The frame shown in the middle of the filmstrip: sideways only, so opening
  // a frame never scrolls the page itself.
  var strip = document.querySelector('.filmstrip');
  var current = strip && strip.querySelector('[aria-current="page"]');
  if (current) {
    var box = strip.getBoundingClientRect();
    var shown = current.getBoundingClientRect();
    strip.scrollLeft += shown.left - box.left - (box.width - shown.width) / 2;
  }
})();
`;
