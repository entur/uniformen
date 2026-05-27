import { breakpoints, colors, space } from "@entur/tokens";
import { css, Style } from "hono/css";
import { Logo } from "./Logo";

const headerClass = css`
  background: ${colors.brand.blue};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const navClass = css`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 4rem;
  padding: 0 ${space.large}px;
  box-shadow:
    0px 0.3px 1px rgba(0, 0, 0, 0.02),
    0px 1.14px 4px rgba(0, 0, 0, 0.08);

  @media (max-width: ${breakpoints.large}px) {
    height: 3.5rem;
    padding: 0 ${space.medium}px;
    grid-template-columns: 2fr auto 1fr;
    column-gap: ${space.small}px;
  }
`;

const leftSlotClass = css`
  justify-self: start;
  display: flex;
  align-items: center;
  gap: ${space.small}px;
  min-width: 0;
`;

const centerSlotClass = css`
  justify-self: center;
  display: flex;
  align-items: center;
  min-width: 0;
`;

const rightSlotClass = css`
  justify-self: end;
  display: flex;
  align-items: center;
  gap: ${space.medium}px;
  min-width: 0;
`;

export function TopNavigation({ nonce }: { nonce: string }) {
  return (
    <>
      <Style nonce={nonce} />
      <header id="top-navigation" class={headerClass}>
        <nav class={navClass} aria-label="Toppnavigasjon">
          <div class={leftSlotClass}>
            <Logo appName="Portal" />
          </div>
          <div class={centerSlotClass}></div>
          <div class={rightSlotClass}></div>
        </nav>
      </header>
    </>
  );
}
