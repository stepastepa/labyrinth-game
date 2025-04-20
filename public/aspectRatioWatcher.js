// function updateWideAspectClass() {
//   const ratio = window.innerWidth / window.innerHeight;
//   document.documentElement.classList.toggle('wide-aspect-ratio', ratio >= 0.84);
// }

// updateWideAspectClass();
// window.addEventListener('resize', updateWideAspectClass);
// window.addEventListener('orientationchange', updateWideAspectClass);

const query = '(min-aspect-ratio: 0.84/1)';
const media = window.matchMedia(query);

if (media.matches !== (window.innerWidth / window.innerHeight >= 0.84)) {
  const observer = new ResizeObserver(entries => {
    for (let entry of entries) {
      const rect = entry.contentRect;
      const ratio = rect.width / rect.height;
      document.documentElement.classList.toggle('wide-aspect-ratio', ratio >= 0.84);
    }
  });

  observer.observe(document.documentElement);
}