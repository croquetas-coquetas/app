from API_nueva import API_planificacion, InsufficientRecipesError, PlanningError

# Uso simple
api = API_planificacion()
planificacion = api.planifica()

print(planificacion)

"""
# Parámetros personalizados
api = API_planificacion(
    dias_totales = 7,
    comidas_por_dia = 2,  # ← Cambiar a 3 comidas
    recipes_path = "recetas.json"
)

planificacion = api.planifica()
"""