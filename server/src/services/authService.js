const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { env } = require("../config/env");
const { httpError } = require("../middleware/errors");

function publicUser(user) {
  const obj = user.toObject();
  delete obj.passwordHash;
  return obj;
}

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

async function register({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw httpError(409, "Email already registered", "conflict");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: "donor",
  });
  return publicUser(user);
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw httpError(401, "Invalid email or password", "unauthorized");
  }

  const matched = await bcrypt.compare(password, user.passwordHash);
  if (!matched) {
    throw httpError(401, "Invalid email or password", "unauthorized");
  }

  return { token: signToken(user), user: publicUser(user) };
}

async function getMe(id) {
  const user = await User.findById(id);
  if (!user) {
    throw httpError(401, "Login required", "unauthorized");
  }
  return publicUser(user);
}

module.exports = { register, login, getMe, publicUser, signToken };
