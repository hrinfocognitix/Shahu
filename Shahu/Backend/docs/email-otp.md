# Email verification OTP API

Endpoints are available at both `/api/auth` and `/api/v1/auth`.

## Send OTP

`POST /api/auth/send-email-otp`

```json
{ "email": "user@example.com" }
```

Successful and throttled requests intentionally return the same response:

```json
{ "success": true, "message": "If the email address is valid, a verification code has been sent." }
```

## Verify OTP

`POST /api/auth/verify-email-otp`

```json
{ "email": "user@example.com", "otp": "123456" }
```

Success:

```json
{ "success": true, "message": "Email verified successfully." }
```

Invalid, expired, consumed, or locked codes return HTTP 401:

```json
{ "success": false, "message": "Invalid or expired verification code." }
```

## Frontend example

```ts
async function sendEmailOtp(email: string) {
  const response = await fetch(`${API_URL}/api/auth/send-email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return response.json();
}

async function verifyEmailOtp(email: string, otp: string) {
  const response = await fetch(`${API_URL}/api/auth/verify-email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  return response.json();
}
```

## Required environment variables

Copy `.env.example` to `.env.local` and supply secrets there. Use HTTPS in production. Never commit SMTP passwords or OTP HMAC secrets.
