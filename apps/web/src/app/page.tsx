import AddressSearchForm from "@/components/search/AddressSearchForm";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <h1>Who Owns What</h1>
      <p>OpenNext + Convex rewrite (MVP parity in progress).</p>
      <AddressSearchForm />
    </main>
  );
}
