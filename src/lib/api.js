export async function apiFetch(endpoint, options = {}) {
  const token = await window.Clerk.session.getToken();

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  return fetch(`${endpoint}`, {
    ...options,
    headers,
  });
}