import { Check, CreditCard, Crown, Infinity as InfinityIcon } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { StateView } from "../../components/StateView";

const features = ["Необмежені цілі","Повний Oracle для кожної мети","Goal Focus без обмежень","Усі майбутні Pro-функції"];

export function PaywallScreens({ screenId = "paywall-lifetime", onNavigate = () => {} }) {
  if (screenId === "stripe-loading") return <AppFrame title="Оплата" noNav><section className="stripe-loading"><span><CreditCard size={34} weight="duotone" /></span><h1>Відкриваємо Stripe Checkout</h1><p>Тестовий платіж. Списання реальних коштів не відбудеться.</p><div className="loading-line"><span /></div><Button onClick={() => onNavigate("payment-success")}>Завершити демо-платіж</Button></section></AppFrame>;
  if (screenId === "payment-success") return <AppFrame title="Lifetime Pro" noNav><StateView state="success" title="Lifetime Pro активний" message="Тепер можеш додавати необмежену кількість цілей і будувати окремий шлях для кожної." action={<Button onClick={() => onNavigate("goals-default")}>Додати нову мету</Button>} /></AppFrame>;
  if (screenId === "payment-failed") return <AppFrame title="Оплата" noNav><StateView state="error" title="Платіж не завершено" message="Нічого не списано. Можеш повторити тестовий Checkout або повернутися до однієї мети." action={<div className="detail-actions"><Button onClick={() => onNavigate("stripe-loading")}>Спробувати ще раз</Button><Button variant="secondary" onClick={() => onNavigate("goals-default")}>Повернутися</Button></div>} /></AppFrame>;
  return <AppFrame title="Lifetime Pro" onBack={() => onNavigate("goal-add-second")} noNav><section className="paywall"><span className="paywall-icon"><Crown size={36} weight="duotone" /></span><p className="paywall-eyebrow">Один платіж. Назавжди.</p><h1>Більше цілей — більше ясності</h1><p>Купуєш один раз і користуєшся всіма Pro-функціями без підписки.</p><div className="price"><strong>$100</strong><span>одноразово</span></div><div className="paywall-features">{features.map((feature) => <span key={feature}><Check size={17} weight="bold" />{feature}</span>)}</div><Button icon={InfinityIcon} onClick={() => onNavigate("stripe-loading")}>Отримати Lifetime Pro</Button><small>Stripe Test Mode · це демонстраційна оплата</small></section></AppFrame>;
}
