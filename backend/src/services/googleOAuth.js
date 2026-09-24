const { OAuth2Client } = require('google-auth-library'); 
const env = require('../../config/env');

const client = new OAuth2Client(env.google.clientId, env.google.clientSecret, env.google.callbackUrl);

function buildAuthUrl(state) {
    return client.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        state,
        prompt: 'select_account'
    });
}

async function exchangeCodeForProfile(code) {
    const { tokens } = await client.getToken({ code, redirect_uri: env.google.callbackUrl });
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.google.clientId });
    const payload = ticket.getPayload();

    return {
        googleId: payload.sub,
        email: payload.email,
        emailVerified: Boolean(payload.email_verified),
        fullName: payload.name || null,
        avatarUrl: payload.picture || null,
    };
}

module.exports = { buildAuthUrl, exchangeCodeForProfile };
