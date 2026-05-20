FROM oven/bun:1.3.14 AS builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production
COPY src ./src

FROM oven/bun:1.3.14-distroless
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=nonroot:nonroot /app /app
USER nonroot
EXPOSE 3000
CMD ["run", "src/index.ts"]
