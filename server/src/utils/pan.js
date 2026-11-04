function maskPan(pan) {
  if (!pan || typeof pan !== "string" || pan.length < 6) {
    return "****";
  }
  return `${pan.slice(0, 5)}****${pan.slice(-1)}`;
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

module.exports = { maskPan, PAN_REGEX };
