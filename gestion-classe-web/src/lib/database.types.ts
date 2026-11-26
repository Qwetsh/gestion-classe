// Fichier généré par `npm run db:types` (scripts/gen-db-types.mjs). Ne pas le modifier à la main.
// Description de la base, limitée aux tables, vues et fonctions utilisées par src/.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academy_answers: {
        Row: {
          answer_text: string
          display_order: number
          gryffondor_weight: number
          id: string
          poufsouffle_weight: number
          question_id: string
          serdaigle_weight: number
          serpentard_weight: number
        }
        Insert: {
          answer_text: string
          display_order?: number
          gryffondor_weight?: number
          id?: string
          poufsouffle_weight?: number
          question_id: string
          serdaigle_weight?: number
          serpentard_weight?: number
        }
        Update: {
          answer_text?: string
          display_order?: number
          gryffondor_weight?: number
          id?: string
          poufsouffle_weight?: number
          question_id?: string
          serdaigle_weight?: number
          serpentard_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "academy_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          class_id: string
          house: string
          id: string
          override: boolean
          student_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string
          class_id: string
          house: string
          id?: string
          override?: boolean
          student_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          class_id?: string
          house?: string
          id?: string
          override?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_config: {
        Row: {
          class_id: string
          created_at: string
          enabled: boolean
          id: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_config_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_house_bonuses: {
        Row: {
          class_id: string
          created_at: string
          house: string
          id: string
          label: string
          points: number
          revealed_at: string | null
          user_id: string
          visible: boolean
        }
        Insert: {
          class_id: string
          created_at?: string
          house: string
          id?: string
          label?: string
          points: number
          revealed_at?: string | null
          user_id: string
          visible?: boolean
        }
        Update: {
          class_id?: string
          created_at?: string
          house?: string
          id?: string
          label?: string
          points?: number
          revealed_at?: string | null
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "academy_house_bonuses_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_preferences: {
        Row: {
          house: string
          id: string
          rank: number
          student_id: string
          submitted_at: string
        }
        Insert: {
          house: string
          id?: string
          rank: number
          student_id: string
          submitted_at?: string
        }
        Update: {
          house?: string
          id?: string
          rank?: number
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_preferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_questions: {
        Row: {
          created_at: string
          id: string
          question_order: number
          question_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_order: number
          question_text: string
        }
        Update: {
          created_at?: string
          id?: string
          question_order?: number
          question_text?: string
        }
        Relationships: []
      }
      academy_responses: {
        Row: {
          answer_id: string
          id: string
          question_id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          answer_id: string
          id?: string
          question_id: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          answer_id?: string
          id?: string
          question_id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_responses_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "academy_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "academy_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_session_coefficients: {
        Row: {
          coefficient: number
          group_session_id: string
          id: string
        }
        Insert: {
          coefficient?: number
          group_session_id: string
          id?: string
        }
        Update: {
          coefficient?: number
          group_session_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_session_coefficients_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: true
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          accepting_submissions: boolean
          bareme_total: number
          created_at: string
          definition: Json
          definition_version: number
          expected_answers: string | null
          id: string
          is_deleted: boolean
          key: string
          level: string | null
          sequence: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepting_submissions?: boolean
          bareme_total?: number
          created_at?: string
          definition?: Json
          definition_version?: number
          expected_answers?: string | null
          id?: string
          is_deleted?: boolean
          key: string
          level?: string | null
          sequence?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepting_submissions?: boolean
          bareme_total?: number
          created_at?: string
          definition?: Json
          definition_version?: number
          expected_answers?: string | null
          id?: string
          is_deleted?: boolean
          key?: string
          level?: string | null
          sequence?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_assessments: {
        Row: {
          activity_id: string
          assessment_id: string
          class_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          assessment_id: string
          class_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          assessment_id?: string
          class_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_assessments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_assessments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "pending_makeups"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "activity_assessments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "written_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_class_settings: {
        Row: {
          activity_id: string
          animated_correction_open: boolean
          class_id: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          animated_correction_open?: boolean
          class_id: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          animated_correction_open?: boolean
          class_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_class_settings_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_class_settings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          active: boolean
          created_at: string
          id: string
          message: string
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          message: string
          type?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          message?: string
          type?: string
        }
        Relationships: []
      }
      assessment_ai_corrections: {
        Row: {
          a_arbitrer: Json
          assessment_id: string
          attempts: number
          cache_creation_tokens: number | null
          cache_read_tokens: number | null
          cost_usd: number | null
          error: string | null
          finished_at: string | null
          grade: number | null
          id: string
          input_tokens: number | null
          mode: string
          model: string | null
          output_tokens: number | null
          started_at: string
          status: string
          student_id: string
          user_id: string
        }
        Insert: {
          a_arbitrer?: Json
          assessment_id: string
          attempts?: number
          cache_creation_tokens?: number | null
          cache_read_tokens?: number | null
          cost_usd?: number | null
          error?: string | null
          finished_at?: string | null
          grade?: number | null
          id?: string
          input_tokens?: number | null
          mode: string
          model?: string | null
          output_tokens?: number | null
          started_at?: string
          status?: string
          student_id: string
          user_id: string
        }
        Update: {
          a_arbitrer?: Json
          assessment_id?: string
          attempts?: number
          cache_creation_tokens?: number | null
          cache_read_tokens?: number | null
          cost_usd?: number | null
          error?: string | null
          finished_at?: string | null
          grade?: number | null
          id?: string
          input_tokens?: number | null
          mode?: string
          model?: string | null
          output_tokens?: number | null
          started_at?: string
          status?: string
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_ai_corrections_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "pending_makeups"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_ai_corrections_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "written_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_ai_corrections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_copy_pages: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          page_order: number
          storage_path: string
          student_id: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          page_order?: number
          storage_path: string
          student_id: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          page_order?: number
          storage_path?: string
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_copy_pages_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "pending_makeups"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_copy_pages_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "written_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_copy_pages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_copy_transcripts: {
        Row: {
          assessment_id: string
          created_at: string
          student_id: string
          transcript: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          student_id: string
          transcript: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          student_id?: string
          transcript?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_copy_transcripts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "pending_makeups"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_copy_transcripts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "written_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_copy_transcripts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_correction_kits: {
        Row: {
          assessment_id: string
          created_at: string
          kit: Json
          source: string
          updated_at: string
          user_id: string
          version_key: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          kit: Json
          source?: string
          updated_at?: string
          user_id: string
          version_key?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          kit?: Json
          source?: string
          updated_at?: string
          user_id?: string
          version_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_correction_kits_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "pending_makeups"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_correction_kits_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "written_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_grade_revisions: {
        Row: {
          assessment_id: string
          comment: string | null
          details: Json | null
          grade: number | null
          grade_id: string
          grade_raw: number | null
          id: string
          replaced_at: string
          source: string
          status: string | null
          student_id: string
          user_id: string
          version_at: string | null
          was_validated: boolean
        }
        Insert: {
          assessment_id: string
          comment?: string | null
          details?: Json | null
          grade?: number | null
          grade_id: string
          grade_raw?: number | null
          id?: string
          replaced_at?: string
          source: string
          status?: string | null
          student_id: string
          user_id: string
          version_at?: string | null
          was_validated?: boolean
        }
        Update: {
          assessment_id?: string
          comment?: string | null
          details?: Json | null
          grade?: number | null
          grade_id?: string
          grade_raw?: number | null
          id?: string
          replaced_at?: string
          source?: string
          status?: string | null
          student_id?: string
          user_id?: string
          version_at?: string | null
          was_validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "assessment_grade_revisions_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "assessment_grades"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_grades: {
        Row: {
          assessment_id: string
          comment: string | null
          copy_annotated: boolean
          created_at: string
          details: Json | null
          grade: number | null
          grade_raw: number | null
          id: string
          is_adapted: boolean
          is_validated: boolean
          status: string
          student_id: string
          subject_version: string | null
          updated_at: string | null
          user_id: string
          validated_at: string | null
        }
        Insert: {
          assessment_id: string
          comment?: string | null
          copy_annotated?: boolean
          created_at?: string
          details?: Json | null
          grade?: number | null
          grade_raw?: number | null
          id?: string
          is_adapted?: boolean
          is_validated?: boolean
          status?: string
          student_id: string
          subject_version?: string | null
          updated_at?: string | null
          user_id: string
          validated_at?: string | null
        }
        Update: {
          assessment_id?: string
          comment?: string | null
          copy_annotated?: boolean
          created_at?: string
          details?: Json | null
          grade?: number | null
          grade_raw?: number | null
          id?: string
          is_adapted?: boolean
          is_validated?: boolean
          status?: string
          student_id?: string
          subject_version?: string | null
          updated_at?: string | null
          user_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_grades_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "pending_makeups"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_grades_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "written_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_series: {
        Row: {
          correction_path: string | null
          created_at: string
          id: string
          level: string | null
          name: string
          school_year: string
          subject_path: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          correction_path?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name: string
          school_year: string
          subject_path?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          correction_path?: string | null
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          school_year?: string
          subject_path?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      assessment_unnamed_pages: {
        Row: {
          assessment_id: string
          copy_id: string
          created_at: string
          id: string
          page_order: number
          storage_path: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          copy_id: string
          created_at?: string
          id?: string
          page_order?: number
          storage_path: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          copy_id?: string
          created_at?: string
          id?: string
          page_order?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_unnamed_pages_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "pending_makeups"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_unnamed_pages_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "written_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      board_doc_versions: {
        Row: {
          board_id: string
          created_at: string
          doc: Json
          id: string
          kind: string
          label: string | null
          user_id: string
          words: number | null
        }
        Insert: {
          board_id: string
          created_at?: string
          doc: Json
          id?: string
          kind?: string
          label?: string | null
          user_id: string
          words?: number | null
        }
        Update: {
          board_id?: string
          created_at?: string
          doc?: Json
          id?: string
          kind?: string
          label?: string | null
          user_id?: string
          words?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "board_doc_versions_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_mobile_custom: {
        Row: {
          board_id: string
          board_updated_at: string | null
          bytes: number
          checked_at: string
          deposited_at: string
          doc_fingerprint: string
          doc_rev: string | null
          html: string
          user_id: string
        }
        Insert: {
          board_id: string
          board_updated_at?: string | null
          bytes: number
          checked_at?: string
          deposited_at?: string
          doc_fingerprint: string
          doc_rev?: string | null
          html: string
          user_id: string
        }
        Update: {
          board_id?: string
          board_updated_at?: string | null
          bytes?: number
          checked_at?: string
          deposited_at?: string
          doc_fingerprint?: string
          doc_rev?: string | null
          html?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_mobile_custom_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: true
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_mobile_links: {
        Row: {
          board_id: string
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          token: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_mobile_links_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: true
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_pages: {
        Row: {
          background: string
          board_id: string | null
          id: string
          image: Json | null
          meta: Json | null
          objects: Json
          page_id: string
          position: number
          session_id: string | null
          strokes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          background?: string
          board_id?: string | null
          id?: string
          image?: Json | null
          meta?: Json | null
          objects?: Json
          page_id: string
          position?: number
          session_id?: string | null
          strokes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          background?: string
          board_id?: string | null
          id?: string
          image?: Json | null
          meta?: Json | null
          objects?: Json
          page_id?: string
          position?: number
          session_id?: string | null
          strokes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_pages_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_pages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      board_share_links: {
        Row: {
          board_id: string
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          token: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_share_links_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: true
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          category: string | null
          chapter: string | null
          class_id: string | null
          created_at: string
          doc: Json | null
          id: string
          is_template: boolean
          level: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          chapter?: string | null
          class_id?: string | null
          created_at?: string
          doc?: Json | null
          id?: string
          is_template?: boolean
          level?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          chapter?: string | null
          class_id?: string | null
          created_at?: string
          doc?: Json | null
          id?: string
          is_template?: boolean
          level?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_selections: {
        Row: {
          bonus_id: string | null
          card_id: string
          id: string
          selected_at: string | null
          student_id: string
          synced_at: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          bonus_id?: string | null
          card_id: string
          id?: string
          selected_at?: string | null
          student_id: string
          synced_at?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          bonus_id?: string | null
          card_id?: string
          id?: string
          selected_at?: string | null
          student_id?: string
          synced_at?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_selections_bonus_id_fkey"
            columns: ["bonus_id"]
            isOneToOne: false
            referencedRelation: "bonuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_selections_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "stamp_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_selections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      bonuses: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          label: string
          synced_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          synced_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      class_binder_items: {
        Row: {
          anchor_board_id: string
          class_id: string
          correction_visible: boolean
          created_at: string
          id: string
          released: Json
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          anchor_board_id: string
          class_id: string
          correction_visible?: boolean
          created_at?: string
          id?: string
          released?: Json
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          anchor_board_id?: string
          class_id?: string
          correction_visible?: boolean
          created_at?: string
          id?: string
          released?: Json
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "class_binder_items_anchor_board_id_fkey"
            columns: ["anchor_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_binder_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_binders: {
        Row: {
          class_id: string
          created_at: string
          link_enabled: boolean
          link_token: string | null
          tab_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          link_enabled?: boolean
          link_token?: string | null
          tab_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          link_enabled?: boolean
          link_token?: string | null
          tab_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_binders_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_group_plans: {
        Row: {
          class_id: string
          created_at: string
          group_id: string
          id: string
          positions: Json
          room_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          group_id: string
          id?: string
          positions?: Json
          room_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          group_id?: string
          id?: string
          positions?: Json
          room_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_group_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_group_plans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_group_plans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_groups: {
        Row: {
          class_id: string
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_room_plans: {
        Row: {
          class_id: string
          created_at: string
          id: string
          positions: Json
          room_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          positions?: Json
          room_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          positions?: Json
          room_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_room_plans_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_room_plans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_student_tabs: {
        Row: {
          class_id: string
          show_annales: boolean
          show_grades: boolean
          show_stamps: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          show_annales?: boolean
          show_grades?: boolean
          show_stamps?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          show_annales?: boolean
          show_grades?: boolean
          show_stamps?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_student_tabs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_trimester_config: {
        Row: {
          base_grade: number | null
          bavardage_penalty: boolean | null
          class_id: string
          created_at: string | null
          id: string
          target_participations: number
          total_sessions_expected: number
          updated_at: string | null
        }
        Insert: {
          base_grade?: number | null
          bavardage_penalty?: boolean | null
          class_id: string
          created_at?: string | null
          id?: string
          target_participations?: number
          total_sessions_expected?: number
          updated_at?: string | null
        }
        Update: {
          base_grade?: number | null
          bavardage_penalty?: boolean | null
          class_id?: string
          created_at?: string | null
          id?: string
          target_participations?: number
          total_sessions_expected?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_trimester_config_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean | null
          name: string
          school_class_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          name: string
          school_class_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          name?: string
          school_class_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_class_id_fkey"
            columns: ["school_class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      course_files: {
        Row: {
          chapter: string
          created_at: string
          id: string
          level: string | null
          mime: string | null
          name: string
          size: number
          storage_path: string
          user_id: string
        }
        Insert: {
          chapter: string
          created_at?: string
          id?: string
          level?: string | null
          mime?: string | null
          name: string
          size?: number
          storage_path: string
          user_id: string
        }
        Update: {
          chapter?: string
          created_at?: string
          id?: string
          level?: string | null
          mime?: string | null
          name?: string
          size?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_annales: {
        Row: {
          annee: number
          centre: string | null
          code: string | null
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          matiere: string
          points: number | null
          programme: string | null
          theme: string
          url: string
        }
        Insert: {
          annee: number
          centre?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          matiere: string
          points?: number | null
          programme?: string | null
          theme: string
          url: string
        }
        Update: {
          annee?: number
          centre?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          matiere?: string
          points?: number | null
          programme?: string | null
          theme?: string
          url?: string
        }
        Relationships: []
      }
      device_connections: {
        Row: {
          created_at: string
          device_info: string
          id: string
          platform: string
          user_email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info: string
          id?: string
          platform?: string
          user_email: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string
          id?: string
          platform?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          page_url: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message: string
          error_stack?: string | null
          id?: string
          page_url?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          page_url?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          note: string | null
          photo_path: string | null
          session_id: string
          student_id: string
          subtype: string | null
          timestamp: string
          tp_group_id: string | null
          type: string
        }
        Insert: {
          id?: string
          note?: string | null
          photo_path?: string | null
          session_id: string
          student_id: string
          subtype?: string | null
          timestamp?: string
          tp_group_id?: string | null
          type: string
        }
        Update: {
          id?: string
          note?: string | null
          photo_path?: string | null
          session_id?: string
          student_id?: string
          subtype?: string | null
          timestamp?: string
          tp_group_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          archived: boolean | null
          created_at: string
          id: string
          message: string
          type: string
          user_email: string
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          created_at?: string
          id?: string
          message: string
          type: string
          user_email: string
          user_id: string
        }
        Update: {
          archived?: boolean | null
          created_at?: string
          id?: string
          message?: string
          type?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      grading_criteria: {
        Row: {
          display_order: number
          id: string
          label: string
          max_points: number
          session_id: string
          synced_at: string | null
        }
        Insert: {
          display_order?: number
          id?: string
          label: string
          max_points: number
          session_id: string
          synced_at?: string | null
        }
        Update: {
          display_order?: number
          id?: string
          label?: string
          max_points?: number
          session_id?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grading_criteria_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_events: {
        Row: {
          grade_max: number | null
          grade_value: number | null
          id: string
          note: string | null
          photo_path: string | null
          session_group_id: string
          timestamp: string
          type: string
        }
        Insert: {
          grade_max?: number | null
          grade_value?: number | null
          id?: string
          note?: string | null
          photo_path?: string | null
          session_group_id: string
          timestamp?: string
          type: string
        }
        Update: {
          grade_max?: number | null
          grade_value?: number | null
          id?: string
          note?: string | null
          photo_path?: string | null
          session_group_id?: string
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_events_session_group_id_fkey"
            columns: ["session_group_id"]
            isOneToOne: false
            referencedRelation: "session_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_grades: {
        Row: {
          criteria_id: string
          group_id: string
          id: string
          points_awarded: number
          synced_at: string | null
        }
        Insert: {
          criteria_id: string
          group_id: string
          id?: string
          points_awarded?: number
          synced_at?: string | null
        }
        Update: {
          criteria_id?: string
          group_id?: string
          id?: string
          points_awarded?: number
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_grades_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "grading_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_grades_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "session_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          session_group_id: string
          student_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          session_group_id: string
          student_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          session_group_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_session_group_id_fkey"
            columns: ["session_group_id"]
            isOneToOne: false
            referencedRelation: "session_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      group_session_photos: {
        Row: {
          author: string
          caption: string | null
          created_at: string | null
          display_order: number | null
          file_path: string
          group_id: string | null
          id: string
          session_id: string
          student_id: string | null
        }
        Insert: {
          author?: string
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          file_path: string
          group_id?: string | null
          id?: string
          session_id: string
          student_id?: string | null
        }
        Update: {
          author?: string
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          file_path?: string
          group_id?: string | null
          id?: string
          session_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_session_photos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "session_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_photos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_photos_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      group_sessions: {
        Row: {
          class_id: string
          completed_at: string | null
          created_at: string
          deposit_closed: boolean
          deposit_until: string | null
          id: string
          linked_session_id: string | null
          materials: string[] | null
          name: string
          status: string
          synced_at: string | null
          template_id: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          completed_at?: string | null
          created_at?: string
          deposit_closed?: boolean
          deposit_until?: string | null
          id?: string
          linked_session_id?: string | null
          materials?: string[] | null
          name: string
          status?: string
          synced_at?: string | null
          template_id?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          completed_at?: string | null
          created_at?: string
          deposit_closed?: boolean
          deposit_until?: string | null
          id?: string
          linked_session_id?: string | null
          materials?: string[] | null
          name?: string
          status?: string
          synced_at?: string | null
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_linked_session_id_fkey"
            columns: ["linked_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_boards: {
        Row: {
          board_id: string
          class_id: string | null
          created_at: string
          ends_at: string
          group_id: string | null
          id: string
          label: string
          source_board_id: string | null
          starts_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          class_id?: string | null
          created_at?: string
          ends_at: string
          group_id?: string | null
          id?: string
          label: string
          source_board_id?: string | null
          starts_at: string
          user_id: string
        }
        Update: {
          board_id?: string
          class_id?: string | null
          created_at?: string
          ends_at?: string
          group_id?: string | null
          id?: string
          label?: string
          source_board_id?: string | null
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_boards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_boards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_boards_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_journal: {
        Row: {
          class_id: string | null
          content: string
          copied_at: string | null
          created_at: string
          ends_at: string
          group_id: string | null
          id: string
          label: string
          source: string
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          content: string
          copied_at?: string | null
          created_at?: string
          ends_at: string
          group_id?: string | null
          id?: string
          label: string
          source?: string
          starts_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string | null
          content?: string
          copied_at?: string | null
          created_at?: string
          ends_at?: string
          group_id?: string | null
          id?: string
          label?: string
          source?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_journal_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_journal_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          class_id: string | null
          content: string
          created_at: string
          done: boolean
          ends_at: string
          group_id: string | null
          id: string
          label: string
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          content: string
          created_at?: string
          done?: boolean
          ends_at: string
          group_id?: string | null
          id?: string
          label: string
          starts_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string | null
          content?: string
          created_at?: string
          done?: boolean
          ends_at?: string
          group_id?: string | null
          id?: string
          label?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          activity_id: string | null
          class_id: string | null
          created_at: string
          expires_at: string
          id: string
          points: number | null
          signe: string
          student_ids: string[] | null
          style: string
          texte: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          class_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          points?: number | null
          signe?: string
          student_ids?: string[] | null
          style?: string
          texte: string
          user_id?: string
        }
        Update: {
          activity_id?: string | null
          class_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          points?: number | null
          signe?: string
          student_ids?: string[] | null
          style?: string
          texte?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_messages_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_participations: {
        Row: {
          count: number
          created_at: string | null
          id: string
          reason: string | null
          school_year: string
          student_id: string
          trimester: number
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          reason?: string | null
          school_year: string
          student_id: string
          trimester: number
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          reason?: string | null
          school_year?: string
          student_id?: string
          trimester?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_participations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      oral_evaluations: {
        Row: {
          class_id: string
          evaluated_at: string | null
          grade: number
          id: string
          school_year: string
          student_id: string
          trimester: number
          user_id: string
        }
        Insert: {
          class_id: string
          evaluated_at?: string | null
          grade: number
          id?: string
          school_year: string
          student_id: string
          trimester: number
          user_id: string
        }
        Update: {
          class_id?: string
          evaluated_at?: string | null
          grade?: number
          id?: string
          school_year?: string
          student_id?: string
          trimester?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oral_evaluations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oral_evaluations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          disabled_cells: Json | null
          grid_cols: number | null
          grid_rows: number | null
          id: string
          is_deleted: boolean | null
          layout_type: string | null
          name: string
          table_groups: Json | null
          tables: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled_cells?: Json | null
          grid_cols?: number | null
          grid_rows?: number | null
          id?: string
          is_deleted?: boolean | null
          layout_type?: string | null
          name: string
          table_groups?: Json | null
          tables?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          disabled_cells?: Json | null
          grid_cols?: number | null
          grid_rows?: number | null
          id?: string
          is_deleted?: boolean | null
          layout_type?: string | null
          name?: string
          table_groups?: Json | null
          tables?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      seating_constraints: {
        Row: {
          class_id: string
          created_at: string
          id: string
          kind: string
          other_student_id: string | null
          params: Json
          student_id: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          kind: string
          other_student_id?: string | null
          params?: Json
          student_id: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          kind?: string
          other_student_id?: string | null
          params?: Json
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seating_constraints_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_constraints_other_student_id_fkey"
            columns: ["other_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seating_constraints_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      session_board_state: {
        Row: {
          reveal: Json
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          reveal?: Json
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          reveal?: Json
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_board_state_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_boards: {
        Row: {
          board_id: string
          course_ink: Json | null
          linked_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          board_id: string
          course_ink?: Json | null
          linked_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          board_id?: string
          course_ink?: Json | null
          linked_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_boards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_boards_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_group_members: {
        Row: {
          group_id: string
          id: string
          student_id: string
          synced_at: string | null
        }
        Insert: {
          group_id: string
          id?: string
          student_id: string
          synced_at?: string | null
        }
        Update: {
          group_id?: string
          id?: string
          student_id?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "session_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      session_groups: {
        Row: {
          comment: string | null
          conduct_malus: number
          created_at: string
          display_order: number
          group_number: number | null
          id: string
          name: string | null
          position_x: number | null
          position_y: number | null
          session_id: string
          synced_at: string | null
        }
        Insert: {
          comment?: string | null
          conduct_malus?: number
          created_at?: string
          display_order?: number
          group_number?: number | null
          id?: string
          name?: string | null
          position_x?: number | null
          position_y?: number | null
          session_id: string
          synced_at?: string | null
        }
        Update: {
          comment?: string | null
          conduct_malus?: number
          created_at?: string
          display_order?: number
          group_number?: number | null
          id?: string
          name?: string | null
          position_x?: number | null
          position_y?: number | null
          session_id?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_groups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          class_id: string
          ended_at: string | null
          group_id: string | null
          id: string
          notes: string | null
          room_id: string
          started_at: string
          topic: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          ended_at?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          room_id: string
          started_at?: string
          topic?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          ended_at?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          room_id?: string
          started_at?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_cards: {
        Row: {
          card_number: number
          completed_at: string | null
          created_at: string | null
          id: string
          status: string
          student_id: string
          synced_at: string | null
          user_id: string
        }
        Insert: {
          card_number?: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          status?: string
          student_id: string
          synced_at?: string | null
          user_id: string
        }
        Update: {
          card_number?: number
          completed_at?: string | null
          created_at?: string | null
          id?: string
          status?: string
          student_id?: string
          synced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamp_cards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_categories: {
        Row: {
          color: string
          created_at: string | null
          display_order: number
          icon: string
          icon_ref: string | null
          id: string
          is_active: boolean
          label: string
          synced_at: string | null
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          display_order?: number
          icon: string
          icon_ref?: string | null
          id?: string
          is_active?: boolean
          label: string
          synced_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          display_order?: number
          icon?: string
          icon_ref?: string | null
          id?: string
          is_active?: boolean
          label?: string
          synced_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stamps: {
        Row: {
          awarded_at: string | null
          card_id: string
          category_id: string | null
          id: string
          slot_number: number
          student_id: string
          synced_at: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          card_id: string
          category_id?: string | null
          id?: string
          slot_number: number
          student_id: string
          synced_at?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          card_id?: string
          category_id?: string | null
          id?: string
          slot_number?: number
          student_id?: string
          synced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamps_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "stamp_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stamp_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_connections: {
        Row: {
          connected_at: string
          id: string
          student_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          student_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_connections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_work_held: {
        Row: {
          activity: Json
          activity_id: string
          attempts: number
          class_name: string | null
          codes: string[]
          codes_key: string
          content: Json
          first_at: string
          id: string
          last_at: string
          pseudos: string[]
          submit: boolean
          user_id: string
        }
        Insert: {
          activity: Json
          activity_id: string
          attempts?: number
          class_name?: string | null
          codes: string[]
          codes_key: string
          content: Json
          first_at?: string
          id?: string
          last_at?: string
          pseudos?: string[]
          submit?: boolean
          user_id: string
        }
        Update: {
          activity?: Json
          activity_id?: string
          attempts?: number
          class_name?: string | null
          codes?: string[]
          codes_key?: string
          content?: Json
          first_at?: string
          id?: string
          last_at?: string
          pseudos?: string[]
          submit?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_work_held_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      student_work_versions: {
        Row: {
          content: Json
          id: string
          submitted_at: string
          version: number
          work_id: string
        }
        Insert: {
          content: Json
          id?: string
          submitted_at?: string
          version: number
          work_id: string
        }
        Update: {
          content?: Json
          id?: string
          submitted_at?: string
          version?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_work_versions_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "student_works"
            referencedColumns: ["id"]
          },
        ]
      }
      student_works: {
        Row: {
          activity_id: string
          advice: string | null
          class_id: string | null
          content: Json
          corrected_at: string | null
          corrected_by: string | null
          correction: Json | null
          created_at: string
          first_submitted_at: string | null
          group_key: string | null
          group_pseudos: string[]
          id: string
          is_deleted: boolean
          modified_after_correction: boolean
          skills: Json | null
          status: string
          student_id: string
          submitted_at: string | null
          total_points: number | null
          updated_at: string
          user_id: string
          validated_at: string | null
          version: number
        }
        Insert: {
          activity_id: string
          advice?: string | null
          class_id?: string | null
          content?: Json
          corrected_at?: string | null
          corrected_by?: string | null
          correction?: Json | null
          created_at?: string
          first_submitted_at?: string | null
          group_key?: string | null
          group_pseudos?: string[]
          id?: string
          is_deleted?: boolean
          modified_after_correction?: boolean
          skills?: Json | null
          status?: string
          student_id: string
          submitted_at?: string | null
          total_points?: number | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
          version?: number
        }
        Update: {
          activity_id?: string
          advice?: string | null
          class_id?: string | null
          content?: Json
          corrected_at?: string | null
          corrected_by?: string | null
          correction?: Json | null
          created_at?: string
          first_submitted_at?: string | null
          group_key?: string | null
          group_pseudos?: string[]
          id?: string
          is_deleted?: boolean
          modified_after_correction?: boolean
          skills?: Json | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          total_points?: number | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_works_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_works_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_works_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string | null
          created_at: string
          gender: string | null
          has_pai: boolean
          has_pap: boolean
          has_ppre: boolean
          id: string
          identity_id: string
          is_deleted: boolean | null
          is_witness: boolean
          photo_path: string | null
          pseudo: string
          student_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          gender?: string | null
          has_pai?: boolean
          has_pap?: boolean
          has_ppre?: boolean
          id?: string
          identity_id?: string
          is_deleted?: boolean | null
          is_witness?: boolean
          photo_path?: string | null
          pseudo: string
          student_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          gender?: string | null
          has_pai?: boolean
          has_pap?: boolean
          has_ppre?: boolean
          id?: string
          identity_id?: string
          is_deleted?: boolean | null
          is_witness?: boolean
          photo_path?: string | null
          pseudo?: string
          student_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "student_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          class_label: string | null
          created_at: string
          ends_at: string
          external_id: string | null
          id: string
          kind: string
          label: string
          room: string | null
          source: string
          starts_at: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          class_label?: string | null
          created_at?: string
          ends_at: string
          external_id?: string | null
          id?: string
          kind?: string
          label: string
          room?: string | null
          source: string
          starts_at: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          class_label?: string | null
          created_at?: string
          ends_at?: string
          external_id?: string | null
          id?: string
          kind?: string
          label?: string
          room?: string | null
          source?: string
          starts_at?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timetable_label_links: {
        Row: {
          class_id: string | null
          group_id: string | null
          ignored: boolean
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id?: string | null
          group_id?: string | null
          ignored?: boolean
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string | null
          group_id?: string | null
          ignored?: boolean
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_label_links_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_label_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tp_template_criteria: {
        Row: {
          display_order: number
          hint: string | null
          id: string
          label: string
          max_points: number
          synced_at: string | null
          template_id: string
        }
        Insert: {
          display_order?: number
          hint?: string | null
          id?: string
          label: string
          max_points: number
          synced_at?: string | null
          template_id: string
        }
        Update: {
          display_order?: number
          hint?: string | null
          id?: string
          label?: string
          max_points?: number
          synced_at?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tp_template_criteria_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tp_template_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          display_order: number | null
          file_path: string
          id: string
          template_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          file_path: string
          id?: string
          template_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          file_path?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tp_template_photos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tp_templates: {
        Row: {
          activity: string | null
          chapter: string | null
          color: string
          created_at: string
          duration_min: number | null
          id: string
          level: string | null
          materials: string[] | null
          modality: string | null
          name: string
          problem: string | null
          protocol: string[]
          safety: string[]
          student_boards: Json | null
          synced_at: string | null
          theme: string | null
          user_id: string
        }
        Insert: {
          activity?: string | null
          chapter?: string | null
          color?: string
          created_at?: string
          duration_min?: number | null
          id?: string
          level?: string | null
          materials?: string[] | null
          modality?: string | null
          name: string
          problem?: string | null
          protocol?: string[]
          safety?: string[]
          student_boards?: Json | null
          synced_at?: string | null
          theme?: string | null
          user_id: string
        }
        Update: {
          activity?: string | null
          chapter?: string | null
          color?: string
          created_at?: string
          duration_min?: number | null
          id?: string
          level?: string | null
          materials?: string[] | null
          modality?: string | null
          name?: string
          problem?: string | null
          protocol?: string[]
          safety?: string[]
          student_boards?: Json | null
          synced_at?: string | null
          theme?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trimester_boundaries: {
        Row: {
          id: string
          school_year: string
          started_at: string | null
          trimester: number
          user_id: string
        }
        Insert: {
          id?: string
          school_year: string
          started_at?: string | null
          trimester: number
          user_id: string
        }
        Update: {
          id?: string
          school_year?: string
          started_at?: string | null
          trimester?: number
          user_id?: string
        }
        Relationships: []
      }
      trimester_grades: {
        Row: {
          absences: number
          adjusted_target: number
          archived_at: string | null
          bonus: number
          class_id: string | null
          class_name: string | null
          grade: number
          id: string
          participations: number
          school_year: string
          student_id: string
          target_participations: number
          trimester: number
          user_id: string
        }
        Insert: {
          absences?: number
          adjusted_target: number
          archived_at?: string | null
          bonus?: number
          class_id?: string | null
          class_name?: string | null
          grade: number
          id?: string
          participations?: number
          school_year: string
          student_id: string
          target_participations: number
          trimester: number
          user_id: string
        }
        Update: {
          absences?: number
          adjusted_target?: number
          archived_at?: string | null
          bonus?: number
          class_id?: string | null
          class_name?: string | null
          grade?: number
          id?: string
          participations?: number
          school_year?: string
          student_id?: string
          target_participations?: number
          trimester?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trimester_grades_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trimester_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      trimester_settings: {
        Row: {
          created_at: string | null
          current_trimester: number
          id: string
          school_year: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_trimester?: number
          id?: string
          school_year?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_trimester?: number
          id?: string
          school_year?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          device_info: string | null
          last_seen_at: string
          login_count: number
          user_email: string
          user_id: string
        }
        Insert: {
          device_info?: string | null
          last_seen_at?: string
          login_count?: number
          user_email: string
          user_id: string
        }
        Update: {
          device_info?: string | null
          last_seen_at?: string
          login_count?: number
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          keys: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          keys?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          keys?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_board_events: {
        Row: {
          created_at: string
          id: string
          label: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      written_assessments: {
        Row: {
          bareme_total: number | null
          class_id: string
          coefficient: number
          copies_purge_at: string | null
          copies_purged_at: string | null
          correction_path: string | null
          corrections_withheld: boolean
          counts_in_average: boolean
          created_at: string
          date: string | null
          group_id: string | null
          group_session_id: string | null
          id: string
          is_deleted: boolean | null
          kind: string
          library_board_id: string | null
          library_correction_board_id: string | null
          library_documents_board_id: string | null
          makeup_reminder_dismissed_at: string | null
          name: string
          only_if_raises_average: boolean
          period: number | null
          published_at: string | null
          published_to_students: boolean
          school_year: string | null
          sequence: string | null
          series_id: string | null
          session_id: string | null
          short_name: string | null
          subject: string | null
          subject_path: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bareme_total?: number | null
          class_id: string
          coefficient?: number
          copies_purge_at?: string | null
          copies_purged_at?: string | null
          correction_path?: string | null
          corrections_withheld?: boolean
          counts_in_average?: boolean
          created_at?: string
          date?: string | null
          group_id?: string | null
          group_session_id?: string | null
          id?: string
          is_deleted?: boolean | null
          kind?: string
          library_board_id?: string | null
          library_correction_board_id?: string | null
          library_documents_board_id?: string | null
          makeup_reminder_dismissed_at?: string | null
          name: string
          only_if_raises_average?: boolean
          period?: number | null
          published_at?: string | null
          published_to_students?: boolean
          school_year?: string | null
          sequence?: string | null
          series_id?: string | null
          session_id?: string | null
          short_name?: string | null
          subject?: string | null
          subject_path?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bareme_total?: number | null
          class_id?: string
          coefficient?: number
          copies_purge_at?: string | null
          copies_purged_at?: string | null
          correction_path?: string | null
          corrections_withheld?: boolean
          counts_in_average?: boolean
          created_at?: string
          date?: string | null
          group_id?: string | null
          group_session_id?: string | null
          id?: string
          is_deleted?: boolean | null
          kind?: string
          library_board_id?: string | null
          library_correction_board_id?: string | null
          library_documents_board_id?: string | null
          makeup_reminder_dismissed_at?: string | null
          name?: string
          only_if_raises_average?: boolean
          period?: number | null
          published_at?: string | null
          published_to_students?: boolean
          school_year?: string | null
          sequence?: string | null
          series_id?: string | null
          session_id?: string | null
          short_name?: string | null
          subject?: string | null
          subject_path?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "written_assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "written_assessments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "written_assessments_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "written_assessments_library_board_id_fkey"
            columns: ["library_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "written_assessments_library_correction_board_id_fkey"
            columns: ["library_correction_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "written_assessments_library_documents_board_id_fkey"
            columns: ["library_documents_board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "written_assessments_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "assessment_series"
            referencedColumns: ["id"]
          },
        ]
      }
      yearly_class_summaries: {
        Row: {
          average_grade: number | null
          class_name: string
          created_at: string | null
          id: string
          ratio: number | null
          school_year: string
          total_absences: number | null
          total_bavardages: number | null
          total_participations: number | null
          total_sorties: number | null
          total_students: number | null
          user_id: string
        }
        Insert: {
          average_grade?: number | null
          class_name: string
          created_at?: string | null
          id?: string
          ratio?: number | null
          school_year: string
          total_absences?: number | null
          total_bavardages?: number | null
          total_participations?: number | null
          total_sorties?: number | null
          total_students?: number | null
          user_id: string
        }
        Update: {
          average_grade?: number | null
          class_name?: string
          created_at?: string | null
          id?: string
          ratio?: number | null
          school_year?: string
          total_absences?: number | null
          total_bavardages?: number | null
          total_participations?: number | null
          total_sorties?: number | null
          total_students?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
    }
    Functions: {
      assign_unnamed_copy: {
        Args: { p_copy_id: string; p_student_id: string }
        Returns: number
      }
      award_stamp: {
        Args: { p_category_id: string; p_student_id: string }
        Returns: Json
      }
      get_connection_stats: {
        Args: { p_class_id: string }
        Returns: {
          connection_count: number
          last_connected: string
          student_id: string
        }[]
      }
      get_session_event_counts: {
        Args: { p_session_ids: string[] }
        Returns: {
          absences: number
          events_count: number
          malus: number
          participations: number
          remarques: number
          session_id: string
          sorties: number
        }[]
      }
      get_student_academy: {
        Args: { p_code: string; p_student_id?: string }
        Returns: Json
      }
      get_student_dashboard: {
        Args: { p_code: string; p_student_id?: string }
        Returns: Json
      }
      get_student_grades: {
        Args: { p_code: string; p_student_id?: string }
        Returns: Json
      }
      get_student_stamps: {
        Args: { p_code: string; p_student_id?: string }
        Returns: Json
      }
      get_student_tp: {
        Args: { p_code: string; p_session_id: string; p_student_id?: string }
        Returns: Json
      }
      get_student_tps: {
        Args: { p_code: string; p_student_id?: string }
        Returns: Json
      }
      get_student_work_correction: {
        Args: { p_assessment_id: string; p_code: string; p_student_id?: string }
        Returns: Json
      }
      get_table_row_counts: {
        Args: never
        Returns: {
          row_count: number
          table_name: string
        }[]
      }
      log_device_connection: {
        Args: {
          p_device_info: string
          p_platform?: string
          p_user_email: string
          p_user_id: string
        }
        Returns: undefined
      }
      search_courses: {
        Args: { p_query: string }
        Returns: {
          board_id: string
          excerpt: string
        }[]
      }
      select_bonus_for_student: {
        Args: { p_bonus_id: string; p_student_id: string }
        Returns: Json
      }
      select_student_bonus: {
        Args: { p_bonus_id: string; p_code: string; p_student_id?: string }
        Returns: Json
      }
      storage_usage: {
        Args: never
        Returns: {
          course_files_bytes: number
          total_bytes: number
        }[]
      }
      student_work_accept_held: {
        Args: { p_activity_id: string }
        Returns: Json
      }
      submit_academy_test: {
        Args: {
          p_code: string
          p_preferences: Json
          p_responses: Json
          p_student_id?: string
        }
        Returns: Json
      }
      tp_deposit_state: { Args: { p_session_id: string }; Returns: Json }
      track_user_activity:
        | {
            Args: { p_user_email: string; p_user_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_device_info?: string
              p_user_email: string
              p_user_id: string
            }
            Returns: undefined
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
