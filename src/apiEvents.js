export function recordEvent(eventName, { userId = null, metadata = {} } = {}) {
  const API_BASE_URL = process.env.REACT_APP_API_URL;

  return fetch(`${API_BASE_URL}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, userId, metadata }),
  }).catch(() => null);
}
