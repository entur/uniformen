import { createElement, type FC, type ScriptHTMLAttributes } from "react";
import parse, { attributesToProps, Element, type Text } from "html-react-parser";
import { fetchUniformenLayout, type FetchUniformenLayoutProps } from "./lib/fetchUniformenLayout";
import type { UniformenLayout } from "./types";

/**
 * A component that renders one `<script>` the way the host framework wants it
 * rendered.
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
 * A slot whose `<script>` tags go through `loader` when one is passed.
 *
 * Without a loader the tags render as plain `<script>` elements, which is what a
 * server-rendered page needs and all most apps need.
 *
 * The inline body is handed over as its exact source text to match the CSP hash.
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

        // We use `createElement` instead of JSX so this file doesn't rely on any particular JSX runtime.
        // (This avoids JSX transform/runtime configuration concerns for consumers.)
        return source ? createElement(Loader, props, source) : createElement(Loader, props);
      },
    });
  };

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
