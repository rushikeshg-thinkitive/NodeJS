import { Router } from "express";
import * as userController from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.post("/users", userController.createUser);
userRouter.get("/users", userController.getUsers);

export default userRouter;
