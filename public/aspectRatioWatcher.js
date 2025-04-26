function isMediaAspectRatioSupported() {
  try {
    // Пробуем создать media query
    return window.matchMedia('(min-aspect-ratio: 0.84/1)').media !== 'not all';
  } catch (e) {
    // Если браузер не понял медиазапрос — значит не поддерживается
    return false;
  }
}

function changeLayout() {
  if (isMediaAspectRatioSupported()) return;

  let root = document.documentElement;
  if (window.innerWidth / window.innerHeight >= 0.84) {
    root.classList.add('wide-aspect-ratio');
  } else {
    root.classList.remove('wide-aspect-ratio');
  }
}

changeLayout(); // initial
window.addEventListener('resize', changeLayout);
window.addEventListener('orientationchange', changeLayout);