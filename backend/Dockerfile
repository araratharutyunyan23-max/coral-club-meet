# ---- build stage ----
FROM golang:1.26-alpine AS build
WORKDIR /src

# Download dependencies as a cached layer, verified against the committed
# go.sum (reproducible, no network resolution at build time beyond the pinned set).
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- runtime stage ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 app
COPY --from=build /out/server /usr/local/bin/server
USER app
EXPOSE 8080
ENTRYPOINT ["server"]
