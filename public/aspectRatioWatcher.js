function isSupportAspRatio() {
  return CSS.supports('min-aspect-ratio', '0.84');
}

function changeLayout() {
  let root = document.querySelector('html');
  if (window.innerWidth / window.innerHeight >= 0.84) {
    root.classList.add('wide-aspect-ratio');
  } else {
    root.classList.remove('wide-aspect-ratio');
  }
}

if (!isSupportAspRatio()) {
  changeLayout(); // initial
  window.addEventListener('resize', changeLayout);
  window.addEventListener('orientationchange', changeLayout);
}
