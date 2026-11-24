import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { type ChatAccessToken, chatProxyConfig, issueChatToken } from "../chat/chatProxy";
import { environment as runningEnvironment, type Environment } from "../config";
import type { UserMenuUser } from "../components/UserMenu";
import { Footer } from "./Footer";
import { PreviewControls, previewViewer } from "./PreviewControls";
import { PreviewSidebar } from "./PreviewSidebar";
import { renderComponentToString } from "./renderComponentToString";
import { sha256Source } from "./sha256";
import { TopNavigation } from "./TopNavigation";
import { renderUniformenScripts, uniformenScriptsHash } from "./uniformenScripts";
import { renderUniformenHeadScript, uniformenHeadScriptHash } from "./uniformenHeadScript";
import { renderUniformenStyleTag, uniformenCssHash } from "./uniformenStyles";
import { topNavigationProps, uniformenQuerySchema } from "./uniformenQuery";
import notificationsDummyData from "./notificationsDummyData.json";
import { decodeJwt } from "jose";
import { componentVariables, semantic } from "@entur/tokens";
import { notificationService } from "../auth/notifications";
import type { Notifications } from "../types";
import { uniformenOrigin } from "../auth/browserTokens";
import { logger } from "../logging/logger";

// Colours from the Entur design system, so the controls look like its components.
const formComponents = componentVariables.light.components.form;
const formField = formComponents.baseForm.standard;
const panel = formComponents.basePanel.standard;
const checkbox = formComponents.checkbox.standard;
const radio = formComponents.radio.standard;
const primaryButton = componentVariables.light.components.button.primary.standard;
const secondaryButton = componentVariables.light.components.button.secondary.standard;
const negative = semantic.fill.negative;
const tint = semantic.fill.background.tint.light;
const divider = semantic.fill.selected.default.neutral;

/** Returns an SVG icon as a URL for CSS. */
function svgUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const checkIcon = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="${checkbox.icon}" stroke-width="2"/></svg>`,
);
const chevronIcon = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="${formField.icon}" stroke-width="1.5"/></svg>`,
);

