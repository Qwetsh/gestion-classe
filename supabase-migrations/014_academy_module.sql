-- ============================================================
-- Migration 014: Module "L'Académie des Quatre Lumières"
-- Système de maisons pour les classes (Salamandre, Vouivre, Zéphyr, Taisson)
-- ============================================================

-- 1. Configuration par classe (toggle on/off)
CREATE TABLE IF NOT EXISTS academy_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id)
);

ALTER TABLE academy_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_config_user" ON academy_config
  FOR ALL USING (user_id = auth.uid());

-- 2. Questions du test (Le Diadème des Affinités)
CREATE TABLE IF NOT EXISTS academy_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_order INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE academy_questions ENABLE ROW LEVEL SECURITY;

-- Questions lisibles par tous (les élèves accèdent via RPC SECURITY DEFINER)
CREATE POLICY "academy_questions_read" ON academy_questions
  FOR SELECT USING (true);

-- 3. Réponses possibles par question
CREATE TABLE IF NOT EXISTS academy_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES academy_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  salamandre_weight REAL NOT NULL DEFAULT 0,
  vouivre_weight REAL NOT NULL DEFAULT 0,
  zephyr_weight REAL NOT NULL DEFAULT 0,
  taisson_weight REAL NOT NULL DEFAULT 0
);

ALTER TABLE academy_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_answers_read" ON academy_answers
  FOR SELECT USING (true);

-- 4. Réponses des élèves au test
CREATE TABLE IF NOT EXISTS academy_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES academy_questions(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES academy_answers(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, question_id)
);

ALTER TABLE academy_responses ENABLE ROW LEVEL SECURITY;

-- Accès via RPC SECURITY DEFINER uniquement, mais l'enseignant peut lire via sa session
CREATE POLICY "academy_responses_teacher" ON academy_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = academy_responses.student_id
      AND c.user_id = auth.uid()
    )
  );

-- 5. Préférences de maisons (classement 1-4)
CREATE TABLE IF NOT EXISTS academy_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  house TEXT NOT NULL CHECK (house IN ('salamandre', 'vouivre', 'zephyr', 'taisson')),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 4),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, house)
);

ALTER TABLE academy_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_preferences_teacher" ON academy_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.id = academy_preferences.student_id
      AND c.user_id = auth.uid()
    )
  );

-- 6. Affectation d'un élève à une maison
CREATE TABLE IF NOT EXISTS academy_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  house TEXT NOT NULL CHECK (house IN ('salamandre', 'vouivre', 'zephyr', 'taisson')),
  assigned_by TEXT NOT NULL DEFAULT 'algorithm',
  override BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

ALTER TABLE academy_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_assignments_user" ON academy_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = academy_assignments.class_id
      AND c.user_id = auth.uid()
    )
  );

-- 7. Bonus manuels par maison (visible/caché)
CREATE TABLE IF NOT EXISTS academy_house_bonuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  house TEXT NOT NULL CHECK (house IN ('salamandre', 'vouivre', 'zephyr', 'taisson')),
  points REAL NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revealed_at TIMESTAMPTZ
);

ALTER TABLE academy_house_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_house_bonuses_user" ON academy_house_bonuses
  FOR ALL USING (user_id = auth.uid());

-- Activer Realtime sur cette table (pour le reveal côté élève)
ALTER PUBLICATION supabase_realtime ADD TABLE academy_house_bonuses;

-- 8. Coefficients par session de groupe
CREATE TABLE IF NOT EXISTS academy_session_coefficients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  coefficient REAL NOT NULL DEFAULT 1.0,
  UNIQUE(group_session_id)
);

ALTER TABLE academy_session_coefficients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_session_coefficients_user" ON academy_session_coefficients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM group_sessions gs
      WHERE gs.id = academy_session_coefficients.group_session_id
      AND gs.user_id = auth.uid()
    )
  );

-- ============================================================
-- RPC: get_student_academy(p_code)
-- Retourne l'état complet du module pour un élève
-- ============================================================
CREATE OR REPLACE FUNCTION get_student_academy(p_code VARCHAR(6))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
  v_enabled BOOLEAN;
  v_house TEXT;
  v_test_completed BOOLEAN;
  v_house_points JSONB;
