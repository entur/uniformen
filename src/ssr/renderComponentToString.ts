import type { Child } from "hono/jsx";
import { renderToReadableStream } from "hono/jsx/dom/server";

export async function renderComponentToString(element: Child): Promise<string> {
  const stream = await renderToReadableStream(element);

  let resultString = "";
  let isDone = false;

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (!isDone) {
    const { value, done } = await reader.read();
    isDone = done;
    if (value) {
      resultString += decoder.decode(value, { stream: true });
    }
  }

  return resultString;
}
