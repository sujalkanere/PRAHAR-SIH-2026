"""High-performance report generation (FR-DVZ-004): CSV exports and PDF reports (ReportLab).

Optimizations & Scaling:
- O(1) database aggregation instead of O(N) ORM object hydration in memory.
- Targeted index-assisted queries for Top-20 risky works and Duplicate Pairs.
- Subquery-scoped duplicate query to prevent SQLite parameter binding limits.
- Group-by SQL aggregations for anomaly distribution.
- Offloaded CPU-bound Matplotlib rendering and ReportLab compilation to thread pool.
"""
from __future__ import annotations

import asyncio
import csv
import io
import os
import uuid
from datetime import date, datetime

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import ANOMALY_CATEGORY_MAP, Anomaly, Constituency, ConstituencyRiskScore, DuplicatePair, Work
from app.services.analytics import anomaly_trends

settings = get_settings()


async def _resolve_constituency_ids(
    db: AsyncSession, scope: str, scope_id: str | None
) -> tuple[list[uuid.UUID] | None, list[Constituency]]:
    """Resolves constituency scope and returns target constituency IDs and objects."""
    cq = select(Constituency)
    consts = list((await db.execute(cq)).scalars().all())

    if scope == "STATE" and scope_id:
        cids = [c.id for c in consts if c.state == scope_id]
        return cids, consts
    elif scope == "CONSTITUENCY" and scope_id:
        cids = [c.id for c in consts if c.name == scope_id]
        return cids, consts

    return None, consts


async def generate_csv_report(
    db: AsyncSession, scope: str, scope_id: str | None, fy: str | None
) -> bytes:
    """Generates streaming CSV export selecting only necessary scalar columns without loading heavy embeddings."""
    cids, _ = await _resolve_constituency_ids(db, scope, scope_id)

    q = select(
        Work.work_id,
        Constituency.name.label("constituency"),
        Constituency.state,
        Constituency.mp_name,
        Work.work_description,
        Work.work_category,
        Work.financial_year,
        Work.sanctioned_amount,
        Work.actual_expenditure,
        Work.cost_overrun_percentage,
        Work.work_status,
        Work.sanction_date,
        Work.expected_completion_date,
        Work.completion_date,
        Work.implementing_agency,
        Work.risk_score,
        Work.risk_tier,
    ).join(Constituency, Constituency.id == Work.constituency_id)

    if cids is not None:
        q = q.where(Work.constituency_id.in_(cids))
    if fy and fy != "ALL":
        q = q.where(Work.financial_year == fy)

    q = q.order_by(Work.risk_score.desc())
    rows = (await db.execute(q)).mappings().all()

    buf = io.StringIO()
    if not rows:
        return "".encode("utf-8")

    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    for r in rows:
        row_dict = dict(r)
        if isinstance(row_dict.get("sanction_date"), (date, datetime)):
            row_dict["sanction_date"] = row_dict["sanction_date"].isoformat()
        if isinstance(row_dict.get("expected_completion_date"), (date, datetime)):
            row_dict["expected_completion_date"] = row_dict["expected_completion_date"].isoformat()
        if isinstance(row_dict.get("completion_date"), (date, datetime)):
            row_dict["completion_date"] = row_dict["completion_date"].isoformat()
        writer.writerow(row_dict)

    return buf.getvalue().encode("utf-8")


