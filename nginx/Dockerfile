# fholzer/nginx-brotli includes the ngx_brotli module pre-compiled
FROM fholzer/nginx-brotli:v1.27.3

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/nginx.conf

# Create SSL directory for future certificate mounting
RUN mkdir -p /etc/nginx/ssl

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
