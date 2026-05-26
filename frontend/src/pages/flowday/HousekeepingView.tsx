/**
 * FLOWTYM — Housekeeping opérationnel.
 * Gestion des tâches de ménage par jour : assignation, statuts, suivi.
 */
import React, { useState, useMemo } from 'react';
import {
  Bed, RefreshCw, Plus, Search, Calendar, User, ChevronDown,
  CheckCircle2, Clock, AlertCircle, Filter, Users,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  useHkTasks, useHkStaff, useUpdateHkTaskStatus, useAssignHkTask, useCreateHkTask,
} from '@/src/domains/housekeeping/index';
import type { HkTask, HkStaff } from '@/src/domains/housekeeping/index';

// ─── Configs ─────────────────────────────────────────────────────────────────

const TASK_TYPE_LABEL: Record<HkTask['task_type'], string> = {
  cleaning:    'Ménage',
  inspection:  'Inspection',
  turndown:    'Couverture',
  deep_clean:  'Grand ménage',
  checkout:    'Départ',
};

const STATUS_CFG: Record<HkTask['status'], { label: string; color: string; bg: string; ring: string; icon: typeof CheckCircle2 }> = {
  pending:     { label: 'À faire',     color: 'text-slate-600',   bg: 'bg-slate-100',   ring: 'ring-slate-200',   icon: Clock        },
  in_progress: { label: 'En cours',    color: 'text-violet-700',  bg: 'bg-violet-50',   ring: 'ring-violet-200',  icon: RefreshCw    },
  done:        { label: 'Terminée',    color: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'ring-emerald-200', icon: CheckCircle2 },
  validated:   { label: 'Validée',     color: 'text-teal-700',    bg: 'bg-teal-50',     ring: 'ring-teal-200',    icon: CheckCircle2 },
  skipped:     { label: 'Ignorée',     color: 'text-red-600',     bg: 'bg-red-50',      ring: 'ring-red-200',     icon: AlertCircle  },
};

const PRIORITY_CFG: Record<HkTask['priority'], { label: string; color: string; dot: string }> = {
  low:    { label: 'Basse',   color: 'text-slate-500',  dot: 'bg-slate-300'  },
  normal: { label: 'Normal',  color: 'text-blue-600',   dot: 'bg-blue-400'   },
  high:   { label: 'Haute',   color: 'text-amber-600',  dot: 'bg-amber-400'  },
  urgent: { label: 'Urgent',  color: 'text-red-600',    dot: 'bg-red-500'    },
};

const STATUS_ORDER: HkTask['status'][] = ['pending','in_progress','done','validated','skipped'];
const NEXT_STATUS: Partial<Record<HkTask['status'], HkTask['status']>> = {
  pending:    'in_progress',
  in_progress:'done',
  done:       'validated',
};

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' });
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

interface CreateTaskModalProps {
  staff: HkStaff[];
  onClose: () => void;
  onSubmit: (v: { roomNumber: string; roomId: string; taskType: HkTask['task_type']; priority: HkTask['priority']; assignedTo?: string; notes?: string; scheduledFor: string }) => void;
  scheduledFor: string;
}

