import React from "react";
import { LocaleNavLink as NavLink } from "../i18n";

import "styles/LegalFooter.css";
import { Trans } from "@lingui/macro";
import { createWhoOwnsWhatRoutePaths } from "../routes";
import { useLocation } from "react-router-dom";
import { isLegacyPath } from "./WowzaToggle";

const LegalFooter = () => {
  const { termsOfUse, privacyPolicy, methodology, legacy } = createWhoOwnsWhatRoutePaths();
  const { pathname } = useLocation();
  return (
    <div className="Footer LegalFooter container">
      <div className="columns">
        <div className="Disclaimer column col-8 col-md-12">
          <p>
            <Trans>
              Information on this site is for informational purposes only and is not legal advice.
            </Trans>
          </p>
          <p>
            <Trans>
              This Chicago version of Who Owns What is built and operated independently by
              Yazan.
            </Trans>
          </p>
          <p>
            <Trans>It is not a JustFix project.</Trans>
          </p>
          <p>
            <Trans>This version was modified to fit Chicago and is not affiliated with or endorsed by JustFix.</Trans>
          </p>
        </div>
        <div className="Links column col-4 col-md-12">
          <div className="d-flex">
            <p>
              <Trans>
                Built by <a href="https://yazan.io">Yazan</a>
              </Trans>
            </p>
            <nav className="inline">
              <a target="_blank" rel="noopener noreferrer" href="https://yazan.io">
                <Trans>Yazan.io</Trans>
              </a>
              <a
                href="https://github.com/yazankittaneh"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Trans>GitHub</Trans>
              </a>
              <NavLink to={isLegacyPath(pathname) ? legacy.termsOfUse : termsOfUse}>
                <Trans>Terms of use</Trans>
              </NavLink>
              <NavLink to={isLegacyPath(pathname) ? legacy.privacyPolicy : privacyPolicy}>
                <Trans>Privacy policy</Trans>
              </NavLink>
              <br className="hide-md" />
              <NavLink to={isLegacyPath(pathname) ? legacy.methodology : methodology}>
                <Trans>Methodology</Trans>
              </NavLink>
              <a
                href="https://github.com/yazankittaneh"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Trans>Source code</Trans>
              </a>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalFooter;
