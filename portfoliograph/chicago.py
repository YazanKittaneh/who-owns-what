"""Owner-portfolio linking engine for the Chicago fork of Who Owns What.

This module replaces the old exact-string ``GROUP BY mail_address_name`` linking
with a normalization + graph engine (see GitHub issue #7).

Everything here is pure Python and unit-testable without a database. The only
third-party dependency is :mod:`networkx` (used for connected components and the
Louvain community split for very large portfolios).

The public entry point is :func:`build_portfolio_groups`, which takes an
iterable of :class:`OwnerRow` and returns a list of :class:`PortfolioGroup`.
:func:`portfoliograph.table.populate_portfolios_table` reads owner rows from the
database, feeds them through this engine, and writes the result back to
``wow_portfolios``.
"""

from __future__ import annotations

import logging
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Iterator, List, NamedTuple, Optional, Set, Tuple

import networkx as nx

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Tuning constants
# --------------------------------------------------------------------------- #

# Maximum number of parcel pins in a single portfolio before we attempt to split
# it into smaller communities with the Louvain algorithm (ported from the
# upstream NYC graph.py, which used the same value against BBL counts).
MAX_PORTFOLIO_SIZE = 300

# An address linked to more than this many distinct normalized owner names is
# treated as a registered-agent / mass-PO-box "hub" and dropped from the graph
# so it cannot merge otherwise-unrelated portfolios.
ADDRESS_HUB_THRESHOLD = 50

# Portfolios with more than this many graph nodes get an empty graph ('{}') to
# avoid bloating the jsonb column; the graph field is not consumed downstream.
MAX_GRAPH_NODES = 50

# Louvain resolution, matching the upstream splitting logic in graph.py.
LOUVAIN_RESOLUTION = 0.1

# --------------------------------------------------------------------------- #
# Name / address normalization
# --------------------------------------------------------------------------- #

# Entity-suffix tokens stripped from the "core" owner name. This mirrors the
# token list used in sql/create_business_linkage_summary.sql. Longer, multi-word
# variants are listed first so the alternation prefers them.
_ENTITY_SUFFIX_TOKENS = [
    "INCORPORATED",
    "CORPORATION",
    "COMPANY",
    "LIMITED",
    "PLLC",
    "P L L C",
    "L L C",
    "LLC",
    "L L P",
    "LLP",
    "L P",
    "LP",
    "P C",
    "PC",
    "INC",
    "CORP",
    "CO",
    "LTD",
]

_ENTITY_SUFFIX_RE = re.compile(r"\b(?:" + "|".join(_ENTITY_SUFFIX_TOKENS) + r")\b")

_NON_ALNUM_RE = re.compile(r"[^A-Z0-9]+")
_WHITESPACE_RE = re.compile(r"\s+")
_NON_DIGIT_RE = re.compile(r"\D+")

# Unit / secondary-designator tokens stripped from a street address, along with
# the token that follows them (e.g. "APT 5", "STE 200", "#3B"). Mirrors the
# no-unit address normalization in sql/create_business_linkage_summary.sql.
_UNIT_RE = re.compile(
    r"(?:\b(?:APARTMENT|APT|UNIT|SUITE|STE|FLOOR|FL|ROOM|RM)\b|#)\s*[A-Z0-9-]*"
)


def normalize_owner_name(raw: Optional[str]) -> str:
    """Normalize a free-text owner/taxpayer name to a comparison key.

    Uppercases, replaces punctuation with spaces, collapses whitespace, and
    strips entity-suffix tokens (LLC, INC, CORP, ...) with word boundaries so
    punctuation-only variants collapse to the same key. Numbers are preserved
    (they distinguish e.g. numbered land trusts). Word order is preserved -- no
    reordering heuristics -- so "SMITH JOHN" and "JOHN SMITH" stay distinct.

    >>> normalize_owner_name("Funky Holdings, L.L.C.")
    'FUNKY HOLDINGS'
    >>> normalize_owner_name("FUNKY HOLDINGS LLC")
    'FUNKY HOLDINGS'
    >>> normalize_owner_name("Smith John") != normalize_owner_name("John Smith")
    True
    >>> normalize_owner_name("  ")
    ''
    """
    if not raw:
        return ""
    text = _NON_ALNUM_RE.sub(" ", raw.upper())
    text = _WHITESPACE_RE.sub(" ", text).strip()
    if not text:
        return ""
    # Strip suffix tokens repeatedly so chained suffixes ("FOO LLC CORP") and any
    # adjacencies created by removal are all resolved.
    while True:
        stripped = _ENTITY_SUFFIX_RE.sub(" ", text)
        stripped = _WHITESPACE_RE.sub(" ", stripped).strip()
        if stripped == text:
            break
        text = stripped
    return text


