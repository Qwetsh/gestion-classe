/**
 * Script de la page de retour OAuth (`auth-callback.html`), ouverte en fenêtre surgissante par
 * MSAL pour la connexion OneDrive. Depuis MSAL 5, la fenêtre d'origine n'inspecte plus l'URL de
 * la fenêtre surgissante : c'est cette page qui lui transmet la réponse (BroadcastChannel, même
 * origine) via le « redirect bridge », puis se ferme. Aucun jeton ne transite par ici : le
 * tableau garde le vérificateur PKCE et fait lui-même l'échange.
 */
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

broadcastResponseToMainFrame().catch((err: unknown) => {
  const el = document.getElementById('status');
  if (el) el.textContent = `Réponse de connexion illisible : ${err instanceof Error ? err.message : 'erreur'}. Fermer cette fenêtre et réessayer.`;
  console.error('[auth-callback]', err);
});
