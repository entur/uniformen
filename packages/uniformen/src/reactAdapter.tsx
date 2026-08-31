import { type FC } from "react";
import parse from "html-react-parser";
import { fetchUniformenLayout, type FetchUniformenLayoutProps } from "./lib/fetchUniformenLayout";
import type { UniformenLayout } from "./types";

type UniformenComponents = {
  HeadAssets: FC;
  Header: FC;
  Footer: FC;
  Scripts: FC;
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

export async function fetchUniformenComponents(
  props: FetchUniformenLayoutProps = {},
): Promise<UniformenComponents> {
  const layout = await fetchUniformenLayout(props);

  if (!layout) return EMPTY_COMPONENTS;

  // `parse()` turns the HTML strings into real React elements, so head assets
  // sit directly inside `<head>` with no wrapper element and `<script>` tags
  // render as real `<script>` elements.
  return {
    HeadAssets: () => parse(layout.headAssets),
    Header: () => parse(layout.headerHtml),
    Footer: () => parse(layout.footerHtml),
    Scripts: () => parse(layout.scripts),
    csp: layout.csp,
  };
}