function CreateTaskModal({ staff, onClose, onSubmit, scheduledFor }: CreateTaskModalProps) {
  const [roomNumber, setRoomNumber] = useState('');
  const [taskType, setTaskType]     = useState<HkTask['task_type']>('cleaning');
  const [priority, setPriority]     = useState<HkTask['priority']>('normal');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes]           = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-[16px] font-bold text-gray-900 mb-4">Nouvelle tâche HK</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Chambre *</label>
            <input
              type="text" placeholder="ex. 101" value={roomNumber}
              onChange={e => setRoomNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Type</label>
              <select value={taskType} onChange={e => setTaskType(e.target.value as HkTask['task_type'])}
                className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400 bg-white">
                {Object.entries(TASK_TYPE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Priorité</label>
              <select value={priority} onChange={e => setPriority(e.target.value as HkTask['priority'])}
                className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400 bg-white">
                {Object.entries(PRIORITY_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Assigner à</label>
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400 bg-white">
              <option value="">— Non assignée —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Instructions particulières…"
              className="w-full px-3 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] outline-none focus:ring-violet-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl ring-1 ring-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            onClick={() => {
              if (!roomNumber.trim()) return;
              onSubmit({ roomNumber: roomNumber.trim(), roomId: '', taskType, priority, assignedTo: assignedTo || undefined, notes: notes.trim() || undefined, scheduledFor });
              onClose();
            }}
            className="flex-1 px-4 py-2 rounded-xl bg-violet-600 text-white text-[13px] font-semibold hover:bg-violet-700"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({ task, staff, onStatusChange, onAssign }: {
  task: HkTask; staff: HkStaff[];
  onStatusChange: (id: string, status: HkTask['status']) => void;
  onAssign: (taskId: string, staffId: string | null) => void;
}) {
  const cfg      = STATUS_CFG[task.status];
  const priCfg   = PRIORITY_CFG[task.priority];
  const Icon     = cfg.icon;
  const nextStat = NEXT_STATUS[task.status];
  const assigned = staff.find(s => s.id === task.assigned_to);

  return (
    <div className={cn('bg-white rounded-2xl ring-1 p-4 shadow-sm flex flex-col gap-2', cfg.ring)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
            <Icon size={14} className={cfg.color} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-800">Chambre {task.room_number}</p>
            <p className="text-[11px] text-slate-500">{TASK_TYPE_LABEL[task.task_type]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('w-2 h-2 rounded-full', priCfg.dot)} />
          <span className={cn('text-[10px] font-semibold', priCfg.color)}>{priCfg.label}</span>
        </div>
      </div>

      {/* Assignment */}
      <div className="flex items-center gap-1.5">
        <User size={11} className="text-slate-400 shrink-0" />
        <select
          value={task.assigned_to ?? ''}
          onChange={e => onAssign(task.id, e.target.value || null)}
          className="text-[11px] text-slate-600 bg-transparent outline-none flex-1 cursor-pointer"
        >
          <option value="">Non assignée</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
        </select>
      </div>

      {/* Notes */}
      {task.notes && <p className="text-[11px] text-slate-500 italic">{task.notes}</p>}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1', cfg.bg, cfg.ring, cfg.color)}>
          {cfg.label}
        </span>
        {nextStat && (
          <button
            onClick={() => onStatusChange(task.id, nextStat)}
            className="ml-auto text-[11px] font-semibold text-violet-600 hover:text-violet-800 px-2 py-1 rounded-lg hover:bg-violet-50"
          >
            → {STATUS_CFG[nextStat].label}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export const HousekeepingView: React.FC = () => {
  const [date, setDate]           = useState(today());
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<HkTask['status'] | 'ALL'>('ALL');
  const [showCreate, setShowCreate] = useState(false);

  const { data: rawTasks, isLoading: tasksLoading, refetch: refetchTasks } = useHkTasks(date);
  const { data: rawStaff, isLoading: staffLoading }  = useHkStaff();
  const tasks: HkTask[] = (rawTasks ?? []) as HkTask[];
  const staff: HkStaff[] = (rawStaff ?? []) as HkStaff[];
  const updateStatus = useUpdateHkTaskStatus();
  const assignTask   = useAssignHkTask();
  const createTask   = useCreateHkTask();

  const filtered = useMemo(() => {
    let list = tasks;
    if (statusFilter !== 'ALL') list = list.filter(t => t.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.room_number.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [tasks, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: tasks.length };
    for (const s of STATUS_ORDER) c[s] = tasks.filter(t => t.status === s).length;
    return c;
  }, [tasks]);

  const isLoading = tasksLoading || staffLoading;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8F9FD]">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 ring-1 ring-teal-100 flex items-center justify-center shrink-0">
              <Bed size={20} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-gray-900">Housekeeping</h1>
              <p className="text-[12.5px] text-gray-500 mt-0.5 capitalize">{fmtDate(date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400" />
            <button onClick={() => refetchTasks()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] font-medium text-slate-600 hover:bg-slate-50">
              <RefreshCw size={13} /> Actualiser
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-[12.5px] font-semibold hover:bg-violet-700">
              <Plus size={13} /> Nouvelle tâche
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',       value: counts.ALL,        color: 'text-slate-700',   bg: 'bg-slate-50'   },
            { label: 'À faire',     value: counts.pending,    color: 'text-slate-600',   bg: 'bg-slate-100'  },
            { label: 'En cours',    value: counts.in_progress,color: 'text-violet-600',  bg: 'bg-violet-50'  },
            { label: 'Terminées',   value: counts.done,       color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Validées',    value: counts.validated,  color: 'text-teal-600',    bg: 'bg-teal-50'    },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl ring-1 ring-slate-100 px-4 py-3 shadow-sm">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</p>
              <p className={cn('text-[22px] font-bold mt-0.5', k.color)}>{k.value ?? 0}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Chambre, notes…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white text-[12.5px] outline-none focus:ring-violet-400" />
          </div>
          <div className="flex items-center gap-1 bg-white ring-1 ring-slate-200 rounded-xl p-1">
            {(['ALL', ...STATUS_ORDER] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                  statusFilter === s ? 'bg-[#8B5CF6] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
                {s === 'ALL' ? 'Toutes' : STATUS_CFG[s].label}
                {counts[s] !== undefined && <span className="ml-1 opacity-60">({counts[s]})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Staff strip */}
        {staff.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Users size={11}/> Équipe :</span>
            {staff.map(s => (
              <div key={s.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-white ring-1 ring-slate-200 rounded-full text-[11px]">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ background: s.color || '#8B5CF6' }}>
                  {s.first_name[0]}{s.last_name[0]}
                </div>
                <span className="font-medium text-slate-700">{s.first_name}</span>
                <span className="text-slate-400">{tasks.filter(t => t.assigned_to === s.id).length} tâches</span>
              </div>
            ))}
          </div>
        )}

        {/* Task grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl ring-1 ring-slate-200">
            <Bed size={32} className="mb-3 opacity-30" />
            <p className="text-[13px] font-medium">Aucune tâche pour cette journée</p>
            <button onClick={() => setShowCreate(true)} className="mt-3 px-4 py-2 rounded-xl bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700">
              Créer une tâche
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(filtered as HkTask[]).map((task: HkTask) => (
              <TaskCard
                key={task.id}
                task={task}
                staff={staff}
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
                onAssign={(taskId, staffId) => assignTask.mutate({ taskId, staffId })}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTaskModal
          staff={staff}
          scheduledFor={date}
          onClose={() => setShowCreate(false)}
          onSubmit={v => createTask.mutate(v)}
        />
      )}
    </div>
  );
};
