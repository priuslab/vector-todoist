import { ChartLineUp, CheckCircle, MoonStars } from "@phosphor-icons/react";
import { Button } from "../../components/Button";
import { InlineInsight } from "../../components/InlineInsight";

export function EveningReview({ onFinish, insights = ["Складні задачі сьогодні зайняли на 12 хв більше.", "Короткі блоки допомогли втримати темп.", "Завтра можна залишити один головний фокус."] , onUpdateProfile = () => {} }) {
  return (
    <section className="evening-review">
      <span className="evening-icon"><MoonStars size={34} weight="duotone" /></span>
      <h1>День завершено</h1>
      <p>Без оцінок — лише короткий погляд на те, що спрацювало.</p>
      <div className="review-stats"><div><CheckCircle size={22} /><strong>4</strong><span>виконано</span></div><div><ChartLineUp size={22} /><strong>1</strong><span>перенесено</span></div><div><MoonStars size={22} /><strong>4 год</strong><span>фокус</span></div></div>
      {insights.slice(0, 3).map((insight) => <InlineInsight key={insight}>{insight}</InlineInsight>)}
      <div className="review-reflection"><strong>Що допомогло сьогодні?</strong><div><button>Тихий ранок</button><button>Короткі блоки</button><button>Чіткий план</button></div></div>
      <button className="button button--secondary" onClick={onUpdateProfile}>Оновити налаштування за цим спостереженням</button>
      <Button onClick={onFinish}>Завершити день</Button>
    </section>
  );
}
