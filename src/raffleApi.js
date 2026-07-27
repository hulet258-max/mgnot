export const API_BASE_URL = process.env.REACT_APP_API_URL;

export function getApiOrigin() {
  return String(API_BASE_URL || "").replace(/\/api\/?$/, "");
}

/** Resolve uploaded relative paths (/uploads/...) against the API host. */
export function mediaUrl(path) {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  const origin = getApiOrigin();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}

/** Build width variants for newly optimized uploads; legacy/external paths stay unchanged. */
export function mediaSrcSet(path) {
  const resolved = mediaUrl(path);
  if (!/-1280\.webp(?:$|[?#])/i.test(resolved)) return undefined;
  return [320, 768, 1280]
    .map((width) => `${resolved.replace(/-1280\.webp(?=$|[?#])/i, `-${width}.webp`)} ${width}w`)
    .join(", ");
}

export function telegramHeaders(user, withJson = false) {
  const headers = {};
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) headers["x-telegram-init-data"] = initData;
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

export function userQuery(user) {
  return user?.telegramId ? `?userId=${encodeURIComponent(user.telegramId)}` : "";
}

export async function readJson(response, fallback) {
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data?.error || fallback);
  return data;
}