// Base styles for the preview page: fonts and layout. It is a constant so its exact
// text can be hashed for the CSP `style-src` directive.
const PREVIEW_BASE_CSS = `
                    @font-face {
                      font-family: "Nationale";
                      font-weight: 300;
                      src: url("/static/fonts/Entur-Nationale-Light.woff2") format("woff2");
                    }

                    @font-face {
                      font-family: "Nationale";
                      font-weight: 500;
                      src: url("/static/fonts/Entur-Nationale-Medium.woff2") format("woff2");
                    }

                    @font-face {
                      font-family: "Nationale";
                      font-weight: 600;
                      src: url("/static/fonts/Entur-Nationale-Demibold.woff2") format("woff2");
                    }

                    *, *::before, *::after { box-sizing: border-box; }

                    html, body {
                        margin: 0;
                        padding: 0;
                    }

                    /* min-height, not height. A sticky element only sticks inside its
                       parent, so a body as high as the window would let the bar scroll
                       away at the bottom of a long page. */
                    html { height: 100%; }
                    body { min-height: 100%; }

                    body {
                        font-family: Nationale, sans-serif;
                        font-weight: 500;
                        display: flex;
                        flex-direction: column;
                        background: ${tint};
                    }
                    main { flex: 1 0 auto; display: flex; }

                    /* With contrast=true or in dark mode the app's page behind the
                       header is dark, so the preview page is dark too. The header
                       colours are hard to judge on a white page. The controls keep
                       their white card. */
                    body.preview--contrast,
                    [data-color-mode="dark"] body { background: #08091c; }

                    /* Dark colours for the example sidebar, so it can be read on the
                       dark page. */
                    :is(.preview--contrast, [data-color-mode="dark"]) .preview-sidebar { border-right-color: #393d79; }
                    :is(.preview--contrast, [data-color-mode="dark"]) :is(.preview-sidebar__title, .preview-sidebar__close, .preview-sidebar__link) { color: #ffffff; }
                    :is(.preview--contrast, [data-color-mode="dark"]) .preview-sidebar__heading { color: #aeb7e2; }
                    :is(.preview--contrast, [data-color-mode="dark"]) :is(.preview-sidebar__close:hover, .preview-sidebar__link:hover) { background: #393d79; }

                    /* Example side navigation, for testing the collapse button by hand.
                       The width animates. The inner column has a fixed width, so the
                       content slides out of view instead of wrapping. */
                    .preview-sidebar {
                        width: 16rem;
                        flex: 0 0 auto;
                        overflow: hidden;
                        border-right: 1px solid #e5e5e9;
                        transition: width 150ms ease, visibility 150ms ease;
                    }

                    /* Zero width alone does not remove the links from the tab order or
                       from screen readers. visibility: hidden does. Because visibility
                       has a transition, the content stays visible until the animation
                       ends. */
                    :root[data-uniformen-sidebar="collapsed"] .preview-sidebar {
                        width: 0;
                        visibility: hidden;
                    }

                    .preview-sidebar__inner {
                        width: 16rem;
                        height: 100%;
                        padding: 1rem 0.75rem;
                        overflow-y: auto;
                    }

                    .preview-sidebar__head {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 0 0.5rem 0.75rem;
                    }

                    .preview-sidebar__title {
                        font-weight: 600;
                        font-size: 1rem;
                        color: #181c56;
                    }

                    .preview-sidebar__close {
                        border: 0;
                        background: none;
                        padding: 0 0.25rem;
                        font: inherit;
                        font-size: 1.25rem;
                        line-height: 1;
                        color: #181c56;
                        cursor: pointer;
                        border-radius: 0.25rem;
                    }

                    .preview-sidebar__close:hover { background: #e9eaf3; }

                    .preview-sidebar__nav {
                        display: flex;
                        flex-direction: column;
                        gap: 1.25rem;
                    }

                    .preview-sidebar__heading {
                        display: block;
                        padding: 0 0.5rem 0.375rem;
                        font-size: 0.75rem;
                        font-weight: 600;
                        letter-spacing: 0.03em;
                        text-transform: uppercase;
                        color: #6b708f;
                    }

                    .preview-sidebar__list {
                        list-style: none;
                        margin: 0;
                        padding: 0;
                    }

                    .preview-sidebar__link {
                        display: block;
                        padding: 0.4375rem 0.5rem;
                        border-radius: 0.25rem;
                        font-size: 0.875rem;
                        color: #181c56;
                        text-decoration: none;
                        white-space: nowrap;
                    }

                    .preview-sidebar__link:hover { background: #e9eaf3; }

                    /* Keep the bar in view while the controls scroll, so every change
                       can be seen at once. This applies only to the preview page. */
                    #top-navigation {
                        position: sticky;
                        top: 0;
                        /* Greyed-out controls use opacity, which paints them above an
                           element without a z-index. This keeps the bar on top. */
                        z-index: 10;
                    }

                    /* The controls, in the content area. The colours and sizes are
                       the ones the Entur design system uses for its form components.

                       Three columns: the box for the left part of the bar, the middle
                       column, and the box for the right part. The middle column has
                       the card with the other controls and, below it, the code. */
                    .preview-controls {
                        display: grid;
                        grid-template-columns: minmax(14rem, 17rem) minmax(0, 1fr) minmax(15rem, 20rem);
                        grid-template-rows: auto 1fr;
                        grid-template-areas: "left card right" "left code right";
                        align-items: start;
                        gap: 0.75rem;
                        padding: 0.75rem 1rem 1.5rem;
                        color: ${formField.textContent};
                        font-size: 0.875rem;
                        line-height: 1.25rem;
                    }

                    /* The boxes and the card are items of the grid above, even though
                       they are inside the form. */
                    .preview-controls__form { display: contents; }

                    .preview-controls__section--left { grid-area: left; }
                    .preview-controls__section--right { grid-area: right; }
                    .preview-controls__card { grid-area: card; }
                    .preview-code { grid-area: code; }

                    /* The widths depend on the space next to the example sidebar, so
                       they use a container query. */
                    .preview-content {
                        flex: 1 1 auto;
                        min-width: 0;
                        container-type: inline-size;
                    }

                    @container (max-width: 66rem) {
                        .preview-controls {
                            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                            grid-template-rows: auto;
                            grid-template-areas: "left right" "card card" "code code";
                        }
                    }

                    @container (max-width: 38rem) {
                        .preview-controls {
                            grid-template-columns: minmax(0, 1fr);
                            grid-template-areas: "card" "left" "right" "code";
                        }
                    }

                    /* Read by screen readers, but not shown. */
                    .preview-controls__visually-hidden {
                        position: absolute;
                        width: 1px;
                        height: 1px;
                        overflow: hidden;
                        clip-path: inset(50%);
                        white-space: nowrap;
                    }

                    .preview-controls__form > .preview-controls__section,
                    .preview-controls__card,
                    .preview-code {
                        min-width: 0;
                        padding: 1rem;
                        border: 0;
                        border-radius: 0.5rem;
                        background: #ffffff;
                        box-shadow: 0 1px 3px rgba(8, 9, 28, 0.1);
                    }

                    .preview-controls__form > .preview-controls__section .preview-controls__fields {
                        grid-template-columns: minmax(0, 1fr);
                    }

                    .preview-controls__card {
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .preview-controls__title {
                        margin: 0;
                        font-size: 1.25rem;
                        font-weight: 600;
                        line-height: 1.75rem;
                    }

                    .preview-controls__error,
                    .preview-controls__note {
                        margin: 0;
                        padding: 0.5rem 0.75rem;
                        border-radius: 0.25rem;
                    }

                    .preview-controls__error {
                        border-left: 4px solid ${negative.deep};
                        background: ${negative.muted};
                    }

                    .preview-controls__note { background: ${tint}; }

                    .preview-controls__section {
                        margin: 0;
                        padding: 1rem 0 0;
                        border: 0;
                        border-top: 1px solid ${divider};
                        min-width: 0;
                    }

                    .preview-controls__section-title {
                        float: left;
                        width: 100%;
                        padding: 0 0 0.5rem;
                        font-size: 1rem;
                        font-weight: 600;
                    }

                    .preview-controls__section--right .preview-controls__section-title {
                        text-align: right;
                    }

                    /* Two columns where there is room, one column on narrow screens. */
                    .preview-controls__fields {
                        clear: both;
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
                        gap: 0.75rem 1rem;
                    }

                    .preview-controls__field--wide,
                    .preview-controls__person { grid-column: 1 / -1; }

                    .preview-controls__person {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
                        gap: 0.75rem 1rem;
                        margin: 0;
                        padding: 0;
                        border: 0;
                        min-width: 0;
                    }

                    .preview-controls__person[hidden] { display: none; }

                    .preview-controls__field {
                        display: flex;
                        flex-direction: column;
                        gap: 0.375rem;
                        min-width: 0;
                    }

                    /* A control that has no effect with the other choices. It still
                       works, so its value is kept for later. */
                    .preview-controls__field--inactive > :not(.preview-controls__inactive) {
                        opacity: 0.45;
                    }

                    .preview-controls__inactive {
                        font-size: 0.8125rem;
                        font-style: italic;
                        color: ${panel.textSubdued};
                    }

                    .preview-controls__head {
                        display: flex;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 0.5rem;
                    }

                    .preview-controls__label { font-weight: 600; }

                    /* The query parameter, as a small tag like the package names on
                       the design system's pages. */
                    .preview-controls__param {
                        padding: 0 0.25rem;
                        border: 1px solid ${formField.borderDefault};
                        border-radius: 0.125rem;
                        font-family: ui-monospace, monospace;
                        font-size: 0.6875rem;
                        font-weight: 400;
                        line-height: 1rem;
                        color: ${panel.textSubdued};
                    }

                    .preview-controls__hint {
                        font-size: 0.8125rem;
                        color: ${panel.textSubdued};
                    }

                    /* Text fields and menus with the label inside the box. */
                    .preview-controls__input {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        min-height: 2.5rem;
                        padding: 0.125rem 0.75rem;
                        border: 2px solid ${formField.borderDefault};
                        border-radius: 0.25rem;
                        background: ${formField.fillDefault};
                        cursor: text;
                        transition: border-color 100ms ease-in-out;
                    }

                    .preview-controls__input:hover,
                    .preview-controls__input:focus-within {
                        border-color: ${formField.borderInteractive};
                    }

                    .preview-controls__input:has(select) { cursor: pointer; }

                    .preview-controls__input-label {
                        display: flex;
                        align-items: center;
                        gap: 0.375rem;
                        font-size: 0.6875rem;
                        line-height: 1rem;
                        color: ${formField.textLabel};
                    }

                    .preview-controls__input-label .preview-controls__param {
                        padding: 0;
                        border: 0;
                        line-height: inherit;
                    }

                    .preview-controls__select,
                    .preview-controls__text {
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        border: 0;
                        background: transparent;
                        font: inherit;
                        line-height: 1.25rem;
                        color: ${formField.textContent};
                        outline: none;
                    }

                    .preview-controls__text::placeholder { color: ${panel.textSubdued}; opacity: 0.7; }

                    .preview-controls__select {
                        appearance: none;
                        padding-right: 1.5rem;
                        background: url("${chevronIcon}") no-repeat right center / 1rem;
                        cursor: pointer;
                    }

                    .preview-controls__row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.375rem;
                    }

                    /* The panels in a row share the width. In a narrow box they are
                       one below the other. */
                    .preview-controls__row > * { flex: 1 1 auto; }

                    .preview-controls__choices {
                        display: flex;
                        flex-direction: column;
                        gap: 0.375rem;
                    }

                    .preview-controls__section--viewer .preview-controls__choices {
                        flex-direction: row;
                        flex-wrap: wrap;
                    }

                    /* Checkboxes and radio buttons in panels with a large click area,
                       like the checkbox panel in the design system. The first line of
                       text is as high as the checkbox, so they line up. */
                    .preview-controls__choice,
                    .preview-controls__check {
                        display: grid;
                        grid-template-columns: auto 1fr;
                        align-items: center;
                        align-content: start;
                        column-gap: 0.5rem;
                        row-gap: 0.125rem;
                        padding: 0.5rem 0.75rem;
                        border: 2px solid ${panel.borderDefault};
                        border-radius: 0.25rem;
                        background: #ffffff;
                        cursor: pointer;
                        transition: background 100ms ease-in-out, border-color 100ms ease-in-out;
                    }

                    .preview-controls__choice input { grid-row: span 2; align-self: start; margin-top: 0.0625rem; }

                    .preview-controls__choice .preview-controls__head {
                        min-height: 1.25rem;
                        font-weight: 500;
                    }

                    .preview-controls__choice .preview-controls__hint { grid-column: 2; }

                    /* A link panel: the checkbox row, and the path field below it when
                       the box is checked. The path lines up with the label text. */
                    .preview-controls__link {
                        display: flex;
                        flex-direction: column;
                        gap: 0.375rem;
                        padding: 0.5rem 0.75rem;
                        border: 2px solid ${panel.borderDefault};
                        border-radius: 0.25rem;
                        background: #ffffff;
                        transition: background 100ms ease-in-out, border-color 100ms ease-in-out;
                    }

                    .preview-controls__link:hover { background: ${panel.fillHover}; }

                    .preview-controls__link:has(:checked) {
                        border-color: ${panel.borderSelected};
                        background: ${panel.fillSelected};
                    }

                    .preview-controls__link .preview-controls__choice {
                        padding: 0;
                        border: 0;
                        background: none;
                    }

                    .preview-controls__path {
                        width: calc(100% - 1.625rem);
                        margin-left: 1.625rem;
                        padding: 0.25rem 0.5rem;
                        border: 1px solid ${formField.borderDefault};
                        border-radius: 0.25rem;
                        background: #ffffff;
                        font-family: ui-monospace, monospace;
                        font-size: 0.8125rem;
                        color: ${formField.textContent};
                    }

                    .preview-controls__path:hover,
                    .preview-controls__path:focus { border-color: ${formField.borderInteractive}; outline: none; }
                    .preview-controls__choices > .preview-controls__choice { flex: 1 1 9rem; }

                    .preview-controls__choice:hover,
                    .preview-controls__check:hover { background: ${panel.fillHover}; }

                    .preview-controls__choice:has(:checked),
                    .preview-controls__check:has(:checked) {
                        border-color: ${panel.borderSelected};
                        background: ${panel.fillSelected};
                    }

                    .preview-controls__choice:has(:focus-visible),
                    .preview-controls__check:has(:focus-visible),
                    .preview-controls__input:has(:focus-visible),
                    .preview-controls__path:focus-visible {
                        outline: 2px solid ${formField.borderInteractive};
                        outline-offset: 2px;
                    }

                    /* The locked language cannot be changed, so it does not look
                       clickable. */
                    .preview-controls__check:has(:disabled) { cursor: default; }
                    .preview-controls__check:has(:disabled):hover { background: ${panel.fillSelected}; }

                    /* Checkboxes and radio buttons drawn like the ones in the design
                       system, with a 2 pixel border. */
                    .preview-controls__form input:is([type="checkbox"], [type="radio"]) {
                        appearance: none;
                        flex: 0 0 auto;
                        width: 1.125rem;
                        height: 1.125rem;
                        margin: 0;
                        border: 2px solid ${checkbox.border};
                        background: ${checkbox.fillDefault} no-repeat center / 0.75rem;
                        cursor: inherit;
                        outline: none;
                    }

                    .preview-controls__form input[type="checkbox"] { border-radius: 0.125rem; }
                    .preview-controls__form input[type="radio"] { border-radius: 50%; }

                    .preview-controls__form input[type="checkbox"]:checked {
                        background-color: ${checkbox.fillSelected};
                        background-image: url("${checkIcon}");
                    }

                    /* A white ring inside the border leaves a dot in the middle. */
                    .preview-controls__form input[type="radio"]:checked {
                        background: ${radio.fillSelected};
                        box-shadow: inset 0 0 0 3px #ffffff;
                    }

                    .preview-controls__form input[type="checkbox"]:disabled {
                        border-color: ${panel.textSubdued};
                        background-color: ${panel.textSubdued};
                    }

                    .preview-controls__actions {
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                    }

                    /* Buttons like the primary and secondary buttons in the design
                       system. */
                    .preview-controls__submit {
                        min-height: 2.25rem;
                        padding: 0 1rem;
                        border: 0;
                        border-radius: 0.25rem;
                        background: ${primaryButton.default};
                        color: ${primaryButton.text};
                        font: inherit;
                        font-weight: 500;
                        cursor: pointer;
                    }

                    .preview-controls__submit:hover { background: ${primaryButton.hover}; }
                    .preview-controls__submit:active { background: ${primaryButton.active}; }

                    .preview-controls__reset {
                        font-weight: 500;
                        color: ${formField.textContent};
                    }

                    /* The code that fetches the layout, and the link to this view. */
                    .preview-code {
                        display: flex;
                        flex-direction: column;
                        gap: 0.75rem;
                    }

                    .preview-code__title {
                        margin: 0;
                        font-size: 1rem;
                        font-weight: 600;
                    }

                    .preview-code__subtitle {
                        margin: 0.25rem 0 -0.375rem;
                        font-size: 0.875rem;
                        font-weight: 600;
                    }

                    .preview-code__head {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        justify-content: space-between;
                        gap: 0.75rem;
                    }

                    /* The tabs look like the segmented control in the design system. */
                    .preview-code__tabs {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.25rem;
                        padding: 0.25rem;
                        border-radius: 0.375rem;
                        background: ${divider};
                    }

                    .preview-code__tab {
                        display: flex;
                        align-items: center;
                        padding: 0.375rem 0.75rem;
                        border-radius: 0.25rem;
                        font-family: ui-monospace, monospace;
                        font-size: 0.8125rem;
                        cursor: pointer;
                    }

                    /* The radio button is hidden but can still be focused. */
                    .preview-code__tab input {
                        position: absolute;
                        opacity: 0;
                        pointer-events: none;
                    }

                    .preview-code__tab:has(:checked) {
                        background: #ffffff;
                        box-shadow: 0 1px 2px rgba(8, 9, 28, 0.15);
                    }

                    .preview-code__tab:has(:focus-visible) {
                        outline: 2px solid ${formField.borderInteractive};
                        outline-offset: 2px;
                    }

                    .preview-code__block,
                    .preview-controls__url-text {
                        margin: 0;
                        padding: 1rem;
                        border-radius: 0.25rem;
                        background: ${tint};
                        font-family: ui-monospace, monospace;
                        font-size: 0.8125rem;
                        line-height: 1.5;
                    }

                    .preview-code__block { overflow-x: auto; }

                    .preview-controls__url {
                        display: flex;
                        align-items: flex-start;
                        gap: 0.75rem;
                    }

                    /* The link wraps at any character, so the box does not scroll
                       sideways. */
                    .preview-controls__url-text {
                        flex: 1 1 auto;
                        min-width: 0;
                        overflow-wrap: anywhere;
                    }

                    .preview-controls__copy {
                        flex: 0 0 auto;
                        min-height: 2rem;
                        padding: 0 0.75rem;
                        border: 2px solid ${secondaryButton.border};
                        border-radius: 0.25rem;
                        background: #ffffff;
                        color: ${secondaryButton.text};
                        font: inherit;
                        font-size: 0.875rem;
                        font-weight: 500;
                        white-space: nowrap;
                        cursor: pointer;
                    }

                    .preview-controls__copy:hover { background: ${secondaryButton.hover}; }

                    /* Show only the block for the checked tab. */
                    .preview-code:has([value=layout]:checked) [data-preview-code=react],
                    .preview-code:has([value=react]:checked) [data-preview-code=layout] {
                        display: none;
                    }
`.trim();

