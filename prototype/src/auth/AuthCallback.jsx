import { useEffect, useRef, useState } from "react";
import { completeGoogleLogin } from "./pocketBaseOAuth";

export function AuthCallback({ pb, onComplete }) {
  const [hasError, setHasError] = useState(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    let active = true;
    completeGoogleLogin({ pb })
      .then(() => { if (active) onCompleteRef.current?.(); })
      .catch((reason) => {
        console.error("Помилка завершення входу через Google", reason);
        if (active) setHasError(true);
      });
    return () => { active = false; };
  }, [pb]);

  return <section className="auth-screen" role="status" aria-live="polite">
    <img className="vector-wordmark" src="/assets/vector-wordmark.png" alt="Вектор" />
    <div className="auth-loading">
      <h1>{hasError ? "Не вдалося увійти" : "Завершуємо вхід…"}</h1>
      <p>{hasError ? "Не вдалося завершити вхід. Твої дані не змінено — спробуй ще раз." : "Перевіряємо дані Google. Це займе лише мить."}</p>
      {hasError ? <a className="button button--primary" href="/">Повернутися до входу</a> : <div className="loading-line"><span /></div>}
    </div>
  </section>;
}
