/**
 * Récupère le token d'authentification Clerk en attendant que le SDK client soit initialisé.
 * @param {number} maxWaitMs Temps d'attente maximum en millisecondes (par défaut 3500ms)
 * @returns {Promise<string|null>}
 */
async function getClerkToken(maxWaitMs = 3500) {
  if (typeof window === 'undefined') return null;

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (window.Clerk && window.Clerk.session) {
      try {
        return await window.Clerk.session.getToken();
      } catch (e) {
        console.warn("Erreur lors de la récupération du token Clerk:", e);
      }
    }
    // Si Clerk a fini de charger mais que l'utilisateur n'est pas connecté
    if (window.Clerk && window.Clerk.loaded && !window.Clerk.session) {
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return await window.Clerk?.session?.getToken() || null;
}

export async function apiFetch(endpoint, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error("apiFetch can only be used on the client side.");
  }

  const token = await getClerkToken();

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ne pas forcer Content-Type: application/json si on envoie du FormData
  // Fetch s'occupera de mettre le bon Content-Type avec le boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${endpoint}`, {
    ...options,
    headers,
  });
}