/**
 * Script for the preview page. It does what a consuming app would do.
 *
 * The example sidebar's close button sets the sidebar attribute on the root element,
 * like the top bar button does. On a `uniformen:locale` event the page reloads with
 * the new `locale` in the URL. A real app would save the choice, for example in a
 * cookie, and reload.
 *
 * The form handlers submit the form on every change. On submit they disable empty
 * controls, because a form would send them as `app=` and the schema rejects empty
 * values. A disabled field is not submitted.
 */
const PREVIEW_SCRIPT = `(${function previewHandlers() {
  const close = document.querySelector("[data-preview-sidebar-close]");
  close?.addEventListener("click", () => {
    document.documentElement.setAttribute("data-uniformen-sidebar", "collapsed");
  });

  window.addEventListener("uniformen:locale", (event) => {
    const url = new URL(window.location.href);
    url.searchParams.set("locale", event.detail.locale);
    window.location.assign(url.toString());
  });

  const controls = document.querySelector<HTMLFormElement>("[data-preview-controls]");
  controls?.addEventListener("submit", () => {
    // "Hvem ser på?" sets debugUser and debugEnturUser. A signed-in user needs a
    // name, so fill in the default name when the field is empty.
    const viewer = controls.querySelector<HTMLInputElement>("[data-preview-viewer]:checked");
    const person = controls.querySelector<HTMLFieldSetElement>("[data-preview-person]");
    const userName = controls.querySelector<HTMLInputElement>("input[name=debugUser]");
    const entur = controls.querySelector<HTMLInputElement>("[data-preview-entur]");
    if (viewer && person && userName && entur) {
      const signedIn = viewer.value !== "anonymous";
      person.disabled = !signedIn;
      if (signedIn && !userName.value.trim()) userName.value = userName.dataset["default"] ?? "";
      entur.disabled = viewer.value !== "entur";
    }

    // "Varsler" sets hideNotifications, or debugNotifications when it is not the
    // default "max".
    const notifications = controls.querySelector<HTMLInputElement>(
      "[data-preview-notifications]:checked",
    )?.value;
    const hide = controls.querySelector<HTMLInputElement>("[data-preview-hide-notifications]");
    const count = controls.querySelector<HTMLInputElement>("[data-preview-notifications-count]");
    if (notifications && hide) hide.disabled = notifications !== "hidden";
    if (notifications && count) {
      count.value = notifications;
      count.disabled = notifications === "hidden" || notifications === "max";
    }

    // A checked link box turns its path on. An empty path gets the default path.
    for (const toggle of controls.querySelectorAll<HTMLInputElement>("[data-preview-link]")) {
      const path = controls.querySelector<HTMLInputElement>(
        `[name=${toggle.dataset["previewLink"]}]`,
      );
      if (!path) continue;
      path.disabled = !toggle.checked;
      if (toggle.checked && !path.value.trim()) path.value = path.dataset["default"] ?? "";
    }

    // The radio buttons and boxes above are not parameters, so they are not submitted.
    const helpers = controls.querySelectorAll<HTMLInputElement>(
      "[data-preview-viewer], [data-preview-notifications], [data-preview-link]",
    );
    for (const helper of helpers) helper.disabled = true;

    const fields = controls.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input[type=text], select",
    );
    for (const field of fields) if (!field.value) field.disabled = true;

    // The hidden entry in `availableLocales` is the locale the page was rendered in. If
    // the user picked a new locale, check its box too, because the schema rejects a list
    // without `locale`. If no other box is checked, there is no list, so drop the hidden
    // entry as well.
    const boxes = [
      ...controls.querySelectorAll<HTMLInputElement>("input[type=checkbox][name=availableLocales]"),
    ];
    const locale = controls.querySelector<HTMLInputElement>("input[name=locale]:checked");
    const locked = controls.querySelector<HTMLInputElement>("[data-preview-locale]");
    if (boxes.some((box) => box.checked)) {
      for (const box of boxes) if (box.value === locale?.value) box.checked = true;
    } else if (locked) {
      locked.disabled = true;
    }
  });

  // Submit on every change. Checkboxes and menus fire `change` when picked, and a
  // text field fires it only when it loses focus, not on every key.
  const FOCUS_KEY = "uniformen-preview-focus";
  controls?.addEventListener("change", (event) => {
    const field = event.target;
    // Submitting loads a new page, which loses focus and scroll position. Save the
    // control's name and value and the scroll position, so they can be restored, even
    // if the form renders differently.
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
      sessionStorage.setItem(FOCUS_KEY, `${field.name}\n${field.value}\n${window.scrollY}`);
    }
    controls.requestSubmit();
  });

  const [name = "", value = "", scroll = ""] = (sessionStorage.getItem(FOCUS_KEY) ?? "").split(
    "\n",
  );
  sessionStorage.removeItem(FOCUS_KEY);
  if (scroll) window.scrollTo(0, Number(scroll));
  if (controls && name) {
    // Radio buttons and checkboxes share a name, so use the value to find the right one.
    // If that finds nothing, for example for a text field, find the control by name only.
    const field =
      (value &&
        controls.querySelector<HTMLElement>(
          `[name=${CSS.escape(name)}][value=${CSS.escape(value)}]`,
        )) ||
      controls.querySelector<HTMLElement>(`[name=${CSS.escape(name)}]`);
    field?.focus({ preventScroll: true });
  }

  // Copies `text` and shows the result on the button. If the clipboard is blocked, it
  // selects `printed` instead, so the user can copy it.
  async function copyText(button: Element, text: string, printed: Element | null) {
    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Kopiert";
    } catch {
      if (printed) window.getSelection()?.selectAllChildren(printed);
      button.textContent = "Merket";
    }
    window.setTimeout(() => (button.textContent = label), 1500);
  }

  const copy = document.querySelector("[data-preview-copy]");
  copy?.addEventListener("click", async () => {
    // Copy the URL printed on the page, not the one in the address bar. The printed URL
    // is built from the validated query and has no extra parameters.
    const printed = document.querySelector("[data-preview-url]");
    await copyText(copy, new URL(printed?.textContent ?? "", window.location.href).href, printed);
  });

  // The page reloads on every change, so store the picked code tab and check it again
  // after the reload. Storage can be blocked. Then the first tab is shown.
  const TAB_KEY = "uniformen-preview-code";
  const tabs = [...document.querySelectorAll<HTMLInputElement>("[data-preview-code-tab]")];
  try {
    const stored = tabs.find((tab) => tab.value === localStorage.getItem(TAB_KEY));
    if (stored) stored.checked = true;
  } catch {}
  for (const tab of tabs) {
    tab.addEventListener("change", () => {
      try {
        localStorage.setItem(TAB_KEY, tab.value);
      } catch {}
    });
  }

  const copyCode = document.querySelector("[data-preview-copy-code]");
  copyCode?.addEventListener("click", async () => {
    const checked = tabs.find((tab) => tab.checked)?.value;
    const printed = document.querySelector(`[data-preview-code=${checked}]`);
    await copyText(copyCode, printed?.textContent ?? "", printed);
  });
}
  .toString()
  .trim()})();`;

