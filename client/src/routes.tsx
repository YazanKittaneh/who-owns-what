import { reportError } from "error-reporting";
import { removeLocalePrefix } from "i18n";

export type AddressPageUrlParams = {
  pin: string;
  locale?: string;
  indicator?: string;
};

export type AddressPageRoutes = ReturnType<typeof createAddressPageRoutes>;

export const isAddressPageRoute = (pathname: string) => {
  let path = removeLocalePrefix(pathname);
  if (path.startsWith("/legacy")) path = path.replace("/legacy", "");
  return path.startsWith("/pin");
};

export const createRouteForAddressPage = (params: AddressPageUrlParams, isLegacyRoute?: boolean) => {
  let route = `/pin/${encodeURIComponent(params.pin)}`;

  const allowChangingPortfolioMethod =
    process.env.REACT_APP_ENABLE_NEW_WOWZA_PORTFOLIO_MAPPING === "1";

  if (isLegacyRoute && allowChangingPortfolioMethod) route = "/legacy" + route;

  if (route.includes(" ")) {
    reportError("A PIN URL was not encoded properly! There's a space in the URL.");
    route = route.replace(" ", "%20");
  }

  if (params.locale) {
    route = `/${params.locale}${route}`;
  }

  return route;
};

export const createAddressPageRoutes = (
  prefix: string | AddressPageUrlParams,
  isLegacyRoute?: boolean
) => {
  if (typeof prefix === "object") {
    prefix = createRouteForAddressPage(prefix, isLegacyRoute);
  }
  return {
    overview: `${prefix}`,
    portfolio: `${prefix}/portfolio`,
    timeline: `${prefix}/timeline/:indicator?`,
    summary: `${prefix}/summary`,
  };
};

export const removeIndicatorSuffix = (pathname: string) =>
  pathname.replace(/(\/timeline)(\/[^/]+)?$/, "$1");

export const createAccountRoutePaths = (prefix?: string) => {
  return {
    login: `${prefix}/login`,
    settings: `${prefix}/settings`,
    verifyEmail: `${prefix}/verify-email`,
    forgotPassword: `${prefix}/forgot-password`,
    resetPassword: `${prefix}/reset-password`,
    unsubscribe: `${prefix}/unsubscribe`,
  };
};

export const authRequiredPaths = () => {
  const locales = ["en", "es"];
  let pathnames: string[] = [];
  locales.forEach((locale) => {
    pathnames = pathnames.concat(Object.values(createAccountRoutePaths(`/${locale}/account`)));
  });
  return pathnames;
};

export const createCoreRoutePaths = (prefix?: string) => {
  const pathPrefix = prefix || "";
  return {
    home: `${pathPrefix}/`,
    addressPage: createAddressPageRoutes(`${pathPrefix}/pin/:pin(\\d{14})`),
    account: createAccountRoutePaths(`${pathPrefix}/account`),
    about: `${pathPrefix}/about`,
    howToUse: `${pathPrefix}/how-to-use`,
    methodology: `${pathPrefix}/how-it-works`,
    termsOfUse: `${pathPrefix}/terms-of-use`,
    privacyPolicy: `${pathPrefix}/privacy-policy`,
  };
};

export const createWhoOwnsWhatRoutePaths = (prefix?: string) => {
  const pathPrefix = prefix || "";
  return {
    ...createCoreRoutePaths(pathPrefix),
    legacy: {
      ...createCoreRoutePaths(`${pathPrefix}/legacy`),
    },
    oldWowzaPath: `${pathPrefix}/wowza`,
    dev: `${pathPrefix}/dev`,
  };
};

export const getSiteOrigin = () => `${window.location.protocol}//${window.location.host}`;