def _normalize_plain(value: Optional[str]) -> str:
    """Uppercase, replace non-alphanumerics with spaces, collapse whitespace."""
    if not value:
        return ""
    text = _NON_ALNUM_RE.sub(" ", value.upper())
    return _WHITESPACE_RE.sub(" ", text).strip()


def _normalize_street(value: Optional[str]) -> str:
    """Like :func:`_normalize_plain` but also strips unit/secondary designators."""
    if not value:
        return ""
    text = _UNIT_RE.sub(" ", value.upper())
    text = _NON_ALNUM_RE.sub(" ", text)
    return _WHITESPACE_RE.sub(" ", text).strip()


def normalize_mailing_address(
    full: Optional[str],
    city: Optional[str],
    state: Optional[str],
    zip_code: Optional[str],
) -> Optional[str]:
    """Normalize a mailing address to "FULL CITY STATE ZIP5".

    The street portion is unit-stripped and de-punctuated; the ZIP is reduced to
    its first five digits. Returns ``None`` when the street part is empty (an
    address with no street is not a useful merge key).

    >>> normalize_mailing_address("1 Main St Apt 5", "Chicago", "IL", "60601-1234")
    '1 MAIN ST CHICAGO IL 60601'
    >>> normalize_mailing_address("", "Chicago", "IL", "60601") is None
    True
    """
    street = _normalize_street(full)
    if not street:
        return None
    parts = [street]
    city_norm = _normalize_plain(city)
    if city_norm:
        parts.append(city_norm)
    state_norm = _normalize_plain(state)
    if state_norm:
        parts.append(state_norm)
    zip5 = _NON_DIGIT_RE.sub("", zip_code or "")[:5]
    if zip5:
        parts.append(zip5)
    return " ".join(parts)


# --------------------------------------------------------------------------- #
# Generic / placeholder owner names
# --------------------------------------------------------------------------- #

# Normalized owner names that must NEVER form merge edges. Each row with such a
# name stays its own portfolio, grouped only by the exact raw name (as the old
# exact-string GROUP BY did). These are government bodies and placeholder values.
# Extend this set as new placeholder names are discovered.
GENERIC_NAME_BLOCKLIST: Set[str] = {
    "CITY OF CHICAGO",
    "COUNTY OF COOK",
    "COOK COUNTY",
    "STATE OF ILLINOIS",
    "TAXPAYER OF",
    "CURRENT OWNER",
    "OWNER OF RECORD",
    "UNKNOWN",
    "PROPERTY OWNER",
}

# Corporate-trustee company names that are generic on their own (a bare trustee,
# no specific trust identified). A name that starts with one of these prefixes
# but contains digits (e.g. a trust number) is specific and IS allowed to merge.
# Extend this list as new corporate trustees are discovered.
GENERIC_TRUSTEE_PREFIXES: List[str] = [
    "CHICAGO TITLE LAND TRUST",
    "ATG TRUST",
]


def is_generic_owner_name(normalized: str) -> bool:
    """Return True if a *normalized* owner name must never form merge edges.

    >>> is_generic_owner_name("CITY OF CHICAGO")
    True
    >>> is_generic_owner_name("CHICAGO TITLE LAND TRUST")
    True
    >>> is_generic_owner_name("CHICAGO TITLE LAND TRUST 12345")
    False
    >>> is_generic_owner_name("FUNKY HOLDINGS")
    False
    """
    if not normalized:
        return False
    if normalized in GENERIC_NAME_BLOCKLIST:
        return True
    has_digit = any(ch.isdigit() for ch in normalized)
    for prefix in GENERIC_TRUSTEE_PREFIXES:
        if normalized == prefix or normalized.startswith(prefix + " "):
            # A bare trustee name (no trust number) is generic; one with a
            # numeric trust identifier is a specific trust and is allowed.
            if not has_digit:
                return True
    return False