const previewBaseCssHash = await sha256Source(PREVIEW_BASE_CSS);
const previewScriptHash = await sha256Source(PREVIEW_SCRIPT);

// CSP that only allows the inline scripts and styles this page renders, by hash.
const previewCsp = [
  `script-src ${uniformenHeadScriptHash} ${uniformenScriptsHash} ${previewScriptHash}`,
  `style-src ${previewBaseCssHash} ${uniformenCssHash}`,
  `connect-src 'self' ${uniformenOrigin}`,
].join("; ");

/**
 * Query parameters for the preview page. These are the `/ssr` parameters plus some
 * for testing by hand, which start with `debug`.
 *
 * Do not add the `debug` parameters to the shared schema. On `/ssr` they would let
 * any page show any name as the signed-in user. The user must come from the token.
 */
const previewQuerySchema = uniformenQuerySchema.extend({
  // Any text up to 120 characters. The text is not validated, so you can test long
  // names and odd values.
  debugUser: z.string().min(1).max(120).optional(),
  debugOrganisation: z.string().min(1).max(120).optional(),
  // Whether to render the bar for an Entur user. In `/ssr` this comes from the token.
  // The preview page has no token, so it is a parameter here.
  debugEnturUser: z.enum(["true", "false"]).optional(),
  debugNotifications: z.enum(["none", "some", "max"]).optional(),
  // The value for `data-color-mode` on the page's `<html>`. In an app, the app sets
  // this attribute, so it is not a parameter of `/ssr`.
  colorMode: z.enum(["light", "dark"]).optional(),
});

