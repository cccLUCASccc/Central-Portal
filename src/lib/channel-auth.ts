export async function readAuthResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Le serveur a renvoyé une réponse non JSON (HTTP ${response.status}). Vérifiez l'adresse de Central-API et les journaux du serveur.`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`Réponse d'authentification invalide (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const details = Object.entries(data)
      .filter(([key]) => ["error", "message", "details", "hint"].includes(key))
      .map(([key, value]) => `${key} : ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join("\n\n");
    throw new Error(`Erreur HTTP ${response.status}\n\n${details || "Le serveur n'a fourni aucune explication. Consultez les journaux de Central-API."}`);
  }
  return data;
}
