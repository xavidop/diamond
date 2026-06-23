# syntax=docker/dockerfile:1

# ---- build the Go binary ----
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/diamond .

# ---- minimal runtime ----
FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY --from=build /out/diamond /usr/local/bin/diamond
ENTRYPOINT ["diamond"]
