import { NextResponse } from "next/server";

/**
 * Wraps a route handler so any thrown error becomes a JSON 500 response
 * (instead of an empty body that breaks `res.json()` on the client).
 */
export function handle<C = unknown>(
  fn: (req: Request, ctx: C) => Promise<Response>
) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Internal server error";
      console.error("[api error]", message, e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
