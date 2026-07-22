FROM alpine:3.20 AS pocketbase-download

ARG PB_VERSION=0.39.5
ARG TARGETARCH

RUN apk add --no-cache ca-certificates curl unzip && \
    curl --fail --location --silent --show-error \
      --output /tmp/pocketbase.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" && \
    mkdir -p /pb && \
    unzip /tmp/pocketbase.zip -d /pb

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

WORKDIR /pb
COPY --from=pocketbase-download /pb/pocketbase ./pocketbase
COPY pb_migrations ./pb_migrations

EXPOSE 8090
VOLUME ["/pb/pb_data"]

CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090"]
