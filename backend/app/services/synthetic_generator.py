"""Synthetic MPLADS data generator (FR-DIM-002).

Produces realistic synthetic MPLADS datasets where:
  - All 34 states & UTs across India are tracked with data.
  - "Andaman and Nicobar" is the ONLY untracked territory (showing No Data Tracked).
  - Anomaly Injection Rate (%) directly scales the anomaly prevalence and risk levels.
  - Ingests all 6 risk dimensions: Cost, Delay, Payment, Duplicate, Compliance, Durability.
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date, timedelta
import pandas as pd

# ---------------------------------------------------------------------------
# All 34 tracked states & UTs across India (Andaman and Nicobar is excluded)
# ---------------------------------------------------------------------------
ALL_STATES_CONFIG: dict[str, list[tuple[str, str, str]]] = {
    # Tier 1 (Predisposed to Critical / High when anomaly rate is active)
    "Bihar": [
        ("Patna Sahib", "Patna", "Ravi Shankar Prasad"),
        ("Saran", "Saran", "Rajiv Pratap Rudy"),
        ("Gaya", "Gaya", "Jitan Ram Manjhi"),
        ("Muzaffarpur", "Muzaffarpur", "Raj Bhushan Choudhary"),
        ("Begusarai", "Begusarai", "Giriraj Singh"),
    ],
    "Uttar Pradesh": [
        ("Varanasi", "Varanasi", "Narendra Modi"),
        ("Lucknow", "Lucknow", "Rajnath Singh"),
        ("Gorakhpur", "Gorakhpur", "Ravi Kishan"),
        ("Kanpur", "Kanpur Nagar", "Ramesh Awasthi"),
        ("Agra", "Agra", "S. P. Singh Baghel"),
    ],
    "West Bengal": [
        ("Kolkata South", "Kolkata", "Mala Roy"),
        ("Kolkata North", "Kolkata", "Sudip Bandyopadhyay"),
        ("Howrah", "Howrah", "Prasun Banerjee"),
        ("Darjeeling", "Darjeeling", "Raju Bista"),
        ("Asansol", "Paschim Bardhaman", "Shatrughan Sinha"),
    ],
    "Jharkhand": [
        ("Ranchi", "Ranchi", "Sanjay Seth"),
        ("Jamshedpur", "East Singhbhum", "Bidyut Baran Mahato"),
        ("Dhanbad", "Dhanbad", "Dulu Mahato"),
        ("Hazaribagh", "Hazaribagh", "Manish Jaiswal"),
    ],
    "Punjab": [
        ("Ludhiana", "Ludhiana", "Amrinder Singh Raja Warring"),
        ("Amritsar", "Amritsar", "Gurjeet Singh Aujla"),
        ("Jalandhar", "Jalandhar", "Charanjit Singh Channi"),
        ("Patiala", "Patiala", "Dharamvir Gandhi"),
    ],

    # Tier 2 (Predisposed to High / Medium)
    "Maharashtra": [
        ("Mumbai South", "Mumbai City", "Arvind Sawant"),
        ("Pune", "Pune", "Murlidhar Mohol"),
        ("Nagpur", "Nagpur", "Nitin Gadkari"),
        ("Nashik", "Nashik", "Rajabhau Waje"),
        ("Baramati", "Pune", "Supriya Sule"),
    ],
    "Rajasthan": [
        ("Jaipur", "Jaipur", "Manju Sharma"),
        ("Jodhpur", "Jodhpur", "Gajendra Singh Shekhawat"),
        ("Kota", "Kota", "Om Birla"),
        ("Udaipur", "Udaipur", "Mannalal Rawat"),
    ],
    "Madhya Pradesh": [
        ("Bhopal", "Bhopal", "Alok Sharma"),
        ("Indore", "Indore", "Shankar Lalwani"),
        ("Gwalior", "Gwalior", "Bharat Singh Kushwah"),
        ("Jabalpur", "Jabalpur", "Ashish Dubey"),
    ],
    "Haryana": [
        ("Gurugram", "Gurugram", "Rao Inderjit Singh"),
        ("Faridabad", "Faridabad", "Krishan Pal Gurjar"),
        ("Ambala", "Ambala", "Varun Chaudhary"),
        ("Karnal", "Karnal", "Manohar Lal Khattar"),
    ],
    "Chhattisgarh": [
        ("Raipur", "Raipur", "Brijmohan Agrawal"),
        ("Bilaspur", "Bilaspur", "Tokhan Sahu"),
        ("Durg", "Durg", "Vijay Baghel"),
    ],
    "Assam": [
        ("Guwahati", "Kamrup", "Bijuli Kalita Medhi"),
        ("Dibrugarh", "Dibrugarh", "Sarbananda Sonowal"),
        ("Silchar", "Cachar", "Parimal Suklabaidya"),
    ],

    # Tier 3 (Predisposed to Medium / Low)
    "Karnataka": [
        ("Bengaluru South", "Bengaluru Urban", "Tejasvi Surya"),
        ("Bengaluru Central", "Bengaluru Urban", "P. C. Mohan"),
        ("Mysuru", "Mysuru", "Yaduveer Wadiyar"),
        ("Belagavi", "Belagavi", "Jagadish Shettar"),
    ],
    "Andhra Pradesh": [
        ("Visakhapatnam", "Visakhapatnam", "M. Sribharat"),
        ("Vijayawada", "Krishna", "Kesineni Sivanath"),
        ("Guntur", "Guntur", "Pemmasani Chandrasekhar"),
        ("Tirupati", "Tirupati", "Maddila Gurumoorthy"),
    ],
    "Telangana": [
        ("Hyderabad", "Hyderabad", "Asaduddin Owaisi"),
        ("Secunderabad", "Hyderabad", "G. Kishan Reddy"),
        ("Warangal", "Warangal", "Kadiyam Kavya"),
    ],
    "Odisha": [
        ("Bhubaneswar", "Khordha", "Aparajita Sarangi"),
        ("Cuttack", "Cuttack", "Bhartruhari Mahtab"),
        ("Puri", "Puri", "Sambit Patra"),
        ("Sambalpur", "Sambalpur", "Dharmendra Pradhan"),
    ],
    "Gujarat": [
        ("Gandhinagar", "Gandhinagar", "Amit Shah"),
        ("Ahmedabad East", "Ahmedabad", "Hasmukh Patel"),
        ("Surat", "Surat", "Mukesh Dalal"),
        ("Vadodara", "Vadodara", "Hemang Joshi"),
    ],
    "Uttarakhand": [
        ("Dehradun", "Dehradun", "Mala Rajya Laxmi Shah"),
        ("Haridwar", "Haridwar", "Trivendra Singh Rawat"),
        ("Nainital-Udhamsingh Nagar", "Nainital", "Ajay Bhatt"),
    ],
    "Himachal Pradesh": [
        ("Shimla", "Shimla", "Suresh Kumar Kashyap"),
        ("Mandi", "Mandi", "Kangana Ranaut"),
        ("Hamirpur", "Hamirpur", "Anurag Singh Thakur"),
    ],
    "Jammu and Kashmir": [
        ("Srinagar", "Srinagar", "Aga Syed Ruhullah Mehdi"),
        ("Jammu", "Jammu", "Jugal Kishore Sharma"),
        ("Udhampur", "Udhampur", "Jitendra Singh"),
    ],

    # Tier 4 (Predisposed to Low risk)
    "Kerala": [
        ("Thiruvananthapuram", "Thiruvananthapuram", "Shashi Tharoor"),
        ("Wayanad", "Wayanad", "Priyanka Gandhi"),
        ("Ernakulam", "Ernakulam", "Hibi Eden"),
        ("Kozhikode", "Kozhikode", "M. K. Raghavan"),
    ],
    "Tamil Nadu": [
        ("Chennai Central", "Chennai", "Dayanidhi Maran"),
        ("Coimbatore", "Coimbatore", "Ganapathi Rajkumar"),
        ("Madurai", "Madurai", "Su. Venkatesan"),
        ("Salem", "Salem", "T. M. Selvaganapathi"),
    ],
    "Delhi": [
        ("New Delhi", "New Delhi", "Bansuri Swaraj"),
        ("Chandni Chowk", "Central Delhi", "Praveen Khandelwal"),
        ("East Delhi", "East Delhi", "Harsh Malhotra"),
        ("South Delhi", "South Delhi", "Ramvir Singh Bidhuri"),
    ],
    "Goa": [
        ("North Goa", "North Goa", "Shripad Yesso Naik"),
        ("South Goa", "South Goa", "Viriato Fernandes"),
    ],
    "Sikkim": [("Sikkim", "East Sikkim", "Indra Hang Subba")],
    "Meghalaya": [
        ("Shillong", "East Khasi Hills", "Ricky AJ Syngkon"),
        ("Tura", "West Garo Hills", "Saleng A. Sangma"),
    ],
    "Manipur": [
        ("Inner Manipur", "Imphal West", "Angomcha Bimol Akoijam"),
        ("Outer Manipur", "Senapati", "Alfred Kanngam Arthur"),
    ],
    "Mizoram": [("Mizoram", "Aizawl", "Richard Vanlalhmangaiha")],
    "Nagaland": [("Nagaland", "Kohima", "S. Supongmeren Jamir")],
    "Tripura": [
        ("Tripura West", "West Tripura", "Biplab Kumar Deb"),
        ("Tripura East", "Dhalai", "Kriti Devi Debbarman"),
    ],
    "Arunachal Pradesh": [
        ("Arunachal West", "Papum Pare", "Kiren Rijiju"),
        ("Arunachal East", "Changlang", "Tapir Gao"),
    ],
    "Chandigarh": [("Chandigarh", "Chandigarh", "Manish Tewari")],
    "Puducherry": [("Puducherry", "Puducherry", "V. Vaithilingam")],
    "Dadra and Nagar Haveli": [("Dadra and Nagar Haveli", "Dadra and Nagar Haveli", "Kalaben Delkar")],
    "Daman and Diu": [("Daman and Diu", "Daman", "Umeshbhai Patel")],
    "Lakshadweep": [("Lakshadweep", "Lakshadweep", "Muhammed Hamdullah Sayeed")],
}

STATE_CENTROIDS: dict[str, tuple[float, float]] = {
    "Bihar": (25.6, 85.1),
    "Uttar Pradesh": (26.8, 80.9),
    "West Bengal": (22.6, 88.4),
    "Jharkhand": (23.6, 85.3),
    "Punjab": (30.9, 75.8),
    "Maharashtra": (18.5, 73.8),
    "Rajasthan": (26.9, 75.8),
    "Madhya Pradesh": (23.2, 77.4),
    "Haryana": (29.0, 76.0),
    "Chhattisgarh": (21.2, 81.6),
    "Assam": (26.2, 92.9),
    "Karnataka": (12.9, 77.6),
    "Andhra Pradesh": (15.9, 79.7),
    "Telangana": (17.4, 78.5),
    "Odisha": (20.9, 85.1),
    "Gujarat": (23.2, 72.6),
    "Uttarakhand": (30.3, 78.0),
    "Himachal Pradesh": (31.1, 77.1),
    "Jammu and Kashmir": (34.1, 74.8),
    "Kerala": (8.5, 76.9),
    "Tamil Nadu": (13.0, 80.2),
    "Delhi": (28.6, 77.2),
    "Goa": (15.3, 74.1),
    "Sikkim": (27.3, 88.6),
    "Meghalaya": (25.6, 91.9),
    "Manipur": (24.8, 93.9),
    "Mizoram": (23.7, 92.7),
    "Nagaland": (25.7, 94.1),
    "Tripura": (23.8, 91.3),
    "Arunachal Pradesh": (27.1, 93.6),
    "Chandigarh": (30.7, 76.8),
    "Puducherry": (11.9, 79.8),
    "Dadra and Nagar Haveli": (20.3, 73.0),
    "Daman and Diu": (20.4, 72.8),
    "Lakshadweep": (10.6, 72.6),
}

# State tier group multipliers
STATE_TIERS = {
    # Tier 1
    "Bihar": 1, "Uttar Pradesh": 1, "West Bengal": 1, "Jharkhand": 1, "Punjab": 1,
    # Tier 2
    "Maharashtra": 2, "Rajasthan": 2, "Madhya Pradesh": 2, "Haryana": 2, "Chhattisgarh": 2, "Assam": 2,
    # Tier 3
    "Karnataka": 3, "Andhra Pradesh": 3, "Telangana": 3, "Odisha": 3, "Gujarat": 3, "Uttarakhand": 3,
    "Himachal Pradesh": 3, "Jammu and Kashmir": 3,
    # Tier 4
    "Kerala": 4, "Tamil Nadu": 4, "Delhi": 4, "Goa": 4, "Sikkim": 4, "Meghalaya": 4, "Manipur": 4,
    "Mizoram": 4, "Nagaland": 4, "Tripura": 4, "Arunachal Pradesh": 4, "Chandigarh": 4,
    "Puducherry": 4, "Dadra and Nagar Haveli": 4, "Daman and Diu": 4, "Lakshadweep": 4,
}

CATEGORY_DESCRIPTIONS = {
    "EDUCATION": [
        "Construction of additional classrooms in Government High School at {loc}",
        "Setting up of computer lab and digital library in Higher Secondary School at {loc}",
        "Construction of drinking water facility and sanitation block in school at {loc}",
    ],
    "HEALTH": [
        "Upgradation of Primary Health Centre with maternal care equipment at {loc}",
        "Construction of Community Health Sub-Centre building at {loc}",
        "Supply of mobile health dispensary unit and diagnostic lab at {loc}",
    ],
    "ROADS": [
        "Construction of CC road and drainage channel from Main Market to {loc}",
        "Bituminous surface road connectivity linking village to {loc}",
        "Construction of reinforced cement concrete culvert and approach road at {loc}",
    ],
    "DRINKING_WATER": [
        "Installation of piped drinking water supply scheme with solar pump at {loc}",
        "Construction of 50,000 litre overhead water storage tank at {loc}",
        "Installation of community reverse osmosis water purification plant at {loc}",
    ],
    "SANITATION": [
        "Construction of modern community sanitary complex with bio-toilets at {loc}",
        "Underground storm water drainage and sewage disposal network at {loc}",
        "Installation of decentralized solid waste segregation and processing unit at {loc}",
    ],
    "COMMUNITY_ASSETS": [
        "Construction of multipurpose community welfare hall and auditorium at {loc}",
        "Construction of Gram Panchayat Bhavan cum civic service centre at {loc}",
        "Construction of covered shed and crematorium facility with lighting at {loc}",
    ],
    "POWER": [
        "Installation of integrated solar LED street lighting units across {loc}",
        "Supply and erection of 100 kVA distribution transformer for power stabilization at {loc}",
        "Rooftop solar photovoltaic power system for primary healthcare facility at {loc}",
    ],
}

LOCALITIES = [
    "Sector 4", "Gandhi Chowk", "Station Road", "Shivaji Nagar", "Ram Nagar",
    "Adarsh Nagar", "Subhash Ward", "Kisan Basti", "Vikas Puri", "Model Town"
]

AGENCIES = [
    "Public Works Department (PWD)",
    "Rural Development Agency (DRDA)",
    "Municipal Corporation Engineering Cell",
    "Zilla Parishad Engineering Division",
    "Irrigation & Public Health Division",
]


@dataclass
class GeneratorParams:
    num_constituencies: int = 50
    num_works_per_constituency: int = 100
    anomaly_injection_rate: float = 0.08
    seed: int = 42


def generate_synthetic(params: GeneratorParams | None = None) -> dict[str, pd.DataFrame]:
    params = params or GeneratorParams()
    rng = random.Random(params.seed)

    # Anomaly rate from slider (0.0 to 0.50)
    air = max(0.0, min(0.50, float(params.anomaly_injection_rate)))

    fys = ["2023-24", "2024-25", "2025-26"]

    # STEP 1: Select constituencies across ALL 34 states/UTs
    # Guarantee at least 1 constituency for EVERY state in ALL_STATES_CONFIG
    selected_constituencies: list[dict] = []
    pool_tracker: dict[str, int] = {}

    for st, pool in ALL_STATES_CONFIG.items():
        cname, dist, mp = pool[0]
        selected_constituencies.append({
            "state": st,
            "name": cname,
            "district": dist,
            "mp": mp,
            "tier": STATE_TIERS.get(st, 4),
        })
        pool_tracker[st] = 1

    # Remaining quota to reach params.num_constituencies
    quota = max(0, params.num_constituencies - len(selected_constituencies))
    if quota > 0:
        # Prioritize larger states for extra constituencies
        large_states = [s for s in ALL_STATES_CONFIG if len(ALL_STATES_CONFIG[s]) > 1]
        rng.shuffle(large_states)
        while quota > 0 and large_states:
            for st in list(large_states):
                if quota <= 0:
                    break
                idx = pool_tracker[st]
                if idx < len(ALL_STATES_CONFIG[st]):
                    cname, dist, mp = ALL_STATES_CONFIG[st][idx]
                    selected_constituencies.append({
                        "state": st,
                        "name": cname,
                        "district": dist,
                        "mp": mp,
                        "tier": STATE_TIERS.get(st, 4),
                    })
                    pool_tracker[st] += 1
                    quota -= 1
                else:
                    large_states.remove(st)

    works_rows: list[dict] = []
    release_rows: list[dict] = []
    labels_rows: list[dict] = []

    work_id_counter = 1000
    release_id_counter = 1000
    categories = list(CATEGORY_DESCRIPTIONS.keys())

    # Generate data per constituency
    for cidx, cinfo in enumerate(selected_constituencies):
        cname = cinfo["name"]
        st = cinfo["state"]
        dist = cinfo["district"]
        mp = cinfo["mp"]
        st_tier = cinfo["tier"]
        lat_base, lon_base = STATE_CENTROIDS.get(st, (20.0, 78.0))

        # Effective anomaly injection probability for this constituency
        # Scales directly with params.anomaly_injection_rate
        if air <= 0:
            p_anom = 0.0
        elif st_tier == 1:
            p_anom = min(0.95, air * 2.2 + 0.10)
        elif st_tier == 2:
            p_anom = min(0.85, air * 1.7 + 0.05)
        elif st_tier == 3:
            p_anom = min(0.70, air * 1.2)
        else:
            p_anom = min(0.40, air * 0.5)

        works_per_fy = max(10, params.num_works_per_constituency // len(fys))

        for fy in fys:
            fy_start_year = int(fy.split("-")[0])
            fy_start = date(fy_start_year, 4, 1)

            fy_sanc_total = 0.0
            fy_exp_total = 0.0
            prior_work_by_cat: dict[str, dict] = {}

            for w_idx in range(works_per_fy):
                work_id_counter += 1
                wid = f"WRK{work_id_counter:06d}"

                cat = categories[(w_idx + cidx) % len(categories)]
                desc_tpl = rng.choice(CATEGORY_DESCRIPTIONS[cat])
                loc = rng.choice(LOCALITIES)
                desc = desc_tpl.format(loc=loc)

                sanc_date = fy_start + timedelta(days=rng.randint(15, 300))
                sanc_amount = round(rng.uniform(5, 50), 1) * 100000.0

                # Duration 3 to 8 months
                exp_comp_date = sanc_date + timedelta(days=rng.randint(90, 240))
                agency = AGENCIES[(w_idx + cidx) % len(AGENCIES)]
                lat = round(lat_base + (rng.random() - 0.5) * 0.4, 4)
                lon = round(lon_base + (rng.random() - 0.5) * 0.4, 4)

                injected_anomalies: list[str] = []
                status = "COMPLETED"
                comp_date = exp_comp_date

                # Decide if this work receives anomalies based on p_anom
                has_anomaly = rng.random() < p_anom

                if has_anomaly:
                    # 1. Cost & Delay Risk
                    mult = rng.uniform(1.30, 1.75)
                    act_exp = round(sanc_amount * mult, 2)
                    delay_days = rng.randint(190, 480)
                    comp_date = exp_comp_date + timedelta(days=delay_days)
                    injected_anomalies.extend(["COST_OVERRUN", "DELAYED_PROJECT"])

                    # 2. Payment Risk (Premature or overflow payment)
                    if rng.random() < 0.25:
                        status = "IN_PROGRESS"
                        comp_date = None
                        act_exp = round(sanc_amount * rng.uniform(1.35, 1.60), 2)
                        injected_anomalies.append("PAYMENT_RISK")

                    # 3. Compliance Risk (Generic agency or premature completion)
                    if rng.random() < 0.20:
                        agency = "Department"  # Triggers CMP-002
                        injected_anomalies.append("COMPLIANCE_RISK")

                    # 4. Durability Risk (Repeat repair within 180 days)
                    if cat in prior_work_by_cat and rng.random() < 0.25:
                        prior_sdate = prior_work_by_cat[cat]["sanc_date"]
                        sanc_date = prior_sdate + timedelta(days=rng.randint(30, 150))
                        desc = f"Repair and patch work of {desc.lower()}"
                        injected_anomalies.append("DURABILITY_RISK")

                    # 5. Pattern Risk (Amount clustering & round number bias)
                    if rng.random() < 0.35:
                        sanc_amount = 1000000.0  # Cluster at 10 Lakhs
                        injected_anomalies.append("AMOUNT_CLUSTERING")

                else:
                    # Clean work
                    mult = rng.uniform(0.92, 1.00)
                    act_exp = round(sanc_amount * mult, 2)
                    delay_days = rng.randint(-15, 0)
                    comp_date = exp_comp_date + timedelta(days=delay_days)

                prior_work_by_cat[cat] = {"sanc_date": sanc_date, "work_id": wid}
                fy_sanc_total += sanc_amount
                fy_exp_total += act_exp

                w_row = {
                    "work_id": wid,
                    "constituency_name": cname,
                    "state_name": st,
                    "district_name": dist,
                    "mp_name": mp,
                    "work_description": desc,
                    "work_category": cat,
                    "sanctioned_amount": sanc_amount,
                    "sanction_date": sanc_date.isoformat(),
                    "actual_expenditure": act_exp,
                    "work_status": status,
                    "implementing_agency": agency,
                    "financial_year": fy,
                    "expected_completion_date": exp_comp_date.isoformat(),
                    "completion_date": comp_date.isoformat() if comp_date else "",
                    "latitude": lat,
                    "longitude": lon,
                    "anomaly_injected": ",".join(injected_anomalies) if injected_anomalies else "",
                }
                works_rows.append(w_row)

                for atype in injected_anomalies:
                    labels_rows.append({
                        "work_id": wid,
                        "constituency_name": cname,
                        "financial_year": fy,
                        "anomaly_type": atype,
                        "anomaly_injected": True,
                        "anomaly_description": f"Injected synthetic {atype}",
                    })

                # Duplicate Work injection (Twin work pair)
                if has_anomaly and rng.random() < 0.15:
                    work_id_counter += 1
                    twin_wid = f"WRK{work_id_counter:06d}"
                    twin_desc = desc.replace(" at ", " in ", 1) if " at " in desc else f"Modern {desc.lower()}"
                    twin_row = dict(w_row)
                    twin_row["work_id"] = twin_wid
                    twin_row["work_description"] = twin_desc
                    twin_row["sanctioned_amount"] = sanc_amount
                    twin_row["actual_expenditure"] = act_exp
                    twin_row["anomaly_injected"] = "DUPLICATE_WORK"
                    works_rows.append(twin_row)
                    fy_exp_total += act_exp
                    fy_sanc_total += sanc_amount
                    labels_rows.append({
                        "work_id": twin_wid,
                        "constituency_name": cname,
                        "financial_year": fy,
                        "anomaly_type": "DUPLICATE_WORK",
                        "anomaly_injected": True,
                        "anomaly_description": f"Duplicate of {wid}",
                    })

            # Fund releases for this constituency-FY
            # Utilization rate scales cleanly with anomaly rate
            if p_anom > 0.45:
                # Severe over-utilization (rate > 200%)
                total_release = round(fy_sanc_total * 0.55, 2)
            elif p_anom > 0.25:
                # Moderate over-utilization (rate ~140-160%)
                total_release = round(fy_sanc_total * 0.80, 2)
            else:
                # Healthy utilization (rate = 78%)
                total_release = round(fy_exp_total / 0.78, 2)

            total_release = max(total_release, 100000.0)
            inst1 = round(total_release * 0.5, 2)
            inst2 = round(total_release - inst1, 2)

            release_id_counter += 1
            release_rows.append({
                "release_id": f"REL{release_id_counter:06d}",
                "constituency_name": cname,
                "financial_year": fy,
                "installment_number": 1,
                "amount_released": inst1,
                "release_date": (fy_start + timedelta(days=60)).isoformat(),
                "cumulative_release": inst1,
            })
            release_id_counter += 1
            release_rows.append({
                "release_id": f"REL{release_id_counter:06d}",
                "constituency_name": cname,
                "financial_year": fy,
                "installment_number": 2,
                "amount_released": inst2,
                "release_date": (fy_start + timedelta(days=210)).isoformat(),
                "cumulative_release": total_release,
            })

    works_df = pd.DataFrame(works_rows)
    releases_df = pd.DataFrame(release_rows)
    labels_df = pd.DataFrame(labels_rows)

    return {
        "works": works_df,
        "fund_releases": releases_df,
        "anomaly_labels": labels_df,
    }
