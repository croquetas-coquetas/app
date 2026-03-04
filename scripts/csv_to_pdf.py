#!/usr/bin/env python3

import csv
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors

def csv_to_pdf(csv_file='issues.csv', pdf_file='issues.pdf'):
    """Convierte CSV de issues a PDF formateado"""

    # Crear documento PDF
    doc = SimpleDocTemplate(
        pdf_file,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    # Contenedor de elementos
    elements = []

    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#0366d6'),
        spaceAfter=30,
        alignment=TA_CENTER
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#1f6feb'),
        spaceAfter=10,
        spaceBefore=10
    )

    # Título
    title = Paragraph("GitHub Issues Report", title_style)
    elements.append(title)

    # Información del reporte
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    info = Paragraph(f"<b>Generated:</b> {timestamp}", styles['Normal'])
    elements.append(info)
    elements.append(Spacer(1, 0.3*inch))

    # Leer CSV y crear tabla
    issues_data = []
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            issues_data.append(row)

    # Crear tabla con encabezados
    table_data = [['#', 'Title', 'State', 'Created', 'Comments']]

    for issue in issues_data:
        row = [
            issue.get('number', '')[:5],
            issue.get('title', '')[:50],
            issue.get('state', ''),
            issue.get('created_at', '')[:10],
            issue.get('comments', '0')
        ]
        table_data.append(row)

    # Crear tabla
    table = Table(table_data, colWidths=[0.5*inch, 3*inch, 0.8*inch, 1*inch, 0.7*inch])

    # Estilo de tabla
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0366d6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), TA_LEFT),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f6f8fa')]),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))

    elements.append(table)

    # Agregar detalles de cada issue en páginas separadas si hay muchas
    if len(issues_data) > 10:
        elements.append(PageBreak())
        elements.append(Paragraph("Detailed Issues", heading_style))
        elements.append(Spacer(1, 0.2*inch))

        for idx, issue in enumerate(issues_data):
            # Título de issue
            issue_title = Paragraph(
                f"<b>#{issue.get('number', 'N/A')}: {issue.get('title', 'N/A')}</b>",
                heading_style
            )
            elements.append(issue_title)

            # Detalles
            details = f"""
            <b>State:</b> {issue.get('state', 'N/A')}<br/>
            <b>Created:</b> {issue.get('created_at', 'N/A')}<br/>
            <b>Author:</b> {issue.get('user', 'N/A')}<br/>
            <b>Comments:</b> {issue.get('comments', '0')}<br/>
            <b>Body:</b> {issue.get('body', 'No description')[:200]}...
            """
            elements.append(Paragraph(details, styles['Normal']))
            elements.append(Spacer(1, 0.2*inch))

            if (idx + 1) % 5 == 0 and idx < len(issues_data) - 1:
                elements.append(PageBreak())

    # Crear PDF
    doc.build(elements)
    print(f"✅ PDF generado exitosamente: {pdf_file}")

if __name__ == "__main__":
    csv_to_pdf()