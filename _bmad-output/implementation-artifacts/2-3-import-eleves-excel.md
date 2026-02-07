# Story 2.3: Import d'eleves depuis Excel

Status: complete

## Story

As an **enseignant**,
I want **importer une liste d'eleves depuis un fichier Excel**,
So that **je puisse rapidement ajouter tous mes eleves sans saisie manuelle**.

## Acceptance Criteria

1. **AC1:** L'enseignant peut selectionner un fichier Excel ✅
2. **AC2:** Les eleves sont crees avec pseudonyme (Prenom + 2 lettres nom) ✅
3. **AC3:** La table de correspondance locale est mise a jour avec nom complet <-> pseudonyme ✅
4. **AC4:** Les eleves apparaissent dans la classe selectionnee ✅
5. **AC5:** Un message d'erreur s'affiche si le format est invalide ✅

## Tasks / Subtasks

- [x] Task 1: Dependencies
  - [x] 1.1 Installer expo-document-picker
  - [x] 1.2 Installer xlsx pour parser Excel
  - [x] 1.3 Installer expo-file-system

- [x] Task 2: Repository eleves
  - [x] 2.1 Creer `services/database/studentRepository.ts`
  - [x] 2.2 Creer `services/database/localMappingRepository.ts`

- [x] Task 3: Utilitaire de pseudonymisation
  - [x] 3.1 Creer `utils/pseudonymize.ts`
  - [x] 3.2 Fonction: Prenom + 2 premieres lettres du nom en majuscules

- [x] Task 4: Service d'import Excel
  - [x] 4.1 Creer `services/import/excelImport.ts`
  - [x] 4.2 Parser Excel, valider colonnes, creer eleves

- [x] Task 5: Store eleves
  - [x] 5.1 Creer `stores/studentStore.ts`
  - [x] 5.2 Actions: loadStudents, importFromExcel

- [x] Task 6: UI Import
  - [x] 6.1 Bouton import dans ecran detail classe
  - [x] 6.2 Affichage liste eleves avec nom complet et pseudo

## Dev Notes

### Format Excel attendu

| Nom | Prenom |
|-----|--------|
| DUPONT | Marie |
| MARTIN | Lucas |

Le parser essaie d'abord de trouver les colonnes par leur nom (Nom/Prenom), sinon utilise les 2 premieres colonnes.

### Pseudonymisation (FR38, NFR7)

- `Marie DUPONT` -> `Marie DU`
- `Lucas MARTIN` -> `Lucas MA`

### RGPD (FR40, NFR8)

- Table `students`: stocke uniquement le pseudo
- Table `local_student_mapping`: stocke nom complet (LOCAL ONLY, jamais sync)

### FR Couverts

- **FR22:** Import fichier Excel
- **FR38:** Stockage pseudonymise
- **FR39:** Table correspondance depuis import

### References

- [Source: epics.md#Story-2.3]
- [Source: architecture.md#RGPD]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)
- Dependencies installees: expo-document-picker, xlsx, expo-file-system

### Completion Notes List

1. Utilitaire de pseudonymisation (generatePseudonym, normalizeName, generateFullName)
2. Repository students avec batch creation
3. Repository local_student_mapping pour RGPD (LOCAL ONLY)
4. Service d'import Excel avec validation format
5. Store students avec import et merge des mappings
6. UI: Bouton "Importer Excel" + liste eleves avec avatar
7. Document picker pour fichiers .xls et .xlsx
8. Affichage nom complet + pseudo pour chaque eleve

### File List

**Utils:**
- `utils/pseudonymize.ts` - Fonctions de pseudonymisation
- `utils/index.ts` - Exports

**Database:**
- `services/database/studentRepository.ts` - CRUD students
- `services/database/localMappingRepository.ts` - Correspondance noms (LOCAL)
- `services/database/index.ts` - Exports

**Services:**
- `services/import/excelImport.ts` - Parser Excel et import
- `services/import/index.ts` - Exports
- `services/index.ts` - Export import service

**Stores:**
- `stores/studentStore.ts` - State management eleves
- `stores/index.ts` - Export store

**App:**
- `app/(main)/classes/[id].tsx` - UI import + liste eleves

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story demarree |
| 2026-02-03 | Story implementee et completee |
