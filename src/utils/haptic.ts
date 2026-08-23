export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' | 'error' = 'light') {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      switch (type) {
        case 'light':
          window.navigator.vibrate(10);
          break;
        case 'medium':
          window.navigator.vibrate(30);
          break;
        case 'success':
          window.navigator.vibrate([20, 50, 20]);
          break;
        case 'warning':
          window.navigator.vibrate([40, 80, 40]);
          break;
        case 'error':
          window.navigator.vibrate([60, 120, 60]);
          break;
      }
    } catch (e) {
      // Fail silently if browser blocks vibration
    }
  }
}
