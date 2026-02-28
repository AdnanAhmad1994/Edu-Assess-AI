/**
 * Single Vercel Serverless Function
 *
 * This wraps the entire Express app as ONE serverless function,
 * staying well within Vercel Hobby plan's 12-function limit.
 * All API routes are handled internally by Express routing.
 */
import { createApp } from "../server/app";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await createApp();
  return app(req as any, res as any);
}
