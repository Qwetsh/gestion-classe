-- Mode « en classe » : le tableau blanc doit être notifié en direct des séances
-- ouvertes depuis le téléphone et des événements qui y sont enregistrés.
-- On ajoute donc sessions et events à la publication Realtime.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
END
$$;

-- Sans REPLICA IDENTITY FULL, un DELETE ne transporte que la clé primaire :
-- le filtre Realtime « session_id = … » ne verrait jamais les suppressions
-- (annulation d'un événement depuis le téléphone).
ALTER TABLE public.events REPLICA IDENTITY FULL;
