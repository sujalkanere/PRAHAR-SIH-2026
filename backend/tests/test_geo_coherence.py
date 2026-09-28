"""Unit tests verifying geographic coherence and variance (Q1.4 items 2 and 3)."""
import pytest
from app.services.official_dataset_seeder import _sanitize_work_geo
from app.services.synthetic_generator import generate_synthetic, GeneratorParams


def test_sanitize_work_geo_for_pune():
    """Q1.4.2: Ensure Jammu & Kashmir location text is never filed under Pune."""
    raw_desc = "Medical Office, Primary Health Center, Duddi, Dis. Kupwada, Jammu & Kashmir Providing of Ambulance."
    raw_agency = "KUPWARA(Deputy Commissioner Kupwara_IDA)"
    mp_name = "Dr. Medha Vishram Kulkarni (2024-30)"

    sanitized_desc, sanitized_agency, centroid = _sanitize_work_geo(raw_desc, raw_agency, mp_name, "Maharashtra")

    assert "Kupwada" not in sanitized_desc
    assert "Jammu & Kashmir" not in sanitized_desc
    assert "Pune" in sanitized_desc
    assert "Maharashtra" in sanitized_desc
    assert "KUPWARA" not in sanitized_agency.upper()
    assert "PUNE" in sanitized_agency.upper()
    assert centroid == (18.5204, 73.8567)


def test_synthetic_generator_geographic_coherence_and_variance():
    """Q1.4.2 & Q1.4.3: Synthetic generator incorporates district in description and provides variance."""
    params = GeneratorParams(num_constituencies=5, num_works_per_constituency=30, seed=123)
    res = generate_synthetic(params)
    works_df = res["works"]

    # Check geographic coherence
    for _, row in works_df.iterrows():
        desc = row["work_description"]
        dist = row["district_name"]
        assert dist.lower() in desc.lower(), f"Work description '{desc}' must include assigned district '{dist}'"

    # Check independent variance of expenditure (paisa-level precision, non-repetitive)
    expenditures = works_df["actual_expenditure"].tolist()
    unique_exp = set(expenditures)
    # Almost all generated expenditures should be distinct
    assert len(unique_exp) > len(expenditures) * 0.90
