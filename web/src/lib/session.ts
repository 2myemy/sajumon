const KEY = "sajumon_session_id";

function newId() {
  return crypto.randomUUID();
}

export function getSessionId() {
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id = newId();
  localStorage.setItem(KEY, id);
  return id;
}

export function resetSessionId() {
  const id = newId();
  localStorage.setItem(KEY, id);
  return id;
}
