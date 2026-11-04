const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/app");
const { User } = require("../src/models");

const app = createApp();
const password = "DemoPass123";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

async function createAdmin() {
  await User.create({
    name: "Seva Admin",
    email: "admin@seva.test",
    passwordHash: await bcrypt.hash(password, 10),
    role: "admin",
  });
}

describe("auth", () => {
  it("register then login works", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      name: "Demo Donor",
      email: "donor@seva.test",
      password,
    });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.user.email).toBe("donor@seva.test");
    expect(registerRes.body.user.role).toBe("donor");
    expect(registerRes.body.user.passwordHash).toBeUndefined();

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "donor@seva.test",
      password,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toEqual(expect.any(String));
    expect(loginRes.body.user.email).toBe("donor@seva.test");
    expect(loginRes.body.user.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Demo Donor",
      email: "donor@seva.test",
      password,
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Another Donor",
      email: "donor@seva.test",
      password,
    });

    expect(res.status).toBe(409);
  });

  it("returns 401 on admin ping without a token", async () => {
    const res = await request(app).get("/api/admin/ping");
    expect(res.status).toBe(401);
  });

  it("returns 403 on admin ping with a donor token", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Demo Donor",
      email: "donor@seva.test",
      password,
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "donor@seva.test",
      password,
    });

    const res = await request(app)
      .get("/api/admin/ping")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(403);
  });

  it("returns 200 on admin ping with an admin token", async () => {
    await createAdmin();
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@seva.test",
      password,
    });

    const res = await request(app)
      .get("/api/admin/ping")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 400 for invalid input", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "short",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });
});
