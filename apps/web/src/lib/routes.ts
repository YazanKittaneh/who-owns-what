export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function withLocalePrefix(pathname: string, locale?: SupportedLocale): string {
  if (!locale) return pathname;
  if (pathname === "/") return `/${locale}`;
  return `/${locale}${pathname}`;
}

export function mapLegacySlugToModernPath(
  slug: string[] | undefined,
  locale?: SupportedLocale,
): string | null {
  const parts = slug ?? [];
  const base = (path: string) => withLocalePrefix(path, locale);

  if (parts.length === 0) return base("/");

  const [first, second, third, ...rest] = parts;

  if (first === "pin" && second) {
    if (!third) return base(`/pin/${encodeURIComponent(second)}`);
    if (third === "portfolio") return base(`/pin/${encodeURIComponent(second)}/portfolio`);
    if (third === "summary") return base(`/pin/${encodeURIComponent(second)}/summary`);
    if (third === "timeline") {
      const suffix = rest.map(encodeURIComponent).join("/");
      return base(`/pin/${encodeURIComponent(second)}/timeline${suffix ? `/${suffix}` : ""}`);
    }
  }

  if (first === "about") return base("/about");
  if (first === "how-to-use") return base("/how-to-use");
  if (first === "how-it-works") return base("/how-it-works");
  if (first === "terms-of-use") return base("/terms-of-use");
  if (first === "privacy-policy") return base("/privacy-policy");
  if (first === "wowza") return base("/");

  return null;
}
