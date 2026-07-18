import { useEffect, useState } from "react";
import { completeGoogleLogin } from "./pocketBaseOAuth";

export function AuthCallback({ pb, onComplete }) {
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    completeGoogleLogin({ pb })
      .then(() => { if (active) onComplete?.(); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Не вдалося завершити вхід. Спробуй ще раз."); });
    return () => { active = false; };
  }, [pb, onComplete]);

  return <section className="auth-screen" role="status" aria-live="polite">
    <img className="vector-wordmark" src="/assets/vector-wordmark.png" alt="Вектор" />
    <div className="auth-loading">
      <h1>{error ? "Не вдалося увійти" : "Завершуємо вхід…"}</h1>
      <p>{error || "Перевіряємо дані Google. Це займе лише мить."}</p>
      {error ? <a className="button button--primary" href="/">Повернутися до входу</a> : <div className="loading-line"><span /></div>}
    </div>
  </section>;
}
