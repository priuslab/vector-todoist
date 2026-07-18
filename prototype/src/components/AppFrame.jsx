import { ActionFooterLayout } from "./ActionFooterLayout";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

export function AppFrame({
  children,
  title,
  eyebrow,
  onBack,
  activeRoute,
  onNavigate,
  noNav = false,
  avatar = false,
  className = "",
  footer,
  contentAlign = "start",
  footerRows = 1,
}) {
  return (
    <section className={`app-frame ${footer ? "app-frame--with-footer" : ""} ${className}`.trim()}>
      {title ? <TopBar title={title} eyebrow={eyebrow} onBack={onBack} avatar={avatar} /> : null}
      {footer ? (
        <ActionFooterLayout footer={footer} contentAlign={contentAlign} footerRows={footerRows}>
          {children}
        </ActionFooterLayout>
      ) : (
        <div className="app-frame__scroll" data-testid="app-frame-scroll">{children}</div>
      )}
      {!noNav ? <BottomNav active={activeRoute} onNavigate={onNavigate} /> : null}
    </section>
  );
}
