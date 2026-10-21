#!/usr/bin/env python3

import csv
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib import colors

def csv_to_pdf(csv_file='issues.csv', pdf_file='issues.pdf'):
    """Convierte CSV de issues a PDF formateado"""

    if not os.path.exists(csv_file):
        print(f"❌ Error: {csv_file} not found")
        return

    # Crear documento PDF
    doc = SimpleDocTemplate(
        pdf_file,
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    elements = []
    styles = getSampleStyleSheet()

    # Estilos personalizados
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#0366d6'),
        spaceAfter=12,
        alignment=TA_CENTER
    )

    # Leer CSV
    issues_data = []
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        issues_data = list(reader)

    # Título
    title = Paragraph("📋 GitHub Issues Report", title_style)
    elements.append(title)

    # Metadatos
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    repo_info = f"<b>Repository:</b> croquetas-coquetas/app<br/><b>Generated:</b> {timestamp}<br/><b>Total Issues:</b> {len(issues_data)}"
    elements.append(Paragraph(repo_info, styles['Normal']))
    elements.append(Spacer(1, 0.3*inch))

    # Crear tabla resumen
    table_data = [['#', 'Title', 'Status', 'Created', 'Comments']]

    for issue in issues_data:
        row = [
            issue.get('number', '')[:4],
            issue.get('title', '')[:45],
            issue.get('state', '').upper(),
            issue.get('created_at', ''),
            issue.get('comments', '0')
        ]
        table_data.append(row)

    # Tabla
    table = Table(table_data, colWidths=[0.4*inch, 3.2*inch, 0.7*inch, 0.8*inch, 0.6*inch])

    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0366d6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), TA_LEFT),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f6f8fa')),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#ffffff')]),
    ]))

    elements.append(table)

    # Detalles de issues
    if len(issues_data) > 0:
        elements.append(PageBreak())
        elements.append(Paragraph("📝 Detailed Issues", styles['Heading2']))
        elements.append(Spacer(1, 0.2*inch))

        for idx, issue in enumerate(issues_data):
            # Evitar orphans con KeepTogether
            issue_block = []

            # Título
            issue_title = f"<b>#{issue.get('number', 'N/A')}: {issue.get('title', 'N/A')}</b>"
            issue_block.append(Paragraph(issue_title, styles['Heading3']))

            # Detalles
            details = f"""
            <font size=8>
            <b>Status:</b> {issue.get('state', 'N/A')}<br/>
            <b>Created:</b> {issue.get('created_at', 'N/A')}<br/>
            <b>Author:</b> {issue.get('author', 'Unknown')}<br/>
            <b>Comments:</b> {issue.get('comments', '0')}<br/>
            </font>
            """
            issue_block.append(Paragraph(details, styles['Normal']))

            # Descripción
            body = issue.get('body', 'No description')
            if body and len(body) > 0:
                body_text = body[:150] + "..." if len(body) > 150 else body
                issue_block.append(Paragraph(f"<i>{body_text}</i>", styles['Normal']))

            issue_block.append(Spacer(1, 0.15*inch))

            # Agregar bloque con espaciado
            elements.extend(issue_block)

            # Page break cada 5 issues
            if (idx + 1) % 5 == 0 and idx < len(issues_data) - 1:
                elements.append(PageBreak())

    # Crear PDF
    try:
        doc.build(elements)
        print(f"✅ PDF generado exitosamente: {pdf_file}")
        print(f"📊 Issues incluidas: {len(issues_data)}")
    except Exception as e:
        print(f"❌ Error al generar PDF: {e}")

if __name__ == "__main__":
    csv_to_pdf()