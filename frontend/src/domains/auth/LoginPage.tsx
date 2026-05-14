import React, { useState } from 'react';
import {
  Activity,
  BedDouble,
  Building2,
  Circle,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wrench,
} from 'lucide-react';

import { useAuth } from '@/src/domains/auth/AuthContext';
import { loginSchema, signupSchema } from '@/src/domains/auth/schemas';
import { DomainError } from '@/src/domains/_shared/errors';

type Mode = 'login' | 'signup';

export const LoginPage: React.FC = () => {
  const { login, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('Wali Larabi');
  const [hotelName, setHotelName] = useState('Flowtym Demo Hotel');
  const [tenantSlug, setTenantSlug] = useState('flowtym');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const parsed = loginSchema.parse({ email, password });
        await login(parsed);
      } else {
        const parsed = signupSchema.parse({
          email,
          password,
          fullName,
          tenantSlug,
          hotelName,
        });
        await signUp(parsed);
      }
    } catch (err) {
      if (err instanceof DomainError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError('Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="login-page"
      className="min-h-screen w-full bg-white font-sans text-slate-900 lg:grid lg:grid-cols-[53%_47%]"
    >
      <BrandPanel />

      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:px-16">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[360px] space-y-5"
          data-testid={mode === 'login' ? 'login-form' : 'signup-form'}
        >
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-600 ring-1 ring-emerald-100">
              <ShieldCheck size={12} />
              Accès sécurisé
            </span>
            <div className="space-y-1">
              <h2 className="text-[22px] font-extrabold tracking-[-0.04em] text-[#191923]">
                {mode === 'login' ? 'Bon retour' : 'Créer votre accès'}
              </h2>
              <p className="text-[12px] font-medium leading-5 text-slate-500">
                {mode === 'login'
                  ? 'Connectez-vous à votre espace de pilotage.'
                  : 'Demandez un accès à votre espace Flowtym.'}
              </p>
            </div>
          </div>

          {mode === 'signup' && (
            <div className="space-y-3">
              <Field
                label="Nom complet"
                value={fullName}
                onChange={setFullName}
                testid="signup-fullname-input"
              />
              <Field
                label="Nom de l'hôtel"
                value={hotelName}
                onChange={setHotelName}
                testid="signup-hotel-input"
              />
              <Field
                label="Identifiant tenant"
                value={tenantSlug}
                onChange={(v) => setTenantSlug(v.toLowerCase())}
                testid="signup-tenant-input"
                placeholder="ex. flowtym"
              />
            </div>
          )}

          <Field
            label="Adresse email"
            type="email"
            value={email}
            onChange={setEmail}
            testid={`${mode}-email-input`}
            placeholder="prenom.nom@hotel.com"
            icon={<Mail size={14} />}
          />
          <Field
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            testid={`${mode}-password-input`}
            placeholder="••••••••••••"
            icon={<Lock size={14} />}
            trailing={
              <button
                type="button"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                onClick={() => setShowPassword((value) => !value)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-[#8B5CF6]"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />

          {error && (
            <div
              data-testid="auth-error"
              className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-600"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid={`${mode}-submit-button`}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] px-6 text-[12px] font-extrabold text-white shadow-[0_12px_24px_rgba(139,92,246,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#7C3AED] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mode === 'login' ? (
              <>
                {submitting ? 'Connexion...' : 'Se connecter'}
                <LogIn size={14} />
              </>
            ) : (
              <>
                {submitting ? 'Demande en cours...' : 'Demander un accès'}
                <Building2 size={14} />
              </>
            )}
          </button>

          <div className="flex items-center gap-4 py-1">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
              ou
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-500 transition-colors hover:border-[#8B5CF6]/40 hover:text-[#8B5CF6]"
          >
            <KeyRound size={13} />
            Connexion SSO entreprise
          </button>

          <button
            type="button"
            data-testid="toggle-auth-mode"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
            className="w-full text-center text-[11px] font-medium text-slate-400 transition-colors hover:text-[#8B5CF6]"
          >
            {mode === 'login'
              ? "Pas encore de compte ? Demander une démo"
              : 'Déjà un compte ? Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  testid?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  testid,
  icon,
  trailing,
}) => (
  <label className="block">
    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
      {label}
    </span>
    <span className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-transparent bg-[#F6F4FA] px-3 transition-all focus-within:border-[#8B5CF6]/50 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.08)]">
      {icon && <span className="text-slate-400">{icon}</span>}
      <input
        data-testid={testid}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
        required
      />
      {trailing}
    </span>
  </label>
);

const BrandPanel: React.FC = () => (
  <section className="relative hidden min-h-screen overflow-hidden bg-[radial-gradient(circle_at_16%_8%,rgba(255,255,255,0.18),transparent_30%),linear-gradient(150deg,#9B5CFF_0%,#8B5CF6_48%,#7C4DFF_100%)] px-16 py-12 text-white lg:flex lg:flex-col">
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:72px_72px] opacity-10" />
    <div className="relative z-10 flex items-start justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#5B21B6] shadow-[0_10px_30px_rgba(49,18,97,0.35)]">
          <Sparkles size={18} />
        </span>
        <div>
          <div className="text-[18px] font-black tracking-[-0.05em]">Flowtym</div>
          <div className="mt-0.5 text-[8px] font-black uppercase tracking-[0.32em] text-white/60">
            Property Management
          </div>
        </div>
      </div>
    </div>

    <div className="relative z-10 mx-auto mt-10 w-full max-w-[590px]">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/80 backdrop-blur">
        <Sparkles size={12} />
        PMS nouvelle génération
      </div>
      <h1 className="max-w-[430px] text-[48px] font-black leading-[0.95] tracking-[-0.065em]">
        Pilotez. Détectez. Optimisez.
      </h1>
      <p className="mt-5 max-w-[520px] text-[13px] font-semibold leading-6 text-white/68">
        Flowtym centralise vos opérations hôtelières, détecte les anomalies de vos OTA et vous
        donne la maîtrise complète de votre performance — en temps réel.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <FeatureCard
          icon={<Database size={15} />}
          title="RMS intégré"
          text="Pricing dynamique et stratégie tarifaire pilotée par les données."
        />
        <FeatureCard
          icon={<TriangleAlert size={15} />}
          title="Détection OTA"
          text="Anomalies tarifaires détectées automatiquement sur vos canaux."
        />
        <FeatureCard
          icon={<BedDouble size={15} />}
          title="Housekeeping"
          text="Assignation terrain, statuts, planning et suivi centralisé."
        />
        <FeatureCard
          icon={<Building2 size={15} />}
          title="Multi-hôtel"
          text="Vision consolidée et pilotage centralisé de votre portefeuille."
        />
        <FeatureCard
          icon={<Wrench size={15} />}
          title="Maintenance"
          text="Suivi des interventions, prévention et alertes d’exploitation."
        />
        <FeatureCard
          icon={<ReceiptText size={15} />}
          title="TVA & e-facturation"
          text="Conformité FR 2026, génération automatique et archivage."
        />
      </div>

      <div className="mt-8 rounded-2xl border border-white/12 bg-white/10 p-4 shadow-[0_28px_80px_rgba(53,22,134,0.28)] backdrop-blur-md">
        <div className="flex items-center justify-between text-[9px] font-bold text-white/50">
          <div className="flex items-center gap-2">
            <Circle size={6} className="fill-[#34D399] text-[#34D399]" />
            app.flowtym.com
          </div>
          <span className="text-emerald-300">Live</span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metric label="Occupation" value="87%" delta="+4.2 pts" />
          <Metric label="ADR" value="€147" delta="+€12" />
          <Metric label="RevPAR" value="€128" delta="+15%" />
        </div>

        <div className="mt-5 rounded-xl bg-white/8 p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/55">
              Revenus · 14 jours
            </span>
            <span className="text-[10px] font-black text-emerald-300">+12.4%</span>
          </div>
          <div className="flex h-12 items-end gap-2">
            {[34, 48, 42, 60, 53, 68, 58, 72, 50, 74, 70, 62, 78, 88].map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t bg-white/22"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <AlertRow icon={<TriangleAlert size={12} />} label="Booking — Chambres Standard sous-évaluées de 12%" badge="2 alertes" />
          <AlertRow icon={<Activity size={12} />} label="Expedia — Écart tarifaire détecté sur 5 dates" />
        </div>

        <div className="mt-4 rounded-xl bg-white/8 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[28px] font-black leading-none">4.6</div>
              <div className="mt-1 text-[10px] font-bold text-amber-200">★ ★ ★ ★ ☆</div>
            </div>
            <div className="w-2/3 space-y-2">
              <Score label="Propreté" value={96} color="bg-emerald-300" />
              <Score label="Accueil" value={91} color="bg-cyan-300" />
              <Score label="Chambres" value={82} color="bg-violet-200" />
              <Score label="Services" value={76} color="bg-amber-300" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-5 text-[10px] font-semibold text-white/42">
        <span> AES-256</span>
        <span>TVA 2026 & e-facturation</span>
        <span>ISO 27001</span>
      </div>
    </div>
  </section>
);

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  text: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, text }) => (
  <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm ring-1 ring-white/10">
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-emerald-200">
        {icon}
      </span>
      <div>
        <div className="text-[11px] font-black tracking-[-0.02em]">{title}</div>
        <p className="mt-1 text-[9px] font-semibold leading-4 text-white/52">{text}</p>
      </div>
    </div>
  </div>
);

const Metric: React.FC<{ label: string; value: string; delta: string }> = ({ label, value, delta }) => (
  <div className="rounded-xl bg-white/10 p-3">
    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-white/45">{label}</div>
    <div className="mt-2 text-[22px] font-black leading-none tracking-[-0.05em]">{value}</div>
    <div className="mt-1 text-[9px] font-bold text-white/45">{delta}</div>
  </div>
);

const AlertRow: React.FC<{ icon: React.ReactNode; label: string; badge?: string }> = ({
  icon,
  label,
  badge,
}) => (
  <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-white/62">
    <div className="flex items-center gap-2">
      <span className="text-amber-300">{icon}</span>
      <span>{label}</span>
    </div>
    {badge && (
      <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[8px] font-black text-amber-900">
        {badge}
      </span>
    )}
  </div>
);

const Score: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="grid grid-cols-[64px_1fr_28px] items-center gap-2">
    <span className="text-[9px] font-bold text-white/55">{label}</span>
    <span className="h-1.5 overflow-hidden rounded-full bg-white/12">
      <span className={`block h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </span>
    <span className="text-right text-[8px] font-black text-white/45">{value}%</span>
  </div>
);

export default LoginPage;
