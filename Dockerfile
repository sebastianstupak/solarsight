# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.9.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Next.js"

# Next.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base as build

# Build arguments
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ARG NEXT_PUBLIC_CESIUM_ACCESS_TOKEN
ENV NEXT_PUBLIC_CESIUM_ACCESS_TOKEN=$NEXT_PUBLIC_CESIUM_ACCESS_TOKEN
ARG NEXT_PUBLIC_CESIUM_ASSET_ID
ENV NEXT_PUBLIC_CESIUM_ASSET_ID=$NEXT_PUBLIC_CESIUM_ASSET_ID
ARG NEXT_PUBLIC_MAPBOX_STYLE_USERNAME
ENV NEXT_PUBLIC_MAPBOX_STYLE_USERNAME=$NEXT_PUBLIC_MAPBOX_STYLE_USERNAME
ARG NEXT_PUBLIC_MAPBOX_STYLE_ID
ENV NEXT_PUBLIC_MAPBOX_STYLE_ID=$NEXT_PUBLIC_MAPBOX_STYLE_ID

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app/.next/standalone /app
COPY --from=build /app/.next/static /app/.next/static
COPY --from=build /app/public /app/public

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "node", "server.js" ]
