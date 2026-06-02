/**
 * FLOWTYM — Tests du remplissage de modèles + modèles par défaut.
 */
import { describe, it, expect, vi } from 'vitest';

// templates.ts importe le client supabase au niveau module (pour fetchTemplates).
// On le mocke pour éviter l'init réseau en test.
vi.mock('@/src/lib/supabase', () => ({ supabase: { from: vi.fn() } }));

import { fillTemplate, defaultTemplates, DEFAULT_EMAIL_TEMPLATES, DEFAULT_WHATSAPP_TEMPLATES } from './templates';

describe('fillTemplate', () => {
  it('remplace les variables connues', () => {
    const out = fillTemplate('Bonjour {{guest}}, chambre {{room}}', { guest: 'Alice', room: '204' });
    expect(out).toBe('Bonjour Alice, chambre 204');
  });

  it('tolère les espaces autour de la variable', () => {
    expect(fillTemplate('{{ guest }}', { guest: 'Bob' })).toBe('Bob');
  });

  it('laisse le placeholder si la variable est absente', () => {
    expect(fillTemplate('Bonjour {{guest}}', {})).toBe('Bonjour {{guest}}');
  });

  it('remplace plusieurs occurrences', () => {
    expect(fillTemplate('{{hotel}} — {{hotel}}', { hotel: 'X' })).toBe('X — X');
  });
});

describe('defaultTemplates', () => {
  it('retourne les modèles email', () => {
    expect(defaultTemplates('email')).toBe(DEFAULT_EMAIL_TEMPLATES);
    expect(DEFAULT_EMAIL_TEMPLATES.every((t) => t.channel === 'email')).toBe(true);
  });
  it('retourne les modèles whatsapp', () => {
    expect(defaultTemplates('whatsapp')).toBe(DEFAULT_WHATSAPP_TEMPLATES);
    expect(DEFAULT_WHATSAPP_TEMPLATES.every((t) => t.channel === 'whatsapp')).toBe(true);
  });
  it('chaque modèle email a un objet', () => {
    expect(DEFAULT_EMAIL_TEMPLATES.every((t) => typeof t.subject === 'string')).toBe(true);
  });
});
