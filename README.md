# SmartCook

Este repositorio contiene el código fuente de SmartCook.

## API REST de planificación semanal con Django

El servidor Django dentro de `server/` expone una API JSON para obtener una planificación semanal completa de comidas y cenas.

### Puesta en marcha en Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Set-Location .\server
python manage.py migrate
python manage.py runserver
```

### Probar la API

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/planificacion/semanal/
```

### Ejecutar pruebas

```powershell
Set-Location .\server
python manage.py test
```

### Script de consola alternativo

También puedes generar una planificación en JSON sin levantar Django:

```powershell
python .\server\planificacion.py
```
