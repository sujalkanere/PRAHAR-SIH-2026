import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public", "docs")
os.makedirs(DOCS_DIR, exist_ok=True)

def create_mplads_guidelines_pdf():
    pdf_path = os.path.join(DOCS_DIR, "Revised_MPLADS_Guidelines_2023.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0b2545'),
        alignment=1, # Center
        spaceAfter=8
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=14
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#134e4a'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=8
    )

    story = []
    story.append(Paragraph("GOVERNMENT OF INDIA", subtitle_style))
    story.append(Paragraph("MINISTRY OF STATISTICS AND PROGRAMME IMPLEMENTATION", ParagraphStyle('M', parent=subtitle_style, fontSize=12, fontName='Helvetica-Bold', textColor=colors.HexColor('#0b2545'))))
    story.append(Spacer(1, 6))
    story.append(Paragraph("REVISED GUIDELINES ON MEMBERS OF PARLIAMENT LOCAL AREA DEVELOPMENT SCHEME (MPLADS) — 2023", title_style))
    story.append(Paragraph("Effective from 1st April, 2023 | Integrated with e-SAKSHI & TSA JIT Protocol", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=14))

    story.append(Paragraph("1. Background & Scope of the Scheme", h2_style))
    story.append(Paragraph(
        "The Members of Parliament Local Area Development Scheme (MPLADS) was instituted in December 1993 to enable Members of Parliament (MPs) "
        "to recommend works of developmental nature for the creation of durable community assets based on locally felt needs. "
        "The annual financial allocation under the scheme is Rs. 5.00 Crore per Member of Parliament, released as a statutory entitlement.",
        body_style
    ))

    story.append(Paragraph("2. Key Reforms Introduced in the 2023 Revision", h2_style))
    reforms = [
        ["Key Dimension", "Prior Framework (2016)", "Revised Guidelines 2023"],
        ["Fund Authorization", "Two tranches of Rs 2.50 Cr upon UC submission", "Single annual authorization of Rs 5.00 Cr via eSAKSHI"],
        ["Fund Flow System", "Commercial bank account parking", "Treasury Single Account (TSA) Just-In-Time RBI release"],
        ["Recommendation Portal", "Manual physical paper file movements", "100% paperless e-SAKSHI digital submission"],
        ["Sanction Time limit", "No binding SLA (often > 120 days)", "Strict 45-day statutory SLA for District Authority"],
        ["Asset Durability & Quota", "15% SC, 7.5% ST target", "Mandatory 15% SC, 7.5% ST with automated algorithmic geo-audit"],
    ]
    t = Table(reforms, colWidths=[130, 180, 220])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0b2545')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('FONTSIZE', (0,1), (-1,-1), 8.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    story.append(Paragraph("3. Permissible and Prohibited Works", h2_style))
    story.append(Paragraph(
        "Works permissible under MPLADS must result in the creation of durable public assets for broad community benefit. "
        "Permissible categories include: drinking water supply, primary education infrastructure, community health sub-centres, "
        "rural roads, renewable energy installations, sanitation facilities, and public digital libraries. "
        "Explicitly prohibited works include: commercial ventures, places of religious worship, private residential properties, "
        "and recurring administrative or revenue expenditures.",
        body_style
    ))

    story.append(Paragraph("4. Implementation Agency & Statutory Audits", h2_style))
    story.append(Paragraph(
        "The District Authority (District Collector/District Magistrate) remains the nodal executive authority responsible for overall coordination. "
        "Technical sanctions must conform strictly to State Schedule of Rates (SOR/DSR). All works must be inspected, geo-tagged, and time-stamped "
        "at 3 milestones: Foundation, 50% Completion, and Final Handover. Third-party continuous algorithmic integrity checks are monitored "
        "by the PRAHAR sentinel network.",
        body_style
    ))
    
    story.append(Spacer(1, 14))
    story.append(Paragraph("Official Publication: Ministry of Statistics and Programme Implementation, Government of India. Reference: MoSPI/MPLADS/2023/REV-01", ParagraphStyle('Foot', parent=body_style, fontSize=8, textColor=colors.HexColor('#64748b'), alignment=1)))

    doc.build(story)
    print("Generated:", pdf_path)

