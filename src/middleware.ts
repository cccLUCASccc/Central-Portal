import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";
import { sequence } from "astro:middleware";
import { serverLogsMiddleware } from "./lib/server-logs";

// On définit les routes qui ne nécessitent pas d'authentification
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/unsubscribe',
  '/inventoryt5hr4hr85g48412r(.*)',
  '/api/(.*)'
]);

const authenticatedMiddleware = clerkMiddleware((auth, context) => {
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

export const onRequest = sequence(serverLogsMiddleware, (context, next) => {
  if (context.url.pathname === '/unsubscribe') return next();
  return authenticatedMiddleware(context, next);
});