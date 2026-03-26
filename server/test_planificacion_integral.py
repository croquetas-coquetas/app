"""
Script de pruebas integral para el algoritmo de planificación de menús.
Valida restricciones de cuotas y no repetición de platos en 14 días.
Incluye dos modos: sin historial (generación desde cero) y con historial (con días previos).
"""

import io
import json
import statistics
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

# Configurar salida UTF-8 para Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from API_nueva import API_planificacion, CUOTAS, PlanningError


# ============================================================================
# CONFIGURACIÓN GLOBAL
# ============================================================================

ITERACIONES = 100  # Número de iteraciones para cada modo de prueba
DIAS_REGEN = 6    # Días anteriores a pasar al algoritmo en modo con historial
REGEN_MODE = "con_historial"  # Opciones: "sin_historial", "con_historial", "ambos"


# ============================================================================
# VALIDADORES
# ============================================================================

def obtener_tags_plato(plato: dict[str, Any]) -> list[str]:
    """Extrae los tags nutricionales válidos de un plato."""
    if not plato:
        return []
    return [t for t in plato.get("tags", []) if t in CUOTAS]


def obtener_id_plato(plato: dict[str, Any]) -> str:
    """Obtiene un identificador único para un plato."""
    for clave in ("_id", "id", "nombre"):
        valor = plato.get(clave)
        if valor is not None:
            return str(valor)
    return json.dumps(plato, ensure_ascii=False, sort_keys=True)


def validar_sin_repeticiones(planificacion: dict[str, Any]) -> tuple[bool, str]:
    """
    Valida que no haya platos repetidos en los últimos 14 días.
    
    Returns:
        (es_valida, mensaje_error)
    """
    dias = planificacion.get("dias", [])
    
    # Recorremos cada plato y comprobamos que no esté en los 14 días previos
    for idx, dia in enumerate(dias):
        for turno in ("comida", "cena"):
            plato_actual = dia.get(turno)
            if not plato_actual:
                continue
            
            id_actual = obtener_id_plato(plato_actual)
            
            # Buscamos en los últimos 14 días (28 platos: 14 días * 2 comidas)
            # hacia atrás desde el día actual
            inicio_ventana = max(0, idx - 14)
            
            for idx_previo in range(inicio_ventana, idx):
                dia_previo = dias[idx_previo]
                for turno_previo in ("comida", "cena"):
                    plato_previo = dia_previo.get(turno_previo)
                    if plato_previo and obtener_id_plato(plato_previo) == id_actual:
                        dias_atras = idx - idx_previo
                        return False, (
                            f"Plato repetido '{obtener_id_plato(plato_actual)}' "
                            f"encontrado {dias_atras} día(s) atrás "
                            f"(índices plato: {idx_previo * 2}, actual: {idx * 2})"
                        )
    
    return True, ""


def validar_cuotas_por_intervalo(planificacion: dict[str, Any]) -> tuple[bool, str]:
    """
    Valida que cada intervalo de 7 días consecutivos cumpla con las cuotas.
    Usa ventanas deslizantes.
    
    Returns:
        (es_valida, mensaje_error)
    """
    dias = planificacion.get("dias", [])
    
    # Necesitamos al menos 7 días para validar
    if len(dias) < 7:
        return False, "Se necesitan al menos 7 días para validar cuotas"
    
    # Usamos ventanas deslizantes de 7 días
    for inicio_ventana in range(len(dias) - 6):
        fin_ventana = inicio_ventana + 7
        ventana_dias = dias[inicio_ventana:fin_ventana]
        
        # Contamos los tags en esta ventana
        conteo_tags: dict[str, int] = {g: 0 for g in CUOTAS}
        
        for dia in ventana_dias:
            for turno in ("comida", "cena"):
                plato = dia.get(turno)
                if not plato:
                    continue
                
                for tag in obtener_tags_plato(plato):
                    conteo_tags[tag] += 1
        
        # Validamos que los tags estén dentro de sus cuotas
        for grupo, cuota in CUOTAS.items():
            cantidad = conteo_tags[grupo]
            if cantidad < cuota["min"] or cantidad > cuota["max"]:
                return False, (
                    f"Grupo '{grupo}' fuera de rango en ventana "
                    f"[{inicio_ventana}:{fin_ventana}]. "
                    f"Esperado [{cuota['min']}, {cuota['max']}], "
                    f"obtenido {cantidad}"
                )
    
    return True, ""