BEGIN
  -- Trouver l'élève par son code
  SELECT s.id, s.class_id INTO v_student_id, v_class_id
  FROM students s
  WHERE s.student_code = p_code;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('error', 'student_not_found');
  END IF;

  -- Vérifier si le module est actif pour cette classe
  SELECT ac.enabled INTO v_enabled
  FROM academy_config ac
  WHERE ac.class_id = v_class_id;

  IF v_enabled IS NULL OR v_enabled = false THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  -- Vérifier si le test est complété
  SELECT EXISTS (
    SELECT 1 FROM academy_responses ar
    WHERE ar.student_id = v_student_id
    LIMIT 1
  ) INTO v_test_completed;

  -- Récupérer la maison assignée
  SELECT aa.house INTO v_house
  FROM academy_assignments aa
  WHERE aa.student_id = v_student_id
  AND aa.class_id = v_class_id;

  -- Calculer les points par maison
  SELECT jsonb_object_agg(house, total_points) INTO v_house_points
  FROM (
    SELECT h.house,
      COALESCE(grade_pts.pts, 0) + COALESCE(bonus_pts.pts, 0) AS total_points
    FROM (VALUES ('salamandre'), ('vouivre'), ('zephyr'), ('taisson')) AS h(house)
    LEFT JOIN (
      -- Points des notes de groupe × coefficient
      SELECT aa.house,
        SUM(
          (SELECT COALESCE(SUM(gg.points_awarded), 0) - COALESCE(sg.conduct_malus, 0)
           FROM group_grades gg
           JOIN grading_criteria gc ON gc.id = gg.criteria_id
           WHERE gg.group_id = sg.id
          ) * COALESCE(asc2.coefficient, 1.0)
        ) AS pts
      FROM academy_assignments aa
      JOIN session_group_members sgm ON sgm.student_id = aa.student_id
      JOIN session_groups sg ON sg.id = sgm.group_id
      JOIN group_sessions gs ON gs.id = sg.session_id AND gs.class_id = v_class_id
      LEFT JOIN academy_session_coefficients asc2 ON asc2.group_session_id = gs.id
      WHERE aa.class_id = v_class_id
      GROUP BY aa.house
    ) grade_pts ON grade_pts.house = h.house
    LEFT JOIN (
      -- Bonus visibles
      SELECT ahb.house, SUM(ahb.points) AS pts
      FROM academy_house_bonuses ahb
      WHERE ahb.class_id = v_class_id AND ahb.visible = true
      GROUP BY ahb.house
    ) bonus_pts ON bonus_pts.house = h.house
  ) sub;

  RETURN jsonb_build_object(
    'enabled', true,
    'student_id', v_student_id,
    'class_id', v_class_id,
    'test_completed', v_test_completed,
    'house', v_house,
    'house_points', COALESCE(v_house_points, '{}'::jsonb)
  );
END;
$$;

-- ============================================================
-- RPC: submit_academy_test(p_code, p_responses, p_preferences)
-- Soumet les réponses et préférences d'un élève
-- p_responses: [{"question_id": "...", "answer_id": "..."}, ...]
-- p_preferences: [{"house": "salamandre", "rank": 1}, ...]
-- ============================================================
CREATE OR REPLACE FUNCTION submit_academy_test(
  p_code VARCHAR(6),
  p_responses JSONB,
  p_preferences JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
  v_already_submitted BOOLEAN;
  v_resp JSONB;
  v_pref JSONB;
BEGIN
  -- Trouver l'élève
  SELECT s.id, s.class_id INTO v_student_id, v_class_id
  FROM students s
  WHERE s.student_code = p_code;

  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('error', 'student_not_found');
  END IF;

  -- Vérifier que le module est actif
  IF NOT EXISTS (
    SELECT 1 FROM academy_config ac
    WHERE ac.class_id = v_class_id AND ac.enabled = true
  ) THEN
    RETURN jsonb_build_object('error', 'module_not_enabled');
  END IF;

  -- Vérifier que le test n'a pas déjà été soumis
  SELECT EXISTS (
    SELECT 1 FROM academy_responses ar
    WHERE ar.student_id = v_student_id
    LIMIT 1
  ) INTO v_already_submitted;

  IF v_already_submitted THEN
    RETURN jsonb_build_object('error', 'already_submitted');
  END IF;

  -- Insérer les réponses
  FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responses)
  LOOP
    INSERT INTO academy_responses (student_id, question_id, answer_id)
    VALUES (
      v_student_id,
      (v_resp->>'question_id')::UUID,
      (v_resp->>'answer_id')::UUID
    );
  END LOOP;

  -- Insérer les préférences
  FOR v_pref IN SELECT * FROM jsonb_array_elements(p_preferences)
  LOOP
    INSERT INTO academy_preferences (student_id, house, rank)
    VALUES (
      v_student_id,
      v_pref->>'house',
      (v_pref->>'rank')::INTEGER
    );
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- SEED: 20 questions style Pottermore
-- Tonalité cérémonielle, scénarios de vie, valeurs, réactions
-- ============================================================

