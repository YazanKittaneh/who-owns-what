"""Unit tests for the Chicago owner-portfolio linking engine.

These tests run WITHOUT a database (pure Python), so they are safe to run in the
backend CI job (`pytest tests wow/tests/test_milestone1.py --ignore=tests/test_sql.py`).
"""

from portfoliograph.chicago import (
    ADDRESS_HUB_THRESHOLD,
    MAX_PORTFOLIO_SIZE,
    build_owner_row,
    build_portfolio_groups,
    is_generic_owner_name,
    normalize_mailing_address,
    normalize_owner_name,
)


# --------------------------------------------------------------------------- #
# normalize_owner_name
# --------------------------------------------------------------------------- #


def test_normalize_owner_name_punctuation_and_suffix_variants_collapse():
    variants = [
        "FUNKY HOLDINGS LLC",
        "Funky Holdings, L.L.C.",
        "  funky   holdings   llc  ",
        "FUNKY HOLDINGS, LLC.",
        "Funky Holdings Inc",
    ]
    normalized = {normalize_owner_name(v) for v in variants}
    assert normalized == {"FUNKY HOLDINGS"}


def test_normalize_owner_name_strips_repeated_suffix_tokens():
    assert normalize_owner_name("FOO LLC CORP") == "FOO"
    assert normalize_owner_name("BAR COMPANY INCORPORATED") == "BAR"


def test_normalize_owner_name_preserves_word_order():
    # No reordering heuristics: "SMITH JOHN" and "JOHN SMITH" stay distinct.
    assert normalize_owner_name("Smith John") == "SMITH JOHN"
    assert normalize_owner_name("John Smith") == "JOHN SMITH"
    assert normalize_owner_name("Smith John") != normalize_owner_name("John Smith")


def test_normalize_owner_name_keeps_numbers():
    assert normalize_owner_name("Chicago Title Land Trust 12345") == (
        "CHICAGO TITLE LAND TRUST 12345"
    )


def test_normalize_owner_name_empty_and_none():
    assert normalize_owner_name("") == ""
    assert normalize_owner_name(None) == ""
    assert normalize_owner_name("   ") == ""
    # A name that is nothing but a suffix token normalizes to empty.
    assert normalize_owner_name("LLC") == ""


# --------------------------------------------------------------------------- #
# normalize_mailing_address
# --------------------------------------------------------------------------- #


def test_normalize_mailing_address_basic():
    assert (
        normalize_mailing_address("1 Main St", "Chicago", "IL", "60601")
        == "1 MAIN ST CHICAGO IL 60601"
    )


def test_normalize_mailing_address_strips_unit_designators():
    with_unit = normalize_mailing_address("1 Main St Apt 5", "Chicago", "IL", "60601")
    without_unit = normalize_mailing_address("1 Main St", "Chicago", "IL", "60601")
    assert with_unit == without_unit == "1 MAIN ST CHICAGO IL 60601"
    assert (
        normalize_mailing_address("500 W Madison Ste 200", "Chicago", "IL", "60661")
        == "500 W MADISON CHICAGO IL 60661"
    )
    assert (
        normalize_mailing_address("77 State #3B", "Chicago", "IL", "60601")
        == "77 STATE CHICAGO IL 60601"
    )


def test_normalize_mailing_address_zip_digits_only_first_five():
    assert (
        normalize_mailing_address("1 Main St", "Chicago", "IL", "60601-1234")
        == "1 MAIN ST CHICAGO IL 60601"
    )


def test_normalize_mailing_address_none_when_street_empty():
    assert normalize_mailing_address("", "Chicago", "IL", "60601") is None
    assert normalize_mailing_address(None, "Chicago", "IL", "60601") is None
    assert normalize_mailing_address("   ", "Chicago", "IL", "60601") is None


# --------------------------------------------------------------------------- #
# is_generic_owner_name
# --------------------------------------------------------------------------- #


def test_is_generic_owner_name_blocklist():
    assert is_generic_owner_name("CITY OF CHICAGO") is True
    assert is_generic_owner_name("COUNTY OF COOK") is True
    assert is_generic_owner_name("STATE OF ILLINOIS") is True
    assert is_generic_owner_name("UNKNOWN") is True


def test_is_generic_owner_name_specific_names_not_generic():
    assert is_generic_owner_name("FUNKY HOLDINGS") is False
    assert is_generic_owner_name("") is False


