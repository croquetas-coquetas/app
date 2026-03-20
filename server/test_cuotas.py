#!/usr/bin/env python3
"""
Script para probar que el algoritmo respeta las cuotas nutricionales.
"""
import json
from API_nueva import API_planificacion, CUOTAS

def test_cuotas():
    """Genera planificación y verifica que respeta las cuotas."""
    print("🔍 Generando planificación semanal...")
    api = API_planificacion()
    planificacion = api.planifica()
    
    print(f"\n✅ Planificación generada en: {planificacion['generado_en']}")
    print(f"📊 Total de recetas disponibles: {planificacion['total_recetas_disponibles']}")
    print(f"📌 Fuente de datos: {planificacion['fuente_datos']}")
    
    # Contar tags en la semana
    conteo = {g: 0 for g in CUOTAS}
    platos = []
    
    for dia in planificacion['dias']:
        for turno in ('comida', 'cena'):
            plato = dia[turno]
            platos.append({
                'nombre': plato['nombre'],
                'dia': dia['dia'],
                'turno': turno,
                'tags': plato.get('tags', [])
            })
            
            # Usar solo el tag nutricional principal si existe
            tag_principal = plato.get('tag_nutricional_principal')
            if tag_principal and tag_principal in conteo:
                conteo[tag_principal] += 1
    
    # Mostrar resultados
    print("\n" + "="*60)
    print("📋 VERIFICACIÓN DE CUOTAS NUTRICIONALES")
    print("="*60)
    
    todos_ok = True
    for grupo, cuota in CUOTAS.items():
        actual = conteo.get(grupo, 0)
        min_req = cuota['min']
        max_req = cuota['max']
        
        status = "✅" if min_req <= actual <= max_req else "❌"
        todos_ok = todos_ok and (min_req <= actual <= max_req)
        
        print(f"{status} {grupo.upper():<12} | Min: {min_req}  Max: {max_req}  Actual: {actual}")
    
    print("="*60)
    
    if todos_ok:
        print("\n🎉 ¡TODAS LAS CUOTAS RESPETADAS!")
    else:
        print("\n⚠️  ALGUNAS CUOTAS NO SE RESPETAN")
    
    # Mostrar planificación
    print("\n" + "="*60)
    print("📅 PLANIFICACIÓN SEMANAL")
    print("="*60)
    for i, plato in enumerate(platos, 1):
        print(f"\n{i}. {plato['nombre']}")
        print(f"   Día: {plato['dia']} ({plato['turno']})")
        print(f"   Tags: {', '.join(plato['tags']) if plato['tags'] else 'Sin tags'}")
    
    return todos_ok

if __name__ == "__main__":
    resultado = test_cuotas()
    exit(0 if resultado else 1)
