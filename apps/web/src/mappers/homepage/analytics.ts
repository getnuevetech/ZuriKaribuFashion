type AnalyticsPayload = Record<string, unknown>;

export const trackHomeEvent = (eventName: string, payload: AnalyticsPayload = {}) => {
  const event = String(eventName || '').trim();
  if (!event || typeof window === 'undefined') return;

  try {
    const bag = { event, ...payload };
    const dataLayer = (window as any).dataLayer;
    if (Array.isArray(dataLayer)) {
      dataLayer.push(bag);
    }
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('event', event, payload);
    }
    window.dispatchEvent(new CustomEvent('zk:home-analytics', { detail: bag }));
  } catch {
    // Never block user interactions due to analytics transport issues.
  }
};
