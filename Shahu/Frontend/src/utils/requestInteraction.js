// Keeps a reference to the control that started a request. This lets the API
// layer provide consistent loading feedback without changing each page's flow.
let lastControl = null;
let lastActivatedAt = 0;

export function setupRequestInteractionTracking() {
  document.addEventListener('click', (event) => {
    const control = event.target.closest('button, input[type="submit"]');
    if (control) {
      lastControl = control;
      lastActivatedAt = Date.now();
    }
  }, true);

  document.addEventListener('submit', (event) => {
    lastControl = event.submitter || event.target.querySelector('button[type="submit"], input[type="submit"]');
    lastActivatedAt = Date.now();
  }, true);
}

export function markRequestPending() {
  // A request normally starts immediately after a click. Do not attach a
  // loading state to a button from an older, unrelated interaction.
  const control = Date.now() - lastActivatedAt < 1500 ? lastControl : null;
  if (!control || !control.isConnected) return () => {};

  const wasDisabled = control.disabled;
  control.disabled = true;
  control.dataset.requestPending = 'true';
  control.setAttribute('aria-busy', 'true');
  return () => {
    if (!control.isConnected) return;
    control.disabled = wasDisabled;
    delete control.dataset.requestPending;
    control.removeAttribute('aria-busy');
  };
}
