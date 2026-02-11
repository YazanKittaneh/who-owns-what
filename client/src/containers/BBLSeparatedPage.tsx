import React from "react";
import { RouteComponentProps } from "react-router-dom";

export type BBLSeparatedPageParams = {
  boro: string;
  block: string;
  lot: string;
  locale?: string;
};

type BBLPageProps = RouteComponentProps<BBLSeparatedPageParams> & {
  useNewPortfolioMethod?: boolean;
};

const BBLSeparatedPage: React.FC<BBLPageProps> = () => {
  return null;
};

export default BBLSeparatedPage;