def test_is_generic_owner_name_trustee_prefix_handling():
    # Bare trustee company name (no trust number) is generic...
    assert is_generic_owner_name("CHICAGO TITLE LAND TRUST") is True
    assert is_generic_owner_name("ATG TRUST") is True
    # ...but one with a trust number is specific and allowed to merge.
    assert is_generic_owner_name("CHICAGO TITLE LAND TRUST 12345") is False
    assert is_generic_owner_name("ATG TRUST 98765") is False


# --------------------------------------------------------------------------- #
# build_portfolio_groups
# --------------------------------------------------------------------------- #


def _assert_pins_partitioned(groups, expected_pins):
    """Every expected pin appears in exactly one group, and no extras."""
    seen = []
    for group in groups:
        seen.extend(group.pins)
    assert sorted(seen) == sorted(expected_pins)
    assert len(seen) == len(set(seen)), "a pin appeared in more than one group"


def _group_containing(groups, pin):
    matches = [g for g in groups if pin in g.pins]
    assert len(matches) == 1
    return matches[0]


def test_same_normalized_name_different_punctuation_merges():
    rows = [
        build_owner_row(
            "PIN1",
            "Funky Holdings, L.L.C.",
            "1 Main St",
            "Chicago",
            "IL",
            "60601",
            "O1",
        ),
        build_owner_row(
            "PIN2", "FUNKY HOLDINGS LLC", "9 Other Ave", "Chicago", "IL", "60614", "O2"
        ),
    ]
    groups = build_portfolio_groups(rows)
    _assert_pins_partitioned(groups, ["PIN1", "PIN2"])
    group = _group_containing(groups, "PIN1")
    assert set(group.pins) == {"PIN1", "PIN2"}
    # Raw owner names are preserved (owner_names containment is used by tests).
    assert "FUNKY HOLDINGS LLC" in group.owner_names
    assert "Funky Holdings, L.L.C." in group.owner_names


def test_different_names_sharing_normalized_address_merge():
    rows = [
        build_owner_row(
            "P1", "Alpha Group LLC", "500 West St", "Chicago", "IL", "60601", "A"
        ),
        build_owner_row(
            "P2", "Beta Ventures Inc", "500 West St", "Chicago", "IL", "60601", "B"
        ),
    ]
    groups = build_portfolio_groups(rows)
    _assert_pins_partitioned(groups, ["P1", "P2"])
    assert set(_group_containing(groups, "P1").pins) == {"P1", "P2"}


def test_generic_name_rows_never_merge_even_sharing_address():
    shared = ("121 N LaSalle St", "Chicago", "IL", "60602")
    rows = [
        build_owner_row("P1", "City of Chicago", *shared, "G1"),
        build_owner_row("P2", "County of Cook", *shared, "G2"),
        build_owner_row("P3", "Alpha Holdings LLC", *shared, "A1"),
    ]
    groups = build_portfolio_groups(rows)
    _assert_pins_partitioned(groups, ["P1", "P2", "P3"])
    # All three land in distinct portfolios despite the shared address.
    assert _group_containing(groups, "P1").pins == ["P1"]
    assert _group_containing(groups, "P2").pins == ["P2"]
    assert _group_containing(groups, "P3").pins == ["P3"]


def test_generic_name_rows_group_by_exact_raw_name():
    shared = ("121 N LaSalle St", "Chicago", "IL", "60602")
    rows = [
        build_owner_row("P1", "City of Chicago", *shared, "G1"),
        build_owner_row(
            "P2", "City of Chicago", "22 Random Rd", "Chicago", "IL", "60601", "G2"
        ),
    ]
    groups = build_portfolio_groups(rows)
    _assert_pins_partitioned(groups, ["P1", "P2"])
    # Identical raw generic name -> one portfolio (old exact-string behavior).
    group = _group_containing(groups, "P1")
    assert set(group.pins) == {"P1", "P2"}
    assert group.owner_names == ["City of Chicago"]


