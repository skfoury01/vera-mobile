# Vera Mobile Auth Integration

This document records the current Vera web authentication contract from read-only inspection of
`../fanbase-mvp`. The mobile app must not copy server implementation details or secrets from the
web app.

## Current Web Login Contract

The web login route is `POST /api/auth/login`.

It accepts either:

- `application/json` with `{ "email": string, "password": string }`
- native form data / URL-encoded form fields named `email` and `password`

For JSON callers, the route responds with JSON shaped like:

```json
{
  "ok": true,
  "next": "/somewhere",
  "flowId": "auth-flow-id"
}
```

On failures, it responds with:

```json
{
  "ok": false,
  "error": "invalid",
  "message": "optional user-safe message",
  "next": "/somewhere",
  "flowId": "auth-flow-id"
}
```

Observed error codes include `missing`, `invalid`, `rate_limited`, and the email-unverified error
constant used by the web app.

Successful login signs a session token server-side and writes it to the app session cookie. In
production the cookie name is `__Host-session`; in development it is `session`. Cookie options
include `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, a production/secure-request-aware
`secure` value, and a max age from the server security configuration.

The web client calls the login endpoint with `credentials: "include"` and then navigates based on
the `next` value. The raw session token is not returned in the JSON body.

## Session And Logout

The web session check is exposed through `GET /api/auth/session`. It returns JSON with:

```json
{
  "session": {
    "user": {
      "id": "user-id",
      "email": "user@example.com"
    }
  },
  "viewer": {},
  "source": "app-session"
}
```

When unauthenticated, `session` is `null`. The response is no-store and varies on `Cookie`.

Logout is handled by `/api/auth/logout` with both `GET` and `POST`. For JSON callers, it returns
`{ "ok": true, "next": "/login", "flowId": "auth-flow-id" }` and clears the web session and pending
signup cookies.

## Why The Web Contract Is Not Enough For Native

The current login contract depends on an HttpOnly browser cookie for persistence. That is the right
shape for the web app, but it is not a complete native-client contract:

- React Native does not reliably share the browser's cookie jar with the website.
- HttpOnly cookies are intentionally unavailable to JavaScript, so the mobile app cannot safely read
  or persist the web session cookie.
- Copying the raw cookie into JavaScript would weaken the web security model and increase leakage
  risk.
- A native app needs an explicit token lifecycle: creation, storage, refresh, revocation, and logout.

The temporary mobile sign-in screen therefore must not claim authentication works until a safe
native endpoint exists.

## Minimal Native Backend Endpoints Needed

The safest minimal backend contract is:

- `POST /api/mobile/auth/login`
  - Accept email and password over HTTPS.
  - Apply the same rate limits, password verification, email verification, ban checks, and audit
    logging as web login.
  - Return a narrow mobile session token and its expiry, not a browser cookie.
- `GET /api/mobile/auth/session`
  - Accept `Authorization: Bearer <mobile-session-token>`.
  - Return the current viewer/session shape needed by the app.
  - Fail closed when the token is expired, revoked, malformed, or the user is blocked.
- `POST /api/mobile/auth/refresh`
  - Rotate short-lived access tokens using a refresh token or equivalent server-side session record.
  - Revoke the previous refresh token on rotation.
- `POST /api/mobile/auth/logout`
  - Revoke the presented mobile token/session server-side.
  - Return success even if the token was already expired or revoked.
- `POST /api/mobile/auth/logout-all`
  - Revoke all mobile sessions for the current user, if account security flows need it.

## Token Expectations

Native tokens should be scoped to the mobile client and stored only in the device secure store.

Expected behavior:

- Access tokens should be short-lived.
- Refresh tokens, if used, should be rotated and revocable.
- Server-side session records should allow logout and emergency revocation.
- Token verification should enforce user existence, ban state, and account security status.
- Tokens should include only minimal claims, such as session id, user id, audience, issued-at, and
  expiry.
- The mobile app should store only the narrow mobile session token material needed for API calls.
- Passwords must never be stored.

## Mobile Secret Boundary

No server secrets belong in the mobile app. Do not include Prisma, database URLs, Supabase
service-role keys, Stripe secrets, Mux secrets, OAuth client secrets, webhook secrets, signing
secrets, or any other privileged backend secret in Expo config, source files, native resources, or
environment variables exposed with `EXPO_PUBLIC_`.
