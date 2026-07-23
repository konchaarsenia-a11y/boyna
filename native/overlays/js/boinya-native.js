/**
 * JS-мост телефона. Live Activity / APNs — stub под будущий Swift plugin.
 */
(function () {
  "use strict";
  if (window.BoinyaNative && window.BoinyaNative.__ready) return;

  function cap() {
    return window.Capacitor || null;
  }

  async function haptic(kind) {
    try {
      var C = cap();
      if (C && C.Plugins && C.Plugins.Haptics) {
        var H = C.Plugins.Haptics;
        if (kind === "success" || kind === "error" || kind === "warning") {
          await H.notification({ type: kind === "error" ? "ERROR" : kind === "warning" ? "WARNING" : "SUCCESS" });
        } else {
          var style = kind === "medium" || kind === "heavy" ? String(kind).toUpperCase() : "LIGHT";
          await H.impact({ style: style });
        }
        return;
      }
    } catch (e) {}
  }

  function openUrl(url) {
    try {
      window.open(url, "_blank");
    } catch (e) {}
  }

  function notify(title, body) {
    // Stub: позже — локальные/push уведомления + Dynamic Island
    try {
      if (window.console) console.log("[BoinyaNative.notify]", title, body || "");
    } catch (e) {}
    return Promise.resolve({ ok: false, stub: true });
  }

  function startLiveActivity(payload) {
    try {
      if (window.console) console.log("[BoinyaNative.startLiveActivity]", payload);
    } catch (e) {}
    return Promise.resolve({ ok: false, stub: true });
  }

  function updateLiveActivity(payload) {
    try {
      if (window.console) console.log("[BoinyaNative.updateLiveActivity]", payload);
    } catch (e) {}
    return Promise.resolve({ ok: false, stub: true });
  }

  function endLiveActivity(payload) {
    try {
      if (window.console) console.log("[BoinyaNative.endLiveActivity]", payload);
    } catch (e) {}
    return Promise.resolve({ ok: false, stub: true });
  }

  window.BoinyaNative = {
    __ready: true,
    platform: "capacitor",
    haptic: haptic,
    openUrl: openUrl,
    notify: notify,
    startLiveActivity: startLiveActivity,
    updateLiveActivity: updateLiveActivity,
    endLiveActivity: endLiveActivity
  };
})();
