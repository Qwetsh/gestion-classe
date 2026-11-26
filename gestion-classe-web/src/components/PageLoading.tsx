/** Écran d'attente pendant le téléchargement d'une page (première ouverture, réseau lent). */
export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]" role="status" aria-live="polite">
      <p className="text-[var(--text-muted)]">Chargement…</p>
    </div>
  );
}
