# syntax=docker/dockerfile:1.4
# 分层：仅当 package.json / yarn.lock 变化时才重新 yarn install；源码变更只走 yarn build。
# 需 BuildKit（docker compose v2 / docker buildx 默认开启）。
FROM node:20.9.0 AS builder
WORKDIR /app
RUN curl -o- -L https://yarnpkg.com/install.sh | bash
ENV PATH="/root/.yarn/bin:/root/.config/yarn/global/node_modules/.bin:${PATH}"
# 国内构建可取消下一行注释以使用镜像加速
RUN yarn config set registry https://registry.npmmirror.com

# ----- 依赖层：与源码分离，避免每次改代码都整包重装 -----
COPY package.json yarn.lock .yarnrc ./
COPY apps/web/package.json apps/web/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config-custom/package.json packages/eslint-config-custom/
COPY packages/tsdaodaobase/package.json packages/tsdaodaobase/
COPY packages/tsdaodaoadvanced/package.json packages/tsdaodaoadvanced/
COPY packages/tsdaodaocontacts/package.json packages/tsdaodaocontacts/
COPY packages/tsdaodaodatasource/package.json packages/tsdaodaodatasource/
COPY packages/tsdaodaofavorite/package.json packages/tsdaodaofavorite/
COPY packages/tsdaodaofile/package.json packages/tsdaodaofile/
COPY packages/tsdaodaogroupmanager/package.json packages/tsdaodaogroupmanager/
COPY packages/tsdaodaologin/package.json packages/tsdaodaologin/
COPY packages/tsdaodaomoments/package.json packages/tsdaodaomoments/
COPY packages/tsdaodaoprivacy/package.json packages/tsdaodaoprivacy/
COPY packages/tsdaodaosticker/package.json packages/tsdaodaosticker/
COPY packages/tsdaodaovideo/package.json packages/tsdaodaovideo/

ENV YARN_CACHE_FOLDER=/root/.yarn-cache
RUN --mount=type=cache,target=/root/.yarn-cache \
    yarn install --network-timeout 300000

# ----- 构建层：仅源码 / 配置变更时执行 -----
COPY . .
# 可选构建参数：
# - REACT_APP_TWEMOJI_USE_SERVER_PROXY=1 让浏览器经由后端 /v1/common/twemoji72/ 取表情，避免外链 jsDelivr。
# - REACT_APP_TWEMOJI_BASE=https://mirror.example.com/... 指定自建镜像站。
ARG REACT_APP_TWEMOJI_USE_SERVER_PROXY
ARG REACT_APP_TWEMOJI_BASE
ENV REACT_APP_TWEMOJI_USE_SERVER_PROXY=${REACT_APP_TWEMOJI_USE_SERVER_PROXY}
ENV REACT_APP_TWEMOJI_BASE=${REACT_APP_TWEMOJI_BASE}
RUN yarn build

FROM nginx:latest
COPY --from=builder /app/docker-entrypoint.sh /docker-entrypoint2.sh 
RUN sed -i 's/\r$//' /docker-entrypoint2.sh
COPY --from=builder /app/nginx.conf.template /
COPY --from=builder /app/apps/web/build /usr/share/nginx/html
ENTRYPOINT ["sh", "/docker-entrypoint2.sh"]
CMD ["nginx","-g","daemon off;"]
