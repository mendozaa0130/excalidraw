import * as Sentry from "@sentry/browser";

import { scrubBreadcrumb } from "../sentry";

const ROOM_KEY = "AAAAAAAAAAAAAAAAAAAAAA";

describe("sentry breadcrumb scrubbing", () => {
  it("removes the room key from navigation breadcrumbs", () => {
    const breadcrumb = scrubBreadcrumb({
      category: "navigation",
      data: { from: "/", to: `/#room=0123456789abcdef0123,${ROOM_KEY}` },
    });

    expect(breadcrumb.data).toEqual({ from: "/", to: "/" });
  });

  it("removes the share-link key from the page a navigation started on", () => {
    const breadcrumb = scrubBreadcrumb({
      category: "navigation",
      data: { from: `/#json=abc,${ROOM_KEY}`, to: "/" },
    });

    expect(breadcrumb.data).toEqual({ from: "/", to: "/" });
  });

  it("removes fragments from fetch and xhr breadcrumb URLs", () => {
    const breadcrumb = scrubBreadcrumb({
      category: "fetch",
      data: {
        method: "GET",
        url: `https://example.com/scene#room=a,${ROOM_KEY}`,
      },
    });

    expect(breadcrumb.data).toEqual({
      method: "GET",
      url: "https://example.com/scene",
    });
  });

  it("leaves breadcrumbs without URL fields unchanged", () => {
    const breadcrumb = { category: "ui.click", message: "button.ToolIcon" };

    expect(scrubBreadcrumb({ ...breadcrumb })).toEqual(breadcrumb);
  });

  it("is registered with the Sentry client", () => {
    expect(Sentry.getClient()?.getOptions().beforeBreadcrumb).toBe(
      scrubBreadcrumb,
    );
  });

  it("keeps the room key out of an event sent after starting a room", async () => {
    // Without a DSN (as in tests) Sentry never installs its breadcrumb
    // integration, so re-initialize with the app's own options plus a DSN and
    // an in-memory transport. Nothing leaves the test process.
    const sentBodies: string[] = [];
    Sentry.init({
      ...Sentry.getClient()!.getOptions(),
      dsn: "https://public@sentry.invalid/1",
      transport: (options) =>
        Sentry.createTransport(options, async (request) => {
          sentBodies.push(
            typeof request.body === "string"
              ? request.body
              : new TextDecoder().decode(request.body),
          );
          return {};
        }),
    });

    // What Collab.startCollaboration does when a Drawer starts a room.
    window.history.pushState({}, "", `/#room=0123456789abcdef0123,${ROOM_KEY}`);
    Sentry.captureException(new Error("simulated crash"));
    await Sentry.flush(1000);
    window.history.pushState({}, "", "/");

    const sent = sentBodies.join("\n");
    // Positive control: the navigation breadcrumb must actually be recorded,
    // otherwise the next assertion would pass for the wrong reason.
    expect(sent).toContain('"category":"navigation"');
    expect(sent).not.toContain(ROOM_KEY);
  });
});
