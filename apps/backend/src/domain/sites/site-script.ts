/**
 * The lightbox: a few lines of plain JavaScript, no dependencies. Without it
 * each photo is still a link to its large image.
 */
export const siteScript = `(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.photo a'));
  var box = document.getElementById('lightbox');
  var image = box.querySelector('img');
  var caption = box.querySelector('.lightbox-caption');
  var current = 0;

  function show(index) {
    current = (index + links.length) % links.length;
    var link = links[current];
    var thumb = link.querySelector('img');
    image.src = link.href;
    image.alt = thumb.alt;
    var text = link.parentNode.querySelector('figcaption');
    caption.textContent = text ? text.textContent : '';
  }

  links.forEach(function (link, index) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      show(index);
      box.showModal();
    });
  });

  box.querySelector('[data-previous]').addEventListener('click', function () {
    show(current - 1);
  });
  box.querySelector('[data-next]').addEventListener('click', function () {
    show(current + 1);
  });
  box.querySelector('[data-close]').addEventListener('click', function () {
    box.close();
  });
  box.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });

  var startX = null;
  box.addEventListener('touchstart', function (event) {
    startX = event.touches[0].clientX;
  });
  box.addEventListener('touchend', function (event) {
    if (startX === null) return;
    var moved = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(moved) > 50) show(current + (moved < 0 ? 1 : -1));
  });
})();
`;
