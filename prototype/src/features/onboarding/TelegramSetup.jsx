import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { AppFrame } from "../../components/AppFrame";
import { Button } from "../../components/Button";
import { StateView } from "../../components/StateView";

export function TelegramSetup({ screenId, onBack, onNext }) {
  const footerByScreen = {
    "telegram-connect": <><Button onClick={onNext}>Відкрити Telegram</Button><button className="text-action" onClick={onNext}>Підключити пізніше</button></>,
    "telegram-success": <Button onClick={onNext}>Продовжити</Button>,
    "first-brain-dump": <Button onClick={onNext}>Спробувати зараз</Button>,
  };

  return (
    <AppFrame
      title="Telegram"
      eyebrow="Крок 4 з 4"
      onBack={onBack}
      noNav
      footer={footerByScreen[screenId]}
      footerRows={screenId === "telegram-connect" ? 2 : 1}
      contentAlign="center"
    >
      {screenId === "telegram-connect" ? <><div className="onboarding-hero"><span><PaperPlaneTilt size={34} weight="duotone" /></span><h1>Нагадування там, де ти їх побачиш</h1><p>Надсилай голосові думки в Telegram і отримуй ранковий план, нагадування та м'яке перепланування.</p></div><div className="telegram-preview"><strong>Вектор у Telegram</strong><span>«План змінився — я знайшов новий час.»</span><span>«Хочеш розбити цю ідею на задачі?»</span></div></> : null}
      {screenId === "telegram-success" ? <StateView state="success" title="Telegram підключено" message="Тепер можеш диктувати думки в боті й отримувати нагадування без шуму." /> : null}
      {screenId === "first-brain-dump" ? <><div className="onboarding-hero"><span><CheckCircle size={34} weight="duotone" /></span><h1>Усе готово, Олено</h1><p>Скажи все, що зараз у голові. Вектор сам відокремить задачі від ідей і знайде для них місце.</p></div><div className="first-dump-card"><PaperPlaneTilt size={26} /><strong>Перший Brain Dump</strong><span>Голосом або текстом — як зручніше</span></div></> : null}
    </AppFrame>
  );
}
