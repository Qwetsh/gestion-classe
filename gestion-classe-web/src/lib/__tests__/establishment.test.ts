import { describe, expect, it } from 'vitest';
import {
  EMPTY_ESTABLISHMENT, establishmentFromLegacy, establishmentFullAddress, establishmentPlace,
  isEstablishmentEmpty, sameEstablishment, sanitizeEstablishment,
} from '../establishment';

describe('establishment', () => {
  it('vide par défaut', () => {
    expect(isEstablishmentEmpty(EMPTY_ESTABLISHMENT)).toBe(true);
  });

  it('ne garde que les champs connus, en chaînes', () => {
    const e = sanitizeEstablishment({ name: 'Collège Test', tel: 12, intrus: 'x' });
    expect(e.name).toBe('Collège Test');
    expect(e.tel).toBe('');
    expect('intrus' in e).toBe(false);
    expect(sanitizeEstablishment(null)).toEqual(EMPTY_ESTABLISHMENT);
  });

  it('garde un établissement saisi par le professeur', () => {
    const e = establishmentFromLegacy({ name: 'Collège des Tilleuls', tel: '01 00 00 00 00' });
    expect(e.name).toBe('Collège des Tilleuls');
    expect(e.tel).toBe('01 00 00 00 00');
  });

  it('compare champ par champ', () => {
    const a = sanitizeEstablishment({ name: 'A' });
    expect(sameEstablishment(a, { ...a })).toBe(true);
    expect(sameEstablishment(a, { ...a, tel: '1' })).toBe(false);
  });

  it('compose le lieu et l’adresse sans espaces en trop', () => {
    const e = sanitizeEstablishment({ name: 'Collège Test', address: '2 rue Haute', codePostal: '00000 VILLE' });
    expect(establishmentPlace(e)).toBe('Collège Test 00000 VILLE');
    expect(establishmentFullAddress(e)).toBe('2 rue Haute 00000 VILLE');
    expect(establishmentPlace(EMPTY_ESTABLISHMENT)).toBe('');
  });
});
