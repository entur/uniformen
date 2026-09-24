import { createElement, type FC, type ScriptHTMLAttributes } from "react";
import parse, { attributesToProps, Element, type Text } from "html-react-parser";
import { fetchUniformenLayout, type FetchUniformenLayoutProps } from "./lib/fetchUniformenLayout";
import type { UniformenLayout } from "./types";

/**
 * A component that renders one `<script>` element, for example `Script` from
 * `next/script`. It gets the script's attributes as props, and the inline source
 * as `children` when there is one.
 */
export type ScriptLoader = FC<ScriptHTMLAttributes<HTMLScriptElement>>;

type ScriptSlotProps = { loader?: ScriptLoader };

type UniformenComponents = {
  HeadAssets: FC<ScriptSlotProps>;
  Header: FC;
  Footer: FC;
  Scripts: FC<ScriptSlotProps>;
  csp: UniformenLayout["csp"];
};

const Empty: FC = () => null;
const EMPTY_COMPONENTS: UniformenComponents = {
  HeadAssets: Empty,
  Header: Empty,
  Footer: Empty,
  Scripts: Empty,
  csp: {},
};

/**
 * Returns a component that renders `html`. If a `loader` is passed, each
 * `<script>` is rendered with the loader. If not, it is rendered as a plain
 * `<script>` element. The loader gets the inline source as the exact original
 * text, so it still matches its CSP hash.
 */
const scriptSlot =
  (html: string) =>
  ({ loader: Loader }: ScriptSlotProps) => {
    if (!Loader) return parse(html);

    return parse(html, {
      replace: (domNode) => {
        if (!(domNode instanceof Element) || domNode.name !== "script") return;

        const props = attributesToProps(domNode.attribs, domNode.name);
        const source = (domNode.children[0] as Text | undefined)?.data;

        // Use `createElement` instead of JSX, so consumers do not need a specific JSX runtime or JSX configuration.
        return source ? createElement(Loader, props, source) : createElement(Loader, props);
      },
    });
  };

/**
 * Fetches the layout and returns it as React components, plus the CSP sources.
 * Takes the same options as `fetchUniformenLayout`. If the fetch fails, every
 * component renders nothing and `csp` is `{}`.
 */
export async function fetchUniformenComponents(
  props: FetchUniformenLayoutProps = {},
): Promise<UniformenComponents> {
  const layout = await fetchUniformenLayout(props);

  if (!layout) return EMPTY_COMPONENTS;

  return {
    HeadAssets: scriptSlot(layout.headAssets),
    Header: () => parse(layout.headerHtml),
    Footer: () => parse(layout.footerHtml),
    Scripts: scriptSlot(layout.scripts),
    csp: layout.csp,
  };
}
