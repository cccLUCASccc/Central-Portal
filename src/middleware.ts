import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

// On définit les routes qui ne nécessitent pas d'authentification
const isPublicRoute = createRouteMatcher(['/inventoryt5hr4hr85g48412r(.*)']);

export const onRequest = clerkMiddleware((auth, context) => {
  const { userId } = auth();

  // Si l'utilisateur n'est pas connecté et que la route n'est pas publique
  if (!userId && !isPublicRoute(context.request)) {
    return auth().redirectToSignIn();
  }
});