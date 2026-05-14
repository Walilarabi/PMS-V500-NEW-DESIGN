import React, { useState } from 'react';
import { LogIn, Building2, Sparkles } from 'lucide-react';

import { useAuth } from '@/src/domains/auth/AuthContext';
import { loginSchema, signupSchema } from '@/src/domains/auth/schemas';
import { DomainError } from '@/src/domains/_shared/errors';

type Mode = 'login' | 'signup';

export const LoginPage: React.FC = () => {
  const { login, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('walilarabi@gmail.com');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('Wali Larabi');
  const [hotelName, setHotelName] = useState('Flowtym Demo Hotel');
  const [tenantSlug, setTenantSlug] = useState('flowtym');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      className="min-h-screen w-full flex items-stretch bg-[#F7F6FB] font-sans"
    >
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-gradient-to-br from-[#1F1A2E] via-[#312E5B] to-[#5A3FA9] text-white p-14 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#8B5CF6]/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            <span className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur grid place-items-center">
              <Sparkles size={20} />
            </span>
            FLOWTYM
          </div>
          <p className="mt-2 text-sm text-white/60 uppercase tracking-[0.3em]">
            Property Management System
          </p>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Le PMS hôtelier <br />
            <span className="text-[#C4B5FD]">temps réel</span>, pensé pour les groupes
            modernes.
          </h1>
          <ul className="space-y-2 text-sm text-white/70">
            <li>· Multi-hôtels, multi-tenants stricts</li>
            <li>· Yield management & événementiel intégré</li>
            <li>· Conformité fiscale FR 2026 (FEC, UBL 2.1, PPF)</li>
          </ul>
        </div>
        <div className="relative z-10 text-xs text-white/40">
          © 2026 Flowtym Labs · Données chiffrées AES-256 · ISO 27001 ready
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white rounded-3xl shadow-[0_2px_30px_rgba(31,26,46,0.06)] border border-gray-100 p-10 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
          data-testid={mode === 'login' ? 'login-form' : 'signup-form'}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#8B5CF6] font-semibold">
              {mode === 'login' ? 'Bienvenue' : 'Créer mon compte'}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              {mode === 'login' ? 'Connexion à votre PMS' : 'Lancez votre tenant Flowtym'}
            </h2>
          </div>

          {mode === 'signup' && (
            <>
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
            </>
          )}

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            testid={`${mode}-email-input`}
          />
          <Field
            label="Mot de passe"
            type="password"
            value={password}
            onChange={setPassword}
            testid={`${mode}-password-input`}
          />

          {error && (
            <div
              data-testid="auth-error"
              className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid={`${mode}-submit-button`}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#8B5CF6] hover:bg-[#7C4DEF] active:bg-[#6D40DE] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-2xl px-6 py-3 transition-colors"
          >
            {mode === 'login' ? (
              <>
                <LogIn size={18} /> Se connecter
              </>
            ) : (
              <>
                <Building2 size={18} /> Créer mon tenant
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="toggle-auth-mode"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
            className="w-full text-sm text-gray-500 hover:text-[#8B5CF6] transition-colors"
          >
            {mode === 'login'
              ? "Pas encore de compte ? Créer un tenant"
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
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, type = 'text', placeholder, testid }) => (
  <label className="block">
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
    <input
      data-testid={testid}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1 w-full bg-[#F7F6FB] border border-transparent focus:border-[#8B5CF6] focus:bg-white outline-none rounded-xl px-4 py-3 text-sm text-gray-900 transition-colors"
      required
    />
  </label>
);

export default LoginPage;
