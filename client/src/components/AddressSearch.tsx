import React from "react";
import Downshift, {
  DownshiftInterface,
  GetInputPropsOptions,
  ControllerStateAndHelpers,
} from "downshift";

import "../styles/AddressSearch.css";

const GeoDownshift = Downshift as DownshiftInterface<SearchAddress>;

const KEY_ENTER = 13;
const KEY_TAB = 9;
const KEY_ESC = 27;
const SEARCH_RESULTS_LIMIT = 5;

export interface SearchAddress {
  housenumber?: string | null;
  streetname: string | null;
  city: string | null;
  state: string | null;
  zip?: string | null;
  pin: string;
}

export interface AddressSearchProps {
  onFormSubmit: (searchAddress: SearchAddress, error: any) => void;
  labelText: string | JSX.Element;
  labelClass: string;
}

type State = {
  isLoading: boolean;
  results: SearchAddress[];
};

export function makeEmptySearchAddress(): SearchAddress {
  return {
    housenumber: "",
    streetname: "",
    city: "",
    state: "",
    zip: "",
    pin: "",
  };
}

export function searchAddressToString(sa: SearchAddress): string {
  const prefix = sa.housenumber ? `${sa.housenumber} ` : "";
  const street = sa.streetname || "";
  const city = sa.city ? `, ${sa.city}` : "";
  const state = sa.state ? `, ${sa.state}` : "";
  return `${prefix}${street}${city}${state}`.trim();
}

async function fetchSearchResults(query: string, signal?: AbortSignal): Promise<SearchAddress[]> {
  const baseUrl = process.env.REACT_APP_API_BASE_URL || "";
  const res = await fetch(`${baseUrl}/api/address/search?q=${encodeURIComponent(query)}`, {
    headers: { accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Search failed with status ${res.status}`);
  }
  const data = await res.json();
  return (data.result || []).map((row: any) => ({
    pin: row.pin,
    housenumber: row.housenumber,
    streetname: row.streetname,
    city: row.city,
    state: row.state,
    zip: row.zip,
  }));
}

export default class AddressSearch extends React.Component<AddressSearchProps, State> {
  private pendingSearch?: number;
  private activeSearch?: AbortController;
  private isUnmounted = false;

  constructor(props: AddressSearchProps) {
    super(props);
    this.state = {
      isLoading: false,
      results: [],
    };
  }

  componentWillUnmount() {
    this.isUnmounted = true;
    if (this.pendingSearch) {
      window.clearTimeout(this.pendingSearch);
    }
    if (this.activeSearch) {
      this.activeSearch.abort();
    }
  }

  handleInputValueChange(value: string) {
    if (!value) {
      if (this.activeSearch) {
        this.activeSearch.abort();
        this.activeSearch = undefined;
      }
      this.setState({ isLoading: false, results: [] });
      return;
    }

    if (this.pendingSearch) {
      window.clearTimeout(this.pendingSearch);
    }
    if (this.activeSearch) {
      this.activeSearch.abort();
    }

    this.setState({ isLoading: true });
    this.pendingSearch = window.setTimeout(async () => {
      this.activeSearch = new AbortController();
      try {
        const results = await fetchSearchResults(value, this.activeSearch.signal);
        if (this.isUnmounted) {
          return;
        }
        this.setState({
          isLoading: false,
          results: results.slice(0, SEARCH_RESULTS_LIMIT),
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        if (this.isUnmounted) {
          return;
        }
        this.setState({ isLoading: false, results: [] });
        this.props.onFormSubmit(makeEmptySearchAddress(), e);
      } finally {
        this.activeSearch = undefined;
      }
    }, 200);
  }

  selectFirstResult(ds: ControllerStateAndHelpers<SearchAddress>): boolean {
    const { results } = this.state;
    if (results.length === 0) return false;
    const index = ds.highlightedIndex === null ? 0 : ds.highlightedIndex;
    const boundedIndex = Math.max(0, Math.min(index, results.length - 1));
    ds.selectItem(results[boundedIndex]);
    return true;
  }

  handleAutocompleteKeyDown(
    ds: ControllerStateAndHelpers<SearchAddress>,
    event: React.KeyboardEvent
  ) {
    const { results } = this.state;
    if (event.keyCode === KEY_ENTER) {
      if (this.selectFirstResult(ds)) {
        event.preventDefault();
      }
    }
    if (results.length > 0) {
      if (event.keyCode === KEY_TAB && !event.shiftKey) {
        ds.setHighlightedIndex(
          ds.highlightedIndex === results.length - 1 || ds.highlightedIndex === null
            ? 0
            : ds.highlightedIndex + 1
        );
        event.preventDefault();
      }
      if (event.keyCode === KEY_TAB && event.shiftKey) {
        ds.setHighlightedIndex(
          ds.highlightedIndex === 0 || ds.highlightedIndex === null
            ? results.length - 1
            : ds.highlightedIndex - 1
        );
        event.preventDefault();
      }
    }
    if (event.keyCode === KEY_ESC) {
      this.setState({
        results: [],
      });
    }
  }

  render() {
    return (
      <GeoDownshift
        stateReducer={(state, changes) => {
          switch (changes.type) {
            case Downshift.stateChangeTypes.mouseUp:
            case Downshift.stateChangeTypes.touchEnd:
            case Downshift.stateChangeTypes.blurInput:
              return {
                ...changes,
                inputValue: state.inputValue,
              };

            default:
              return changes;
          }
        }}
        onChange={(sa) => {
          if (sa) {
            this.props.onFormSubmit(sa, null);
          }
        }}
        itemToString={(sa) => {
          return sa ? searchAddressToString(sa) : "";
        }}
      >
        {(downshift) => {
          const inputOptions: GetInputPropsOptions = {
            onKeyDown: (e) => this.handleAutocompleteKeyDown(downshift, e),
            onChange: (e) => this.handleInputValueChange(e.currentTarget.value),
          };
          const suggestsClasses = ["geosuggest__suggests"];
          if (!(downshift.isOpen && this.state.results.length > 0)) {
            suggestsClasses.push("geosuggest__suggests--hidden");
          }

          return (
            <div className="AddressSearch">
              <div className="form-group col-xs-12">
                <div className="geosuggest">
                  <div className="geosuggest__input-wrapper">
                    <label className={this.props.labelClass} {...downshift.getLabelProps()}>
                      {this.props.labelText}
                    </label>
                    <input
                      autoFocus
                      placeholder="Search Chicago addresses"
                      className="geosuggest__input form-input"
                      {...downshift.getInputProps(inputOptions)}
                    />
                  </div>
                  <div className="geosuggest__suggests-wrapper">
                    <ul className={suggestsClasses.join(" ")} {...downshift.getMenuProps()}>
                      {this.state.results.map((item, index) => {
                        const classes = ["geosuggest__item"];
                        if (downshift.highlightedIndex === index) {
                          classes.push("geosuggest__item--active");
                        }
                        const label = searchAddressToString(item);
                        const props = downshift.getItemProps({
                          key: `${item.pin}-${label}`,
                          index,
                          item,
                        });
                        return (
                          <li className={classes.join(" ")} {...props}>
                            <span>{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      </GeoDownshift>
    );
  }
}
