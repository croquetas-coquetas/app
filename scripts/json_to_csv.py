#!/usr/bin/env python3

import json
import csv
from datetime import datetime

def json_to_csv(json_file='issues.json', csv_file='issues.csv'):
    """Convierte JSON de GitHub a CSV"""

    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            issues_data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: {json_file} not found")
        return

    # Definir encabezados
    fieldnames = ['number', 'title', 'state', 'created_at', 'updated_at', 'comments', 'author', 'body']

    # Escribir CSV
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for issue in issues_data:
            writer.writerow({
                'number': issue.get('number', ''),
                'title': issue.get('title', ''),
                'state': issue.get('state', ''),
                'created_at': issue.get('createdAt', '')[:10],  # Solo fecha
                'updated_at': issue.get('updatedAt', '')[:10],
                'comments': len(issue.get('comments', [])),
                'author': issue.get('author', {}).get('login', ''),
                'body': issue.get('body', '').replace('\n', ' ')[:100]  # Primeras 100 caracteres
            })

    print(f"✅ CSV generado: {csv_file}")
    print(f"📊 Total de issues: {len(issues_data)}")

if __name__ == "__main__":
    json_to_csv()