def create_tsa_sop_pdf():
    pdf_path = os.path.join(DOCS_DIR, "TSA_Just_In_Time_Fund_Procedure.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=17,
        leading=21,
        textColor=colors.HexColor('#0f172a'),
        alignment=1,
        spaceAfter=8
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=14
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0369a1'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=8
    )

    story = []
    story.append(Paragraph("MINISTRY OF FINANCE • DEPARTMENT OF EXPENDITURE", subtitle_style))
    story.append(Paragraph("PUBLIC FINANCIAL MANAGEMENT SYSTEM (PFMS) DIVISION", ParagraphStyle('M', parent=subtitle_style, fontSize=11, fontName='Helvetica-Bold', textColor=colors.HexColor('#0f172a'))))
    story.append(Spacer(1, 6))
    story.append(Paragraph("STANDARD OPERATING PROCEDURE: TREASURY SINGLE ACCOUNT (TSA) & JUST-IN-TIME (JIT) FUND FLOW FOR MPLADS", title_style))
    story.append(Paragraph("Order Circular No. 1(18)/PFMS/FCD/2021-SNA-SPARSH | Effective April 2025", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0369a1'), spaceAfter=14))

    story.append(Paragraph("1. Statutory Mandate & Purpose", h2_style))
    story.append(Paragraph(
        "To enforce the guidelines issued by the Department of Expenditure regarding cash management and zero idle balances in Centrally Sponsored "
        "and Central Sector Schemes, MPLADS fund disbursements operate under the Treasury Single Account (TSA) architecture. "
        "Funds remain in the Consolidated Fund of India until an authorized milestone invoice is verified for direct vendor payout.",
        body_style
    ))

    story.append(Paragraph("2. Operational Mechanism of JIT Transfer", h2_style))
    sop_steps = [
        ["Phase", "Action Entity", "Process & Protocol", "SLA / Control"],
        ["1. Allocation", "MoSPI / CNA", "Authorizes annual expenditure limit into e-Kuber drawing limit", "Instantaneous"],
        ["2. Milestone", "Implementing Agency", "Uploads MB (Measurement Book) entry, geo-tagged site photo, and invoice", "Within 3 days of work"],
        ["3. Verification", "District Authority", "Conducts technical check, DSR rate matching, and sanctions payment advice", "Maximum 7 days"],
        ["4. Disbursement", "RBI e-Kuber / PFMS", "Executes direct credit into vendor bank account via RTGS/NEFT without intermediary parking", "Real-Time / T+0"],
    ]
    t = Table(sop_steps, colWidths=[90, 110, 230, 100])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0369a1')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f0f9ff')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#bae6fd')),
        ('FONTSIZE', (0,1), (-1,-1), 8.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    story.append(Paragraph("3. Elimination of Float and Idle Accounts", h2_style))
    story.append(Paragraph(
        "Under the TSA model, no implementing district or agency is permitted to maintain physical commercial bank savings accounts "
        "for parking MPLADS funds. All pre-existing commercial accounts have been converted to Zero Balance Subsidiary Accounts (ZBSA). "
        "Interest accrued is automatically credited back to the Consolidated Fund of India.",
        body_style
    ))

    story.append(Paragraph("4. Automated Sentinel Oversight (PRAHAR)", h2_style))
    story.append(Paragraph(
        "Every payment instruction passed through PFMS is analyzed in real time by the PRAHAR multi-detector audit engine. "
        "Disbursement requests exhibiting vendor concentration anomalies, duplicate billing tokens, or split-tender amounts below statutory "
        "tendering thresholds trigger automated audit holds pending manual review.",
        body_style
    ))

    story.append(Spacer(1, 14))
    story.append(Paragraph("Official Publication: Department of Expenditure, Ministry of Finance, North Block, New Delhi.", ParagraphStyle('Foot', parent=body_style, fontSize=8, textColor=colors.HexColor('#64748b'), alignment=1)))

    doc.build(story)
    print("Generated:", pdf_path)

def create_checklist_pdf():
    pdf_path = os.path.join(DOCS_DIR, "District_Authority_Checklist.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=17,
        leading=21,
        textColor=colors.HexColor('#1e1b4b'),
        alignment=1,
        spaceAfter=8
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=14
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#4338ca'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=8
    )

    story = []
    story.append(Paragraph("GOVERNMENT OF INDIA • MoSPI • e-SAKSHI DIVISION", subtitle_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("DISTRICT AUTHORITY (DA) ONBOARDING & WORK FEASIBILITY CHECKLIST", title_style))
    story.append(Paragraph("Standard Operating Procedure for Nodal District Authorities & Implementing Agencies (2026 Edition)", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#4338ca'), spaceAfter=14))

    story.append(Paragraph("1. Purpose & Administrative Scope", h2_style))
    story.append(Paragraph(
        "This checklist provides a binding protocol for District Magistrates / District Collectors and their designated "
        "Implementing District Authorities (IDAs) prior to issuing administrative and technical sanctions under MPLADS.",
        body_style
    ))

    story.append(Paragraph("2. Mandatory Pre-Sanction Verification Gateways", h2_style))
    chk = [
        ["Check No.", "Verification Parameter", "Statutory Rule / Reference", "Mandatory Requirement"],
        ["CHK-01", "Land Ownership & Title", "MPLADS 2023 Para 4.1", "Clear government/panchayat title; no private tenure encumbrance"],
        ["CHK-02", "Cost Estimate Conformity", "State DSR 2025-26", "Bills of Quantities prepared strictly per official Schedule of Rates"],
        ["CHK-03", "Non-Duplication Verification", "PRAHAR Detector D1", "Certificate affirming work has not been funded under PMGSY, AMRUT, etc."],
        ["CHK-04", "SC/ST Quota Compliance", "MPLADS 2023 Para 2.4", "Min 15% SC and 7.5% ST annual allocation maintained across district"],
        ["CHK-05", "Implementing Agency Standing", "General Financial Rules (GFR)", "Reputed engineering dept / local body with verified technical staff"],
        ["CHK-06", "Geo-Coordinates & Milestone", "e-SAKSHI Rule 7", "Precise GPS boundary established for 3-stage visual audit verification"],
    ]
    t = Table(chk, colWidths=[65, 140, 135, 190])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#312e81')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f5f3ff')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#c7d2fe')),
        ('FONTSIZE', (0,1), (-1,-1), 8.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    story.append(Paragraph("3. Sanctioning SLA & Rejection Protocol", h2_style))
    story.append(Paragraph(
        "Upon receiving recommendation from the Hon'ble Member of Parliament via e-SAKSHI, the District Authority must complete "
        "the feasibility study within 45 days. If a work is found non-feasible or ineligible under the guidelines, formal reasons "
        "must be communicated directly to the MP via the portal within 45 days with complete documentary grounds.",
        body_style
    ))

    story.append(Spacer(1, 14))
    story.append(Paragraph("Official Publication: e-SAKSHI Division, Ministry of Statistics & Programme Implementation, Government of India.", ParagraphStyle('Foot', parent=body_style, fontSize=8, textColor=colors.HexColor('#64748b'), alignment=1)))

    doc.build(story)
    print("Generated:", pdf_path)

def create_prahar_whitepaper_pdf():
    pdf_path = os.path.join(DOCS_DIR, "PRAHAR_Audit_Architecture_Whitepaper.pdf")
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=17,
        leading=21,
        textColor=colors.HexColor('#701a75'),
        alignment=1,
        spaceAfter=8
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        alignment=1,
        spaceAfter=14
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#86198f'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=8
    )

    story = []
    story.append(Paragraph("PRAHAR ADVANCED ANALYTICS DIVISION", subtitle_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("PRAHAR MULTI-DETECTOR AUDIT ARCHITECTURE WHITEPAPER", title_style))
    story.append(Paragraph("Algorithmic Sentinel & Continuous Integrity Framework for Statutory Fund Flows", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#86198f'), spaceAfter=14))

    story.append(Paragraph("1. Executive Summary", h2_style))
    story.append(Paragraph(
        "PRAHAR is an AI-powered automated audit sentinel engineered for the Members of Parliament Local Area Development Scheme (MPLADS). "
        "It provides autonomous, non-partisan, multi-tier anomaly detection across project lifecycles, financial disbursements, "
        "vendor bidding behaviors, and geographical execution realities.",
        body_style
    ))

    story.append(Paragraph("2. The Seven Specialized Detection Engines", h2_style))
    detectors = [
        ["Engine ID", "Detector Name", "Methodology / Principle", "Primary Target Anomaly"],
        ["DET-01", "Benford First-Digit Law", "Logarithmic distribution analysis of sanction amounts", "Manufactured & manipulated tender figures"],
        ["DET-02", "Split Tender Sentinel", "Detection of sub-threshold clusters below statutory limits", "Bypassing formal e-procurement thresholds"],
        ["DET-03", "Vendor Cartel & Network", "Bipartite graph clustering & bid-rotation detection", "Collusive vendor cartels & shared bank accounts"],
        ["DET-04", "Geographical Co-Location", "Haversine clustering & GIS boundary overlap", "Ghost works & duplicate geo-tagged physical assets"],
        ["DET-05", "DSR Schedule Discrepancy", "Automated parsing against state Schedule of Rates", "Inflated itemized unit rates & billing padding"],
        ["DET-06", "Milestone Velocity Anomaly", "Z-score timeline analysis vs historical district norms", "Premature invoice clearance before physical completion"],
        ["DET-07", "Demographic Quota Sentinel", "Census SC/ST boundary intersection", "Statutory non-compliance with 15% SC / 7.5% ST quota"],
    ]
    t = Table(detectors, colWidths=[65, 130, 200, 135])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#701a75')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#fdf4ff')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#f0abfc')),
        ('FONTSIZE', (0,1), (-1,-1), 8.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(Spacer(1, 14))

    story.append(Paragraph("3. Risk Scoring & Statutory Reporting", h2_style))
    story.append(Paragraph(
        "PRAHAR synthesizes the individual detector scores into a calibrated Composite Anomaly Score (0 to 100). "
        "Scores >= 70 trigger critical alert status, notifying the MoSPI Central Nodal Agency and the District Vigilance Committee. "
        "All findings are exportable into cryptographically signed PDF and CSV statutory audit digests.",
        body_style
    ))

    story.append(Spacer(1, 14))
    story.append(Paragraph("PRAHAR Technical Consortium • Ministry of Statistics and Programme Implementation • Smart India Hackathon 2026", ParagraphStyle('Foot', parent=body_style, fontSize=8, textColor=colors.HexColor('#64748b'), alignment=1)))

    doc.build(story)
    print("Generated:", pdf_path)

if __name__ == "__main__":
    create_mplads_guidelines_pdf()
    create_tsa_sop_pdf()
    create_checklist_pdf()
    create_prahar_whitepaper_pdf()