export type PreviewQuery = z.infer<typeof previewQuerySchema>;

/**
 * Returns the user to render the preview bar for. Returns `undefined`, which renders
 * the anonymous bar, when `debugUser` is missing or the environment is production.
 *
 * Production ignores the parameters, because a production link that shows a
 * signed-in user with no real session would be misleading. `environment` is a
 * parameter so tests can check the production case.
 */
export function previewUser(
  { debugUser, debugOrganisation }: Pick<PreviewQuery, "debugUser" | "debugOrganisation">,
  environment: Environment = runningEnvironment,
): UserMenuUser | undefined {
  if (environment === "production" || !debugUser) return undefined;
  return { name: debugUser, subtitle: debugOrganisation };
}

/**
 * Turns the made-up notifications into a list the bar can render.
 *
 * The items have no `markAsReadToken`, so the markup has nothing for the click handler to
 * find and opening the preview page cannot delete anyone's notification. With
 * `DEV_ACCESS_TOKEN` set, the preview shows your own notifications instead, and
 * clicking one deletes it.
 */
function dummyNotifications(): Notifications {
  const nonNullNotifications = notificationsDummyData.filter((item) => item.messages[0]);

  const notifications = nonNullNotifications.slice(0, 5).map((item) => ({
    referenceId: item.referenceId,
    date: item.created,
    message: item.messages[0]!.body,
  }));
  return { items: notifications, totalCount: nonNullNotifications.length };
}

