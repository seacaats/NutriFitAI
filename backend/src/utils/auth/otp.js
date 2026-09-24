const crypto = require('crypto');
const bcrypt = require('bcrypt');
const env = require('../../../config/env');

const OTP_SALT_ROUNDS = 10;

function generateOtp(length = env.otp.length) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

function hashOtp(code) {
  return bcrypt.hash(code, OTP_SALT_ROUNDS);
}

function verifyOtp(code, hash) {
  return bcrypt.compare(code, hash);
}

function otpExpiryDate() {
  return new Date(Date.now() + env.otp.ttlMinutes * 60 * 1000);
}

module.exports = { generateOtp, hashOtp, verifyOtp, otpExpiryDate };
