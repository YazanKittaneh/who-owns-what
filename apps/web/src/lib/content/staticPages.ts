import fs from "node:fs";
import path from "node:path";
import { isSupportedLocale, type SupportedLocale } from "@/lib/routes";

export type StaticPageKey =
  | "about"
  | "how-to-use"
  | "how-it-works"
  | "terms-of-use"
  | "privacy-policy";

type RichTextNode = {
  nodeType: string;
  value?: string;
  marks?: Array<{ type: string }>;
  data?: Record<string, unknown>;
  content?: RichTextNode[];
};

export type StaticPageDoc = {
  title: string;
  slug: string;
  content: RichTextNode;
};

const DATA_DIR = path.resolve(process.cwd(), "..", "..", "client", "src", "data");

function normalizeLocale(locale?: string): SupportedLocale {
  return locale && isSupportedLocale(locale) ? locale : "en";
}

export function getStaticPageDoc(page: StaticPageKey, locale?: string): StaticPageDoc {
  const lang = normalizeLocale(locale);
  const filePath = path.join(DATA_DIR, `${page}.${lang}.json`);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as StaticPageDoc;
}
