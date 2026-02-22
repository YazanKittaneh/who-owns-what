import SearchResults from "@/components/search/SearchResults";
import { searchAddresses } from "@/lib/mvpData";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const results = searchAddresses(query);

  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <h1>Search Results</h1>
      <SearchResults query={query} results={results} />
    </main>
  );
}
