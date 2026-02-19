FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl git jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
USER node

CMD ["node"]
