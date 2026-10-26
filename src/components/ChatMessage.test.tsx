import { describe, expect, test } from "bun:test";
import { renderComponentToString } from "../ssr/renderComponentToString";
import { ChatDrawer } from "./ChatDrawer";
import { ChatMessage } from "./ChatMessage";
import type { PortalApplicationId } from "./portalApplications";

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

describe("ChatDrawer example questions", () => {
  test("an app with its own questions shows them", async () => {
    const html = await renderComponentToString(<ChatDrawer locale="nb-NO" activeAppId="partner" />);
    expect(html).toContain("Hvor ser jeg mine avtaler?");
  });

  test("an app without its own questions shows the general ones", async () => {
    // An id that is not in `examplesByApp`, so the test still works when every app has questions.
    const unknownApp = "unknown-app" as PortalApplicationId;
    const html = await renderComponentToString(
      <ChatDrawer locale="nb-NO" activeAppId={unknownApp} />,
    );
    expect(html).toContain("Hvor er jeg?");
    expect(html).not.toContain("avtaler");
  });

  test("no app shows the general questions", async () => {
    const html = await renderComponentToString(<ChatDrawer locale="en-GB" />);
    expect(html).toContain("Where am I?");
  });
});

describe("ChatDrawer location names", () => {
  test("an app with location names sends them to the browser", async () => {
    const html = await renderComponentToString(<ChatDrawer locale="en-GB" activeAppId="partner" />);
    expect(html).toContain("Terminal report");
    expect(html).toContain("data-uniformen-chat-generic-pages=");
    expect(html).toContain("users");
  });

  test("an app without location names sends none", async () => {
    const unknownApp = "unknown-app" as PortalApplicationId;
    const html = await renderComponentToString(
      <ChatDrawer locale="en-GB" activeAppId={unknownApp} />,
    );
    expect(html).not.toContain("Terminal report");
    expect(html).toContain('data-uniformen-chat-generic-pages="[]"');
  });
});