/**
 * Returns `DEV_ACCESS_TOKEN` together with its `sub` claim, or undefined when the
 * variable is missing or does not hold a readable JWT. A bad value falls back to
 * the made-up notifications instead of breaking the preview page.
 *
 * `decodeJwt` does not check the signature. The notification service checks the
 * token when it is used.
 */
function devAccessToken(): { token: string; sub: string } | undefined {
  const token = process.env["DEV_ACCESS_TOKEN"];
  if (!token) return undefined;
  try {
    return { token, sub: decodeJwt(token).sub ?? "" };
  } catch {
    logger.warn("DEV_ACCESS_TOKEN is not a readable JWT. Showing made-up notifications.");
    return undefined;
  }
}

export async function previewNotifications({
  debugNotifications,
}: Pick<PreviewQuery, "debugNotifications">): Promise<Notifications | undefined> {
  if (debugNotifications === "none") {
    return { items: [], totalCount: 0 };
  }

  const devToken = devAccessToken();
  const notifications = devToken
    ? await notificationService.getNotifications("internal", devToken.token, devToken.sub)
    : dummyNotifications();

  return debugNotifications === "some" && notifications
    ? { items: notifications.items.slice(0, 3), totalCount: notifications.items.slice(0, 3).length }
    : notifications;
}

