import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isValidEmail } from '../../utils/leadHelpers';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { BrandMark, BrandPanel } from './BrandPanel';
import { MailLoader } from '../ui/MailLoader';

const MIN_NEW_PASSWORD = 8;

/**
 * Requires a Supabase sign-in when the app is configured for Supabase.
 * Without configuration the app runs on browser storage, as before.
 */
export function AuthGate({ children }: { children: (session: Session | null) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  // Set when the user arrives from a password-reset email.
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return <>{children(null)}</>;
  if (session === undefined) return <MailLoader />;
  if (recovering && session) return <AuthLayout><SetNewPassword onDone={() => setRecovering(false)} /></AuthLayout>;
  if (!session) return <AuthLayout><AuthForms /></AuthLayout>;
  return <>{children(session)}</>;
}

export function FullScreenMessage({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-ui text-ink-3">{children}</div>;
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />
      <main className="flex flex-col px-5 py-8 sm:px-10">
        {/* The brand panel is hidden below lg; keep the mark visible. */}
        <div className="lg:hidden">
          <BrandMark tone="light" />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

type Mode = 'signin' | 'signup' | 'forgot';

/** Turns Supabase's messages into plain guidance. */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return "That email and password don't match. Check them and try again.";
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the link we sent.';
  if (m.includes('already registered')) return 'An account with this email already exists. Sign in instead.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('failed to fetch') || m.includes('network')) return "Couldn't reach the server. Check your connection.";
  return message;
}

function AuthForms() {
  const uid = useId();
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
    setFieldErrors({});
    setPassword('');
    window.setTimeout(() => (next === 'signup' ? nameRef : emailRef).current?.focus(), 0);
  };

  const validate = () => {
    const next: typeof fieldErrors = {};
    if (mode === 'signup' && !fullName.trim()) next.name = 'Enter your name.';
    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email, like name@company.com.';
    if (mode !== 'forgot') {
      if (!password) next.password = 'Enter your password.';
      else if (mode === 'signup' && password.length < MIN_NEW_PASSWORD)
        next.password = `Use at least ${MIN_NEW_PASSWORD} characters.`;
    }
    setFieldErrors(next);
    if (next.name) nameRef.current?.focus();
    else if (next.email) emailRef.current?.focus();
    else if (next.password) passwordRef.current?.focus();
    return !next.name && !next.email && !next.password;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || busy || !validate()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const addr = email.trim();
      if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(addr, {
          redirectTo: window.location.origin,
        });
        if (err) throw err;
        setNotice(`If an account exists for ${addr}, a reset link is on its way.`);
        return;
      }
      const res =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email: addr, password })
          : await supabase.auth.signUp({
              email: addr,
              password,
              // Used as the profile name on first sign-in.
              options: { data: { full_name: fullName.trim() } },
            });
      if (res.error) throw res.error;
      if (mode === 'signup' && !res.data.session) {
        setMode('signin');
        setPassword('');
        setNotice(`We sent a confirmation link to ${addr}. Confirm it, then sign in.`);
      }
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : 'Something went wrong. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const copy = {
    signin: { title: 'Welcome back', sub: 'Sign in to continue to your workspace.', cta: 'Sign in' },
    signup: { title: 'Create your account', sub: 'Start organizing your outreach in minutes.', cta: 'Create account' },
    forgot: { title: 'Reset your password', sub: "Enter your email and we'll send you a reset link.", cta: 'Send reset link' },
  }[mode];

  const passwordField = mode !== 'forgot' && (
    <Field
      label="Password"
      htmlFor={`${uid}-password`}
      error={fieldErrors.password}
      hint={mode === 'signup' && !fieldErrors.password ? <StrengthHint password={password} /> : undefined}
    >
      <Input
        ref={passwordRef}
        id={`${uid}-password`}
        type={showPassword ? 'text' : 'password'}
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        value={password}
        invalid={Boolean(fieldErrors.password)}
        leadingIcon={<Lock />}
        className="[&_input]:h-10"
        onChange={(e) => {
          setPassword(e.target.value);
          if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
        }}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="flex size-7 items-center justify-center rounded text-ink-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />
    </Field>
  );

  return (
    <div>
      {mode === 'forgot' && (
        <button
          type="button"
          onClick={() => switchTo('signin')}
          className="mb-6 inline-flex items-center gap-1.5 rounded text-ui text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </button>
      )}
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">{copy.title}</h1>
      <p className="mt-1.5 text-sm text-ink-3">{copy.sub}</p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {error && <Callout tone="error">{error}</Callout>}
        {notice && <Callout tone="success">{notice}</Callout>}

        {mode === 'signup' && (
          <Field label="Full name" htmlFor={`${uid}-name`} error={fieldErrors.name}>
            <Input
              ref={nameRef}
              id={`${uid}-name`}
              autoComplete="name"
              autoFocus
              placeholder="Jane Cooper"
              value={fullName}
              invalid={Boolean(fieldErrors.name)}
              leadingIcon={<UserRound />}
              className="[&_input]:h-10"
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
              }}
            />
          </Field>
        )}

        <Field label="Email" htmlFor={`${uid}-email`} error={fieldErrors.email}>
          <Input
            ref={emailRef}
            id={`${uid}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus={mode !== 'signup'}
            placeholder="name@company.com"
            value={email}
            invalid={Boolean(fieldErrors.email)}
            leadingIcon={<Mail />}
            className="[&_input]:h-10"
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
          />
        </Field>

        {passwordField}

        {mode === 'signin' && (
          <div className="-mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => switchTo('forgot')}
              className="rounded text-ui font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Forgot password?
            </button>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          className="h-10! w-full bg-ink! text-canvas hover:bg-ink/90! active:bg-ink-2! disabled:bg-ink/60!"
        >
          {busy ? (mode === 'signin' ? 'Signing in…' : mode === 'signup' ? 'Creating account…' : 'Sending…') : copy.cta}
        </Button>
      </form>

      {mode !== 'forgot' && (
        <p className="mt-8 border-t border-line pt-6 text-ui text-ink-3">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => switchTo(mode === 'signin' ? 'signup' : 'signin')}
            className="rounded font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      )}
    </div>
  );
}

/** Shown after following a reset link: the user is signed in and picks a new password. */
function SetNewPassword({ onDone }: { onDone: () => void }) {
  const uid = useId();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    if (password.length < MIN_NEW_PASSWORD) return setFieldError(`Use at least ${MIN_NEW_PASSWORD} characters.`);
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    onDone();
  };

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-ink-3">You'll use it the next time you sign in.</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        {error && <Callout tone="error">{error}</Callout>}
        <Field label="New password" htmlFor={`${uid}-new`} error={fieldError} hint={!fieldError ? `At least ${MIN_NEW_PASSWORD} characters.` : undefined}>
          <Input
            id={`${uid}-new`}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            value={password}
            invalid={Boolean(fieldError)}
            leadingIcon={<Lock />}
            className="[&_input]:h-10"
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldError('');
            }}
            trailing={
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                className="flex size-7 items-center justify-center rounded text-ink-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={busy}
          className="h-10! w-full bg-ink! text-canvas hover:bg-ink/90! active:bg-ink-2! disabled:bg-ink/60!"
        >
          {busy ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </div>
  );
}

function Callout({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-2.5 rounded-md border px-3 py-2.5 text-ui',
        tone === 'error' ? 'border-danger-line bg-danger-soft text-danger' : 'border-success-line bg-success-soft text-success'
      )}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

/** Live password guidance on sign-up: length first, then a simple strength read. */
function StrengthHint({ password }: { password: string }) {
  const variety = [/[a-z]/, /[A-Z]/, /d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const level = password.length < MIN_NEW_PASSWORD ? 0 : password.length >= 12 && variety >= 3 ? 3 : variety >= 2 ? 2 : 1;
  const label = ['At least ' + MIN_NEW_PASSWORD + ' characters.', 'Weak: add numbers or symbols.', 'Good.', 'Strong.'][level];
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 w-6 rounded-full',
              level >= i ? (level === 1 ? 'bg-warning' : 'bg-success') : 'bg-muted'
            )}
          />
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}
