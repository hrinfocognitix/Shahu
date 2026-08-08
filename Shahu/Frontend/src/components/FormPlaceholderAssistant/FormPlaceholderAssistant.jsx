import { useEffect } from 'react';

const supportedTypes = new Set(['', 'text', 'email', 'tel', 'number', 'password', 'url', 'search']);

const labelFor = (field) => {
  const wrappingLabel = field.closest('label');
  const labelCopy = wrappingLabel?.cloneNode(true);
  labelCopy?.querySelectorAll('input, textarea, select, button, small').forEach((element) => element.remove());
  const labelText = wrappingLabel?.querySelector('span, legend')?.textContent?.trim()
    || labelCopy?.textContent?.trim()
    || field.getAttribute('aria-label')
    || field.name?.replace(/([A-Z])/g, ' $1').trim();
  return labelText?.replace(/\s*\(.*?\)\s*/g, '').replace(/:$/, '').trim();
};

const placeholderFor = (field) => {
  const label = labelFor(field);
  if (!label) return '';
  if (field.type === 'email') return 'name@example.com';
  if (field.type === 'password') {
    return /confirm/i.test(label) ? 'Confirm your password' : 'Enter your password';
  }
  if (field.type === 'tel') return 'Enter mobile number';
  return `Enter ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
};

const applyPlaceholders = (root) => {
  root.querySelectorAll('input, textarea').forEach((field) => {
    const type = (field.getAttribute('type') || '').toLowerCase();
    const supported = field.tagName === 'TEXTAREA' || supportedTypes.has(type);
    if (!supported || field.readOnly || field.disabled || field.placeholder || field.dataset.noAutoPlaceholder !== undefined) return;
    const placeholder = placeholderFor(field);
    if (placeholder) field.setAttribute('placeholder', placeholder);
  });
};

// Forms are rendered in many pages and modal portals. This keeps their empty
// fields consistently self-explanatory without changing values or validation.
export function FormPlaceholderAssistant() {
  useEffect(() => {
    const root = document.body;
    applyPlaceholders(root);
    const observer = new MutationObserver(() => applyPlaceholders(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
