import { type FC } from "react";
import parse from "html-react-parser";
import { fetchUniformenLayout } from "./lib/fetchUniformenLayout";
import type { Environment } from "./types";

type UniformenComponents = {
  HeadAssets: FC;
  Header: FC;
  Footer: FC;
  Scripts: FC;
};

const Empty: FC = () => null;
const EMPTY_COMPONENTS: UniformenComponents = {
  HeadAssets: Empty,
  Header: Empty,
  Footer: Empty,
  Scripts: Empty,
};

export async function fetchUniformenComponents(
  token?: string,
  environment: Environment = "production",
): Promise<UniformenComponents> {
  const layout = await fetchUniformenLayout(token, environment);

  if (!layout) return EMPTY_COMPONENTS;

  // `parse()` turns the HTML strings into real React elements, so head assets
  // sit directly inside `<head>` with no wrapper element and `<script>` tags
  // render as real `<script>` elements.
  return {
    HeadAssets: () => parse(layout.headAssets),
    Header: () => parse(layout.headerHtml),
    Footer: () => parse(layout.footerHtml),
    Scripts: () => parse(layout.scripts),
  };
}
