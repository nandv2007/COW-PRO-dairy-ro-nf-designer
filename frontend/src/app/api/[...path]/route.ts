import { NextRequest, NextResponse } from "next/server";

function resolveBackendOrigin(): string {
  const candidates = [
    process.env.BACKEND_URL,
    process.env.BACKEND_INTERNAL_HOSTPORT
      ? `http://${process.env.BACKEND_INTERNAL_HOSTPORT}`
      : undefined,
    process.env.NEXT_PUBLIC_API_URL,
    "http://127.0.0.1:8000",
  ];
  for (const raw of candidates) {
    const trimmed = raw?.trim().replace(/\/$/, "");
    if (!trimmed) continue;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }
  return "http://127.0.0.1:8000";
}

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

async function proxyRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  const backendOrigin = resolveBackendOrigin();
  const targetUrl = `${backendOrigin}/api/${path.join("/")}${req.nextUrl.search}`;

  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  });

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const bodyBuffer = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: hasBody && bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (!HOP_BY_HOP_RESPONSE_HEADERS.has(lower) && lower !== "set-cookie") {
        responseHeaders.set(key, value);
      }
    });

    const setCookies =
      typeof upstream.headers.getSetCookie === "function"
        ? upstream.headers.getSetCookie()
        : [];
    for (const cookie of setCookies) {
      responseHeaders.append("set-cookie", cookie);
    }

    const payload = await upstream.arrayBuffer();
    return new NextResponse(payload, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Backend service unavailable";
    return NextResponse.json(
      {
        detail: `COW PRO API backend is unreachable (${message}). If deployed on Render free tier, please wait 30 seconds for wake-up and retry.`,
      },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(req, context);
}