# --------------------------------------------------------------------------- #
# Engine input / output types
# --------------------------------------------------------------------------- #


class OwnerRow(NamedTuple):
    """One latest-year owner record for a single parcel pin.

    ``fallback_key`` mirrors the old ``coalesce(nullif(name,''),
    nullif(row_id,''), pin)`` grouping key and is used as both the group key and
    the owner name for non-mergeable rows (generic or empty names).
    """

    pin: str
    raw_name: str
    name_norm: str
    addr_norm: Optional[str]
    fallback_key: str


def build_owner_row(
    pin: str,
    mail_address_name: Optional[str],
    mail_address_full: Optional[str],
    mail_address_city_name: Optional[str],
    mail_address_state: Optional[str],
    mail_address_zipcode_1: Optional[str],
    row_id: Optional[str],
) -> OwnerRow:
    """Build an :class:`OwnerRow` from raw database column values."""
    raw_name = (mail_address_name or "").strip()
    name_norm = normalize_owner_name(raw_name)
    addr_norm = normalize_mailing_address(
        mail_address_full,
        mail_address_city_name,
        mail_address_state,
        mail_address_zipcode_1,
    )
    fallback_key = raw_name or (row_id or "").strip() or (pin or "").strip()
    return OwnerRow(
        pin=pin,
        raw_name=raw_name,
        name_norm=name_norm,
        addr_norm=addr_norm,
        fallback_key=fallback_key,
    )


@dataclass
class PortfolioGroup:
    """A resolved portfolio: its parcel pins, owner names, and viz graph."""

    pins: List[str]
    owner_names: List[str]
    graph: Dict[str, Any]


# Node identifiers in the bipartite graph are (kind, value) tuples.
NodeId = Tuple[str, str]


# --------------------------------------------------------------------------- #
# Graph building
# --------------------------------------------------------------------------- #


def _portfolio_pin_count(subgraph: Any) -> int:
    """Total number of parcel pins attached to the name-nodes of a subgraph."""
    total = 0
    for _node, data in subgraph.nodes(data=True):
        pins = data.get("pins")
        if pins:
            total += len(pins)
    return total


def _split_component(graph: nx.Graph, subgraph: Any) -> Iterator[Any]:
    """Recursively split an over-large component via Louvain communities.

    Ported from ``iter_split_graph`` / ``split_subgraph_if`` in graph.py, adapted
    to count pins instead of BBLs. If a Louvain pass fails to shrink a community
    (it returns the whole thing again), we stop recursing on that community to
    avoid infinite recursion.
    """
    if _portfolio_pin_count(subgraph) > MAX_PORTFOLIO_SIZE:
        communities = nx.community.louvain_communities(
            subgraph, resolution=LOUVAIN_RESOLUTION, weight="weight"
        )
        for community in communities:
            community_subgraph = graph.subgraph(community)
            if _portfolio_pin_count(community_subgraph) == _portfolio_pin_count(
                subgraph
            ):
                yield community_subgraph
            else:
                yield from _split_component(graph, community_subgraph)
    else:
        yield subgraph


def _graph_to_json(subgraph: Any) -> Dict[str, Any]:
    """Serialize a portfolio subgraph to the compact viz JSON schema."""
    index: Dict[NodeId, int] = {}
    nodes: List[Dict[str, Any]] = []
    for i, (node, data) in enumerate(subgraph.nodes(data=True)):
        index[node] = i
        nodes.append({"id": i, "kind": data["kind"], "value": data["value"]})
    edges: List[Dict[str, Any]] = []
    for source, target, data in subgraph.edges(data=True):
        edges.append(
            {
                "source": index[source],
                "target": index[target],
                "weight": data.get("weight", 1),
            }
        )
    return {"nodes": nodes, "edges": edges}


