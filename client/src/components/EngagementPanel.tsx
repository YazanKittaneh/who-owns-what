import React from "react";
import SocialShare, { SocialShareLocation } from "./SocialShare";
import { Link } from "@justfixnyc/component-library";

import "styles/EngagementPanel.css";
import { Trans } from "@lingui/macro";

const EngagementPanel: React.FC<{
  location: SocialShareLocation;
}> = (props) => (
  <div className="EngagementPanel">
    <Trans render="h5">Share this project</Trans>
    <div className="EngagementWrapper">
      <div className="EngagementItem">
        <p>
          <Trans>Share with others</Trans>
        </p>
        <SocialShare location={props.location} />
      </div>
      <div className="EngagementItem">
        <p>
          <Trans>Built and maintained by Yazan</Trans>
        </p>
        <Link href="https://yazan.io">yazan.io</Link>
        <br />
        <Link href="https://github.com/yazankittaneh">github.com/yazankittaneh</Link>
      </div>
    </div>
  </div>
);

export default EngagementPanel;
