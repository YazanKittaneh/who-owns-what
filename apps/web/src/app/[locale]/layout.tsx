import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isSupportedLocale } from "@/lib/routes";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  return children;
}
