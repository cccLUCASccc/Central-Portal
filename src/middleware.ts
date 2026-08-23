import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

// On définit les routes qui ne nécessitent pas d'authentification
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/inventoryt5hr4hr85g48412r(.*)'
]);

export const onRequest = clerkMiddleware((auth, context) => {
  const { userId } = auth();

  // Si l'utilisateur est déjà connecté et qu'il se rend sur la page de connexion, rediriger vers l'accueil
  if (userId && context.url.pathname.startsWith('/sign-in')) {
    return context.redirect('/');
  }

  // Si l'utilisateur n'est pas connecté et que la route n'est pas publique
  if (!userId && !isPublicRoute(context.request)) {
    const returnBackPath = context.url.pathname + context.url.search;
    return auth().redirectToSignIn({ returnBackUrl: returnBackPath });
  }
});