/**
 * FLOWTYM — LoginPage (nouveau design Mai 2026)
 * Intégré au système auth Flowtym : useAuth, loginSchema, DomainError.
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, Eye, EyeOff, Lock, Mail,
  BedDouble, CheckCircle2, ShieldCheck,
  ArrowUpRight, Sparkles, AlertTriangle,
  Building2, Receipt, Layers,
} from 'lucide-react';

import { useAuth } from '@/src/domains/auth/AuthContext';
import { loginSchema, signupSchema } from '@/src/domains/auth/schemas';
import { DomainError } from '@/src/domains/_shared/errors';

const C = {
  bg: '#fafafa', surface: '#ffffff',
  text: '#0f0a1e', textMuted: '#6b6574', textSubtle: '#9a94a3',
  border: '#e8e5eb',
  purple: '#7c3aed', purpleSoft: '#ede9fe',
  mint: '#10b981', mintLight: '#a7f3d0', mintSoft: '#d1fae5',
  orange: '#f59e0b', orangeSoft: '#fef3c7',
};

type Mode = 'login' | 'signup';

function FlowtymLogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/flowtym-logo.png" alt="Flowtym" width={size} height={size}
      className="block rounded-[22%] object-cover"
      style={{ width: size, height: size, boxShadow: '0 10px 28px rgba(0,0,0,0.25)' }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

function FeatureModules() {
  const features = [
    { icon: Layers,        title: 'RMS intégré',         desc: 'Pricing dynamique et stratégie tarifaire pilotée par les données.',       color: C.mint },
    { icon: AlertTriangle, title: 'Détection OTA',       desc: 'Anomalies tarifaires détectées automatiquement sur les canaux.',           color: C.orange },
    { icon: BedDouble,     title: 'Housekeeping',        desc: 'Application terrain dernière génération. Planning et contrôle qualité.',   color: '#a78bfa' },
    { icon: Building2,     title: 'Multi-hôtel',         desc: 'Vision consolidée et pilotage centralisé de votre portefeuille.',          color: '#818cf8' },
    { icon: Sparkles,      title: 'Maintenance',         desc: 'Suivi des interventions, prévention et alertes équipements en temps réel.',color: '#f472b6' },
    { icon: Receipt,       title: 'TVA & e-facturation', desc: 'Conformité FR 2026, génération automatique et archivage conforme.',        color: '#93c5fd' },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="grid grid-cols-2 gap-3">
      {features.map((f, i) => (
        <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl px-4 py-3.5 flex items-start gap-3"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <f.icon size={16} style={{ color: f.color }} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">{f.title}</div>
            <div className="text-[11.5px] leading-[1.5] mt-0.5" style={{ color: 'rgba(255,255,255,0.78)' }}>{f.desc}</div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function MiniDashboard() {
  const bars = [35, 52, 48, 67, 55, 72, 60, 82, 70, 78, 65, 88, 75, 92];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(12px)' }}>
      {/* Browser bar */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            {['rgba(251,113,133,0.7)', 'rgba(250,204,21,0.7)', 'rgba(74,222,128,0.7)'].map((bg, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: bg }} />
            ))}
          </div>
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.55)' }}>app.flowtym.com/dashboard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-pulse" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.mint }}>Live</span>
        </div>
      </div>
      <div className="p-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[{ label: 'Occupation', value: '87%', delta: '+4.2 pts' }, { label: 'ADR', value: '€147', delta: '+€12' }, { label: 'RevPAR', value: '€128', delta: '+18%' }].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.1 }}
              className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.65)' }}>{kpi.label}</div>
              <div className="text-[20px] font-bold tracking-tight mt-1 text-white">{kpi.value}</div>
              <div className="text-[11px] font-semibold mt-0.5" style={{ color: C.mintLight }}>{kpi.delta}</div>
            </motion.div>
          ))}
        </div>
        {/* Barchart */}
        <div className="rounded-lg px-4 py-3.5 mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.65)' }}>Revenus · 14 jours</span>
            <div className="flex items-center gap-1 text-[11px] font-bold" style={{ color: C.mintLight }}><ArrowUpRight size={12} />+12.4%</div>
          </div>
          <div className="flex items-end gap-[3px] h-14">
            {bars.map((h, i) => (
              <motion.div key={i} className="flex-1 rounded-[2px]" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                transition={{ delay: 0.85 + i * 0.03, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                style={{ height: `${h}%`, transformOrigin: 'bottom', background: i === 13 ? 'rgba(167,139,250,0.8)' : i >= 11 ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.14)' }} />
            ))}
          </div>
        </div>
        {/* OTA */}
        <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2"><AlertTriangle size={12} style={{ color: C.orange }} /><span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Monitoring OTA</span></div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: C.orangeSoft, color: '#92400e' }}>2 alertes</span>
          </div>
          {[{ text: 'Booking — Chambre Standard sous-évaluée de 12%', warn: true }, { text: 'Expedia — Disparité tarifaire détectée sur la Suite', warn: false }].map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 + i * 0.1 }} className="flex items-center gap-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.warn ? C.orange : '#ef4444' }} />
              <span className="text-[11px] flex-1 truncate" style={{ color: 'rgba(255,255,255,0.78)' }}>{a.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export const LoginPage: React.FC = () => {
  const { login, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(loginSchema.parse({ email, password }));
      } else {
        await signUp(signupSchema.parse({ email, password, fullName, tenantSlug, hotelName }));
      }
    } catch (err) {
      setError(err instanceof DomainError ? err.message : err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = (focused: boolean) => ({
    background: C.bg,
    border: `1px solid ${focused ? C.purple : C.border}`,
    boxShadow: focused ? `0 0 0 4px ${C.purpleSoft}` : '0 1px 2px rgba(15,10,30,0.02)',
  });

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── PANNEAU GAUCHE ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative overflow-hidden p-10 xl:p-14" style={{ background: '#8b5cf6' }}>
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-3 z-10">
          <FlowtymLogo size={46} />
          <div>
            <div className="text-[26px] font-bold tracking-tight"><span className="text-white">Flow</span><span style={{ color: '#a7f3d0' }}>tym</span></div>
            <div className="text-[10px] font-semibold tracking-[0.2em] uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>Property Management</div>
          </div>
        </motion.div>

        <div className="z-10 space-y-6 max-w-[620px] mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Sparkles size={12} className="text-white" />
            <span className="text-[11px] font-semibold tracking-widest uppercase text-white">PMS Nouvelle Génération</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="font-bold leading-[1.08] tracking-[-0.03em] text-white" style={{ fontSize: 'clamp(35px, 3.2vw, 50px)' }}>
            Pilotez. Détectez.<br /><span style={{ color: 'rgba(255,255,255,0.88)' }}>Optimisez.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26 }}
            className="text-[16px] leading-[1.7] max-w-[540px]" style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 400 }}>
            Flowtym centralise vos opérations hôtelières, détecte les anomalies de vos OTA et vous donne la maîtrise complète de votre performance — en temps réel.
          </motion.p>
          <FeatureModules />
          <MiniDashboard />
        </div>

        <div className="z-10 w-full max-w-[620px] mx-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.8 }} className="flex items-center gap-5 flex-wrap">
            {[{ icon: ShieldCheck, text: 'AES-256' }, { icon: Receipt, text: 'TVA 2026 & e-facturation' }, { icon: ShieldCheck, text: 'ISO 27001' }].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <item.icon size={12} style={{ color: 'rgba(255,255,255,0.6)' }} />
                <span className="text-[11.5px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.text}</span>
              </div>
            ))}
          </motion.div>
          <div className="mt-3 text-[11.5px]" style={{ color: 'rgba(255,255,255,0.55)' }}>© 2026 Flowtym Labs</div>
        </div>
      </div>

      {/* ── PANNEAU DROIT — Formulaire ────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-8 py-12 relative" style={{ background: C.surface }}>
        {/* Mobile logo */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex lg:hidden items-center gap-3 mb-10">
          <FlowtymLogo size={38} />
          <span className="text-[22px] font-bold tracking-tight"><span style={{ color: C.text }}>Flow</span><span style={{ color: C.mint }}>tym</span></span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[360px] relative z-10">

          {/* En-tête */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-5" style={{ background: C.mintSoft, border: '1px solid rgba(16,185,129,0.15)' }}>
              <CheckCircle2 size={10} style={{ color: C.mint }} />
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: C.mint }}>Accès sécurisé</span>
            </div>
            <h2 className="font-bold tracking-tight leading-none text-[24px]" style={{ color: C.text }}>
              {mode === 'login' ? 'Bon retour' : 'Créer un compte'}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed" style={{ color: C.textMuted }}>
              {mode === 'login' ? 'Connectez-vous à votre espace de pilotage.' : 'Lancez votre tenant Flowtym.'}
            </p>
          </div>

          {/* Erreur */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 px-4 py-3 rounded-xl text-[13px] font-medium"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold tracking-wide uppercase" style={{ color: C.textMuted }}>Adresse email</label>
              <div className="relative transition-all duration-200 rounded-xl overflow-hidden" style={fieldStyle(emailFocused)}>
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200" style={{ color: emailFocused ? C.purple : C.textSubtle }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)}
                  placeholder="prenom.nom@hotel.com" autoComplete="email" required
                  className="w-full pl-11 pr-4 py-3.5 bg-transparent text-[14px] transition-all" style={{ color: C.text, outline: 'none' }} />
              </div>
            </div>

            {/* Mot de passe */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold tracking-wide uppercase" style={{ color: C.textMuted }}>Mot de passe</label>
                {mode === 'login' && <button type="button" className="text-[11px] font-medium" style={{ color: C.purple }}>Oublié ?</button>}
              </div>
              <div className="relative transition-all duration-200 rounded-xl overflow-hidden" style={fieldStyle(pwFocused)}>
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200" style={{ color: pwFocused ? C.purple : C.textSubtle }} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setPwFocused(true)} onBlur={() => setPwFocused(false)}
                  placeholder="••••••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required
                  className="w-full pl-11 pr-12 py-3.5 bg-transparent text-[14px] transition-all" style={{ color: C.text, outline: 'none' }} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-200" style={{ color: C.textSubtle }}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Champs signup */}
            {mode === 'signup' && (
              <>
                {[
                  { label: 'Nom complet', value: fullName, onChange: setFullName, placeholder: 'Prénom Nom', type: 'text' },
                  { label: "Nom de l'hôtel", value: hotelName, onChange: setHotelName, placeholder: 'Hôtel de la Paix', type: 'text' },
                  { label: 'Identifiant tenant', value: tenantSlug, onChange: (v: string) => setTenantSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-')), placeholder: 'mon-hotel', type: 'text' },
                ].map((field) => (
                  <div key={field.label} className="space-y-1.5">
                    <label className="block text-[11px] font-semibold tracking-wide uppercase" style={{ color: C.textMuted }}>{field.label}</label>
                    <input type={field.type} value={field.value} onChange={e => field.onChange(e.target.value)} placeholder={field.placeholder} required
                      className="w-full px-4 py-3.5 rounded-xl text-[14px] transition-all"
                      style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, outline: 'none' }} />
                  </div>
                ))}
              </>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button type="submit" disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[14px] text-white transition-all duration-200"
                style={{ background: isLoading ? 'rgba(124,58,237,0.7)' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', boxShadow: isLoading ? 'none' : '0 4px 14px rgba(124,58,237,0.35)', letterSpacing: '-0.01em' }}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    Connexion...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">{mode === 'login' ? 'Se connecter' : 'Créer le compte'} <ArrowRight size={15} /></div>
                )}
              </button>
            </div>
          </form>

          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px" style={{ background: C.border }} />
            <span className="text-[11px] font-medium" style={{ color: C.textSubtle }}>ou</span>
            <div className="flex-1 h-px" style={{ background: C.border }} />
          </div>

          <button type="button" className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-[13px] font-medium transition-all duration-200"
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textMuted, boxShadow: '0 1px 2px rgba(15,10,30,0.02)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            Connexion SSO entreprise
          </button>

          <p className="mt-8 text-center text-[12px] font-medium" style={{ color: C.textSubtle }}>
            {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            <button type="button" onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null); }}
              className="font-semibold transition-colors duration-200" style={{ color: C.purple }}>
              {mode === 'login' ? 'Demander une démo' : 'Se connecter'}
            </button>
          </p>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(250,250,250,0.8), transparent)' }} />
      </div>
    </div>
  );
};
