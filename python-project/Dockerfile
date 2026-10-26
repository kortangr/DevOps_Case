FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ETL.py izlenen_repolar.json ./

RUN useradd --system --uid 10001 --no-create-home \
    --shell /usr/sbin/nologin etl
USER 10001
CMD ["python","ETL.py"]