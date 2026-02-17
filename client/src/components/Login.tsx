import React from "react";
import { Trans } from "@lingui/macro";
import { LocaleLink } from "i18n";
import { createWhoOwnsWhatRoutePaths } from "routes";

const Login: React.FC = () => {
  const { home } = createWhoOwnsWhatRoutePaths();

  return (
    <div>
      <p>
        <Trans>
          Account login and sign-up are currently disabled in the Chicago MVP.
        </Trans>
      </p>
      <p>
        <Trans>
          You can still use search and portfolio features without an account.
        </Trans>
      </p>
      <p>
        <LocaleLink to={home}>
          <Trans>Back to search</Trans>
        </LocaleLink>
      </p>
    </div>
  );
};

export default Login;
