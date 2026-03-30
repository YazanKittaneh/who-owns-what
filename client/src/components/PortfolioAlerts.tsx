import React, { useEffect, useState } from "react";
import { Trans } from "@lingui/macro";
import classNames from "classnames";
import { useLocation } from "react-router-dom";
import networkDiagram from "../assets/img/network-diagram.png";
import { Alert, AlertProps } from "./Alert";
import { logAmplitudeEvent } from "./Amplitude";
import Modal from "./Modal";
import { isLegacyPath } from "./WowzaToggle";
import { LocaleLink } from "../i18n";
import { createWhoOwnsWhatRoutePaths } from "../routes";

export const BIG_PORTFOLIO_THRESHOLD = 300;

type PortfolioAlertProps = Omit<AlertProps, "children"> & {
  portfolioSize: number;
};

export const BigPortfolioAlert = ({ portfolioSize, className, ...props }: PortfolioAlertProps) => {
  const [isLearnMoreModalVisible, setModalVisibility] = useState(false);
  const { pathname } = useLocation();
  const { methodology, legacy } = createWhoOwnsWhatRoutePaths();

  // Preload modal image when BigPortfolioBanner mounts:
  useEffect(() => {
    new Image().src = networkDiagram;
  }, []);

  return !isLegacyPath(pathname) && portfolioSize > BIG_PORTFOLIO_THRESHOLD ? (
    <Alert
      className={classNames("big-portfolio-alert", className)}
      variant="secondary"
      type="info"
      {...props}
    >
      <>
        <Trans>Why am I seeing such a big portfolio?</Trans>{" "}
        <button
          className="button is-text"
          onClick={() => {
            logAmplitudeEvent("learnWhyPortfolioSoBig");
            window.gtag("event", "learn-why-portfolio-so-big");
            setModalVisibility(true);
          }}
        >
          <Trans>Learn more.</Trans>
        </button>
        <Modal showModal={isLearnMoreModalVisible} onClose={() => setModalVisibility(false)}>
          <h5 className="first-header">
            <Trans>Why am I seeing such a big portfolio?</Trans>
          </h5>
          <p>
            <Trans>
              When two parties share the same business address, we group them as part of the same
              portfolio.
            </Trans>
          </p>
          <p className="is-marginless">
            <Trans>
              Some large corporations, however, are a bit more complicated and may share personnel
              and financial stake with other related companies, which all will show up on Who Owns
              What as one large portfolio.
            </Trans>
          </p>
          <br />
          <img className="img-responsive" src={networkDiagram} alt="" />
          <br />
          <p>
            <Trans>
              We’ve improved Who Owns What to dig deeper into the data and offer you a more complete
              picture of buildings associated with your landlord.
            </Trans>{" "}
            <LocaleLink to={isLegacyPath(pathname) ? legacy.methodology : methodology}>
              <Trans>Read more in our methodology article</Trans>
            </LocaleLink>
          </p>
        </Modal>
      </>
    </Alert>
  ) : (
    <></>
  );
};
