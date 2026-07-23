export function maximizeTelegramWebApp(webApp) {
  if (!webApp) return false;

  try {
    webApp.ready();
    webApp.expand();

    if (typeof webApp.disableVerticalSwipes === "function") {
      webApp.disableVerticalSwipes();
    }

    const supportsFullscreen =
      typeof webApp.requestFullscreen === "function" &&
      (typeof webApp.isVersionAtLeast !== "function" ||
        webApp.isVersionAtLeast("8.0"));

    if (supportsFullscreen && !webApp.isFullscreen) {
      webApp.requestFullscreen();
    }

    return true;
  } catch (error) {
    console.warn("Telegram fullscreen request was not available:", error);
    return false;
  }
}
