import { GoogleLogo } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { StateView } from "../../components/StateView";

export function AuthStateScreen({ state, onContinue, onRetry }) {
  if (state === "loading") {
    return (
      <section className="auth-screen">
        <img className="vector-wordmark" src="/assets/vector-wordmark.png" alt="Вектор" />
        <div className="auth-loading"><span className="auth-logo"><GoogleLogo size={32} weight="duotone" /></span><h1>Підключаємо Google Calendar…</h1><p>Це допоможе знайти реальні вільні слоти й не накладати задачі на зустрічі.</p><div className="loading-line"><span /></div></div>
        <Button onClick={onContinue}>Продовжити демо</Button>
      </section>
    );
  }
  return <section className="auth-screen"><StateView state="error" title="Не вдалося увійти" message="Google не підтвердив вхід. Твої дані не змінено — спробуй ще раз." action={<Button onClick={onRetry}>Спробувати знову</Button>} /></section>;
}
