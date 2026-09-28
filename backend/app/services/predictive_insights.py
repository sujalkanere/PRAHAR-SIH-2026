from __future__ import annotations

import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from app.models import Constituency, Expenditure, FundRelease, Work

def get_fiscal_year_start(fy_string: str) -> datetime.date:
    # fy_string is like "2023-24"
    start_year = int(fy_string.split("-")[0])
    return datetime.date(start_year, 4, 1)

def get_fiscal_year_end(fy_string: str) -> datetime.date:
    start_year = int(fy_string.split("-")[0])
    return datetime.date(start_year + 1, 3, 31)

def get_utilization_forecast(session: Session, constituency_id: str, financial_year: str) -> dict | None:
    # 1. Total funds released for this constituency in this FY
    releases = session.execute(
        select(FundRelease)
        .where(FundRelease.constituency_id == constituency_id)
        .where(FundRelease.financial_year == financial_year)
    ).scalars().all()
    
    total_released = sum(float(r.amount_released) for r in releases)
    if total_released <= 0:
        return None

    # 2. Get all expenditures for this FY (assuming we filter by expenditure_date within the FY)
    start_date = get_fiscal_year_start(financial_year)
    end_date = get_fiscal_year_end(financial_year)
    
    expenditures = session.execute(
        select(Expenditure)
        .where(Expenditure.constituency_id == constituency_id)
        .where(Expenditure.expenditure_date >= start_date)
        .where(Expenditure.expenditure_date <= end_date)
        .order_by(Expenditure.expenditure_date)
    ).scalars().all()

    if not expenditures:
        return None

    # Calculate cumulative expenditure over time
    data = []
    cum_exp = 0.0
    for exp in expenditures:
        cum_exp += float(exp.amount)
        days_elapsed = (exp.expenditure_date - start_date).days
        data.append({"days_elapsed": days_elapsed, "cumulative_exp": cum_exp})

    if len(data) < 2:
        return None  # Not enough data points to fit a trend

    df = pd.DataFrame(data)
    
    # Fit linear trend: y = mx + c
    x = df["days_elapsed"].values
    y = df["cumulative_exp"].values
    m, c = np.polyfit(x, y, 1)
    
    # Project to end of fiscal year (day 365)
    projected_exp = (m * 365) + c
    projected_utilization_pct = min(100.0, max(0.0, (projected_exp / total_released) * 100))
    
    # Get constituency name
    const = session.execute(select(Constituency).where(Constituency.id == constituency_id)).scalar_one_or_none()
    const_name = const.name if const else "Unknown"

    if projected_utilization_pct < 60.0:
        return {
            "type": "FUND_UTILIZATION_PACE",
            "message": f"At current spending pace, {const_name} is projected to end the fiscal year at ~{projected_utilization_pct:.1f}% utilization.",
            "projected_utilization_pct": round(projected_utilization_pct, 2),
            "method": "linear_trend_projection",
            "data_window": f"Exp. from {start_date} to {df['days_elapsed'].max()} days elapsed"
        }
    
    return None

def get_delay_trajectory(session: Session, constituency_ids: list[str] | None = None) -> list[dict]:
    # Compute historical median time-to-completion by category
    completed = session.execute(
        select(Work)
        .where(Work.work_status == "COMPLETED")
        .where(Work.completion_date != None)
        .where(Work.sanction_date != None)
    ).scalars().all()

    category_medians = {}
    cat_data = {}
    for w in completed:
        days = (w.completion_date - w.sanction_date).days
        if days > 0:
            cat_data.setdefault(w.work_category, []).append(days)
    
    for cat, days_list in cat_data.items():
        category_medians[cat] = np.median(days_list)
        
    # Check IN_PROGRESS works
    q = select(Work).where(Work.work_status == "IN_PROGRESS").where(Work.sanction_date != None)
    if constituency_ids is not None:
        q = q.where(Work.constituency_id.in_(constituency_ids))
        
    in_progress = session.execute(q).scalars().all()
    
    today = datetime.date.today()
    predictions = []
    
    for w in in_progress:
        median_days = category_medians.get(w.work_category)
        if not median_days:
            continue
            
        elapsed_days = (today - w.sanction_date).days
        if elapsed_days > median_days:
            predictions.append({
                "type": "DELAY_TRAJECTORY",
                "work_id": str(w.id),
                "work_title": w.work_description[:50] + "..." if len(w.work_description) > 50 else w.work_description,
                "category": w.work_category,
                "message": "This work has already exceeded the typical completion time for its category; historical pattern suggests elevated delay risk.",
                "elapsed_days": elapsed_days,
                "historical_median_days": int(median_days),
                "method": "category_median_comparison",
                "data_window": "Historical median of all COMPLETED works in this category"
            })
            
    return predictions

def get_predictive_insights(session: Session, state: str | None = None, district: str | None = None, constituency_id: str | None = None, financial_year: str = "2023-24") -> list[dict]:
    insights = []
    
    q = select(Constituency.id)
    if constituency_id:
        q = q.where(Constituency.id == constituency_id)
    if state:
        q = q.where(Constituency.state == state)
    if district:
        q = q.where(Constituency.district == district)
        
    c_ids = session.execute(q).scalars().all()
    if not c_ids:
        return []
    
    for c_id in c_ids:
        util = get_utilization_forecast(session, str(c_id), financial_year)
        if util:
            insights.append(util)
            
    delay_insights = get_delay_trajectory(session, [str(c) for c in c_ids])
    insights.extend(delay_insights)
    
    return insights
