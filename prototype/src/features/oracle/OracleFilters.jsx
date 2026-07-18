import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";

export function OracleFilters({ onClose }) {
  return <BottomSheet title="Фільтри Oracle" onClose={onClose} actions={<Button onClick={onClose}>Показати 12 вузлів</Button>}><div className="filter-groups"><label>Тип вузла<div><button className="is-active">Усі</button><button>Ідеї</button><button>Задачі</button><button>Проєкти</button></div></label><label>Відповідність меті<div><button>Висока</button><button className="is-active">Середня+</button></div></label><label>Період<select defaultValue="all"><option value="all">Увесь час</option><option>Цей місяць</option></select></label><label className="switch-row"><span>Лише рекомендований шлях</span><input type="checkbox" /></label></div></BottomSheet>;
}
