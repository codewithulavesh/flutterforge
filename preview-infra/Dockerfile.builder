# Flutter Web Builder - optimized for 8GB laptop, layer cached pub get
# Use GHCR free to avoid Docker Hub limits
FROM ghcr.io/cirruslabs/flutter:stable AS build
WORKDIR /app

# 1. Cache pub get - only invalidate when pubspec changes
COPY pubspec.yaml pubspec.lock* analysis_options.yaml* ./
RUN flutter pub get || true

# 2. Copy rest and build
COPY . .
# Precache web to avoid download on every build
RUN flutter precache --web
# Build with dart-define for Supabase (injected at build time)
ARG SUPABASE_URL=https://your-project.supabase.co
ARG SUPABASE_ANON_KEY=your-anon-key
RUN flutter build web --release \
  --dart-define=SUPABASE_URL=${SUPABASE_URL} \
  --dart-define=SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}

# Runtime - tiny nginx
FROM nginx:alpine AS runtime
COPY --from=build /app/build/web /usr/share/nginx/html
COPY nginx.preview.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://localhost/ || exit 1
