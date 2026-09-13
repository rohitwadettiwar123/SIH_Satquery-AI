"""SatQuery AI – /api/report endpoint — PDF/JSON report generation."""
from __future__ import annotations

import io
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, JSONResponse

from backend.config import settings
from backend.models.schemas import ReportRequest

log = logging.getLogger("satquery.report")
router = APIRouter(tags=["report"])


def _generate_pdf_report(data: dict) -> bytes:
    """Generate a PDF report using reportlab."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from reportlab.lib import colors

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        # Title
        story.append(Paragraph("🛰️ SatQuery AI — Analysis Report", styles["Title"]))
        story.append(Spacer(1, 0.5*cm))
        story.append(Paragraph(f"Generated: {datetime.now(timezone.utc).isoformat()}", styles["Normal"]))
        story.append(Spacer(1, 0.5*cm))

        # Query
        story.append(Paragraph("Query", styles["Heading2"]))
        story.append(Paragraph(data.get("query", "N/A"), styles["Normal"]))
        story.append(Spacer(1, 0.3*cm))

        # Answer
        story.append(Paragraph("AI Analysis Answer", styles["Heading2"]))
        story.append(Paragraph(data.get("answer", "N/A"), styles["Normal"]))
        story.append(Spacer(1, 0.3*cm))

        # Confidence
        conf = data.get("confidence", 0)
        story.append(Paragraph(f"Overall Confidence: {conf*100:.1f}%", styles["Heading3"]))
        story.append(Spacer(1, 0.3*cm))

        # Gate verdicts
        gates = data.get("gate_verdicts", {})
        if gates:
            story.append(Paragraph("Scientific Validation Gates (G0–G8)", styles["Heading2"]))
            tdata = [["Gate", "Verdict"]] + [[k, v] for k, v in gates.items()]
            t = Table(tdata, colWidths=[8*cm, 8*cm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003366")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0f4f8"), colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.3*cm))

        # Audit hash
        story.append(Paragraph(f"SHA-256 Audit Hash: {data.get('audit_hash', 'N/A')}", styles["Normal"]))

        doc.build(story)
        buf.seek(0)
        return buf.read()
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed. Run: pip install reportlab")


@router.post("/report")
async def generate_report(req: ReportRequest):
    """Generate a PDF or JSON analysis report for a given query ID."""
    # Load from audit log
    try:
        raw = settings.audit_log_path.read_text(encoding="utf-8")
        log_entries: list = json.loads(raw) if raw.strip() else []
    except Exception:
        log_entries = []

    # Find matching entry
    entry = next((e for e in log_entries if e.get("query_id") == req.query_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail=f"No analysis found for query_id: {req.query_id}")

    if req.format == "pdf":
        pdf_bytes = _generate_pdf_report(entry)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="satquery_{req.query_id[:8]}.pdf"'},
        )
    else:
        return JSONResponse(content=entry)
