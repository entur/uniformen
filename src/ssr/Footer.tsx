import { colors, space } from "@entur/tokens";
import { css, Style } from "hono/css";

const footerClass = css`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: start;
  padding: ${space.large}px;
  background: ${colors.brand.blue};
`;

const sectionsContainerClass = css`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: start;
  width: 100%;
`;

const sectionClass = css`
  color: white;
`;

export function Footer({ nonce }: { nonce: string }) {
  return (
    <>
      <Style nonce={nonce} />
      <footer id="footer">
        <div class={footerClass}>
          <div class={sectionsContainerClass} id="footer-sections">
            <section class={sectionClass}>Entur AS</section>
            <section class={sectionClass}>Informasjon</section>
            <section class={sectionClass}>Tjenester</section>
          </div>
        </div>
      </footer>
    </>
  );
}
