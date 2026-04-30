export async function apiFetch(endpoint, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error("apiFetch can only be used on the client side.");
  }

  // Attendre que Clerk soit chargé si nécessaire
  if (!window.Clerk) {
    console.warn("⚠️ window.Clerk n'est pas encore disponible.");
    // Optionnel: vous pourriez ajouter une logique pour attendre l'événement 'clerk-ready'
  }

  const token = await window.Clerk?.session?.getToken();

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

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