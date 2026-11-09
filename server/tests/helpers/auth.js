const bcrypt = require("bcryptjs");
const request = require("supertest");
const { User } = require("../../src/models");

async function makeUser(app, { email, role = "donor", name = "Test User" }) {
  await User.create({
    name,
    email,
    role,
    passwordHash: await bcrypt.hash("DemoPass123", 4),
  });
  const res = await request(app).post("/api/auth/login").send({ email, password: "DemoPass123" });
  return { token: res.body.token, user: res.body.user };
}

module.exports = { makeUser };
