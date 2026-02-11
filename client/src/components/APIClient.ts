import { SearchResults, BuildingInfoResults } from "./APIDataTypes";
import { SearchAddress } from "./AddressSearch";
import { NetworkError, HTTPError } from "error-reporting";

function searchForAddress(searchAddress: SearchAddress): Promise<SearchResults> {
  if (!searchAddress.pin) {
    return Promise.resolve({ addrs: [], geosearch: undefined });
  }
  return getApiJson(`/api/address?pin=${encodeURIComponent(searchAddress.pin)}`);
}

function getBuildingInfo(pin: string): Promise<BuildingInfoResults> {
  return getApiJson(`/api/address/buildinginfo?pin=${encodeURIComponent(pin)}`);
}

const friendlyFetch: typeof fetch = async (input, init) => {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (e) {
    if (e instanceof Error) {
      throw new NetworkError(e.message);
    } else {
      throw new Error("Unexpected error");
    }
  }
  if (!response.ok) {
    throw new HTTPError(response);
  }
  return response;
};

function apiURL(url: string): string {
  return `${process.env.REACT_APP_API_BASE_URL || ""}${url}`;
}

async function getApiJson(url: string): Promise<any> {
  const res = await friendlyFetch(apiURL(url), { headers: { accept: "application/json" } });
  const contentType = res.headers.get("Content-Type");
  if (!(contentType && /^application\/json/.test(contentType))) {
    throw new NetworkError(`Expected JSON response but got ${contentType} from ${res.url}`, true);
  }
  try {
    return await res.json();
  } catch (e) {
    if (e instanceof Error) {
      throw new NetworkError(e.message);
    } else {
      throw new Error("Unexpected error");
    }
  }
}

const Client = {
  searchForAddress,
  getBuildingInfo,
};

export default Client;
