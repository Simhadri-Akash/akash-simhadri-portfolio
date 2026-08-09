import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactRouter from "./contact";
import chatRouter from "./chat";
import portfolioRouter from "./portfolio";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactRouter);
router.use(chatRouter);
router.use(portfolioRouter);

export default router;
