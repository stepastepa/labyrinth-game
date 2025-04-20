// function updateWideAspectClass() {
//   const ratio = window.innerWidth / window.innerHeight;
//   document.documentElement.classList.toggle('wide-aspect-ratio', ratio >= 0.84);
// }

// updateWideAspectClass();
// window.addEventListener('resize', updateWideAspectClass);
// window.addEventListener('orientationchange', updateWideAspectClass);

const testQuery = '(min-aspect-ratio: 0.84/1)';
const supportsAspectRatio = matchMedia(testQuery).media === testQuery;

if (!supportsAspectRatio) {
  function applyWideAspectRatioClass(entry) {
    const rect = entry.contentRect;
    const ratio = rect.width / rect.height;
    document.documentElement.classList.toggle('wide-aspect-ratio', ratio >= 0.84);
  }

  const observer = new ResizeObserver(entries => {
  for (let entry of entries) {
      applyWideAspectRatioClass(entry);
    }
  });

  observer.observe(document.documentElement);
}