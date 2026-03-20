"""
Script de test para probar el algoritmo de planificación semanal y verificar que respeta las cuotas nutricionales definidas en CUOTAS.
"""
import json
from API_nueva import API_planificacion, CUOTAS

def test_cuotas():
    print("Generando planificación semanal...")
    api = API_planificacion()
    planificacion = api.planifica()
    
    print(f"\n Planificación generada en: {planificacion['generado_en']}")
    print(f" Total de recetas disponibles: {planificacion['total_recetas_disponibles']}")
    print(f" Fuente de datos: {planificacion['fuente_datos']}")
    
    # Contar tags: dos versiones
    conteo_principal = {g: 0 for g in CUOTAS}  # Solo tag principal
    conteo_total = {g: 0 for g in CUOTAS}      # Todos los tags
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
            
            # Contar tag principal (para las cuotas originales)
            tags = plato.get('tags', [])
            if tags and tags[0] in conteo_principal:
                conteo_principal[tags[0]] += 1
            
            # Contar TODOS los tags (información adicional)
            for tag in tags:
                if tag in conteo_total:
                    conteo_total[tag] += 1
    
    # Mostrar verificación 1: CUOTAS (con tag principal)
    print("\n" + "="*60)
    print(" VERIFICACIÓN DE CUOTAS (Tag Principal)")
    print("="*60)
    
    todos_ok = True
    for grupo, cuota in CUOTAS.items():
        actual = conteo_principal.get(grupo, 0)
        min_req = cuota['min']
        max_req = cuota['max']
        
        status = "OK" if min_req <= actual <= max_req else "NOT OK"
        todos_ok = todos_ok and (min_req <= actual <= max_req)
        
        print(f"{status} {grupo.upper():<12} | Min: {min_req}  Max: {max_req}  Actual: {actual}")
    
    print("="*60)
    
    if todos_ok:
        print("\n ✅ ¡TODAS LAS CUOTAS RESPETADAS!")
    else:
        print("\n ❌ ALGUNAS CUOTAS NO SE RESPETAN")
    
    # Mostrar verificación 2: Riqueza nutricional (con todos los tags)
    print("\n" + "="*60)
    print(" INFORMACIÓN NUTRICIONAL (Todos los Tags)")
    print("="*60)
    
    for grupo, cuota in CUOTAS.items():
        actual = conteo_total.get(grupo, 0)
        print(f"{grupo.upper():<12} | Conteos: {actual}")
    
    print("="*60)
    
    # Mostrar planificación
    print("\n" + "="*60)
    print("PLANIFICACIÓN SEMANAL")
    print("="*60)
    
    for i, dia in enumerate(planificacion['dias'], 1):
        comida = dia['comida']['nombre']
        cena = dia['cena']['nombre']
        fecha = dia['dia']
        
        print(f"\nDÍA {i} ({fecha})")
        print(f"  Comida: {comida}")
        print(f"  Cena:   {cena}")
    
    return todos_ok

if __name__ == "__main__":
    resultado = test_cuotas()
    exit(0 if resultado else 1)
