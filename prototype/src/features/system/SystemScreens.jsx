import { ArrowsClockwise, CheckCircle, CloudSlash, Trash, WarningCircle } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { StateView } from "../../components/StateView";
import { UndoSnackbar } from "../../components/UndoSnackbar";

function Skeletons() {
  return <div className="skeleton-page" aria-label="Завантаження"><span className="skeleton-title" /><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card skeleton-card--short" /></div>;
}

export function SystemScreens({ screenId, onNavigate = () => {} }) {
  if (screenId === "system-skeletons") return <AppFrame title="Завантаження" noNav><Skeletons /></AppFrame>;
  if (screenId === "system-undo") return <AppFrame title="Сьогодні" activeRoute="today-normal" onNavigate={onNavigate}><StateView state="success" title="Зміни застосовано" message="Лист Марії перенесено на 12:30." /><UndoSnackbar message="1 задачу перенесено" onUndo={() => {}} /></AppFrame>;
  if (screenId === "system-confirmation") return <AppFrame title="Підтвердження" noNav><section className="confirmation"><span><Trash size={32} weight="duotone" /></span><h1>Видалити цю чернетку?</h1><p>Цю ручну дію не можна скасувати. Задачі та ідеї, створені з чернетки, залишаться.</p><div className="detail-actions"><Button variant="danger">Видалити чернетку</Button><Button variant="secondary" onClick={() => onNavigate("inbox-default")}>Залишити</Button></div></section></AppFrame>;
  if (screenId === "system-offline") return <AppFrame title="Вектор" noNav><StateView state="offline" title="Ти офлайн" message="Можеш переглядати план і записувати думки. Вони синхронізуються, коли повернеться інтернет." action={<Button variant="secondary" icon={CloudSlash}>Продовжити офлайн</Button>} /></AppFrame>;
  return <AppFrame title="Вектор" noNav><StateView state="error" title="Щось пішло не так" message="Твої дані збережено. Спробуй оновити екран або повернутися до плану." action={<div className="detail-actions"><Button icon={ArrowsClockwise}>Оновити</Button><Button variant="secondary" onClick={() => onNavigate("today-normal")}>До плану</Button></div>} /></AppFrame>;
}
