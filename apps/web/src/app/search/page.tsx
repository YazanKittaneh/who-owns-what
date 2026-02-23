import SearchResults from "@/components/search/SearchResults";
import { DataSourceUnavailableError, searchAddresses } from "@/lib/dataSource";
import type { AddressRecord } from "@/lib/mvpData";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  let results: AddressRecord[] = [];
  let dataError = "";

  try {
    results = await searchAddresses(query);
  } catch (error) {
    if (error instanceof DataSourceUnavailableError) {
      dataError = error.message;
    } else {
      throw error;
    }
  }

  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <h1>Search Results</h1>
      {dataError ? <p>{dataError}</p> : null}
      <SearchResults query={query} results={results} />
    </main>
  );
}
