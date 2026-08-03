const SECTIONS = [
  { heading: "Oversikt", items: ["Dashbord", "Avvik", "Varsler"] },
  { heading: "Salg", items: ["Bestillinger", "Kunder", "Produkter", "Refusjoner"] },
  { heading: "Rapporter", items: ["Omsetning", "Reisemønster", "Eksport"] },
  { heading: "Administrasjon", items: ["Brukere", "Tilganger", "Innstillinger"] },
];

/**
 * Stand-in for a consuming app's side navigation, so the top bar's collapse
 * control has something to collapse. Preview page only — Uniformen ships no
 * sidebar.
 *
 * Written the way apps should write one: the collapsed width is CSS keyed off
 * `data-uniformen-sidebar` on the root element (see the preview's own styles), and
 * the close button in the header writes that same attribute. Nothing here mirrors
 * the top bar's state or listens for an event.
 *
 * No locale: it stands in for app content, and `?locale=` is the chrome only.
 */
export function PreviewSidebar() {
  return (
    <aside class="preview-sidebar" aria-label="Sidemeny">
      <div class="preview-sidebar__inner">
        <div class="preview-sidebar__head">
          <span class="preview-sidebar__title">Meny</span>
          {/* The app's own control: writes the attribute, same as the top bar button. */}
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
