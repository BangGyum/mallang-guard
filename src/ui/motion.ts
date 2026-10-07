export function reducedMotion(): boolean {
  const setting = document.querySelector<HTMLElement>('#app')?.dataset.reducedMotion;
  return setting === undefined
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : setting === 'true';
}
