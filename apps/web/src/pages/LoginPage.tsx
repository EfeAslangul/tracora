import { useState, type FormEvent } from 'react';
import { useAuth } from '../features/auth/auth-context';

type Mode = 'signIn' | 'signUp';

/**
 * Web istemcisi ileride sıfırdan yazılacağı için burada mevcut stil sınıfları
 * kullanılır; yeni bir tasarım sistemi kurulmaz. Apple ile Giriş yalnız iOS
 * istemcisinde gerekli olduğu için web'e eklenmemiştir.
 */
export function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(
        mode === 'signUp'
          ? 'Kayıt tamamlanamadı. E-posta kullanımda olabilir ya da şifre çok zayıf.'
          : 'Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.',
      );
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() =>
      mode === 'signIn' ? auth.signIn(email, password) : auth.signUp(email, password),
    );
  }

  if (!auth.configured) {
    return (
      <section className="content narrow">
        <div className="state-card error" role="alert">
          Firebase yapılandırılmamış. <code>.env</code> içindeki <code>VITE_FIREBASE_*</code>{' '}
          değerlerini doldurup sayfayı yenileyin.
        </div>
      </section>
    );
  }

  return (
    <section className="content narrow" aria-labelledby="login-title">
      <h1 id="login-title">{mode === 'signIn' ? 'Giriş yapın' : 'Hesap oluşturun'}</h1>
      <form className="setup-form" onSubmit={submit}>
        <fieldset className="url-row">
          <legend>Hesap bilgileri</legend>
          <label>
            E-posta
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Şifre
            <input
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </fieldset>

        {error === null ? null : (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}

        <div className="actions">
          <button className="button primary" type="submit" disabled={busy}>
            {mode === 'signIn' ? 'Giriş yap' : 'Kayıt ol'}
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={() => void run(() => auth.signInWithGoogle())}
          >
            Google ile devam et
          </button>
        </div>

        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
          }}
        >
          {mode === 'signIn'
            ? 'Hesabınız yok mu? Kayıt olun'
            : 'Zaten hesabınız var mı? Giriş yapın'}
        </button>
      </form>
    </section>
  );
}