def validar_planificacion(planificacion: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Realiza todas las validaciones sobre una planificación.
    
    Returns:
        (es_valida, lista_de_errores)
    """
    errores = []
    
    if not planificacion or "dias" not in planificacion:
        return False, ["Planificación vacía o mal formada"]
    
    # Validación 1: Sin repeticiones
    es_valida, error = validar_sin_repeticiones(planificacion)
    if not es_valida:
        errores.append(f"Repetición: {error}")
    
    # Validación 2: Cuotas por intervalo
    es_valida, error = validar_cuotas_por_intervalo(planificacion)
    if not es_valida:
        errores.append(f"Cuotas: {error}")
    
    return len(errores) == 0, errores


# ============================================================================
# RECOLECTOR DE ESTADÍSTICAS
# ============================================================================

class EstadisticasTest:
    """Recolecta estadísticas sobre las pruebas realizadas."""
    
    def __init__(self):
        self.total_iteraciones = 0
        self.iteraciones_validas = 0
        self.iteraciones_invalidas = 0
        self.errores_por_tipo: dict[str, int] = {}
        self.conteos_tags: list[dict[str, int]] = []
        self.planificaciones_con_repeticion = 0
    
    def registrar_resultado(self, es_valida: bool, errores: list[str], 
                           planificacion: dict[str, Any],
                           solo_ultimos_7_dias: bool = False) -> None:
        """
        Registra el resultado de una planificación.
        
        Args:
            solo_ultimos_7_dias: Si True, solo cuenta los últimos 7 días de la planificación.
                                Útil para modo con historial donde vienen 10 días (3+7).
        """
        self.total_iteraciones += 1
        
        if es_valida:
            self.iteraciones_validas += 1
        else:
            self.iteraciones_invalidas += 1
            for error in errores:
                tipo = error.split(":")[0]
                self.errores_por_tipo[tipo] = self.errores_por_tipo.get(tipo, 0) + 1
                if "Repetición" in tipo:
                    self.planificaciones_con_repeticion += 1
        
        # Registrar conteos de tags de cada planificación
        conteo_tags: dict[str, int] = {g: 0 for g in CUOTAS}
        dias = planificacion.get("dias", [])
        
        # Si solo queremos los últimos 7 días (modo con historial)
        if solo_ultimos_7_dias:
            dias = dias[-7:]
        
        for dia in dias:
            for turno in ("comida", "cena"):
                plato = dia.get(turno)
                if not plato:
                    continue
                for tag in obtener_tags_plato(plato):
                    conteo_tags[tag] += 1
        self.conteos_tags.append(conteo_tags)
    
    def calcular_estadisticas(self) -> dict[str, Any]:
        """Calcula estadísticas finales."""
        if not self.conteos_tags:
            return {}
        
        # Estadísticas de tags
        estadisticas_tags = {}
        for grupo in CUOTAS:
            valores = [c[grupo] for c in self.conteos_tags]
            estadisticas_tags[grupo] = {
                "media": statistics.mean(valores),
                "desv_tipica": statistics.stdev(valores) if len(valores) > 1 else 0.0,
                "min": min(valores),
                "max": max(valores),
                "cuota": CUOTAS[grupo],
            }
        
        return {
            "total_iteraciones": self.total_iteraciones,
            "iteraciones_validas": self.iteraciones_validas,
            "iteraciones_invalidas": self.iteraciones_invalidas,
            "tasa_exito": (
                100 * self.iteraciones_validas / self.total_iteraciones
                if self.total_iteraciones > 0 else 0
            ),
            "planificaciones_con_repeticion": self.planificaciones_con_repeticion,
            "errores_por_tipo": self.errores_por_tipo,
            "estadisticas_tags": estadisticas_tags,
        }
    
    def imprimir_resumen(self, modo: str) -> None:
        """Imprime un resumen de las estadísticas."""
        stats = self.calcular_estadisticas()
        
        print(f"\n{'='*80}")
        print(f"RESUMEN - MODO: {modo}")
        print(f"{'='*80}")
        print(f"Iteraciones totales: {stats['total_iteraciones']}")
        print(f"Iteraciones válidas: {stats['iteraciones_validas']}")
        print(f"Iteraciones inválidas: {stats['iteraciones_invalidas']}")
        print(f"Tasa de éxito: {stats['tasa_exito']:.1f}%")
        print(f"Planificaciones con repetición: {stats['planificaciones_con_repeticion']}")
        
        if stats['errores_por_tipo']:
            print(f"\nErrores por tipo:")
            for tipo, cantidad in stats['errores_por_tipo'].items():
                print(f"  - {tipo}: {cantidad}")
        
        print(f"\nEstadísticas de tags:")
        print(f"{'Grupo':<15} {'Media':<8} {'Desv.Típ':<10} {'Min':<5} {'Max':<5} {'Cuota':<15}")
        print("-" * 70)
        for grupo in sorted(CUOTAS.keys()):
            info = stats['estadisticas_tags'][grupo]
            cuota_str = f"[{info['cuota']['min']}, {info['cuota']['max']}]"
            print(
                f"{grupo:<15} {info['media']:<8.2f} {info['desv_tipica']:<10.2f} "
                f"{info['min']:<5} {info['max']:<5} {cuota_str:<15}"
            )
        
        print(f"{'='*80}\n")


# ============================================================================
# MODOS DE PRUEBA
# ============================================================================

def prueba_sin_historial(iteraciones: int = ITERACIONES) -> EstadisticasTest:
    """
    Modo 1: Genera planificaciones desde cero sin historial previo.
    """
    print(f"\n{'#'*80}")
    print("MODO 1: PRUEBA SIN HISTORIAL (Generación desde cero)")
    print(f"{'#'*80}")
    
    stats = EstadisticasTest()
    api = API_planificacion()
    
    for i in range(1, iteraciones + 1):
        try:
            planificacion = api.planifica()
            es_valida, errores = validar_planificacion(planificacion)
            
            estado = "[OK]" if es_valida else "[FALLO]"
            print(f"[{i}/{iteraciones}] {estado}", end="")
            
            if errores:
                print(f" - Errores: {'; '.join(errores)}")
            else:
                print()
            
            stats.registrar_resultado(es_valida, errores, planificacion)
            
        except PlanningError as e:
            print(f"[{i}/{iteraciones}] [ERROR]: {e}")
            stats.iteraciones_invalidas += 1
            stats.total_iteraciones += 1
            stats.errores_por_tipo["PlanningError"] = (
                stats.errores_por_tipo.get("PlanningError", 0) + 1
            )
        except Exception as e:
            print(f"[{i}/{iteraciones}] [EXCEPTION]: {e}")
            stats.iteraciones_invalidas += 1
            stats.total_iteraciones += 1
            stats.errores_por_tipo["Exception"] = (
                stats.errores_por_tipo.get("Exception", 0) + 1
            )
    
    stats.imprimir_resumen("SIN HISTORIAL")
    return stats


def prueba_con_historial(iteraciones: int = ITERACIONES, 
                         dias_regen: int = DIAS_REGEN) -> EstadisticasTest:
    """
    Modo 2: Genera una planificación inicial y luego itera con historial.
    En cada iteración, pasa los primeros DIAS_REGEN días como historial.
    """
    print(f"\n{'#'*80}")
    print("MODO 2: PRUEBA CON HISTORIAL (Con días previos)")
    print(f"{'#'*80}")
    print(f"Parámetros: ITERACIONES={iteraciones}, DIAS_REGEN={dias_regen}")
    
    stats = EstadisticasTest()
    api = API_planificacion()
    
    # Generar planificación inicial (sin argumentos)
    try:
        print(f"\n[Inicialización] Generando planificación inicial...")
        planificacion_anterior = api.planifica()
        es_valida, errores = validar_planificacion(planificacion_anterior)
        estado = "[OK]" if es_valida else "[FALLO]"
        print(f"[Inicialización] Planificación inicial: {estado}")
        if errores:
            print(f"  Errores: {'; '.join(errores)}")
    except Exception as e:
        print(f"[Inicialización] [ERROR]: {e}")
        return stats
    
    # Iteraciones con historial
    for i in range(1, iteraciones + 1):
        try:
            # Extraer los DIAS_REGEN primeros días para pasarlos como historial
            dias_a_pasar = planificacion_anterior["dias"][:dias_regen]
            
            # Generar nueva planificación con historial
            planificacion_nueva = api.planifica(dias_previos=dias_a_pasar)
            
            # Validar
            es_valida, errores = validar_planificacion(planificacion_nueva)
            estado = "[OK]" if es_valida else "[FALLO]"
            
            num_dias = len(planificacion_nueva.get("dias", []))
            print(
                f"[{i}/{iteraciones}] {estado} "
                f"({num_dias} días, {dias_regen} previos)",
                end=""
            )
            
            if errores:
                print(f" - Errores: {'; '.join(errores)}")
            else:
                print()
            
            stats.registrar_resultado(es_valida, errores, planificacion_nueva, 
                                     solo_ultimos_7_dias=True)
            
            # Guardar los últimos 7 días para la siguiente iteración
            dias_nuevos = planificacion_nueva["dias"][-7:]
            planificacion_anterior = {
                "dias": dias_nuevos,
                "generado_en": planificacion_nueva.get("generado_en"),
                "fuente_datos": planificacion_nueva.get("fuente_datos"),
            }
            
        except PlanningError as e:
            print(f"[{i}/{iteraciones}] [ERROR]: {e}")
            stats.iteraciones_invalidas += 1
            stats.total_iteraciones += 1
            stats.errores_por_tipo["PlanningError"] = (
                stats.errores_por_tipo.get("PlanningError", 0) + 1
            )
        except Exception as e:
            print(f"[{i}/{iteraciones}] [EXCEPTION]: {e}")
            stats.iteraciones_invalidas += 1
            stats.total_iteraciones += 1
            stats.errores_por_tipo["Exception"] = (
                stats.errores_por_tipo.get("Exception", 0) + 1
            )
    
    stats.imprimir_resumen("CON HISTORIAL")
    return stats


# ============================================================================
# ENTRADA PRINCIPAL
# ============================================================================

def main():
    """Ejecuta los modos de prueba según la configuración REGEN_MODE."""
    print(f"\n\n{'*'*80}")
    print("TEST INTEGRAL DE PLANIFICACIÓN DE MENÚS")
    print(f"{'*'*80}")
    print(f"Fecha/Hora inicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Configuración global:")
    print(f"  - ITERACIONES: {ITERACIONES}")
    print(f"  - DIAS_REGEN: {DIAS_REGEN}")
    print(f"  - REGEN_MODE: {REGEN_MODE}")
    
    # Validar REGEN_MODE
    modos_validos = {"sin_historial", "con_historial", "ambos"}
    if REGEN_MODE not in modos_validos:
        print(f"\n[ERROR]: REGEN_MODE='{REGEN_MODE}' inválido. Debe ser uno de: {modos_validos}")
        return
    
    # Ejecutar modos según configuración
    stats_sin_historial = None
    stats_con_historial = None
    
    if REGEN_MODE in ("sin_historial", "ambos"):
        stats_sin_historial = prueba_sin_historial(ITERACIONES)
    
    if REGEN_MODE in ("con_historial", "ambos"):
        stats_con_historial = prueba_con_historial(ITERACIONES, DIAS_REGEN)
    
    # Resumen final
    print(f"\n{'*'*80}")
    print("RESUMEN FINAL GENERAL")
    print(f"{'*'*80}")
    
    if REGEN_MODE == "ambos" and stats_sin_historial and stats_con_historial:
        total_iteraciones = (
            stats_sin_historial.total_iteraciones + 
            stats_con_historial.total_iteraciones
        )
        total_validas = (
            stats_sin_historial.iteraciones_validas + 
            stats_con_historial.iteraciones_validas
        )
        
        print(f"Iteraciones totales en ambos modos: {total_iteraciones}")
        print(f"Iteraciones válidas: {total_validas}")
        print(f"Iteraciones inválidas: {total_iteraciones - total_validas}")
        print(f"Tasa de éxito global: {100*total_validas/total_iteraciones:.1f}%")
    elif REGEN_MODE == "sin_historial" and stats_sin_historial:
        print(f"Modo ejecutado: SIN HISTORIAL")
        print(f"Iteraciones totales: {stats_sin_historial.total_iteraciones}")
        print(f"Iteraciones válidas: {stats_sin_historial.iteraciones_validas}")
        print(f"Iteraciones inválidas: {stats_sin_historial.iteraciones_invalidas}")
        print(f"Tasa de éxito: {stats_sin_historial.calcular_estadisticas()['tasa_exito']:.1f}%")
    elif REGEN_MODE == "con_historial" and stats_con_historial:
        print(f"Modo ejecutado: CON HISTORIAL")
        print(f"Iteraciones totales: {stats_con_historial.total_iteraciones}")
        print(f"Iteraciones válidas: {stats_con_historial.iteraciones_validas}")
        print(f"Iteraciones inválidas: {stats_con_historial.iteraciones_invalidas}")
        print(f"Tasa de éxito: {stats_con_historial.calcular_estadisticas()['tasa_exito']:.1f}%")
    
    print(f"\nFecha/Hora fin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'*'*80}\n")


if __name__ == "__main__":
    main()
