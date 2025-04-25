const query = '(min-aspect-ratio: 0.84/1)';
const media = window.matchMedia(query);

function changeLayout() {
  let root = document.querySelector('html');
  if (media.matches !== (window.innerWidth / window.innerHeight >= 0.84)) {
    root.classList.add('wide-aspect-ratio');
  } else {
    root.classList.remove('wide-aspect-ratio');
  }
}

changeLayout(); // initial
window.addEventListener('resize', changeLayout);
window.addEventListener('orientationchange', changeLayout);
