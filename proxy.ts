import { NextResponse, type NextRequest } from "next/server";

// Case-insensitive protection also covers Windows' case-insensitive filesystem.
export function proxy(request: NextRequest) {
  let pathname = request.nextUrl.pathname;
  try { pathname = decodeURIComponent(pathname); } catch { return new Response(null, { status: 400 }); }
  if (/^\/asa(?:\/|$)/i.test(pathname)) return new Response(null, { status: 404 });
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
