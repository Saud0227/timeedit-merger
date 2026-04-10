FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
COPY run.sh /run.sh

RUN chmod +x /run.sh

EXPOSE 8080

CMD ["/run.sh"]