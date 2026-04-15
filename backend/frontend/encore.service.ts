
import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";
import { sentryMiddleware } from "../observability/sentry";

export default new Service("frontend", { middlewares: [sentryMiddleware] });

export const assets = api.static({
  path: "/*path",
  expose: true,
  dir: "./dist",
  notFound: "./dist/index.html",
  notFoundStatus: 200,
});
