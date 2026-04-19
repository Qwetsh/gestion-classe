export default function StarWarsIntro() {
  return (
    <div className="w-full h-[calc(100vh-4rem)]">
      <iframe
        src={`${import.meta.env.BASE_URL}tools/starwars/index.html`}
        className="w-full h-full border-0 rounded-xl"
        allow="autoplay"
        title="Star Wars Intro Creator"
      />
    </div>
  );
}
