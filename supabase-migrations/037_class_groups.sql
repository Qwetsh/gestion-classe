-- ============================================================
-- Migration 037 : Groupes de classe (demi-classes en alternance)
-- ============================================================
-- Des groupes d'élèves DURABLES, propres à une classe (ex. « Groupe 1 » /
-- « Groupe 2 » vus une semaine sur deux). À ne pas confondre avec les groupes
-- de TP (group_sessions / session_groups), éphémères et notés : ces tables
-- ne sont pas touchées.
--
-- Choix :
--  - class_group_members = table de liaison (un élève peut appartenir à
--    plusieurs groupes ; l'UI V1 impose une partition).
--  - class_group_plans = plans de classe PAR GROUPE dans une table dédiée.
--    class_room_plans reste intacte : ses lecteurs (web en .single(), pull
--    mobile sur UNIQUE(class_id, room_id)) ne voient rien changer.
--  - sessions.group_id nullable : NULL = classe entière.
--
-- Mobile : le pull sync lit des colonnes explicites -> sessions.group_id
-- est ignoré par un ancien APK, les nouvelles tables aussi (safe).
-- ============================================================

-- 1. Groupes
CREATE TABLE IF NOT EXISTS public.class_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.class_groups IS 'Groupes durables d''élèves au sein d''une classe (demi-groupes, etc.). Distinct des groupes de TP (session_groups).';
COMMENT ON COLUMN public.class_groups.color IS 'Clé de palette (ex. blue), pas un hex';

-- 2. Appartenance
CREATE TABLE IF NOT EXISTS public.class_group_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, student_id)
);

-- 3. Plans de classe par groupe (table dédiée, class_room_plans intacte)
CREATE TABLE IF NOT EXISTS public.class_group_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  positions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  UNIQUE(class_id, room_id, group_id)
);

COMMENT ON TABLE public.class_group_plans IS 'Placements d''élèves pour (classe, salle, groupe). Repli sur class_room_plans si absent.';
COMMENT ON COLUMN public.class_group_plans.positions IS 'JSONB mapping "row,col" -> student_id (même format que class_room_plans)';

-- 4. Séance en groupe
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.class_groups(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sessions.group_id IS 'Groupe de classe de la séance ; NULL = classe entière';

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_class_groups_class_id ON public.class_groups(class_id);
CREATE INDEX IF NOT EXISTS idx_class_groups_user_id ON public.class_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_class_group_members_group_id ON public.class_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_class_group_members_student_id ON public.class_group_members(student_id);
CREATE INDEX IF NOT EXISTS idx_class_group_plans_class_room ON public.class_group_plans(class_id, room_id);
CREATE INDEX IF NOT EXISTS idx_class_group_plans_user_id ON public.class_group_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON public.sessions(group_id);

-- 6. RLS
ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_group_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_groups_select" ON public.class_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "class_groups_insert" ON public.class_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "class_groups_update" ON public.class_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "class_groups_delete" ON public.class_groups FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "class_group_members_select" ON public.class_group_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.class_groups g WHERE g.id = group_id AND g.user_id = auth.uid()));
CREATE POLICY "class_group_members_insert" ON public.class_group_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.class_groups g WHERE g.id = group_id AND g.user_id = auth.uid()));
CREATE POLICY "class_group_members_delete" ON public.class_group_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.class_groups g WHERE g.id = group_id AND g.user_id = auth.uid()));

CREATE POLICY "class_group_plans_select" ON public.class_group_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "class_group_plans_insert" ON public.class_group_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "class_group_plans_update" ON public.class_group_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "class_group_plans_delete" ON public.class_group_plans FOR DELETE USING (auth.uid() = user_id);

-- Vérification :
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'group_id';
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'class_group%';