def _group_from_subgraph(subgraph: Any) -> PortfolioGroup:
    """Collect pins, raw owner names, and graph JSON from a component subgraph."""
    pins: Set[str] = set()
    names: Set[str] = set()
    for _node, data in subgraph.nodes(data=True):
        if data.get("kind") == "name":
            pins.update(data["pins"])
            names.update(data["names"])
    if subgraph.number_of_nodes() <= MAX_GRAPH_NODES:
        graph_json = _graph_to_json(subgraph)
    else:
        graph_json = {}
    return PortfolioGroup(
        pins=sorted(pins),
        owner_names=sorted(names),
        graph=graph_json,
    )


def build_portfolio_groups(rows: Iterable[OwnerRow]) -> List[PortfolioGroup]:
    """Group owner rows into portfolios via normalization + a bipartite graph.

    Mergeable rows (non-empty, non-generic normalized names) become a bipartite
    graph of name-nodes and address-nodes; connected components are portfolios,
    and components larger than :data:`MAX_PORTFOLIO_SIZE` pins are split with
    Louvain. Rows with generic or empty names never form edges and are grouped
    only by their exact fallback key, preserving the old exact-string behavior.

    Every input pin appears in exactly one output group.
    """
    mergeable: List[OwnerRow] = []
    # Non-mergeable rows grouped by exact fallback key -> (pins, names).
    exact_pins: Dict[str, Set[str]] = defaultdict(set)

    for row in rows:
        if row.name_norm == "" or is_generic_owner_name(row.name_norm):
            exact_pins[row.fallback_key].add(row.pin)
        else:
            mergeable.append(row)

    groups: List[PortfolioGroup] = []

    # Detect high-degree "hub" addresses (registered agents / mass PO boxes)
    # linked to many distinct owner names, and drop them from the graph.
    addr_to_names: Dict[str, Set[str]] = defaultdict(set)
    for row in mergeable:
        if row.addr_norm:
            addr_to_names[row.addr_norm].add(row.name_norm)
    hub_addrs = {
        addr
        for addr, names in addr_to_names.items()
        if len(names) > ADDRESS_HUB_THRESHOLD
    }
    if hub_addrs:
        logger.info(
            "Dropping %d high-degree address node(s) (> %d distinct names)",
            len(hub_addrs),
            ADDRESS_HUB_THRESHOLD,
        )

    graph = nx.Graph()

    # Name-nodes carry the pins and raw owner names they represent.
    for row in mergeable:
        name_node: NodeId = ("name", row.name_norm)
        if name_node not in graph:
            graph.add_node(
                name_node,
                kind="name",
                value=row.name_norm,
                pins=set(),
                names=set(),
            )
        graph.nodes[name_node]["pins"].add(row.pin)
        graph.nodes[name_node]["names"].add(row.raw_name)

    # Address edges (weight = co-occurrence count), excluding hub addresses.
    edge_weights: Counter[Tuple[NodeId, NodeId]] = Counter()
    for row in mergeable:
        if not row.addr_norm or row.addr_norm in hub_addrs:
            continue
        name_node = ("name", row.name_norm)
        addr_node: NodeId = ("bizaddr", row.addr_norm)
        edge_weights[(name_node, addr_node)] += 1
    for (name_node, addr_node), weight in edge_weights.items():
        if addr_node not in graph:
            graph.add_node(addr_node, kind="bizaddr", value=addr_node[1])
        graph.add_edge(name_node, addr_node, weight=weight)

    for component in nx.connected_components(graph):
        component_subgraph = graph.subgraph(component)
        for split_subgraph in _split_component(graph, component_subgraph):
            group = _group_from_subgraph(split_subgraph)
            # A Louvain split can isolate a community of address-nodes only;
            # such a group carries no parcels and must not produce a row
            # (mirrors the old SQL's HAVING count(p.pin) > 0 guard).
            if group.pins:
                groups.append(group)

    # Non-mergeable exact-key groups (generic/empty names): owner name == key.
    for key, pins in exact_pins.items():
        groups.append(
            PortfolioGroup(
                pins=sorted(pins),
                owner_names=[key],
                graph={},
            )
        )

    return groups
