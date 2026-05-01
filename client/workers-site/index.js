import { getAssetFromKV, mapRequestToAsset } from "@cloudflare/kv-asset-handler";

addEventListener("fetch", (event) => {
  event.respondWith(handleEvent(event));
});

function shouldBypassCache(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/" || pathname.endsWith(".html")) {
    return true;
  }

  // SPA routes do not have file extensions and should always resolve fresh
  // index.html so newly deployed asset hashes are picked up immediately.
  return !pathname.includes(".");
}

async function handleEvent(event) {
  const bypassCache = shouldBypassCache(event.request);

  try {
    return await getAssetFromKV(event, {
      cacheControl: {
        bypassCache,
      },
    });
  } catch (_error) {
    const spaFallback = mapRequestToAsset(event.request, {
      defaultDocument: "index.html",
    });

    try {
      return await getAssetFromKV(
        {
          request: spaFallback,
          waitUntil: event.waitUntil.bind(event),
        },
        {
          cacheControl: {
            bypassCache: true,
          },
        },
      );
    } catch (notFoundError) {
      return new Response(notFoundError.message || "Not Found", {
        status: 404,
      });
    }
  }
}
