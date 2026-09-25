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
from reportlab.pdfgen import canvas
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import ANOMALY_CATEGORY_MAP, Anomaly, Constituency, ConstituencyRiskScore, DuplicatePair, Work
from app.services.analytics import anomaly_trends

settings = get_settings()


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and draw total page counts and running headers/footers."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running header on pages > 1
        if self._pageNumber > 1:
            self.drawString(36, 810, "PRAHAR : MPLADS Sovereign Integrity & Risk Audit Dossier")
            self.drawRightString(559, 810, "GOVERNMENT OF INDIA • MoSPI")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.6)
            self.line(36, 804, 559, 804)

        # Running footer on all pages
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.6)
        self.line(36, 38, 559, 38)

        self.setFont("Helvetica", 7)
        self.drawString(
            36,
            26,
            "CONFIDENTIAL • Official Audit Record generated under GFR 2017 & MoSPI MPLADS Guidelines • For Authorized Use Only",
        )
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(559, 26, page_str)
        self.restoreState()


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
    """Renders high-resolution anomaly trend lines into PNG file with clean executive styling."""
    categories = [
        ("COST_OVERRUN", "Cost Overruns", "#e11d48"),
        ("DUPLICATE_WORK", "Duplicate Works", "#7c3aed"),
        ("DELAYED_PROJECT", "Delayed Projects", "#d97706"),
        ("FUND_MISUTILIZATION", "Fund Misutilization", "#dc2626"),
        ("PATTERN_ANOMALY", "Pattern Anomalies", "#0284c7"),
    ]
    years = [t["financial_year"] for t in trends] or ["2023-24", "2024-25"]

    fig, ax = plt.subplots(figsize=(7.2, 2.85), dpi=150)
    fig.patch.set_facecolor("#ffffff")
    ax.set_facecolor("#ffffff")

    for cat_key, cat_label, color in categories:
        vals = [t.get(cat_key, 0) for t in trends] if trends else [0] * len(years)
        ax.plot(
            years,
            vals,
            marker="o",
            markersize=5.5,
            markeredgewidth=1.5,
            markeredgecolor="#ffffff",
            linewidth=2.0,
            label=cat_label,
            color=color,
        )

    ax.set_title(
        "MULTI-YEAR ANOMALY PROGRESSION ACROSS FINANCIAL YEARS",
        fontsize=9.5,
        fontweight="bold",
        color="#0f2744",
        pad=10,
    )
    ax.set_xlabel("Financial Year", fontsize=8, fontweight="bold", color="#475569")
    ax.set_ylabel("Anomalies Flagged", fontsize=8, fontweight="bold", color="#475569")
    ax.tick_params(colors="#475569", labelsize=7.5)

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#cbd5e1")
    ax.spines["bottom"].set_color("#cbd5e1")

    ax.grid(axis="y", linestyle="--", alpha=0.5, color="#e2e8f0")
    ax.legend(
        loc="upper right",
        fontsize=7,
        frameon=True,
        facecolor="#ffffff",
        edgecolor="#e2e8f0",
        framealpha=0.95,
    )
    fig.tight_layout()
    fig.savefig(path, dpi=150, facecolor=fig.get_facecolor(), edgecolor="none")
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
    """Builds an executive-grade ReportLab PDF dossier with official styling and visual polish."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=46,
        bottomMargin=48,
    )

    styles = getSampleStyleSheet()

    # Base typography
    normal_style = styles["Normal"]
    normal_style.fontName = "Helvetica"

    masthead_title = ParagraphStyle(
        "MastheadTitle",
        parent=normal_style,
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#0f2744"),
    )
    masthead_meta = ParagraphStyle(
        "MastheadMeta",
        parent=normal_style,
        fontSize=7.2,
        leading=10.5,
        textColor=colors.HexColor("#334155"),
        alignment=2,
    )

    sec_heading_style = ParagraphStyle(
        "SecHeading",
        parent=normal_style,
        fontSize=10,
        leading=13,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f2744"),
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True,
    )

    cell_style = ParagraphStyle(
        "CellNormal",
        parent=normal_style,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1e293b"),
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )
    cell_center = ParagraphStyle(
        "CellCenter",
        parent=cell_style,
        alignment=1,
    )
    cell_right = ParagraphStyle(
        "CellRight",
        parent=cell_style,
        alignment=2,
    )
    kpi_cell_style = ParagraphStyle(
        "KPICell",
        parent=normal_style,
        fontSize=7.5,
        leading=10,
    )

    story = []

    # 1. Executive Masthead & Title
    logo_path = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "prahar-logo.jpg")
    )
    scope_title = f"{scope.title()} Scope" + (f" ({scope_id})" if scope_id else "")
    now_str = datetime.now().strftime("%d %b %Y, %H:%M UTC")

    masthead_left = """
    <font size="7" color="#0369a1"><b>GOVERNMENT OF INDIA &bull; MoSPI &bull; SIH26102</b></font><br/>
    <font size="14" color="#0f2744"><b>PRAHAR: SOVEREIGN AUDIT &amp; RISK DOSSIER</b></font><br/>
    <font size="8" color="#475569">Members of Parliament Local Area Development Scheme (MPLADS)</font>
    """

    masthead_right = f"""
    <font size="7" color="#64748b"><b>AUDIT SCOPE:</b></font> <font size="7.5" color="#0f2744"><b>{scope_title.upper()}</b></font><br/>
    <font size="7" color="#64748b"><b>FINANCIAL YEAR:</b></font> <font size="7.5" color="#0f2744"><b>{fy or 'ALL YEARS'}</b></font><br/>
    <font size="7" color="#64748b"><b>GENERATED:</b></font> <font size="7" color="#334155">{now_str}</font><br/>
    <font size="6.5" color="#0f766e"><b>CLASSIFICATION: OFFICIAL USE ONLY</b></font>
    """

    if os.path.exists(logo_path):
        masthead_data = [
            [
                Image(logo_path, width=38, height=38),
                Paragraph(masthead_left, masthead_title),
                Paragraph(masthead_right, masthead_meta),
            ]
        ]
        masthead_tbl = Table(masthead_data, colWidths=[46, 305, 172])
    else:
        masthead_data = [
            [
                Paragraph(masthead_left, masthead_title),
                Paragraph(masthead_right, masthead_meta),
            ]
        ]
        masthead_tbl = Table(masthead_data, colWidths=[340, 183])

    masthead_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(masthead_tbl)
    story.append(Spacer(1, 6))

    # Tricolor Ribbon Line
    tricolor_data = [["", "", ""]]
    tricolor_tbl = Table(tricolor_data, colWidths=[174, 174, 175], rowHeights=[2.5])
    tricolor_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#ff9933")),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#138808")),
        ("PADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(tricolor_tbl)
    story.append(Spacer(1, 10))

    # 2. Executive KPI Aggregate Scorecard (3x2 Matrix)
    story.append(Paragraph("<b>1. EXECUTIVE KPI AGGREGATE OVERVIEW</b>", sec_heading_style))

    total_works = summary_data.get("total_works", 0)
    total_sanc = float(summary_data.get("total_sanc", 0))
    total_exp = float(summary_data.get("total_exp", 0))
    active_anom = summary_data.get("active_anom", 0)
    high_risk_cnt = summary_data.get("high_risk_cnt", 0)
    util_rate = (total_exp / total_sanc * 100) if total_sanc > 0 else 0.0

    kpi_card_data = [
        [
            Paragraph(
                f'<font size="6.5" color="#64748b"><b>TOTAL WORKS ANALYZED</b></font><br/>'
                f'<font size="13" color="#0f2744"><b>{total_works:,}</b></font><br/>'
                f'<font size="6.5" color="#94a3b8">Active eSAKSHI Pipeline</font>',
                kpi_cell_style,
            ),
            Paragraph(
                f'<font size="6.5" color="#64748b"><b>SANCTIONED FUND OUTLAY</b></font><br/>'
                f'<font size="13" color="#1d4ed8"><b>₹ {total_sanc / 1e7:,.2f} Cr</b></font><br/>'
                f'<font size="6.5" color="#94a3b8">Administrative Approvals</font>',
                kpi_cell_style,
            ),
            Paragraph(
                f'<font size="6.5" color="#64748b"><b>RECORDED EXPENDITURE</b></font><br/>'
                f'<font size="13" color="#0f766e"><b>₹ {total_exp / 1e7:,.2f} Cr</b></font><br/>'
                f'<font size="6.5" color="#94a3b8">TSA Disbursed Capital</font>',
                kpi_cell_style,
            ),
        ],
        [
            Paragraph(
                f'<font size="6.5" color="#64748b"><b>EXPENDITURE RATIO</b></font><br/>'
                f'<font size="13" color="{"#15803d" if util_rate >= 70 else "#b45309"}"><b>{util_rate:.1f}%</b></font><br/>'
                f'<font size="6.5" color="#94a3b8">Disbursed vs Sanctioned</font>',
                kpi_cell_style,
            ),
            Paragraph(
                f'<font size="6.5" color="#64748b"><b>ACTIVE FLAGGED ANOMALIES</b></font><br/>'
                f'<font size="13" color="{"#b45309" if active_anom > 0 else "#15803d"}"><b>{active_anom:,}</b></font><br/>'
                f'<font size="6.5" color="#94a3b8">Pending Verification</font>',
                kpi_cell_style,
            ),
            Paragraph(
                f'<font size="6.5" color="#b91c1c"><b>HIGH &amp; CRITICAL RISK WORKS</b></font><br/>'
                f'<font size="13" color="#b91c1c"><b>{high_risk_cnt:,}</b></font><br/>'
                f'<font size="6.5" color="#dc2626">Priority Investigation</font>',
                kpi_cell_style,
            ),
        ],
    ]

    kpi_tbl = Table(kpi_card_data, colWidths=[174, 174, 175], rowHeights=[44, 44])
    kpi_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (2, 0), colors.HexColor("#f8fafc")),
        ("BACKGROUND", (0, 1), (1, 1), colors.HexColor("#f8fafc")),
        ("BACKGROUND", (2, 1), (2, 1), colors.HexColor("#fef2f2")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(kpi_tbl)
    story.append(Spacer(1, 10))

    # 3. Anomaly Summary Breakdown
    story.append(Paragraph("<b>2. ANOMALY DISTRIBUTION BY CATEGORY &amp; SEVERITY TIER</b>", sec_heading_style))
    anom_rows = [
        [
            Paragraph("<font color='white'><b>Anomaly Category</b></font>", cell_bold),
            Paragraph("<font color='white'><b>Severity Tier</b></font>", cell_bold),
            Paragraph("<font color='white'><b>Active Flag Count</b></font>", cell_bold),
        ]
    ]

    for atype, sev, cnt in anom_counts:
        cat_name = ANOMALY_CATEGORY_MAP.get(atype, atype).replace("_", " ").title()
        sev_color = {
            "CRITICAL": "#b91c1c",
            "HIGH": "#c2410c",
            "MEDIUM": "#0284c7",
            "LOW": "#15803d",
        }.get(sev.upper(), "#334155")

        anom_rows.append([
            Paragraph(cat_name, cell_style),
            Paragraph(f'<font color="{sev_color}"><b>{sev.upper()}</b></font>', cell_style),
            Paragraph(f"<b>{cnt:,}</b>", cell_right),
        ])

    if len(anom_rows) == 1:
        anom_rows.append([
            Paragraph("No active anomalies flagged in this scope", cell_style),
            Paragraph("—", cell_center),
            Paragraph("0", cell_right),
        ])

    anom_tbl = Table(anom_rows, colWidths=[243, 140, 140])
    anom_tbl_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f2744")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for r_idx in range(1, len(anom_rows)):
        bg = colors.HexColor("#f8fafc") if r_idx % 2 == 1 else colors.white
        anom_tbl_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))

    anom_tbl.setStyle(TableStyle(anom_tbl_style))
    story.append(anom_tbl)
    story.append(Spacer(1, 10))

    # 4. Top 20 Riskiest Works Dossier
    if top20_data:
        story.append(Paragraph("<b>3. PRIORITY HIGH-RISK WORKS DOSSIER</b>", sec_heading_style))
        t20_rows = [
            [
                Paragraph("<font color='white'><b>Work ID</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Constituency</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Sector</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Sanctioned</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Overrun</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Score</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Tier</b></font>", cell_bold),
            ]
        ]

        for r in top20_data:
            overrun = r["cost_overrun_percentage"]
            score = r["risk_score"]
            tier = r["risk_tier"]

            overrun_markup = (
                f'<font color="#b91c1c"><b>+{overrun:.1f}%</b></font>'
                if overrun > 0
                else '<font color="#64748b">0.0%</font>'
            )
            score_markup = (
                f'<font color="#b91c1c"><b>{score}</b></font>'
                if score >= 75
                else f'<b>{score}</b>'
            )
            tier_color = {
                "CRITICAL": "#b91c1c",
                "HIGH": "#c2410c",
                "MEDIUM": "#0284c7",
                "LOW": "#15803d",
            }.get(tier.upper(), "#334155")
            tier_markup = f'<font color="{tier_color}"><b>{tier.upper()}</b></font>'

            t20_rows.append([
                Paragraph(f"<b>{r['work_id']}</b>", cell_style),
                Paragraph(r["constituency"][:18], cell_style),
                Paragraph(r["work_category"][:14].title(), cell_style),
                Paragraph(f"₹ {r['sanctioned_amount']:,.0f}", cell_right),
                Paragraph(overrun_markup, cell_right),
                Paragraph(score_markup, cell_center),
                Paragraph(tier_markup, cell_center),
            ])

        t20_tbl = Table(t20_rows, colWidths=[65, 115, 80, 85, 55, 48, 75])
        t20_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        for r_idx in range(1, len(t20_rows)):
            bg = colors.HexColor("#f8fafc") if r_idx % 2 == 1 else colors.white
            t20_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))

        t20_tbl.setStyle(TableStyle(t20_style))
        story.append(t20_tbl)
        story.append(Spacer(1, 10))

    # 5. Duplicate Work Flag Pairs
    if duplicate_data:
        story.append(Paragraph("<b>4. DETECTED DUPLICATE WORK CLUSTERS &amp; PAIRS</b>", sec_heading_style))
        dup_rows = [
            [
                Paragraph("<font color='white'><b>Work ID (A)</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Work ID (B)</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Text Similarity</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Risk Score</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Classification</b></font>", cell_bold),
            ]
        ]

        for p in duplicate_data:
            sim_pct = p["sim"] * 100
            sev = p["severity"]
            sev_color = "#b91c1c" if sev == "HIGH" else "#0284c7"

            dup_rows.append([
                Paragraph(f"<b>{p['wa']}</b>", cell_style),
                Paragraph(f"<b>{p['wb']}</b>", cell_style),
                Paragraph(f"<b>{sim_pct:.1f}%</b>", cell_right),
                Paragraph(f"<b>{p['score']}</b>", cell_center),
                Paragraph(f'<font color="{sev_color}"><b>{sev}</b></font>', cell_center),
            ])

        dup_tbl = Table(dup_rows, colWidths=[120, 120, 95, 88, 100])
        dup_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        for r_idx in range(1, len(dup_rows)):
            bg = colors.HexColor("#f8fafc") if r_idx % 2 == 1 else colors.white
            dup_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))

        dup_tbl.setStyle(TableStyle(dup_style))
        story.append(dup_tbl)
        story.append(Spacer(1, 10))

    # 6. Fund Utilization Table
    if utilization_data:
        story.append(Paragraph("<b>5. CONSTITUENCY FUND UTILIZATION &amp; RELEASE PERFORMANCE</b>", sec_heading_style))
        util_rows = [
            [
                Paragraph("<font color='white'><b>Constituency</b></font>", cell_bold),
                Paragraph("<font color='white'><b>FY</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Released (₹ Cr)</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Expenditure (₹ Cr)</b></font>", cell_bold),
                Paragraph("<font color='white'><b>Utilization Rate</b></font>", cell_bold),
            ]
        ]

        for u in utilization_data:
            rate = u["rate"]
            rate_color = "#15803d" if rate >= 70 else ("#b45309" if rate >= 50 else "#b91c1c")
            util_rows.append([
                Paragraph(u["name"], cell_style),
                Paragraph(u["fy"], cell_center),
                Paragraph(f"₹ {u['released']:.2f}", cell_right),
                Paragraph(f"₹ {u['exp']:.2f}", cell_right),
                Paragraph(f'<font color="{rate_color}"><b>{rate:.1f}%</b></font>', cell_right),
            ])

        util_tbl = Table(util_rows, colWidths=[150, 80, 100, 100, 93])
        util_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f2744")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
        for r_idx in range(1, len(util_rows)):
            bg = colors.HexColor("#f8fafc") if r_idx % 2 == 1 else colors.white
            util_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))

        util_tbl.setStyle(TableStyle(util_style))
        story.append(util_tbl)
        story.append(Spacer(1, 10))

    # 7. Trend Chart Image
    if chart_path and os.path.exists(chart_path):
        story.append(Paragraph("<b>6. MULTI-YEAR ANOMALY PROGRESSION TRENDS</b>", sec_heading_style))
        story.append(Image(chart_path, width=523, height=207))
        story.append(Spacer(1, 10))

    # 8. Audit Methodology & Governance Standards
    story.append(Paragraph("<b>7. ALGORITHMIC AUDIT METHODOLOGY &amp; STATUTORY STANDARDS</b>", sec_heading_style))
    audit_style = ParagraphStyle(
        "AuditStyle",
        parent=normal_style,
        fontSize=7,
        leading=10,
        textColor=colors.HexColor("#334155"),
    )
    audit_notes = (
        '<font size="8" color="#0f2744"><b>STATUTORY &amp; ALGORITHMIC GOVERNANCE FRAMEWORK</b></font><br/><br/>'
        '<b>1. Continuous Dual-Pass Evaluation:</b> PRAHAR cross-references deterministic statutory rules '
        '(GFR 2017 Rule 133, ₹50 Lakh limits, split-tender thresholds) with machine-learning heuristic anomaly detectors '
        '(Benford\'s Law distribution, NLP vector similarity via all-MiniLM-L6-v2, and DSR schedule cost deltas).<br/>'
        '<b>2. Human-in-the-Loop Governance:</b> Risk scores (0–100) and severity classifications in this dossier are algorithmic alerts '
        'for prioritized investigation. Competent administrative authorities (MoSPI / District Collectors) conduct statutory evidentiary '
        'verification before formal sanction or recovery action.<br/>'
        '<b>3. Data Pipeline &amp; Integrity:</b> Directly integrated with the eSAKSHI digital lifecycle and April 2025 Treasury Single Account '
        '(TSA) Just-in-Time release protocols.'
    )
    callout_tbl = Table([[Paragraph(audit_notes, audit_style)]], colWidths=[523])
    callout_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#cbd5e1")),
        ("LINEBEFORE", (0, 0), (0, 0), 3.5, colors.HexColor("#1d4ed8")),
        ("TOPPADDING", (0, 0), (0, 0), 8),
        ("BOTTOMPADDING", (0, 0), (0, 0), 8),
        ("LEFTPADDING", (0, 0), (0, 0), 12),
        ("RIGHTPADDING", (0, 0), (0, 0), 12),
    ]))
    story.append(callout_tbl)

    doc.build(story, canvasmaker=NumberedCanvas)
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
