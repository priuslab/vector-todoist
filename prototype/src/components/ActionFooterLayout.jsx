export function ActionFooterLayout({
  children,
  footer,
  contentAlign = "start",
  footerRows = 1,
}) {
  return (
    <div
      className={`action-footer-layout action-footer-layout--${contentAlign} action-footer-layout--rows-${footerRows}`}
    >
      <div className="action-footer-layout__content" data-testid="action-footer-content">
        {children}
      </div>
      <footer className="action-footer-layout__footer" data-testid="action-footer">
        {footer}
      </footer>
    </div>
  );
}
