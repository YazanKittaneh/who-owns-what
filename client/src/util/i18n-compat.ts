import { defaultLocale, isSupportedLocale, SupportedLocale } from "../i18n-base";

export type I18nLike = {
  _: (message: any) => string;
  use?: (locale: string) => I18nLike;
  language?: string;
};

export function getI18nLocale(i18n: unknown): SupportedLocale {
  const language =
    i18n && typeof i18n === "object" && "language" in i18n
      ? (i18n as { language?: string }).language
      : undefined;
  if (language && isSupportedLocale(language)) {
    return language;
  }
  return defaultLocale;
}
