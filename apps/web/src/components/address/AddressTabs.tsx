import Link from "next/link";
import {
  ADDRESS_TAB_KEYS,
  buildAddressTabPath,
  type AddressRouteStyle,
  type AddressTabKey,
  type SupportedLocale,
} from "@/lib/routes";

type Props = {
  pin: string;
  currentTab: AddressTabKey;
  style: AddressRouteStyle;
  locale?: SupportedLocale;
};

const TAB_LABELS: Record<AddressTabKey, string> = {
  overview: "Overview",
  portfolio: "Portfolio",
  timeline: "Timeline",
  summary: "Summary",
};

export default function AddressTabs({ pin, currentTab, style, locale }: Props) {
  return (
    <nav aria-label="Address view tabs" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      {ADDRESS_TAB_KEYS.map((tab) => {
        const href = buildAddressTabPath(pin, tab, { style, locale });
        const isActive = tab === currentTab;
        return (
          <Link
            key={tab}
            href={href}
            aria-current={isActive ? "page" : undefined}
            style={{
              border: "1px solid #d0d0d0",
              borderBottomWidth: isActive ? "3px" : "1px",
              padding: "0.4rem 0.7rem",
              textDecoration: "none",
              color: "inherit",
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {TAB_LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}
