from django.urls import path

from .views import WeeklyPlanningView


app_name = "planificador"

urlpatterns = [
    path("planificacion/semanal/", WeeklyPlanningView.as_view(), name="planificacion-semanal"),
]

