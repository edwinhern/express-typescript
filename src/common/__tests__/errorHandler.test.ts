import express, { type Express } from "express";
import { StatusCodes } from "http-status-codes";
import request from "supertest";

import errorHandler from "@/common/middleware/errorHandler";

describe("Error Handler Middleware", () => {
	let app: Express;

	beforeAll(() => {
		app = express();

		app.get("/error", () => {
			throw new Error("Test error");
		});
		app.get("/next-error", (_req, _res, next) => {
			const error = new Error("Error passed to next()");
			next(error);
		});

		app.use(errorHandler());
	});

	it("returns 404 for unknown routes", async () => {
		const response = await request(app).get("/this-route-does-not-exist");
		expect(response.status).toBe(StatusCodes.NOT_FOUND);
	});

	it("handles thrown errors with a 500 status code", async () => {
		const response = await request(app).get("/error");
		expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
	});

	it("handles errors passed to next() with a 500 status code", async () => {
		const response = await request(app).get("/next-error");
		expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
	});
});
