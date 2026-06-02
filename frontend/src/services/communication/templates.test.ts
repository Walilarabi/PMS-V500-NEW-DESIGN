/**
 * FLOWTYM — Tests du remplissage de modèles, modèles par défaut,
 * bibliothèque hôtelière et CRUD des modèles propres à l'hôtel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// templates.ts importe le client supabase + resolveHotelId au niveau module.
// On les mocke pour éviter toute init réseau en test.
vi.mock('@/src/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('@/src/lib/hotelId', () => ({ resolveHotelId: vi.fn() }));

import { supabase } from '@/src/lib/supabase';
import { resolveHotelId } from '@/src/lib/hotelId';
import {
  fillTemplate, defaultTemplates, DEFAULT_EMAIL_TEMPLATES, DEFAULT_WHATSAPP_TEMPLATES,
  HOSPITALITY_LIBRARY, libraryFor, TEMPLATE_KINDS, TEMPLATE_KIND_META,
  createTemplate, updateTemplate, deleteTemplate, fetchHotelTemplates,
  type TemplateKind,
} from './templates';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
const resolveHotelMock = resolveHotelId as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  resolveHotelMock.mockResolvedValue('hotel-1');
});

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

describe('bibliothèque hôtelière', () => {
  const ALLOWED: TemplateKind[] = TEMPLATE_KINDS;

  it('libraryFor filtre strictement par canal', () => {
    expect(libraryFor('email').every((t) => t.channel === 'email')).toBe(true);
    expect(libraryFor('whatsapp').every((t) => t.channel === 'whatsapp')).toBe(true);
    expect(libraryFor('email').length + libraryFor('whatsapp').length).toBe(HOSPITALITY_LIBRARY.length);
  });

  it('chaque modèle a un kind valide, un corps et une description', () => {
    for (const t of HOSPITALITY_LIBRARY) {
      expect(ALLOWED).toContain(t.kind);
      expect(t.body.trim().length).toBeGreaterThan(0);
      expect(t.description.trim().length).toBeGreaterThan(0);
      expect(t.category.trim().length).toBeGreaterThan(0);
    }
  });

  it('les modèles email de la bibliothèque ont un objet', () => {
    expect(libraryFor('email').every((t) => typeof t.subject === 'string' && t.subject!.length > 0)).toBe(true);
  });

  it('TEMPLATE_KIND_META couvre tous les types', () => {
    for (const k of TEMPLATE_KINDS) {
      expect(TEMPLATE_KIND_META[k]?.label).toBeTruthy();
      expect(TEMPLATE_KIND_META[k]?.trigger).toBeTruthy();
    }
  });
});

describe('createTemplate', () => {
  it('insère avec hotel_id résolu et valeurs par défaut (email conserve l\'objet)', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await createTemplate({ channel: 'email', kind: 'confirmation', name: 'Conf', subject: 'Objet', body: 'Corps' });

    expect(fromMock).toHaveBeenCalledWith('communication_templates');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      hotel_id: 'hotel-1', channel: 'email', kind: 'confirmation',
      name: 'Conf', subject: 'Objet', body: 'Corps', language: 'fr', is_active: true,
    }));
  });

  it('force subject à null pour WhatsApp', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await createTemplate({ channel: 'whatsapp', kind: 'free', name: 'Libre', subject: 'ignoré', body: 'Salut' });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ channel: 'whatsapp', subject: null }));
  });

  it('échoue proprement sans hôtel actif', async () => {
    resolveHotelMock.mockResolvedValue(null);
    await expect(createTemplate({ channel: 'email', kind: 'free', name: 'x', body: 'y' })).rejects.toBeTruthy();
  });
});

describe('updateTemplate', () => {
  it('n\'envoie que les champs fournis', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ update });

    await updateTemplate('tpl-9', { name: 'Nouveau nom', is_active: false });

    expect(update).toHaveBeenCalledWith({ name: 'Nouveau nom', is_active: false });
    expect(eq).toHaveBeenCalledWith('id', 'tpl-9');
  });
});

describe('deleteTemplate', () => {
  it('supprime par id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ delete: del });

    await deleteTemplate('tpl-3');

    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'tpl-3');
  });
});

describe('fetchHotelTemplates', () => {
  it('mappe les lignes DB en CommTemplate marqués isCustom', async () => {
    const rows = [
      { id: 't1', channel: 'email', kind: 'confirmation', name: 'Conf hôtel', subject: 'Obj', body: 'B', is_active: true, language: 'fr' },
      { id: 't2', channel: 'email', kind: 'free', name: null, subject: null, body: 'Libre', is_active: false, language: 'en' },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const out = await fetchHotelTemplates('email');

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('channel', 'email');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 't1', label: 'Conf hôtel', isCustom: true, isActive: true, channel: 'email' });
    // name null → fallback sur kind ; is_active false respecté ; langue conservée
    expect(out[1]).toMatchObject({ id: 't2', label: 'free', isActive: false, language: 'en' });
  });

  it('retourne une liste vide si aucune ligne', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ order }) }) });
    expect(await fetchHotelTemplates('whatsapp')).toEqual([]);
  });
});
