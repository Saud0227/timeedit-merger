FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY web ./web
COPY run.sh /run.sh

RUN chmod +x /run.sh

EXPOSE 8080

CMD ["/run.sh"]