def test_high_degree_address_creates_no_merges():
    n_names = ADDRESS_HUB_THRESHOLD + 10
    shared = ("1000 Hub Plaza", "Chicago", "IL", "60601")
    rows = [
        build_owner_row(f"P{i}", f"Owner Number {i} LLC", *shared, f"O{i}")
        for i in range(n_names)
    ]
    groups = build_portfolio_groups(rows)
    _assert_pins_partitioned(groups, [f"P{i}" for i in range(n_names)])
    # Hub address dropped -> no merges -> one singleton portfolio per name.
    assert len(groups) == n_names
    assert all(len(g.pins) == 1 for g in groups)


def test_empty_name_rows_become_singletons_by_fallback_key():
    rows = [
        build_owner_row("P1", "", "", "", "", "", "OWN_ROW_1"),
        build_owner_row("P2", "", "", "", "", "", ""),  # no name, no row_id -> pin
    ]
    groups = build_portfolio_groups(rows)
    _assert_pins_partitioned(groups, ["P1", "P2"])
    assert _group_containing(groups, "P1").owner_names == ["OWN_ROW_1"]
    assert _group_containing(groups, "P2").owner_names == ["P2"]


def test_large_component_is_split_by_louvain():
    rows = []
    # Two dense clusters, each a star of many names sharing one address, joined
    # by a single weak bridge so the combined component exceeds MAX_PORTFOLIO_SIZE
    # and Louvain splits it back into (at least) two smaller portfolios.
    cluster_addrs = ["100 Cluster A St", "900 Cluster B Ave"]
    names_per_cluster = 60
    pins_per_name = 4
    all_pins = []
    for c, addr in enumerate(cluster_addrs):
        for n in range(names_per_cluster):
            name = f"Cluster {c} Owner {n} LLC"
            for k in range(pins_per_name):
                pin = f"C{c}N{n}K{k}"
                all_pins.append(pin)
                rows.append(
                    build_owner_row(pin, name, addr, "Chicago", "IL", "60601", pin)
                )
    # Weak bridge: one cluster-A name also occurs at cluster-B's address once.
    bridge_pin = "BRIDGE"
    all_pins.append(bridge_pin)
    rows.append(
        build_owner_row(
            bridge_pin,
            "Cluster 0 Owner 0 LLC",
            cluster_addrs[1],
            "Chicago",
            "IL",
            "60601",
            bridge_pin,
        )
    )

    total = len(all_pins)
    assert total > MAX_PORTFOLIO_SIZE

    groups = build_portfolio_groups(rows)
    _assert_pins_partitioned(groups, all_pins)
    # The component was split into multiple portfolios, each smaller than the whole.
    assert len(groups) >= 2
    assert all(len(g.pins) < total for g in groups)


def test_every_pin_appears_exactly_once_mixed_input():
    rows = [
        build_owner_row("A1", "Alpha LLC", "1 Main St", "Chicago", "IL", "60601", "R1"),
        build_owner_row(
            "A2", "Alpha, L.L.C.", "2 Main St", "Chicago", "IL", "60601", "R2"
        ),
        build_owner_row("B1", "Beta Inc", "1 Main St", "Chicago", "IL", "60601", "R3"),
        build_owner_row(
            "G1", "City of Chicago", "50 City Hall", "Chicago", "IL", "60602", "R4"
        ),
        build_owner_row("S1", "", "", "", "", "", "R5"),
        build_owner_row(
            "Z1", "Zeta Corp", "77 Lake Shore Dr", "Chicago", "IL", "60611", "R6"
        ),
    ]
    groups = build_portfolio_groups(rows)
    _assert_pins_partitioned(groups, ["A1", "A2", "B1", "G1", "S1", "Z1"])
    # Alpha (name merge) + Beta (address merge to 1 Main St) form one portfolio.
    assert set(_group_containing(groups, "A1").pins) == {"A1", "A2", "B1"}
    # Zeta is unrelated -> its own portfolio.
    assert _group_containing(groups, "Z1").pins == ["Z1"]


def test_graph_json_only_for_small_groups():
    rows = [
        build_owner_row("P1", "Alpha LLC", "1 Main St", "Chicago", "IL", "60601", "A"),
        build_owner_row("P2", "Beta Inc", "1 Main St", "Chicago", "IL", "60601", "B"),
    ]
    groups = build_portfolio_groups(rows)
    group = _group_containing(groups, "P1")
    assert group.graph["nodes"]
    kinds = {node["kind"] for node in group.graph["nodes"]}
    assert kinds == {"name", "bizaddr"}
    assert group.graph["edges"]
