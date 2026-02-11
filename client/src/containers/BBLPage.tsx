import React from "react";
import { RouteComponentProps } from "react-router-dom";

export type BBLPageParams = {
  bbl: string;
  locale?: string;
};

type BBLPageProps = RouteComponentProps<BBLPageParams> & {
  useNewPortfolioMethod?: boolean;
};

const BBLPage: React.FC<BBLPageProps> = () => {
  return null;
};

export default BBLPage;
