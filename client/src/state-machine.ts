import { createMachine, assign, DoneInvokeEvent, State, ErrorPlatformEvent } from "xstate";
import { AddressRecord, BuildingInfoRecord } from "components/APIDataTypes";
import { SearchAddress } from "components/AddressSearch";
import APIClient from "components/APIClient";
import _find from "lodash/find";
import { reportError } from "error-reporting";

export type WowState =
  | { value: "noData"; context: {} }
  | {
      value: "searchInProgress";
      context: WowContext & { searchAddrParams: SearchAddress };
    }
  | {
      value: "pinNotFound";
      context: WowContext & { searchAddrParams: SearchAddress; searchAddrPin: undefined };
    }
  | {
      value: "unregisteredFound";
      context: WowContext & {
        searchAddrParams: SearchAddress;
        searchAddrPin: string;
        portfolioData: undefined;
        buildingInfo: BuildingInfoRecord;
      };
    }
  | {
      value: "portfolioFound";
      context: WowPortfolioFoundContext;
    }
  | {
      value: "networkErrorOccurred";
      context: WowContext & { searchAddrParams: SearchAddress };
    };

export type WowPortfolioFoundContext = WowContext & {
  searchAddrParams: SearchAddress;
  searchAddrPin: string;
  portfolioData: PortfolioData;
};

export type WowEvent =
  | { type: "SEARCH"; address: SearchAddress; useNewPortfolioMethod: boolean }
  | { type: "SELECT_DETAIL_ADDR"; pin: string };

type PortfolioData = {
  searchAddr: AddressRecord;
  assocAddrs: AddressRecord[];
  detailAddr: AddressRecord;
};

export type BuildingSubscription = {
  pin: string;
  bbl?: string;
  housenumber: string;
  streetname: string;
  zip: string;
  city: string;
  boro?: string;
};

export type JustfixUser = {
  email: string;
  verified: boolean;
  id: number;
  type: string;
  buildingSubscriptions: BuildingSubscription[];
  districtSubscriptions?: any[];
  subscriptionLimit: number;
};

export interface WowContext {
  searchAddrParams?: SearchAddress;
  useNewPortfolioMethod?: boolean;
  searchAddrPin?: string;
  portfolioData?: PortfolioData;
  buildingInfo?: BuildingInfoRecord;
}

type WowMachineEverything = State<WowContext, WowEvent, any, WowState>;

type WowMachineInState<
  TSV extends WowStateByAnotherName["value"],
  WowStateByAnotherName extends WowState = WowState
> = State<
  (WowStateByAnotherName extends { value: TSV } ? WowStateByAnotherName : never)["context"],
  WowEvent,
  any,
  WowStateByAnotherName
>;

export type withMachineProps = {
  state: WowMachineEverything;
  send: (event: WowEvent) => WowMachineEverything;
};

export type withMachineInStateProps<TSV extends WowState["value"]> = {
  state: WowMachineInState<TSV>;
  send: (event: WowEvent) => WowMachineEverything;
};

async function getSearchResult(addr: SearchAddress, useNewPortfolioMethod: boolean): Promise<WowState> {
  const apiResults = await APIClient.searchForAddress(addr);
  if (!apiResults.geosearch) {
    return {
      value: "pinNotFound",
      context: { searchAddrParams: addr, searchAddrPin: undefined },
    };
  } else if (apiResults.addrs.length === 0) {
    const buildingInfoResults = await APIClient.getBuildingInfo(apiResults.geosearch.pin);
    const buildingInfo = buildingInfoResults.result[0];

    if (!buildingInfo) {
      return {
        value: "pinNotFound",
        context: { searchAddrParams: addr, searchAddrPin: undefined },
      };
    }

    return {
      value: "unregisteredFound",
      context: {
        searchAddrParams: addr,
        searchAddrPin: apiResults.geosearch.pin,
        portfolioData: undefined,
        buildingInfo,
      },
    };
  } else {
    const searchAddr =
      _find(apiResults.addrs, { pin: apiResults.geosearch.pin }) || apiResults.addrs[0];

    return {
      value: "portfolioFound",
      context: {
        searchAddrParams: addr,
        searchAddrPin: apiResults.geosearch.pin,
        portfolioData: {
          searchAddr: searchAddr,
          assocAddrs: apiResults.addrs,
          detailAddr: searchAddr,
        },
      },
    };
  }
}

const createSearchInvoke = (): any => ({
  src: (_: WowContext, event: WowEvent) => {
    if (event.type !== "SEARCH") throw new Error("Expected search event");
    return getSearchResult(event.address, event.useNewPortfolioMethod);
  },
  onDone: [
    {
      target: "pinNotFound",
      actions: assign((_ctx, event: DoneInvokeEvent<WowState>) => {
        if (event.data.value !== "pinNotFound") return {};
        return event.data.context;
      }),
    },
    {
      target: "unregisteredFound",
      actions: assign((_ctx, event: DoneInvokeEvent<WowState>) => {
        if (event.data.value !== "unregisteredFound") return {};
        return event.data.context;
      }),
    },
    {
      target: "portfolioFound",
      actions: assign((_ctx, event: DoneInvokeEvent<WowState>) => {
        if (event.data.value !== "portfolioFound") return {};
        return event.data.context;
      }),
    },
  ],
  onError: {
    target: "networkErrorOccurred",
    actions: (_ctx: WowContext, event: ErrorPlatformEvent) => reportError(event.data),
  },
});

const selectDetailAddr = assign<WowContext, { type: "SELECT_DETAIL_ADDR"; pin: string }>(
  (context, event) => {
  if (!context.portfolioData) {
    throw new Error("Portfolio data is missing.");
  }
  const addr = _find(context.portfolioData.assocAddrs, { pin: event.pin });
  if (!addr) {
    throw new Error("PIN not found in assocAddrs.");
  }
  return {
    portfolioData: {
      ...context.portfolioData,
      detailAddr: addr,
    },
  };
});

const addSearchContext = assign<
  WowContext,
  { type: "SEARCH"; address: SearchAddress; useNewPortfolioMethod: boolean }
>({
  searchAddrParams: (_ctx, event) => event.address,
  useNewPortfolioMethod: (_ctx, event) => event.useNewPortfolioMethod,
});

export const wowMachine = createMachine<WowContext, WowEvent, WowState>(
  {
    id: "wow",
    initial: "noData",
    states: {
      noData: {
        on: {
          SEARCH: {
            target: "searchInProgress",
            actions: addSearchContext,
          },
        },
      },
      searchInProgress: {
        invoke: createSearchInvoke(),
      },
      pinNotFound: {
        on: {
          SEARCH: {
            target: "searchInProgress",
            actions: addSearchContext,
          },
        },
      },
      unregisteredFound: {
        on: {
          SEARCH: {
            target: "searchInProgress",
            actions: addSearchContext,
          },
        },
      },
      portfolioFound: {
        on: {
          SEARCH: {
            target: "searchInProgress",
            actions: addSearchContext,
          },
          SELECT_DETAIL_ADDR: {
            actions: selectDetailAddr,
          },
        },
      },
      networkErrorOccurred: {
        on: {
          SEARCH: {
            target: "searchInProgress",
            actions: addSearchContext,
          },
        },
      },
    },
  },
  {
    delays: {
      DEBOUNCE_TIME: 500,
    },
  }
);
