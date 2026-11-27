-- 098 : les réponses des élèves au questionnaire de l'Académie ne disparaissent
-- plus quand une question ou une réponse possible est supprimée.
--
-- Le questionnaire (academy_questions, academy_answers) est commun à tous les
-- comptes. Avec ON DELETE CASCADE, supprimer une question ou une réponse
-- possible effaçait les réponses déjà données par les élèves, dans les classes
-- de tous les enseignants. Désormais la base refuse cette suppression tant que
-- des élèves y ont répondu (erreur 23503, traduite par l'application).
--
-- Les autres effacements restent possibles : la suppression d'un élève
-- (student_id, en cascade) et la remise à zéro d'une classe, qui efface
-- d'abord les réponses de ses élèves.

alter table public.academy_responses
  drop constraint academy_responses_answer_id_fkey,
  add constraint academy_responses_answer_id_fkey
    foreign key (answer_id) references public.academy_answers(id) on delete restrict;

alter table public.academy_responses
  drop constraint academy_responses_question_id_fkey,
  add constraint academy_responses_question_id_fkey
    foreign key (question_id) references public.academy_questions(id) on delete restrict;
