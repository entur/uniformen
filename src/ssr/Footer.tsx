import type { Locale } from "../types";

const texts = {
  "nb-NO": { informasjon: "Informasjon", tjenester: "Tjenester" },
  "nn-NO": { informasjon: "Informasjon", tjenester: "Tenester" },
  "en-GB": { informasjon: "Information", tjenester: "Services" },
} as const;

export function Footer({ locale }: { locale: Locale }) {
  const txt = texts[locale];
  return (
    <footer id="footer">
      <div class="uniformen-footer__inner">
        <div class="uniformen-footer__sections" id="footer-sections">
          <section class="uniformen-footer__section">Entur AS</section>
          <section class="uniformen-footer__section">{txt.informasjon}</section>
          <section class="uniformen-footer__section">{txt.tjenester}</section>
        </div>
      </div>
    </footer>
  );
}
