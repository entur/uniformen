import { describe, expect, test } from "bun:test";
import { renderComponentToString } from "../ssr/renderComponentToString";
import { ChatDrawer } from "./ChatDrawer";
import { ChatMessage } from "./ChatMessage";

describe("agent name in ChatMessage", () => {
  test("is the application name followed by Chat", async () => {
    const html = await renderComponentToString(
      <ChatMessage sender="agent" text="Hei" locale="nb-NO" appName="Nplan" />,
    );
    expect(html).toContain("Nplan Chat</p>");
  });

  test("is only Chat without an application name", async () => {
    const html = await renderComponentToString(
      <ChatMessage sender="agent" text="Hei" locale="nb-NO" />,
    );
    expect(html).toContain(">Chat</p>");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("Partner");
  });
});

describe("ChatDrawer appName", () => {
  test("reaches the welcome message, the agent template and the typing template", async () => {
    const html = await renderComponentToString(<ChatDrawer locale="nb-NO" appName="Nplan" />);
    expect(html.match(/Nplan Chat<\/p>/g)).toHaveLength(3);
  });
});
