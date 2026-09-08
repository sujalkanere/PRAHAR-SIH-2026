"""Report generation (FR-DVZ-004): CSV exports and PDF reports (ReportLab).

PDF sections: cover page, executive summary, anomaly summary table,
top-20 highest-risk works, duplicate pairs, fund utilization analysis,
trend chart (PNG), methodology note.
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import ANOMALY_CATEGORY_MAP, Anomaly, Constituency, ConstituencyRiskScore, Work

settings = get_settings()


def _csv_bytes(rows: list[dict]) -> bytes:
    buf = io.StringIO()
    if not rows:
        return "".encode()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


async def _scope_works(db: AsyncSession, scope: str, scope_id: str | None,
                       fy: str) -> tuple[list[Work], list[Constituency]]:

    q = select(Work)
    cq = select(Constituency)
    consts = list((await db.execute(cq)).scalars().all())
    if scope == "STATE" and scope_id:
        cids = [c.id for c in consts if c.state == scope_id]
        q = q.where(Work.constituency_id.in_(cids))
    elif scope == "CONSTITUENCY" and scope_id:
        cids = [c.id for c in consts if c.name == scope_id]
        q = q.where(Work.constituency_id.in_(cids))
    if fy and fy != "ALL":
        q = q.where(Work.financial_year == fy)
    works = list((await db.execute(q)).scalars().all())
    return works, consts


def _work_row(w: Work, c: Constituency) -> dict:
    return {
        "work_id": w.work_id, "constituency": c.name, "state": c.state,
        "mp_name": c.mp_name, "work_description": w.work_description,
        "work_category": w.work_category, "financial_year": w.financial_year,
        "sanctioned_amount": float(w.sanctioned_amount),
        "actual_expenditure": float(w.actual_expenditure or 0),
        "cost_overrun_percentage": float(w.cost_overrun_percentage or 0),
        "work_status": w.work_status, "sanction_date": w.sanction_date.isoformat(),
        "expected_completion_date": w.expected_completion_date.isoformat() if w.expected_completion_date else "",
        "completion_date": w.completion_date.isoformat() if w.completion_date else "",
        "implementing_agency": w.implementing_agency,
        "risk_score": w.risk_score, "risk_tier": w.risk_tier,
    }


async def generate_csv_report(db: AsyncSession, scope: str, scope_id: str | None, fy: str) -> bytes:
    works, consts = await _scope_works(db, scope, scope_id, fy)
    cmap = {str(c.id): c for c in consts}
    rows = [_work_row(w, cmap.get(str(w.constituency_id), c)) for w, c in
            ((w, cmap.get(str(w.constituency_id))) for w in works) if c]
    return _csv_bytes(rows)


async def generate_pdf_report(db: AsyncSession, scope: str, scope_id: str | None, fy: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

    from app.services.analytics import anomaly_trends, _anomaly_rows

    works, consts = await _scope_works(db, scope, scope_id, fy)
    cmap = {str(c.id): c for c in consts}
    ids = [c.id for c in consts]
    if scope == "CONSTITUENCY" and scope_id:
        ids = [c.id for c in consts if c.name == scope_id]
    elif scope == "STATE" and scope_id:
        ids = [c.id for c in consts if c.state == scope_id]

    anomalies = [a for a in await _anomaly_rows(db, ids, limit=5000)
                 if a.status != "FALSE_POSITIVE"]
    trends = await anomaly_trends(db, ids)
    work_rows = []
    for w in works:
        c = cmap.get(str(w.constituency_id))
        if c:
            work_rows.append(_work_row(w, c))
    work_rows.sort(key=lambda r: -r["risk_score"])
    top20 = work_rows[:20]

    # chart: anomaly trends
    chart_path = settings.report_dir + f"/_chart_{uuid.uuid4().hex[:8]}.png"
    _render_trend_chart(trends, chart_path)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            rightMargin=0.7 * inch, leftMargin=0.7 * inch,
                            topMargin=0.7 * inch, bottomMargin=0.7 * inch)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=20, spaceAfter=6)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=14, spaceBefore=12, spaceAfter=6)
    small = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=9)

    story = []
    # cover
    story.append(Paragraph("MPLADS Sentinel", h1))
    story.append(Paragraph(f"Anomaly &amp; Risk Assessment Report — {scope.title()} scope"
                           f"{' — ' + scope_id if scope_id else ''}", styles["Heading2"]))
    story.append(Paragraph(f"Financial Year: {fy} &nbsp;|&nbsp; Generated: "
                           f"{datetime.now().strftime('%Y-%m-%d %H:%M')}", small))
    story.append(Spacer(1, 18))

    # executive summary
    total_exp = sum(float(w.actual_expenditure or 0) for w in works)
    story.append(Paragraph("1. Executive Summary", h2))
    summary_tbl = Table([
        ["Total Works", f"{len(works):,}"],
        ["Total Sanctioned (₹ Cr)", f"{sum(float(w.sanctioned_amount) for w in works) / 1e7:.2f}"],
        ["Total Expenditure (₹ Cr)", f"{total_exp / 1e7:.2f}"],
        ["Active Anomalies", f"{len(anomalies):,}"],
        ["High/CRITICAL Risk Works", f"{sum(1 for r in work_rows if r['risk_tier'] in ('HIGH', 'CRITICAL'))}"],
    ], colWidths=[2.6 * inch, 3.4 * inch])
    summary_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"), ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
    ]))
    story.append(summary_tbl)

    # anomaly summary table
    story.append(Paragraph("2. Anomaly Summary by Type &amp; Severity", h2))
    counts: dict[tuple[str, str], int] = {}
    for a in anomalies:
        cat = ANOMALY_CATEGORY_MAP.get(a.anomaly_type, a.anomaly_type)
        counts[(cat, a.severity)] = counts.get((cat, a.severity), 0) + 1
    rows_data = [["Category", "Severity", "Count"]]
    for (cat, sev), n in sorted(counts.items()):
        rows_data.append([cat, sev, str(n)])
    if len(rows_data) == 1:
        rows_data.append(["—", "—", "0"])
    t = Table(rows_data, colWidths=[2.6 * inch, 1.6 * inch, 1.0 * inch])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    story.append(t)

    # top 20 risk works
    story.append(Paragraph("3. Top 20 Highest-Risk Works", h2))
    if top20:
        data = [["Work ID", "Constituency", "Category", "Sanctioned (₹)", "Overrun %", "Risk", "Tier"]]
        for r in top20:
            data.append([r["work_id"], r["constituency"][:22], r["work_category"],
                         f"{r['sanctioned_amount']:,.0f}", f"{r['cost_overrun_percentage']:.1f}",
                         str(r["risk_score"]), r["risk_tier"]])
        t = Table(data, colWidths=[1.1 * inch, 1.5 * inch, 1.0 * inch, 1.0 * inch,
                                   0.8 * inch, 0.5 * inch, 0.7 * inch])
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ]))
        story.append(t)

    # duplicate pairs
    from app.models import DuplicatePair
    pair_ids = [w.id for w in works]
    pairs = (await db.execute(
        select(DuplicatePair).where(
            DuplicatePair.work_id_a.in_(pair_ids) | DuplicatePair.work_id_b.in_(pair_ids)))).scalars().all()
    if pairs:
        story.append(Paragraph("4. Duplicate Work Pairs", h2))
        wmap = {str(w.id): w for w in works}
        pdata = [["Work A", "Work B", "Text Sim", "Score", "Severity"]]
        for p in pairs[:30]:
            wa, wb = wmap.get(str(p.work_id_a)), wmap.get(str(p.work_id_b))
            if wa and wb:
                pdata.append([wa.work_id, wb.work_id, f"{float(p.text_similarity):.2f}",
                              str(p.composite_score), "HIGH" if p.composite_score >= 70 else "MEDIUM"])
        t = Table(pdata, colWidths=[1.3 * inch, 1.3 * inch, 1.0 * inch, 0.8 * inch, 1.0 * inch])
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
        ]))
        story.append(t)

    # fund utilization analysis
    story.append(Paragraph("5. Fund Utilization Analysis", h2))
    q = select(ConstituencyRiskScore, Constituency).join(Constituency, Constituency.id == ConstituencyRiskScore.constituency_id)
    if ids:
        q = q.where(ConstituencyRiskScore.constituency_id.in_(ids))
    r_rows = (await db.execute(q)).all()
    fdata = [["Constituency", "FY", "Released (₹ Cr)", "Expenditure (₹ Cr)", "Utilization %"]]
    for rs, c in sorted(r_rows, key=lambda x: -float(x[0].fund_utilization_rate or 0)):
        fdata.append([c.name, rs.financial_year,
                      f"{float(rs.total_funds_released or 0) / 1e7:.2f}",
                      f"{float(rs.total_expenditure or 0) / 1e7:.2f}",
                      f"{rs.fund_utilization_rate or 0:.1f}"])
    t = Table(fdata[:16], colWidths=[1.7 * inch, 0.8 * inch, 1.1 * inch, 1.2 * inch, 1.0 * inch])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)

    # trend chart
    story.append(Paragraph("6. Anomaly Trends Over Financial Years", h2))
    story.append(Image(chart_path, width=6.8 * inch, height=3.4 * inch))

    # methodology
    story.append(Paragraph("7. Methodology Note", h2))
    story.append(Paragraph(
        "Anomalies are detected by rule-based thresholds (cost overrun &gt; 15%, delay &gt; 90 days, "
        "fund utilization &lt; 50% or &gt; 110%), statistical z-score methods (|z| &gt; 2.5 by category, "
        "|z| &gt; 2.0 by state), NLP cosine similarity (all-MiniLM-L6-v2, threshold 0.85) for duplicate "
        "works, and pattern rules (amount clustering, end-of-year rush, round-number bias, agency "
        "concentration). Risk scores (0-100) combine component scores with fixed weights "
        "(cost 25, delay 25, duplicate 25, pattern 15, fund utilization 10) and map to "
        "LOW/MEDIUM/HIGH/CRITICAL tiers. Full details: SRS-MPLADS-AI-26102.", small))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f"Generated by MPLADS Sentinel MVP | {date.today().isoformat()} | Report scope: {scope}",
        small))

    doc.build(story)
    import os
    if os.path.exists(chart_path):
        os.remove(chart_path)
    return buf.getvalue()


def _render_trend_chart(trends: list[dict], path: str) -> None:
    categories = ("COST_OVERRUN", "DUPLICATE_WORK", "DELAYED_PROJECT", "FUND_MISUTILIZATION", "PATTERN_ANOMALY")
    years = [t["financial_year"] for t in trends]
    fig, ax = plt.subplots(figsize=(9, 4.5))
    for cat in categories:
        vals = [t.get(cat, 0) for t in trends]
        ax.plot(years, vals, marker="o", label=cat.replace("_", " ").title())
    ax.set_xlabel("Financial Year"); ax.set_ylabel("Anomalies Detected")
    ax.set_title("Anomaly Trends by Financial Year")
    ax.legend(fontsize=8); ax.grid(alpha=0.3)
    fig.tight_layout(); fig.savefig(path, dpi=100); plt.close(fig)
