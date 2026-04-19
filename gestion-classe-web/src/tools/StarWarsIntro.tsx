export default function StarWarsIntro() {
  const base = import.meta.env.BASE_URL || '/gestion-classe/';
  return (
    <div className="w-full" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
      <iframe
        src={`${base}tools/starwars/index.html`}
        className="w-full h-full rounded-xl border border-[var(--color-border)]"
        style={{ background: '#0a0a0a' }}
        allow="autoplay"
      />
    </div>
  );
}
