import React from "react";
import { withMachineInStateProps } from "state-machine";
import "styles/PropertiesList.css";
import { AddressPageRoutes } from "routes";

export const FilterContextProvider: React.FC<{}> = (props) => <>{props.children}</>;

const PropertiesList: React.FC<
  withMachineInStateProps<"portfolioFound"> &
    {
      addressPageRoutes: AddressPageRoutes;
      isVisible?: boolean;
      onAddrChange: (pin: string) => void;
    }
> = ({ state, onAddrChange }) => {
  const addrs = state.context.portfolioData.assocAddrs;

  return (
    <div className="PropertiesList">
      <table className="table">
        <thead>
          <tr>
            <th>Address</th>
            <th>Owner</th>
            <th>Units</th>
            <th>Permits</th>
            <th>Open violations</th>
            <th>311 requests</th>
          </tr>
        </thead>
        <tbody>
          {addrs.map((addr) => (
            <tr key={addr.pin} onClick={() => onAddrChange(addr.pin)}>
              <td>{addr.address || `${addr.housenumber || ""} ${addr.streetname || ""}`}</td>
              <td>{addr.owner_name || ""}</td>
              <td>{addr.units_res ?? 0}</td>
              <td>{addr.permits_total ?? 0}</td>
              <td>{addr.violations_open ?? 0}</td>
              <td>{addr.requests_311_total ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PropertiesList;
