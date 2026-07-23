import { maximizeTelegramWebApp } from "./telegramWebApp";

test("requests Telegram fullscreen and prevents collapsing when supported", () => {
  const webApp = {
    ready: jest.fn(),
    expand: jest.fn(),
    disableVerticalSwipes: jest.fn(),
    requestFullscreen: jest.fn(),
    isVersionAtLeast: jest.fn(() => true),
    isFullscreen: false,
  };

  expect(maximizeTelegramWebApp(webApp)).toBe(true);
  expect(webApp.ready).toHaveBeenCalledTimes(1);
  expect(webApp.expand).toHaveBeenCalledTimes(1);
  expect(webApp.disableVerticalSwipes).toHaveBeenCalledTimes(1);
  expect(webApp.isVersionAtLeast).toHaveBeenCalledWith("8.0");
  expect(webApp.requestFullscreen).toHaveBeenCalledTimes(1);
});

test("keeps expanded mode without requesting unsupported fullscreen", () => {
  const webApp = {
    ready: jest.fn(),
    expand: jest.fn(),
    disableVerticalSwipes: jest.fn(),
    requestFullscreen: jest.fn(),
    isVersionAtLeast: jest.fn(() => false),
    isFullscreen: false,
  };

  expect(maximizeTelegramWebApp(webApp)).toBe(true);
  expect(webApp.expand).toHaveBeenCalledTimes(1);
  expect(webApp.requestFullscreen).not.toHaveBeenCalled();
});
