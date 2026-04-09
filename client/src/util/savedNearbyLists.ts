import { NearbyPropertyRecord } from "components/APIDataTypes";

export type SavedNearbyParcel = {
  kind: "parcel";
  key: string;
  pin: string;
  address: string;
  ownerName: string;
  mailingAddress: string;
  sourcePin: string;
  distanceM: number | null;
  createdAt: string;
};

export type SavedNearbyOwner = {
  kind: "owner";
  key: string;
  ownerType: "id" | "name";
  ownerKey: string;
  ownerName: string;
  mailingAddress: string;
  parcelCount: number;
  parcelPins: string[];
  sourcePin: string;
  nearestDistanceM: number | null;
  createdAt: string;
};

export type SavedNearbyListItem = SavedNearbyParcel | SavedNearbyOwner;

const STORAGE_KEY = "wow-saved-nearby-lists";
export const SAVED_NEARBY_LISTS_EVENT = "wow-saved-nearby-lists-updated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll(): SavedNearbyListItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: SavedNearbyListItem[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(SAVED_NEARBY_LISTS_EVENT));
}

export function loadSavedNearbyItems(): SavedNearbyListItem[] {
  return readAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function removeSavedNearbyItem(key: string) {
  writeAll(readAll().filter((item) => item.key !== key));
}

export function isSavedNearbyItem(key: string) {
  return readAll().some((item) => item.key === key);
}

export function saveNearbyParcel(params: {
  record: NearbyPropertyRecord;
  sourcePin: string;
  address: string;
  ownerName: string;
  mailingAddress: string;
}) {
  const key = `parcel:${params.record.pin}`;
  if (isSavedNearbyItem(key)) return key;
  writeAll([
    {
      kind: "parcel",
      key,
      pin: params.record.pin,
      address: params.address,
      ownerName: params.ownerName,
      mailingAddress: params.mailingAddress,
      sourcePin: params.sourcePin,
      distanceM: params.record.distance_m ?? null,
      createdAt: new Date().toISOString(),
    },
    ...readAll(),
  ]);
  return key;
}

export function saveNearbyOwner(params: {
  ownerType: "id" | "name";
  ownerKey: string;
  ownerName: string;
  mailingAddress: string;
  parcelCount: number;
  parcelPins: string[];
  sourcePin: string;
  nearestDistanceM: number | null;
}) {
  const key = `owner:${params.ownerType}:${params.ownerKey}`;
  if (isSavedNearbyItem(key)) return key;
  writeAll([
    {
      kind: "owner",
      key,
      ownerType: params.ownerType,
      ownerKey: params.ownerKey,
      ownerName: params.ownerName,
      mailingAddress: params.mailingAddress,
      parcelCount: params.parcelCount,
      parcelPins: params.parcelPins,
      sourcePin: params.sourcePin,
      nearestDistanceM: params.nearestDistanceM,
      createdAt: new Date().toISOString(),
    },
    ...readAll(),
  ]);
  return key;
}