def _render_trend_chart_sync(trends: list[dict], path: str) -> None:
    """Renders anomaly trend lines into PNG file synchronously."""
    categories = ("COST_OVERRUN", "DUPLICATE_WORK", "DELAYED_PROJECT", "FUND_MISUTILIZATION", "PATTERN_ANOMALY")
    years = [t["financial_year"] for t in trends] or ["2024-25"]
    fig, ax = plt.subplots(figsize=(8.5, 3.8))
    for cat in categories:
        vals = [t.get(cat, 0) for t in trends] if trends else [0]
        ax.plot(years, vals, marker="o", linewidth=2, label=cat.replace("_", " ").title())
    ax.set_xlabel("Financial Year", fontsize=9, fontweight="bold")
    ax.set_ylabel("Anomalies Detected", fontsize=9, fontweight="bold")
    ax.set_title("MPLADS Anomaly Trends Across Financial Years", fontsize=11, fontweight="bold")
    ax.legend(fontsize=8, loc="upper right")
    ax.grid(True, linestyle="--", alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def _build_pdf_bytes_sync(
    scope: str,
    scope_id: str | None,
    fy: str | None,
    summary_data: dict,
    anom_counts: list[tuple[str, str, int]],
    top20_data: list[dict],
    duplicate_data: list[dict],
    utilization_data: list[dict],
    chart_path: str | None,
) -> bytes:
    """Builds ReportLab document and returns binary PDF payload."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=18, leading=22, textColor=colors.HexColor("#0f2744"), spaceAfter=4)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, leading=16, textColor=colors.HexColor("#1d4ed8"), spaceBefore=10, spaceAfter=4)
    small = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=colors.HexColor("#475569"))

    story = []

    # Title Banner
    story.append(Paragraph("PRAHAR — MPLADS AI Audit Console", h1))
    scope_title = f"{scope.title()} Scope" + (f" ({scope_id})" if scope_id else "")
    story.append(Paragraph(f"Executive Risk &amp; Anomaly Audit Dossier — {scope_title}", styles["Heading2"]))
    story.append(Paragraph(f"Financial Year Filter: <b>{fy or 'ALL'}</b> &nbsp;|&nbsp; Generated On: <b>{datetime.now().strftime('%d %b %Y, %H:%M UTC')}</b>", small))
    story.append(Spacer(1, 10))

    # 1. Executive Summary Table
    story.append(Paragraph("1. Executive Aggregate Overview", h2))
    total_works = summary_data.get("total_works", 0)
    total_sanc = float(summary_data.get("total_sanc", 0))
    total_exp = float(summary_data.get("total_exp", 0))
    active_anom = summary_data.get("active_anom", 0)
    high_risk_cnt = summary_data.get("high_risk_cnt", 0)

    summary_tbl = Table([
        ["Total Works Analyzed", f"{total_works:,}"],
        ["Total Sanctioned Fund Value", f"₹ {total_sanc / 1e7:,.2f} Cr"],
        ["Total Recorded Expenditure", f"₹ {total_exp / 1e7:,.2f} Cr"],
        ["Expenditure Rate", f"{(total_exp / total_sanc * 100) if total_sanc > 0 else 0:.1f}%"],
        ["Active Flagged Anomalies", f"{active_anom:,}"],
        ["High / Critical Risk Projects", f"{high_risk_cnt:,}"],
    ], colWidths=[2.7 * inch, 3.5 * inch])

    summary_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#334155")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    story.append(summary_tbl)
    story.append(Spacer(1, 10))

    # 2. Anomaly Summary Breakdown
    story.append(Paragraph("2. Anomaly Distribution by Category &amp; Severity", h2))
    rows_data = [["Category", "Severity Tier", "Active Count"]]
    for atype, sev, cnt in anom_counts:
        cat = ANOMALY_CATEGORY_MAP.get(atype, atype).replace("_", " ").title()
        rows_data.append([cat, sev, f"{cnt:,}"])
    if len(rows_data) == 1:
        rows_data.append(["No anomalies flagged in this scope", "—", "0"])

    anom_tbl = Table(rows_data, colWidths=[2.8 * inch, 1.8 * inch, 1.6 * inch])
    anom_tbl.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story.append(anom_tbl)
    story.append(Spacer(1, 10))

    # 3. Top 20 Riskiest Works
    story.append(Paragraph("3. Top High-Risk Works Dossier", h2))
    if top20_data:
        data = [["Work ID", "Constituency", "Sector", "Sanctioned (₹)", "Overrun", "Risk", "Tier"]]
        for r in top20_data:
            data.append([
                r["work_id"],
                r["constituency"][:18],
                r["work_category"][:12],
                f"{r['sanctioned_amount']:,.0f}",
                f"{r['cost_overrun_percentage']:.1f}%",
                str(r["risk_score"]),
                r["risk_tier"],
            ])
        top20_tbl = Table(data, colWidths=[1.0 * inch, 1.5 * inch, 1.0 * inch, 1.1 * inch, 0.8 * inch, 0.5 * inch, 0.7 * inch])
        top20_tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ]))
        story.append(top20_tbl)
    story.append(Spacer(1, 10))

    # 4. Duplicate Work Pairs (if present)
    if duplicate_data:
        story.append(Paragraph("4. Duplicate Work Flag Pairs", h2))
        pdata = [["Work ID A", "Work ID B", "Text Similarity", "Score", "Severity"]]
        for p in duplicate_data:
            pdata.append([p["wa"], p["wb"], f"{p['sim']:.2f}", str(p["score"]), p["severity"]])
        dup_tbl = Table(pdata, colWidths=[1.4 * inch, 1.4 * inch, 1.2 * inch, 1.0 * inch, 1.2 * inch])
        dup_tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#475569")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
        ]))
        story.append(dup_tbl)
        story.append(Spacer(1, 10))

    # 5. Fund Utilization Analysis
    if utilization_data:
        story.append(Paragraph("5. Constituency Fund Utilization &amp; Release Analysis", h2))
        fdata = [["Constituency", "FY", "Released (₹ Cr)", "Expenditure (₹ Cr)", "Utilization %"]]
        for u in utilization_data:
            fdata.append([u["name"], u["fy"], f"{u['released']:.2f}", f"{u['exp']:.2f}", f"{u['rate']:.1f}%"])
        util_tbl = Table(fdata, colWidths=[1.8 * inch, 0.9 * inch, 1.2 * inch, 1.3 * inch, 1.0 * inch])
        util_tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
        ]))
        story.append(util_tbl)
        story.append(Spacer(1, 10))

    # 6. Trend Chart Image
    if chart_path and os.path.exists(chart_path):
        story.append(Paragraph("6. Multi-Year Anomaly Progression Chart", h2))
        story.append(Image(chart_path, width=6.6 * inch, height=3.0 * inch))
        story.append(Spacer(1, 8))

    # 7. Audit Methodology Note
    story.append(Paragraph("7. Algorithmic Audit Methodology &amp; Standards", h2))
    story.append(Paragraph(
        "PRAHAR employs automated multi-tiered anomaly detection: (a) Rule-based cost overrun (&gt;15%), delay (&gt;90 days), "
        "and fund misutilization; (b) Statistical category z-scores (|z| &gt; 2.5); (c) High-dimensional NLP vector embeddings "
        "(all-MiniLM-L6-v2) for duplicate identification across same-constituency works; and (d) Temporal clustering analysis. "
        "Official report issued for administrative review under MPLADS guidelines.",
        small,
    ))

    doc.build(story)
    return buf.getvalue()


async def generate_pdf_report(
    db: AsyncSession, scope: str, scope_id: str | None, fy: str | None
) -> bytes:
    """Asynchronously extracts SQL metrics and offloads CPU-bound PDF rendering to a thread."""
    cids, _ = await _resolve_constituency_ids(db, scope, scope_id)

    # 1. Scalable SQL Summary Aggregation (O(1) Memory)
    sum_q = select(
        func.count(Work.id),
        func.coalesce(func.sum(Work.sanctioned_amount), 0),
        func.coalesce(func.sum(Work.actual_expenditure), 0),
        func.coalesce(func.sum(case((Work.risk_tier.in_(("HIGH", "CRITICAL")), 1), else_=0)), 0),
    )
    if cids is not None:
        sum_q = sum_q.where(Work.constituency_id.in_(cids))
    if fy and fy != "ALL":
        sum_q = sum_q.where(Work.financial_year == fy)

    total_works, total_sanc, total_exp, high_risk_cnt = (await db.execute(sum_q)).one()

    # 2. Anomaly Breakdown in SQL
    anom_q = (
        select(Anomaly.anomaly_type, Anomaly.severity, func.count(Anomaly.id))
        .where(Anomaly.status != "FALSE_POSITIVE")
    )
    if cids is not None:
        anom_q = anom_q.where(Anomaly.constituency_id.in_(cids))
    anom_q = anom_q.group_by(Anomaly.anomaly_type, Anomaly.severity)
    anom_counts = (await db.execute(anom_q)).all()
    active_anom = sum(cnt for _, _, cnt in anom_counts)

    summary_data = {
        "total_works": total_works,
        "total_sanc": float(total_sanc),
        "total_exp": float(total_exp),
        "high_risk_cnt": high_risk_cnt,
        "active_anom": active_anom,
    }

    # 3. Top 20 Highest-Risk Works (Index-ordered LIMIT 20)
    top20_q = (
        select(Work, Constituency)
        .join(Constituency, Constituency.id == Work.constituency_id)
    )
    if cids is not None:
        top20_q = top20_q.where(Work.constituency_id.in_(cids))
    if fy and fy != "ALL":
        top20_q = top20_q.where(Work.financial_year == fy)
    top20_q = top20_q.order_by(Work.risk_score.desc()).limit(20)
    top20_rows = (await db.execute(top20_q)).all()

    top20_data = [
        {
            "work_id": w.work_id,
            "constituency": c.name,
            "work_category": w.work_category,
            "sanctioned_amount": float(w.sanctioned_amount),
            "cost_overrun_percentage": float(w.cost_overrun_percentage or 0),
            "risk_score": w.risk_score,
            "risk_tier": w.risk_tier,
        }
        for w, c in top20_rows
    ]

    # 4. Duplicate Work Pairs (Subquery scoped to avoid parameter explosion)
    if scope == "NATIONAL" or not cids:
        pair_q = select(DuplicatePair).order_by(DuplicatePair.composite_score.desc()).limit(30)
    else:
        subq = select(Work.id).where(Work.constituency_id.in_(cids))
        pair_q = select(DuplicatePair).where(
            DuplicatePair.work_id_a.in_(subq) | DuplicatePair.work_id_b.in_(subq)
        ).order_by(DuplicatePair.composite_score.desc()).limit(30)

    pairs = (await db.execute(pair_q)).scalars().all()
    duplicate_data = []
    if pairs:
        pair_work_ids = list(set([p.work_id_a for p in pairs] + [p.work_id_b for p in pairs]))
        pair_works = (await db.execute(select(Work).where(Work.id.in_(pair_work_ids)))).scalars().all()
        wmap = {str(w.id): w.work_id for w in pair_works}
        for p in pairs:
            wa_id = wmap.get(str(p.work_id_a))
            wb_id = wmap.get(str(p.work_id_b))
            if wa_id and wb_id:
                duplicate_data.append({
                    "wa": wa_id,
                    "wb": wb_id,
                    "sim": float(p.text_similarity),
                    "score": p.composite_score,
                    "severity": "HIGH" if p.composite_score >= 70 else "MEDIUM",
                })

    # 5. Fund Utilization Table
    util_q = (
        select(ConstituencyRiskScore, Constituency)
        .join(Constituency, Constituency.id == ConstituencyRiskScore.constituency_id)
    )
    if cids is not None:
        util_q = util_q.where(ConstituencyRiskScore.constituency_id.in_(cids))
    util_q = util_q.order_by(ConstituencyRiskScore.fund_utilization_rate.desc()).limit(14)
    util_rows = (await db.execute(util_q)).all()

    utilization_data = [
        {
            "name": c.name,
            "fy": rs.financial_year,
            "released": float(rs.total_funds_released or 0) / 1e7,
            "exp": float(rs.total_expenditure or 0) / 1e7,
            "rate": float(rs.fund_utilization_rate or 0),
        }
        for rs, c in util_rows
    ]

    # 6. Trends Chart Rendering
    trends = await anomaly_trends(db, cids)
    os.makedirs(settings.report_dir, exist_ok=True)
    chart_path = os.path.join(settings.report_dir, f"_chart_{uuid.uuid4().hex[:8]}.png")

    try:
        await asyncio.to_thread(_render_trend_chart_sync, trends, chart_path)
        # 7. Offload ReportLab rendering to worker thread
        pdf_bytes = await asyncio.to_thread(
            _build_pdf_bytes_sync,
            scope,
            scope_id,
            fy,
            summary_data,
            anom_counts,
            top20_data,
            duplicate_data,
            utilization_data,
            chart_path,
        )
        return pdf_bytes
    finally:
        if os.path.exists(chart_path):
            try:
                os.remove(chart_path)
            except OSError:
                pass
