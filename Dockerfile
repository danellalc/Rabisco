FROM alpine:3.22
ARG PB_VERSION=0.40.4
ARG PB_ARCH=amd64
ARG PB_SHA256
RUN apk add --no-cache ca-certificates unzip
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip /tmp/pb.zip
RUN echo "${PB_SHA256}  /tmp/pb.zip" | sha256sum -c - \
 && unzip -q /tmp/pb.zip pocketbase -d /pb \
 && rm /tmp/pb.zip \
 && apk del unzip \
 && adduser -D -u 1001 pb \
 && mkdir -p /pb/pb_data \
 && chown -R pb:pb /pb
USER pb
WORKDIR /pb
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