-- Q1
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000001', 1, 'Tu te promènes en forêt et découvres un sentier que personne ne semble avoir emprunté. Que fais-tu ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Je m''y engage sans hésiter — l''aventure m''appelle.', 1, 3, 0, 1, 0),
  ('a0000001-0000-0000-0000-000000000001', 'J''observe les traces au sol pour deviner où il mène.', 2, 0, 2, 3, 0),
  ('a0000001-0000-0000-0000-000000000001', 'Je marque le chemin pour pouvoir revenir, puis j''avance prudemment.', 3, 0, 3, 1, 1),
  ('a0000001-0000-0000-0000-000000000001', 'Je retourne chercher un ami — c''est mieux à deux.', 4, 1, 0, 0, 3);

-- Q2
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000002', 2, 'Un camarade est accusé injustement devant toute la classe. Quelle est ta réaction ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000002', 'Je me lève et je prends sa défense, peu importe les conséquences.', 1, 3, 0, 0, 2),
  ('a0000001-0000-0000-0000-000000000002', 'Je rassemble des preuves pour prouver son innocence après le cours.', 2, 0, 1, 3, 1),
  ('a0000001-0000-0000-0000-000000000002', 'Je glisse discrètement un mot au professeur pour rectifier.', 3, 0, 3, 1, 1),
  ('a0000001-0000-0000-0000-000000000002', 'Je vais le réconforter ensuite et lui propose mon aide.', 4, 1, 0, 0, 3);

-- Q3
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000003', 3, 'Quelle qualité admires-tu le plus chez les autres ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000003', 'Le courage de dire ce que personne n''ose dire.', 1, 3, 0, 1, 0),
  ('a0000001-0000-0000-0000-000000000003', 'L''intelligence de toujours trouver une solution.', 2, 0, 2, 3, 0),
  ('a0000001-0000-0000-0000-000000000003', 'L''habileté de retourner chaque situation à son avantage.', 3, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000003', 'La fidélité de ceux qui ne vous abandonnent jamais.', 4, 1, 0, 0, 3);

-- Q4
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000004', 4, 'Tu trouves un objet précieux dans la cour de l''école. Personne ne t''a vu.');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000004', 'Je le dépose immédiatement au bureau de la vie scolaire.', 1, 1, 0, 0, 3),
  ('a0000001-0000-0000-0000-000000000004', 'Je mène ma petite enquête pour retrouver le propriétaire.', 2, 0, 2, 3, 0),
  ('a0000001-0000-0000-0000-000000000004', 'Je le garde en sécurité et j''observe qui semble le chercher.', 3, 0, 3, 1, 1),
  ('a0000001-0000-0000-0000-000000000004', 'J''annonce publiquement ma trouvaille pour que le propriétaire se manifeste.', 4, 3, 0, 0, 1);

-- Q5
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000005', 5, 'Qu''est-ce qui te met le plus en colère ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000005', 'La lâcheté — ceux qui détournent le regard devant l''injustice.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000005', 'L''ignorance volontaire — refuser de chercher la vérité.', 2, 0, 0, 3, 1),
  ('a0000001-0000-0000-0000-000000000005', 'La trahison — briser la confiance de quelqu''un.', 3, 1, 1, 0, 3),
  ('a0000001-0000-0000-0000-000000000005', 'Être sous-estimé — qu''on ne reconnaisse pas ma valeur.', 4, 0, 3, 1, 0);

