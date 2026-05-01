import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

// On définit les routes qui ne nécessitent pas d'authentification
// Ici, on veut que TOUTES les pages soient protégées.
const isPublicRoute = createRouteMatcher([]);

export const onRequest = clerkMiddleware((auth, context) => {
  const { userId } = auth();

  // Si l'utilisateur n'est pas connecté et que la route n'est pas publique
  if (!userId && !isPublicRoute(context.request)) {
    return auth().redirectToSignIn();
  }
});