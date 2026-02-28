import { createApp, log } from "./app";
import { createServer } from "http";
import { serveStatic } from "./static";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

(async () => {
  const app = await createApp();

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
    const httpServer = createServer(app);
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "127.0.0.1" }, () => {
      log(`serving on port ${port}`);
    });
  } else {
    const { setupVite } = await import("./vite");
    const httpServer = createServer(app);
    await setupVite(httpServer, app);
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "127.0.0.1" }, () => {
      log(`serving on port ${port}`);
    });
  }
})();
