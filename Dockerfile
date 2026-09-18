FROM oven/bun:1.4.2 AS builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml tsconfig.json ./
RUN bun install --frozen-lockfile --production
COPY src ./src

FROM oven/bun:1.4.2-distroless
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=nonroot:nonroot /app /app
USER nonroot
EXPOSE 4123
CMD ["run", "src/index.ts"]
