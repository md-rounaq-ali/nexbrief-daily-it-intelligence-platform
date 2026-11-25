// NexBrief — Shared Countdown Timer (7:00 AM IST), PWA Installer & Web Push Client
'use strict';

(() => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  let deferredInstallPrompt = null;
  let swRegistration = null;

  const notify = (msg, type = 'info') => {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.className = `toast ${type} show`;
      setTimeout(() => t.classList.remove('show'), 4000);
    } else {
      console.log(`[NexBrief ${type}] ${msg}`);
    }
  };

  // ── 1. Live Timezone-Proof Countdown to 7:00 AM IST ─────────────────────────
  const computeSecondsToNext7AMIST = () => {
    const shiftedNow = Date.now() + IST_OFFSET_MS;
    const istDate = new Date(shiftedNow);
    let targetShifted = Date.UTC(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
      7, 0, 0, 0
    );
    if (shiftedNow >= targetShifted) {
      targetShifted += 24 * 60 * 60 * 1000;
    }
    return Math.max(0, Math.floor((targetShifted - shiftedNow) / 1000));
  };

  const formatHMS = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const updateCountdowns = () => {
    const els = document.querySelectorAll('[data-countdown]');
    if (!els.length) return;
    const formatted = formatHMS(computeSecondsToNext7AMIST());
    els.forEach((el) => {
      el.textContent = formatted;
    });
  };

  updateCountdowns();
  setInterval(updateCountdowns, 1000);

  // ── 2. Service Worker + PWA Install Prompt ──────────────────────────────────
  const updateInstallButtons = (visible) => {
    document.querySelectorAll('.pwa-install-btn').forEach((btn) => {
      btn.classList.toggle('hidden', !visible);
    });
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallButtons(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButtons(false);
    notify('📱 NexBrief installed! Launch anytime from your home screen.', 'success');
  });

  document.addEventListener('click', async (e) => {
    const installBtn = e.target.closest('.pwa-install-btn');
    if (!installBtn) return;
    if (!deferredInstallPrompt) {
      notify('ℹ️ Use your browser menu → "Install App" / "Add to Home Screen".', 'info');
      return;
    }
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      updateInstallButtons(false);
    }
    deferredInstallPrompt = null;
  });

  // ── 3. Web Push Notifications (7 AM IST Browser Alerts) ─────────────────────
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const setPushBtnState = (isSubscribed) => {
    document.querySelectorAll('.push-optin-btn').forEach((btn) => {
      if (!('Notification' in window) || !('PushManager' in window)) {
        btn.style.display = 'none';
        return;
      }
      if (Notification.permission === 'denied') {
        btn.textContent = '🔕 Alerts Blocked';
        btn.classList.remove('active-push');
        return;
      }
      if (isSubscribed) {
        btn.textContent = '✅ 7 AM Alerts On';
        btn.classList.add('active-push');
        btn.title = 'Click to turn off 7:00 AM IST browser alerts';
      } else {
        btn.textContent = '🔔 7 AM Alerts';
        btn.classList.remove('active-push');
        btn.title = 'Get a browser alert when the 7:00 AM IST digest drops';
      }
    });
  };

  const togglePushSubscription = async () => {
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
      notify('⚠️ Push notifications are not supported by this browser.', 'error');
      return;
    }

    if (Notification.permission === 'denied') {
      notify('🔕 Notifications are blocked in your browser site settings.', 'error');
      return;
    }

    try {
      const reg = swRegistration || (await navigator.serviceWorker.ready);
      const existingSub = await reg.pushManager.getSubscription();

      // Unsubscribe if currently active
      if (existingSub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: existingSub.endpoint }),
        }).catch(() => {});
        await existingSub.unsubscribe();
        setPushBtnState(false);
        notify('🔕 7 AM browser alerts paused.', 'info');
        return;
      }

      // Ask permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushBtnState(false);
        notify('⚠️ Permission needed to send 7 AM digest alerts.', 'info');
        return;
      }

      // Fetch VAPID key from server
      const keyRes = await fetch('/api/push/vapid-public-key');
      const keyData = await keyRes.json();
      if (!keyData.success || !keyData.publicKey) {
        throw new Error('Could not obtain push public key.');
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });

      const token = localStorage.getItem('nexbrief_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscription }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.message || 'Failed to subscribe.');
      }

      setPushBtnState(true);
      notify('🔔 Enabled! You will receive 7:00 AM IST browser alerts.', 'success');
    } catch (err) {
      console.error('Push subscription error:', err);
      notify('❌ Could not enable browser alerts. Try again.', 'error');
    }
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest('.push-optin-btn')) {
      togglePushSubscription();
    }
  });

  // ── 4. Register SW & Sync Push UI on Load ──────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if ('PushManager' in window) {
          const readyReg = await navigator.serviceWorker.ready;
          swRegistration = readyReg;
          const existingSub = await readyReg.pushManager.getSubscription();
          setPushBtnState(!!existingSub);
        }
      } catch (err) {
        console.warn('SW registration skipped:', err.message);
      }
    });
  } else {
    setPushBtnState(false);
  }
})();
