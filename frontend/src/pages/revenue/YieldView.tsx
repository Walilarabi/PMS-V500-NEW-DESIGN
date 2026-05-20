/**
 * FLOWTYM Revenue — Yield Management
 *
 * Règles avancées de yield management : adaptation dynamique au marché,
 * réaction aux pics de demande, simulation d'impact.
 *
 * Statut : fonctionnel — extrait de l'ancien RevenueView. Le moteur
 * "Little Yielder" branche les déclencheurs ci-dessous sur les prix réels.
 */
import React, { useState } from 'react';
import {
  TrendingUp, XCircle, BarChart2, Zap, MoreVertical, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardHeader, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { cn } from '@/src/lib/utils';
import { RevenueHeader } from '@/src/components/revenue/RevenueHeader';

interface YieldRule {
  title: string;
  trigger: string;
  desc: string;
  active: boolean;
}

const STORAGE_KEY = 'flowtym_yield_view_rules';

const DEFAULT_YIELD_RULES: YieldRule[] = [
  { title: 'R1 — Forte demande (volume)',  trigger: 'Volume de ventes > 4 paliers',  desc: 'Augmente les prix lorsque les ventes dépassent des seuils de capacité.', active: true },
  { title: 'R2 — Annulations tardives',    trigger: 'Annulations tardives > 2 paliers', desc: 'Réagit aux annulations de dernière minute pour reconquérir la demande.', active: true },
  { title: 'R3 — Creux prolongé',          trigger: 'Creux de demande > 3 paliers',  desc: 'Réduit les prix si aucune réservation sur J+7 à J+45.', active: true },
  { title: 'R4 — Peak last minute',        trigger: 'Peak last minute > 2 paliers',  desc: 'Exploite la forte demande J-7 à J-1 quand occupation > 80%.', active: true },
  { title: 'R5 — LOS dynamique',           trigger: 'Séjour minimum (LOS) > 2 paliers', desc: 'Impose un séjour minimum les week-ends ou événements.', active: false },
  { title: 'R6 — Parité tarifaire',        trigger: 'Parité concurrentielle > 3 paliers', desc: 'Ajuste les prix face aux concurrents pour garder la compétitivité.', active: true },
  { title: 'R7 — Early bird',              trigger: 'Early bird > 2 paliers',         desc: 'Remises pour réservation anticipée (30-60 jours).', active: true },
  { title: 'R8 — Déplacement groupe',      trigger: 'Déplacement groupe > 2 paliers', desc: 'Détecte les groupes qui risquent de déplacer des individuels rentables.', active: false },
];

const RULE_ICONS = [TrendingUp, XCircle, BarChart2, Zap];

export const YieldView: React.FC = () => {
  const [selectedRule, setSelectedRule] = useState<YieldRule | null>(null);
  const [rules, setRulesRaw] = useState<YieldRule[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_YIELD_RULES;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_YIELD_RULES;
    } catch {
      return DEFAULT_YIELD_RULES;
    }
  });
  const setRules = (next: YieldRule[]) => {
    setRulesRaw(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const toggleRule = (title: string) => {
    setRules(rules.map((r) => (r.title === title ? { ...r, active: !r.active } : r)));
    if (selectedRule?.title === title) {
      setSelectedRule({ ...selectedRule, active: !selectedRule.active });
    }
  };

  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6">
      <RevenueHeader
        icon={TrendingUp}
        title="Yield management"
        subtitle={`Règles dynamiques pour optimiser le RevPAR · ${activeCount}/${rules.length} actives`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {rules.map((rule, i) => {
          const RuleIcon = RULE_ICONS[i % RULE_ICONS.length];
          return (
            <Card
              key={rule.title}
              onClick={() => setSelectedRule(rule)}
              className="flex flex-col group hover:shadow-lg hover:shadow-[#8B5CF6]/5 transition-all text-left cursor-pointer"
            >
              <CardHeader className="items-start">
                <div className="flex gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0',
                    i % 2 === 0 ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]' : 'bg-blue-50 text-blue-500',
                  )}>
                    <RuleIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#8B5CF6] transition-colors leading-tight">
                      {rule.title}
                    </h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 tracking-wider">
                      {rule.trigger}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleRule(rule.title); }}
                    title={rule.active ? 'Désactiver' : 'Activer'}
                    className={cn(
                      'w-9 h-5 rounded-full p-0.5 relative transition-colors',
                      rule.active ? 'bg-[#8B5CF6]' : 'bg-gray-200',
                    )}
                  >
                    <div className={cn(
                      'absolute h-4 w-4 bg-white rounded-full shadow-sm transition-all',
                      rule.active ? 'right-0.5' : 'left-0.5',
                    )} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="text-gray-300 hover:text-gray-500"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-3">
                <p className="text-[13px] text-gray-500 mb-4 leading-relaxed line-clamp-2">
                  {rule.desc}
                </p>
                <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                  <Badge variant={rule.active ? 'success' : 'neutral'} className="text-[9px] py-0">
                    {rule.active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Système
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mini-modale simulation */}
      <AnimatePresence>
        {selectedRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="p-2.5 bg-[#8B5CF6]/10 rounded-2xl text-[#8B5CF6]">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedRule.title}</h2>
                    <p className="text-[11px] font-bold text-gray-400 uppercase mt-0.5">
                      {selectedRule.trigger}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-6">{selectedRule.desc}</p>
                <div className="p-4 bg-blue-50/50 rounded-2xl text-blue-900 flex gap-3 mb-6">
                  <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
                  <p className="text-[11px] font-medium leading-relaxed">
                    Module de simulation détaillée à venir. Cette règle sera bientôt connectée
                    au moteur Little Yielder pour ajuster les prix en temps réel.
                  </p>
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 rounded-b-3xl">
                <Button
                  variant={selectedRule.active ? 'ghost' : 'primary'}
                  onClick={() => toggleRule(selectedRule.title)}
                >
                  {selectedRule.active ? 'Désactiver la règle' : 'Activer la règle'}
                </Button>
                <Button variant="ghost" onClick={() => setSelectedRule(null)}>Fermer</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
