import React from "react";
import { withMachineInStateProps } from "state-machine";
import { AddressPageRoutes } from "routes";

const PropertiesMap: React.FC<
  withMachineInStateProps<"portfolioFound"> & {
    onAddrChange: (pin: string) => void;
    isVisible: boolean;
    addressPageRoutes: AddressPageRoutes;
    location: "overview" | "portfolio";
  }
> = () => {
  return null;
};

export default PropertiesMap;
