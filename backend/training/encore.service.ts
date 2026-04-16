import { Service } from "encore.dev/service";
import { sentryMiddleware } from "../observability/sentry";

export default new Service("training", { middlewares: [sentryMiddleware] });