/**
 * Checks whether the preview bar is rendered for an Entur user, which shows the
 * environment chip and switcher. It needs `debugUser` too, because a user who is not
 * signed in cannot be an Entur user. Always false in production, for the same reason
 * as in `previewUser`.
 */
export function previewIsEnturUser(
  query: Pick<PreviewQuery, "debugUser" | "debugEnturUser">,
  environment: Environment = runningEnvironment,
): boolean {
  return previewViewer(query, environment) === "entur";
}

/**
 * Returns a chat token for the preview page, so the chat can be tested on a local
 * machine. Only in local development, with `debugUser` and `aiAgent=true`. The
 * preview page is public on dev and staging, and `debugUser` is only a query
 * parameter, so a token there would let anyone use the chat.
 */
export async function previewChatAccessToken(
  { debugUser, aiAgent }: Pick<PreviewQuery, "debugUser" | "aiAgent">,
  environment: Environment = runningEnvironment,
): Promise<ChatAccessToken | undefined> {
  if (environment !== "local" || !debugUser || aiAgent !== "true") return undefined;
  return issueChatToken(chatProxyConfig, `preview|${debugUser}`);
}

export function previewRoutes(server: OpenAPIHono): void {
  const previewRoute = createRoute({
    method: "get",
    path: "/",
    request: {
      query: previewQuerySchema,
    },
    responses: {
      200: {
        description: "Preview HTML for header and footer.",
      },
    },
  });

  server.openapi(
    previewRoute,
    async (ctx) => htmlResponse(await renderPreviewPage(ctx.req.valid("query")), 200),
    // A rejected query shows the page with the default values and the error, instead
    // of a JSON error. The status is still 400.
    (result): Promise<Response> | undefined => {
      if (result.success) return undefined;
      const error = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" ");
      return renderPreviewPage(previewQuerySchema.parse({}), error).then((html) =>
        htmlResponse(html, 400),
      );
    },
  );
}

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Content-Security-Policy": previewCsp,
      // Never cache this developer tool. Its output depends on the instance's
      // environment as well as on the URL.
      "Cache-Control": "no-store",
    },
  });
}

