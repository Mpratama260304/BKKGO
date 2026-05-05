// Loads Google reCAPTCHA v2 checkbox lazily. Returns { token, reset } via render-prop.
// If `siteKey` is null/empty, renders nothing — caller treats it as "captcha disabled".
import { useEffect, useRef, useState } from 'react';

let scriptPromise = null;
function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) return resolve(window.grecaptcha);
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = () => resolve(window.grecaptcha);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function Recaptcha({ siteKey, onChange }) {
  const ref = useRef(null);
  const widgetId = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript().then((g) => {
      g.ready(() => {
        if (cancelled || !ref.current || widgetId.current != null) return;
        widgetId.current = g.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onChange?.(token),
          'expired-callback': () => onChange?.(null),
          'error-callback': () => setError('Captcha error'),
        });
      });
    }).catch(() => setError('Failed to load captcha'));
    return () => { cancelled = true; };
  }, [siteKey]);

  if (!siteKey) return null;
  return (
    <div>
      <div ref={ref} />
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
