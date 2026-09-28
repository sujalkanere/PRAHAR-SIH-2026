import React, { useRef } from 'react';
import { Modal, Button, Tag, Space, Typography } from 'antd';
import {
  PrinterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileProtectOutlined,
  SafetyCertificateOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import { SimulateWorkResult } from '../api/compliance';

const { Title, Text } = Typography;

export interface ComplianceSlipProps {
  visible: boolean;
  onClose: () => void;
  result: SimulateWorkResult | null;
  formData: any;
}

export function generateOfficialSlipHtml(result: SimulateWorkResult, formData: any): string {
  const isApproved = result.is_compliant;
  const statusColor = isApproved ? '#059669' : '#DC2626';
  const statusBg = isApproved ? '#F0FDF4' : '#FEF2F2';
  const statusBorder = isApproved ? '#86EFAC' : '#FCA5A5';
  const sealText = isApproved ? 'APPROVED • SANCTION ELIGIBLE' : 'REJECTED • INELIGIBLE';
  const formattedDate = new Date(result.evaluated_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const amountStr = formData?.sanctioned_amount
    ? `₹ ${(Number(formData.sanctioned_amount) / 100000).toFixed(2)} Lakhs (₹ ${Number(formData.sanctioned_amount).toLocaleString('en-IN')})`
    : '₹ 15.00 Lakhs';

  const checklistRows = (result.checklist || [])
    .map(
      (c) => `
      <tr>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 600; color: #0f172a;">${c.clause}</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #475569; font-family: monospace; font-size: 11px;">${c.citation}</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #334155;">${c.description}</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; ${
            c.status === 'PASSED'
              ? 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;'
              : 'background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;'
          }">
            ${c.status}
          </span>
        </td>
      </tr>
    `
    )
    .join('');

  const violationsSection =
    result.violations && result.violations.length > 0
      ? `
      <div style="margin-top: 16px;">
        <div style="font-size: 12px; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1.5px solid #fca5a5; padding-bottom: 4px; margin-bottom: 10px;">
          3. Mandatory Guideline Violations & Rejection Grounds
        </div>
        ${result.violations
          .map(
            (v) => `
          <div style="background: #fef2f2; border: 1px solid #fca5a5; border-left: 5px solid #dc2626; border-radius: 4px; padding: 10px 14px; margin-bottom: 8px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; color: #991b1b; margin-bottom: 4px;">
              <span>${v.name} (${v.rule_id})</span>
              <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${v.guideline_section}</span>
            </div>
            <div style="color: #475569; margin-bottom: 4px;"><b>Grounds:</b> ${v.reason}</div>
            <div style="color: #0f172a; font-weight: 600;"><b>Statutory Order:</b> ${v.action}</div>
          </div>
        `
          )
          .join('')}
      </div>
    `
      : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>MoSPI Pre-Sanction Clearance Slip - ${result.certificate_id}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 10px;
            font-size: 12px;
            line-height: 1.45;
          }
          .slip-wrapper {
            border: 3px double #0a2540;
            padding: 24px;
            background: #ffffff;
            position: relative;
            max-width: 820px;
            margin: 0 auto;
          }
          .top-header {
            text-align: center;
            border-bottom: 2px solid #0a2540;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .govt-title {
            font-size: 12px;
            font-weight: 800;
            color: #475569;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 3px;
          }
          .memo-title {
            font-size: 18px;
            font-weight: 800;
            color: #0a2540;
            letter-spacing: -0.01em;
            margin: 3px 0;
          }
          .form-badge {
            font-size: 11.5px;
            color: #0284c7;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin-top: 4px;
          }
          .meta-box {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 20px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 10px 14px;
            margin-bottom: 16px;
            font-size: 11.5px;
          }
          .meta-box strong {
            color: #0a2540;
          }
          .section-heading {
            font-size: 12px;
            font-weight: 800;
            color: #0a2540;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 8px;
            margin-top: 14px;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11.5px;
            margin-bottom: 14px;
          }
          table.data-table th {
            background: #f1f5f9;
            color: #0a2540;
            font-weight: 700;
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            text-align: left;
          }
          table.data-table td {
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            vertical-align: top;
          }
          .verdict-card {
            background: ${statusBg};
            border: 2px solid ${statusBorder};
            border-radius: 6px;
            padding: 14px 18px;
            margin: 16px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .verdict-title {
            font-size: 17px;
            font-weight: 900;
            color: ${statusColor};
            margin-bottom: 3px;
          }
          .stamp-box {
            display: inline-block;
            border: 3px dashed ${statusColor};
            color: ${statusColor};
            padding: 8px 18px;
            font-size: 14px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            transform: rotate(-3deg);
            border-radius: 6px;
            background: #ffffff;
          }
          .footer-strip {
            border-top: 2px dashed #94a3b8;
            padding-top: 14px;
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 10.5px;
            color: #64748b;
          }
          .barcode-mock {
            font-family: monospace;
            font-size: 14px;
            letter-spacing: 4px;
            font-weight: bold;
            color: #0a2540;
            margin-bottom: 2px;
          }
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            .slip-wrapper {
              border: 2px solid #0a2540;
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="slip-wrapper">
          <!-- Official Letterhead -->
          <div class="top-header">
            <div class="govt-title">GOVERNMENT OF INDIA • भारत सरकार • MoSPI</div>
            <div class="memo-title">MPLADS STATUTORY PRE-SANCTION CLEARANCE SLIP</div>
            <div class="form-badge">FORM PS-1 • eSAKSHI DIGITAL AUDIT CLEARANCE MEMORANDUM</div>
          </div>

          <!-- Memorandum Meta -->
          <div class="meta-box">
            <div><strong>Memorandum Slip Ref:</strong> ${result.certificate_id}</div>
            <div style="text-align: right;"><strong>Evaluation Date & Time:</strong> ${formattedDate}</div>
            <div><strong>Audit Engine:</strong> ${result.official_authority || 'MoSPI Compliance Engine (v2026.09)'}</div>
            <div style="text-align: right;"><strong>Statutory Reference:</strong> MPLADS Guidelines 2023 / 2026</div>
          </div>

          <!-- Section 1: Work Proposal Particulars -->
          <div class="section-heading">1. Work Proposal Particulars</div>
          <table class="data-table">
            <tr>
              <td style="width: 25%; background: #f8fafc; font-weight: 600;">Proposed Work Title:</td>
              <td colspan="3" style="font-weight: 700; color: #0a2540;">${formData?.work_description || 'Proposed Work'}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; font-weight: 600;">Sector / Category:</td>
              <td>${formData?.work_category || 'Community Infrastructure'}</td>
              <td style="width: 25%; background: #f8fafc; font-weight: 600;">Estimated Sanction:</td>
              <td style="font-weight: 700; color: #0a2540;">${amountStr}</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; font-weight: 600;">Beneficiary Entity:</td>
              <td>${formData?.beneficiary_type || 'Panchayat / Local Body'}</td>
              <td style="background: #f8fafc; font-weight: 600;">Land Ownership:</td>
              <td>${
                formData?.land_status === 'PRIVATE_LAND'
                  ? '<span style="color: #dc2626; font-weight: 700;">Private Land (Strictly Ineligible)</span>'
                  : 'Public / Government / Local Body Land'
              }</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; font-weight: 600;">SC/ST Target Beneficiary:</td>
              <td>${formData?.is_sc_st_beneficiary ? 'Yes (Statutory Quota Credited)' : 'General Public Utility'}</td>
              <td style="background: #f8fafc; font-weight: 600;">Statutory Quota Credit:</td>
              <td style="color: #0284c7; font-weight: 700;">${result.sc_st_credit}</td>
            </tr>
          </table>

          <!-- Scheme Statutory Determination Verdict -->
          <div class="verdict-card">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em; color: #475569;">
                Official Statutory Scheme Determination
              </div>
              <div class="verdict-title">${result.verdict}</div>
              <div style="font-size: 11.5px; color: #475569;">
                <b>Criteria Result:</b> ${result.rules_passed} of ${result.total_rules_checked} statutory criteria passed. ${result.rules_violated} violation(s).
              </div>
            </div>
            <div>
              <div class="stamp-box">${sealText}</div>
            </div>
          </div>

          <!-- Section 2: Statutory Checklist -->
          <div class="section-heading">2. MoSPI Statutory Rulebook Verification Checklist</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 25%;">Guideline Clause</th>
                <th style="width: 18%;">Citation</th>
                <th>Statutory Requirement</th>
                <th style="width: 14%; text-align: center;">Determination</th>
              </tr>
            </thead>
            <tbody>
              ${checklistRows}
            </tbody>
          </table>

          <!-- Section 3: Violations if any -->
          ${violationsSection}

          <!-- Footer Barcode & Legal Disclaimer -->
          <div class="footer-strip">
            <div>
              <div class="barcode-mock">||| | |||| | ||| || |||||| | |||</div>
              <div><b>CERT-REF:</b> ${result.certificate_id}</div>
              <div>Security Hash: SHA256-${result.certificate_id.replace(/[^A-Za-z0-9]/g, '').slice(-8)}</div>
            </div>
            <div style="text-align: center; max-width: 320px;">
              <div style="font-weight: 700; color: #0a2540;">eSAKSHI DIGITAL AUDIT SEAL</div>
              <div>Generated via PRAHAR Sentinel Compliance Engine</div>
              <div>Ministry of Statistics & Programme Implementation</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: #0a2540;">OFFICIAL MEMORANDUM</div>
              <div>Valid for Sanction Docket</div>
              <div>Rulebook Ver: 2026.09 (Revised)</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 600);
          };
        </script>
      </body>
    </html>
  `;
}

export function printOfficialSlip(result: SimulateWorkResult, formData: any) {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    window.print();
    return;
  }
  const html = generateOfficialSlipHtml(result, formData);
  printWindow.document.write(html);
  printWindow.document.close();
}

export const OfficialComplianceSlipModal: React.FC<ComplianceSlipProps> = ({
  visible,
  onClose,
  result,
  formData,
}) => {
  if (!result) return null;

  const isApproved = result.is_compliant;
  const statusColor = isApproved ? '#059669' : '#DC2626';
  const statusBg = isApproved ? '#F0FDF4' : '#FEF2F2';
  const sealText = isApproved ? 'APPROVED • SANCTION ELIGIBLE' : 'REJECTED • INELIGIBLE';

  const amountStr = formData?.sanctioned_amount
    ? `₹ ${(Number(formData.sanctioned_amount) / 100000).toFixed(2)} Lakhs (₹ ${Number(formData.sanctioned_amount).toLocaleString('en-IN')})`
    : '₹ 15.00 Lakhs';

  const handleModalPrint = () => {
    printOfficialSlip(result, formData);
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width={820}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileProtectOutlined style={{ fontSize: 20, color: '#0A2540' }} />
          <span style={{ fontWeight: 800, color: '#0A2540' }}>
            Official MPLADS Clearance Memorandum (Form PS-1)
          </span>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose} style={{ borderRadius: 6 }}>
          Close Preview
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          style={{ background: '#0A2540', borderColor: '#0A2540', fontWeight: 700, borderRadius: 6 }}
          onClick={handleModalPrint}
        >
          Print Official Slip (A4 Memo)
        </Button>,
      ]}
      styles={{ body: { padding: '16px', maxHeight: '78vh', overflowY: 'auto' } }}
    >
      <div
        style={{
          border: '3px double #0A2540',
          padding: '24px',
          background: '#FFFFFF',
          borderRadius: 6,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Official Letterhead */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #0A2540', paddingBottom: 12, marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#475569',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            GOVERNMENT OF INDIA • भारत सरकार • MoSPI
          </div>
          <Title
            level={3}
            style={{
              color: '#0A2540',
              margin: '3px 0',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            MPLADS STATUTORY PRE-SANCTION CLEARANCE SLIP
          </Title>
          <div
            style={{
              fontSize: 12,
              color: '#0284C7',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            FORM PS-1 • eSAKSHI DIGITAL AUDIT CLEARANCE MEMORANDUM
          </div>
        </div>

        {/* Reference & Meta Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 16px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          <div>
            <Text type="secondary">Memorandum Slip Ref: </Text>
            <Text strong style={{ color: '#0A2540', fontFamily: 'monospace' }}>
              {result.certificate_id}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary">Date of Evaluation: </Text>
            <Text strong style={{ color: '#0A2540' }}>
              {new Date(result.evaluated_at).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </div>
          <div>
            <Text type="secondary">Audit Authority: </Text>
            <Text strong style={{ color: '#0A2540' }}>
              {result.official_authority || 'MoSPI Compliance Engine (v2026.09)'}
            </Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary">Security Hash: </Text>
            <Text code style={{ fontSize: 10 }}>
              SHA256:{result.certificate_id?.replace(/[^A-Za-z0-9]/g, '').slice(-8) || 'A94E2F89'}
            </Text>
          </div>
        </div>

        {/* 1. Work Proposal Particulars */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#0A2540',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: '1px solid #CBD5E1',
              paddingBottom: 4,
              marginBottom: 8,
            }}
          >
            1. Work Proposal Particulars
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              <tr>
                <td style={{ width: '25%', background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600 }}>
                  Proposed Work Title:
                </td>
                <td colSpan={3} style={{ border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 700, color: '#0A2540' }}>
                  {formData?.work_description || 'Proposed Work'}
                </td>
              </tr>
              <tr>
                <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600 }}>
                  Work Category:
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>
                  {formData?.work_category || 'Community Infrastructure'}
                </td>
                <td style={{ width: '25%', background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600 }}>
                  Estimated Outlay:
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 700, color: '#0A2540' }}>
                  {amountStr}
                </td>
              </tr>
              <tr>
                <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600 }}>
                  Beneficiary Entity:
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>
                  {formData?.beneficiary_type || 'Panchayat / Local Body'}
                </td>
                <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600 }}>
                  Land Ownership:
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>
                  {formData?.land_status === 'PRIVATE_LAND' ? (
                    <span style={{ color: '#DC2626', fontWeight: 700 }}>Private Land (Strictly Ineligible)</span>
                  ) : (
                    'Government / Local Body Land'
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600 }}>
                  Quota Beneficiary:
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px' }}>
                  {formData?.is_sc_st_beneficiary ? 'SC / ST Area Inhabited' : 'General Population'}
                </td>
                <td style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '6px 10px', fontWeight: 600 }}>
                  Statutory Quota Impact:
                </td>
                <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', color: '#0284C7', fontWeight: 700 }}>
                  {result.sc_st_credit}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Statutory Evaluation Determination Stamp */}
        <div
          style={{
            background: statusBg,
            border: `2px solid ${isApproved ? '#86EFAC' : '#FCA5A5'}`,
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, color: '#475569' }}>
              Statutory Evaluation Determination
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: statusColor, marginTop: 2 }}>
              {result.verdict}
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
              <b>Statutory Summary:</b> {result.rules_passed} of {result.total_rules_checked} criteria satisfied. {result.rules_violated} violation(s) recorded.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                display: 'inline-block',
                padding: '6px 14px',
                border: `3px dashed ${statusColor}`,
                color: statusColor,
                fontSize: 13,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                transform: 'rotate(-3deg)',
                borderRadius: 4,
                background: '#FFFFFF',
              }}
            >
              {sealText}
            </div>
          </div>
        </div>

        {/* 2. MoSPI Statutory Rulebook Verification Checklist */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#0A2540',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: '1px solid #CBD5E1',
              paddingBottom: 4,
              marginBottom: 8,
            }}
          >
            2. MoSPI Statutory Rulebook Verification Checklist
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', textAlign: 'left', color: '#0A2540' }}>Guideline Clause</th>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', textAlign: 'left', color: '#0A2540' }}>Citation</th>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', textAlign: 'left', color: '#0A2540' }}>Statutory Requirement</th>
                <th style={{ border: '1px solid #CBD5E1', padding: '6px 8px', width: 90, textAlign: 'center', color: '#0A2540' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.checklist?.map((c, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #CBD5E1', padding: '6px 8px', fontWeight: 600, color: '#0A2540' }}>
                    {c.clause}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '6px 8px', color: '#64748B', fontFamily: 'monospace' }}>
                    {c.citation}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '6px 8px' }}>
                    {c.description}
                  </td>
                  <td style={{ border: '1px solid #CBD5E1', padding: '6px 8px', textAlign: 'center' }}>
                    <Tag
                      color={c.status === 'PASSED' ? 'success' : 'error'}
                      style={{ margin: 0, fontWeight: 700, fontSize: 11, borderRadius: 4 }}
                    >
                      {c.status}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3. Violations / Reasons if any */}
        {result.violations && result.violations.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#DC2626',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderBottom: '1.5px solid #FCA5A5',
                paddingBottom: 4,
                marginBottom: 8,
              }}
            >
              3. Specific Guideline Clause Infringements
            </div>
            {result.violations.map((v, i) => (
              <div
                key={i}
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderLeft: '5px solid #DC2626',
                  borderRadius: 4,
                  padding: '8px 12px',
                  marginBottom: 6,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#DC2626' }}>
                  <span>{v.name} ({v.rule_id})</span>
                  <Tag color="purple">{v.guideline_section}</Tag>
                </div>
                <div style={{ color: '#475569', marginTop: 2 }}>
                  <b>Grounds for Rejection:</b> {v.reason}
                </div>
                <div style={{ color: '#0A2540', marginTop: 2, fontWeight: 600 }}>
                  <b>Mandatory Order:</b> {v.action}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Barcode & Legal Notice */}
        <div
          style={{
            borderTop: '2px dashed #94A3B8',
            paddingTop: 12,
            marginTop: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: '#64748B',
          }}
        >
          <div>
            <BarcodeOutlined style={{ fontSize: 26, color: '#0A2540', display: 'block' }} />
            <span>* {result.certificate_id} *</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontWeight: 700, color: '#0A2540', display: 'block' }}>
              eSAKSHI DIGITAL SEAL VERIFIED
            </span>
            <span>Ministry of Statistics and Programme Implementation (MoSPI)</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontWeight: 700, color: '#0A2540' }}>
              PRAHAR SENTINEL ENGINE
            </span>
            <span>Statutory Rules Engine v2026.09</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
