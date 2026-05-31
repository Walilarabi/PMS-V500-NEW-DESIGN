/**
 * FLOWTYM — HouseAccountsPanel (T6).
 * Gestion des comptes internes hôtel (Direction, Commercial, Maintenance…)
 */
import React, { useState } from 'react';
import { Plus, CreditCard, TrendingUp, TrendingDown, ChevronRight, Loader2, Archive } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import {
  useHouseAccounts,
  useHouseAccountLines,
  useCreateHouseAccount,
  useAddHouseAccountLine,
} from '@/src/domains/billing/hooks';
import type { HouseAccountRow } from '@/src/domains/billing/houseAccounts.repository';
import type { HouseAccountCategory } from '@/src/domains/billing/houseAccounts.repository';

const fmtEur = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const CATEGORY_CONFIG: Record<HouseAccountCategory, { label: string; color: string }> = {
  direction:    { label: 'Direction',    color: 'bg-purple-100 text-purple-700' },
  commercial:   { label: 'Commercial',   color: 'bg-blue-100 text-blue-700' },
  maintenance:  { label: 'Maintenance',  color: 'bg-amber-100 text-amber-700' },
  compensation: { label: 'Compensation', color: 'bg-red-100 text-red-700' },
  general:      { label: 'Général',      color: 'bg-gray-100 text-gray-700' },
  other:        { label: 'Autre',        color: 'bg-slate-100 text-slate-700' },
};

// ─── Account Lines Detail ─────────────────────────────────────────────────────

function AccountLinesPanel({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { data: lines = [], isLoading } = useHouseAccountLines(accountId);
  const addLine = useAddHouseAccountLine();
  const [form, setForm] = useState({ description: '', amount: '', lineType: 'debit' as 'debit' | 'credit' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const amount = parseFloat(form.amount);
    if (!form.description.trim() || !amount || amount <= 0) {
      setError('Description et montant positif requis.');
      return;
    }
    setError(null);
    addLine.mutate(
      { houseAccountId: accountId, description: form.description, amount, lineType: form.lineType },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({ description: '', amount: '', lineType: 'debit' });
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">Mouvements du compte</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      {error && (
        <div className="mx-4 mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
        ) : lines.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Aucun mouvement</p>
        ) : (
          <div className="space-y-2">
            {lines.map(line => (
              <div key={line.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm text-gray-700">{line.description}</p>
                  <p className="text-[10px] text-gray-400">{new Date(line.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <span className={cn('text-sm font-bold', line.line_type === 'debit' ? 'text-red-500' : 'text-emerald-600')}>
                  {line.line_type === 'debit' ? '+' : '-'}{fmtEur(line.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 shrink-0">
        {showForm ? (
          <div className="space-y-2">
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              placeholder="Description *"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                placeholder="Montant (€)"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
              <select
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                value={form.lineType}
                onChange={e => setForm(f => ({ ...f, lineType: e.target.value as 'debit' | 'credit' }))}
              >
                <option value="debit">Débit</option>
                <option value="credit">Crédit</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Annuler</Button>
              <Button size="sm" onClick={handleAdd} disabled={addLine.isPending} className="flex-1 bg-purple-600 text-white">
                {addLine.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Ajouter'}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowForm(true)} className="w-full gap-2">
            <Plus size={13} /> Ajouter un mouvement
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onClick,
}: {
  key?: React.Key;
  account: HouseAccountRow;
  onClick: () => void;
}) {
  const cfg = CATEGORY_CONFIG[account.category] ?? CATEGORY_CONFIG.general;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-purple-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={14} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-900">{account.name}</span>
          </div>
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', cfg.color)}>
            {cfg.label}
          </span>
        </div>
        <div className="text-right">
          <div className={cn('text-base font-bold', account.balance > 0 ? 'text-red-500' : account.balance < 0 ? 'text-emerald-600' : 'text-gray-500')}>
            {account.balance > 0 ? <TrendingUp size={12} className="inline mr-1" /> : <TrendingDown size={12} className="inline mr-1" />}
            {fmtEur(Math.abs(account.balance))}
          </div>
          {account.credit_limit !== null && (
            <p className="text-[10px] text-gray-400">Limite : {fmtEur(account.credit_limit)}</p>
          )}
        </div>
        <ChevronRight size={14} className="text-gray-300 self-center ml-2" />
      </div>
    </button>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateAccountForm({ onClose }: { onClose: () => void }) {
  const create = useCreateHouseAccount();
  const [form, setForm] = useState({ name: '', category: 'general' as HouseAccountCategory, creditLimit: '' });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nom requis.'); return; }
    setError(null);
    create.mutate(
      {
        name: form.name.trim(),
        category: form.category,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
      },
      { onSuccess: onClose, onError: (err) => setError(err.message) },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Nouveau compte interne</h3>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
        placeholder="Nom du compte *"
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        autoFocus
      />
      <select
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
        value={form.category}
        onChange={e => setForm(f => ({ ...f, category: e.target.value as HouseAccountCategory }))}
      >
        {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
      <input
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
        placeholder="Limite de crédit (€, optionnel)"
        type="number"
        min="0"
        step="0.01"
        value={form.creditLimit}
        onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))}
      />
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
        <Button type="submit" disabled={create.isPending} className="flex-1 bg-purple-600 text-white gap-2">
          {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Créer
        </Button>
      </div>
    </form>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function HouseAccountsPanel() {
  const { data: accounts = [], isLoading } = useHouseAccounts(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const active = accounts.filter(a => a.is_active);
  const inactive = accounts.filter(a => !a.is_active);
  const totalBalance = active.reduce((s, a) => s + a.balance, 0);

  if (selectedId) {
    return <AccountLinesPanel accountId={selectedId} onClose={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Comptes internes</h2>
          <p className="text-xs text-gray-400">Total débit net : <strong className="text-red-500">{fmtEur(totalBalance)}</strong></p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-purple-600 text-white gap-2 text-sm font-semibold">
          <Plus size={14} /> Nouveau compte
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-4 bg-white border-b border-gray-100">
          <CreateAccountForm onClose={() => setShowCreate(false)} />
        </div>
      )}

      {/* Accounts list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : active.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <CreditCard size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">Aucun compte interne actif</p>
            <Button onClick={() => setShowCreate(true)} className="mt-4 bg-purple-600 text-white gap-2 text-sm">
              <Plus size={13} /> Créer le premier compte
            </Button>
          </div>
        ) : (
          active.map(account => (
            <AccountCard key={account.id} account={account} onClick={() => setSelectedId(account.id)} />
          ))
        )}

        {inactive.length > 0 && (
          <button
            onClick={() => setShowInactive(v => !v)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 py-2"
          >
            <Archive size={12} />
            {showInactive ? 'Masquer' : 'Afficher'} les {inactive.length} compte(s) archivé(s)
          </button>
        )}
        {showInactive && inactive.map(account => (
          <AccountCard key={account.id} account={account} onClick={() => setSelectedId(account.id)} />
        ))}
      </div>
    </div>
  );
}
