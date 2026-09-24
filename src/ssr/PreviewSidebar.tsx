const SECTIONS = [
  { heading: "Oversikt", items: ["Dashbord", "Avvik", "Varsler"] },
  { heading: "Salg", items: ["Bestillinger", "Kunder", "Produkter", "Refusjoner"] },
  { heading: "Rapporter", items: ["Omsetning", "Reisemønster", "Eksport"] },
  { heading: "Administrasjon", items: ["Brukere", "Tilganger", "Innstillinger"] },
];

/**
 * Renders an example side navigation for the preview page, so the top bar's
 * collapse button has something to collapse. Uniformen does not ship a sidebar.
 *
 * It has no state of its own. CSS uses `data-uniformen-sidebar` on the root element
 * to collapse it. The texts are not translated, because it stands in for app
 * content and `?locale=` only applies to the header and footer.
 */
export function PreviewSidebar() {
  return (
    <aside class="preview-sidebar" aria-label="Sidemeny">
      <div class="preview-sidebar__inner">
        <div class="preview-sidebar__head">
          <span class="preview-sidebar__title">Meny</span>
          {/* Stands in for the app's own close button. It sets the same attribute as the
              top bar button. */}
          <button
            type="button"
            class="preview-sidebar__close"
            aria-label="Skjul sidemeny"
            data-preview-sidebar-close
          >
            ×
          </button>
        </div>
        <nav class="preview-sidebar__nav">
          {SECTIONS.map((section) => (
            <div class="preview-sidebar__section">
              <span class="preview-sidebar__heading">{section.heading}</span>
              <ul class="preview-sidebar__list">
                {section.items.map((item) => (
                  <li>
                    <a class="preview-sidebar__link" href="#">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