/** Returns the preview page for a validated query. `error` is shown above the controls. */
async function renderPreviewPage(query: PreviewQuery, error?: string): Promise<string> {
  const navProps = topNavigationProps(query);
  const user = previewUser(query);
  // With `?sidebar=true`, also render the example sidebar, so the collapse button
  // has something to collapse.
  const sidebar = navProps.sidebar ? await renderComponentToString(<PreviewSidebar />) : "";
  const notifications =
    navProps.simple || navProps.hideNotifications ? undefined : await previewNotifications(query);

  // The locale codes are valid BCP 47 language tags.
  return `
        <html lang="${navProps.locale}"${query.colorMode === "dark" ? ' data-color-mode="dark"' : ""}>
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Uniformen</title>
                <link rel="icon" href="/favicon.ico" sizes="32x32" />
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <style>${PREVIEW_BASE_CSS}</style>
                ${renderUniformenStyleTag()}
                ${renderUniformenHeadScript()}
            </head>
            <body${navProps.contrast ? ' class="preview--contrast"' : ""}>
                ${await renderComponentToString(
                  <TopNavigation
                    {...navProps}
                    user={user}
                    notifications={notifications}
                    isEnturUser={previewIsEnturUser(query)}
                    chatAccessToken={await previewChatAccessToken(query)}
                  />,
                )}
                <main>
                    ${sidebar}
                    <div class="preview-content">${await renderComponentToString(<PreviewControls query={query} error={error} />)}</div>
                </main>
                ${await renderComponentToString(<Footer contrast={navProps.contrast} />)}
                ${renderUniformenScripts()}
                <script>${PREVIEW_SCRIPT}</script>
            </body>
        </html>
    `;
}
