# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_CHALLENGES_API_URL=/api

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_CHALLENGES_API_URL=$VITE_CHALLENGES_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM caddy:2-alpine
EXPOSE 80 443

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
