/**
 * Le même client Supabase que `./supabase`, mais sans la description de la base.
 *
 * `./supabase` est typé par `database.types.ts` : une table, une colonne ou une fonction mal nommée
 * y est une erreur de compilation. Les fichiers écrits avant ce contrôle, et pas encore mis en
 * accord avec lui, importent leur client d'ici en attendant.
 *
 * Ne pas l'importer dans du code nouveau : la liste des fichiers qui s'en servent est consignée
 * dans garde-fous.json et ne peut que diminuer. Pour en sortir un fichier : remplacer l'import par
 * `./supabase`, corriger ce que `npx tsc -b` signale, puis `npm run garde-fous:maj`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as typedClient } from './supabase';

export const supabase = typedClient as unknown as SupabaseClient;
