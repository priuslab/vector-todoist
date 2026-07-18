import { useMemo, useState } from "react";
import { ArrowRight, MagnifyingGlass, Play } from "@phosphor-icons/react";
import { SCREEN_REGISTRY } from "./screenRegistry";

export function ScreenCatalog({ onOpen }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return SCREEN_REGISTRY.reduce((result, screen) => {
      if (normalized && !`${screen.title} ${screen.id} ${screen.group}`.toLowerCase().includes(normalized)) return result;
      (result[screen.group] ??= []).push(screen);
      return result;
    }, {});
  }, [query]);

  return (
    <section className="screen-catalog">
      <header className="catalog-header">
        <span className="catalog-mark"><Play size={18} weight="fill" /></span>
        <div><p>Вектор · prototype</p><h1>Каталог екранів</h1><span>82 стани · 12 груп</span></div>
      </header>
      <label className="catalog-search"><MagnifyingGlass size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Знайти екран або стан" /></label>
      <div className="catalog-groups">
        {Object.entries(groups).map(([group, screens]) => (
          <section className="catalog-group" key={group}>
            <div className="catalog-group__head"><h2>{group}</h2><span>{screens.length}</span></div>
            <div className="catalog-list">
              {screens.map((screen) => <button key={screen.id} onClick={() => onOpen(screen.id)}><span><strong>{screen.title}</strong><small>{screen.id}</small></span><i>{screen.kind}</i><ArrowRight size={17} /></button>)}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
