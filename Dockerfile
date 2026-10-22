FROM oven/bun:1.4.2 AS builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml tsconfig.json ./
RUN bun install --frozen-lockfile --production
COPY src ./src
RUN bun build src/index.ts --target=bun --sourcemap=linked --outdir=dist

FROM oven/bun:1.4.2-distroless
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/src/static ./src/static
USER nonroot
EXPOSE 4123
CMD ["run", "dist/index.js"]
