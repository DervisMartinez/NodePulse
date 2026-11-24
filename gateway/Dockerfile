FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
COPY html/ /usr/share/nginx/html/

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