-- Q6
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000006', 6, 'Dans quel endroit te sentirais-tu le plus à l''aise pour réfléchir ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000006', 'Au sommet d''une colline, face au vent, avec une vue dégagée.', 1, 3, 0, 1, 0),
  ('a0000001-0000-0000-0000-000000000006', 'Au bord d''un lac calme, à l''abri des regards.', 2, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000006', 'Dans une bibliothèque immense, entouré de livres anciens.', 3, 0, 0, 3, 1),
  ('a0000001-0000-0000-0000-000000000006', 'Près d''un feu de cheminée, avec des amis proches.', 4, 1, 0, 0, 3);

-- Q7
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000007', 7, 'Tu dois résoudre un problème difficile. Quelle est ton approche ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000007', 'Je fonce — on apprend mieux en essayant qu''en réfléchissant trop.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000007', 'J''analyse toutes les options avant de choisir la meilleure.', 2, 0, 1, 3, 0),
  ('a0000001-0000-0000-0000-000000000007', 'Je cherche un angle que personne n''a encore envisagé.', 3, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000007', 'Je demande conseil à quelqu''un en qui j''ai confiance.', 4, 1, 0, 0, 3);

-- Q8
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000008', 8, 'On te propose de participer à une compétition. Qu''est-ce qui te motive le plus ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000008', 'Le frisson du défi — je veux me prouver que je peux le faire.', 1, 3, 0, 0, 0),
  ('a0000001-0000-0000-0000-000000000008', 'La victoire — je veux gagner et être reconnu.', 2, 0, 3, 0, 0),
  ('a0000001-0000-0000-0000-000000000008', 'La curiosité — c''est l''occasion d''apprendre quelque chose de nouveau.', 3, 0, 0, 3, 1),
  ('a0000001-0000-0000-0000-000000000008', 'L''esprit d''équipe — je veux y aller avec mes amis.', 4, 1, 0, 0, 3);

-- Q9
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000009', 9, 'Si tu pouvais maîtriser un pouvoir, lequel choisirais-tu ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000009', 'La capacité de protéger ceux que j''aime de tout danger.', 1, 3, 0, 0, 2),
  ('a0000001-0000-0000-0000-000000000009', 'Le pouvoir de lire dans les pensées des gens.', 2, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000009', 'Une mémoire parfaite — ne jamais rien oublier.', 3, 0, 0, 3, 0),
  ('a0000001-0000-0000-0000-000000000009', 'Le don de guérir les blessures, physiques ou morales.', 4, 0, 0, 0, 3);

-- Q10
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000010', 10, 'Tu arrives dans un nouveau collège. Que fais-tu le premier jour ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000010', 'Je me présente à tout le monde — autant se faire remarquer.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000010', 'J''observe qui a de l''influence et je m''en rapproche.', 2, 0, 3, 0, 0),
  ('a0000001-0000-0000-0000-000000000010', 'Je repère la bibliothèque et les endroits calmes.', 3, 0, 0, 3, 0),
  ('a0000001-0000-0000-0000-000000000010', 'Je cherche quelqu''un qui a l''air sympa pour ne pas rester seul.', 4, 1, 0, 0, 3);

-- Q11
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000011', 11, 'Lequel de ces rêves te parle le plus ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000011', 'Voler au-dessus des nuages, libre de toute contrainte.', 1, 3, 0, 1, 0),
  ('a0000001-0000-0000-0000-000000000011', 'Découvrir une pièce secrète remplie de trésors oubliés.', 2, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000011', 'Pouvoir parler toutes les langues du monde.', 3, 0, 0, 3, 1),
  ('a0000001-0000-0000-0000-000000000011', 'Retrouver quelqu''un que j''ai perdu de vue depuis longtemps.', 4, 0, 0, 0, 3);

-- Q12
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000012', 12, 'Un ami te confie un secret important mais te demande de mentir pour le protéger. Que fais-tu ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000012', 'Je refuse de mentir — l''honnêteté passe avant tout.', 1, 3, 0, 1, 0),
  ('a0000001-0000-0000-0000-000000000012', 'Je mens, mais je trouve un moyen de résoudre le problème sans qu''il le sache.', 2, 0, 3, 0, 1),
  ('a0000001-0000-0000-0000-000000000012', 'Je cherche une solution qui ne nécessite ni mensonge ni trahison.', 3, 0, 1, 3, 0),
  ('a0000001-0000-0000-0000-000000000012', 'Je mens pour le protéger — un ami, ça se protège.', 4, 0, 0, 0, 3);

-- Q13
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000013', 13, 'Quel animal t''attire le plus ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000013', 'Le lion — noble, courageux, protecteur de sa troupe.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000013', 'Le serpent — patient, silencieux, toujours prêt à frapper.', 2, 0, 3, 0, 0),
  ('a0000001-0000-0000-0000-000000000013', 'L''aigle — il voit tout d''en haut, rien ne lui échappe.', 3, 0, 0, 3, 0),
  ('a0000001-0000-0000-0000-000000000013', 'Le chien — fidèle, loyal, toujours à tes côtés.', 4, 0, 0, 0, 3);

-- Q14
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000014', 14, 'Tu es capitaine d''une équipe. Comment diriges-tu ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000014', 'Par l''exemple — je suis le premier à me jeter dans l''action.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000014', 'Par la stratégie — je place chacun là où il sera le plus efficace.', 2, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000014', 'Par la réflexion — j''étudie l''adversaire avant d''agir.', 3, 0, 1, 3, 0),
  ('a0000001-0000-0000-0000-000000000014', 'Par l''écoute — chaque membre a son mot à dire.', 4, 0, 0, 0, 3);

-- Q15
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000015', 15, 'Quelle matière imaginaire t''intéresserait le plus ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000015', 'Combat et survie — apprendre à se défendre et à protéger.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000015', 'Alchimie et transmutation — transformer le plomb en or.', 2, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000015', 'Astronomie ancienne — lire les secrets des étoiles.', 3, 0, 0, 3, 0),
  ('a0000001-0000-0000-0000-000000000015', 'Herboristerie — soigner et nourrir grâce aux plantes.', 4, 0, 0, 0, 3);

-- Q16
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000016', 16, 'Tu surprends quelqu''un en train de tricher à un examen. Que fais-tu ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000016', 'Je le signale — ce n''est pas juste pour les autres.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000016', 'Je ne dis rien — ce n''est pas mon problème.', 2, 0, 3, 0, 0),
  ('a0000001-0000-0000-0000-000000000016', 'Je lui en parle en privé après pour comprendre pourquoi.', 3, 0, 1, 3, 1),
  ('a0000001-0000-0000-0000-000000000016', 'Je l''aide à réviser pour qu''il n''ait plus besoin de tricher.', 4, 0, 0, 0, 3);

-- Q17
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000017', 17, 'Qu''est-ce qui te fait le plus peur ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000017', 'Ne pas être à la hauteur quand quelqu''un compte sur moi.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000017', 'Perdre le contrôle de la situation.', 2, 0, 3, 0, 0),
  ('a0000001-0000-0000-0000-000000000017', 'Rester dans l''ignorance, ne pas comprendre ce qui se passe.', 3, 0, 0, 3, 0),
  ('a0000001-0000-0000-0000-000000000017', 'La solitude — être oublié par ceux que j''aime.', 4, 0, 0, 0, 3);

-- Q18
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000018', 18, 'Quel objet emporterais-tu sur une île déserte ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000018', 'Un couteau solide — je me débrouillerai.', 1, 3, 1, 0, 0),
  ('a0000001-0000-0000-0000-000000000018', 'Une carte et une boussole — pour trouver une sortie.', 2, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000018', 'Un carnet et un crayon — pour tout observer et noter.', 3, 0, 0, 3, 0),
  ('a0000001-0000-0000-0000-000000000018', 'Une photo de ma famille — pour garder espoir.', 4, 0, 0, 0, 3);

-- Q19
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000019', 19, 'Comment réagis-tu face à l''échec ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000019', 'Je me relève et je réessaie — on n''abandonne pas.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000019', 'J''analyse ce qui n''a pas marché pour ne pas refaire la même erreur.', 2, 0, 2, 3, 0),
  ('a0000001-0000-0000-0000-000000000019', 'Je change de stratégie — il y a toujours un autre chemin.', 3, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000019', 'J''en parle avec quelqu''un — on se sent mieux après.', 4, 0, 0, 0, 3);

-- Q20
INSERT INTO academy_questions (id, question_order, question_text) VALUES
  ('a0000001-0000-0000-0000-000000000020', 20, 'Quelle phrase te ressemble le plus ?');
INSERT INTO academy_answers (question_id, answer_text, display_order, salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) VALUES
  ('a0000001-0000-0000-0000-000000000020', 'Mieux vaut agir et se tromper que ne rien faire du tout.', 1, 3, 0, 0, 1),
  ('a0000001-0000-0000-0000-000000000020', 'Le monde appartient à ceux qui savent attendre le bon moment.', 2, 0, 3, 1, 0),
  ('a0000001-0000-0000-0000-000000000020', 'La connaissance est la seule richesse qu''on ne peut pas voler.', 3, 0, 0, 3, 0),
  ('a0000001-0000-0000-0000-000000000020', 'On va plus loin ensemble que seul.', 4, 0, 0, 0, 3);
