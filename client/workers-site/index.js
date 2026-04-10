import { getAssetFromKV, mapRequestToAsset } from "@cloudflare/kv-asset-handler";

addEventListener("fetch", (event) => {
  event.respondWith(handleEvent(event));
});

async function handleEvent(event) {
  try {
    return await getAssetFromKV(event, {
      cacheControl: {
        bypassCache: false,
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
            bypassCache: false,
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
