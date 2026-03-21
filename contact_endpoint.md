# Contact Endpoint — Requirements Document

## Overview

A self-hosted, GDPR-compliant REST API endpoint that receives contact form submissions from `orbint.github.io` and delivers them via SMTP email. No user data is stored at any point.

---

## 1. Infrastructure

| Component | Requirement |
|---|---|
| Server | VPS (recommended: Hetzner CX11, located in Germany/EU) |
| OS | Ubuntu 22.04 LTS |
| Runtime | Python 3.11+ |
| Framework | FastAPI |
| ASGI server | Uvicorn (behind Nginx reverse proxy) |
| Domain | `api.orbint.de` (or subdomain of choice) |
| TLS | Let's Encrypt via Certbot (HTTPS required) |
| Process manager | systemd service (auto-restart on failure) |

---

## 2. Endpoint Specification

### `POST /contact`

**Request**

```
Content-Type: application/json
Origin: https://orbint.github.io
```

```json
{
  "name": "string, required, max 100 chars",
  "email": "string, required, valid email format",
  "phone": "string, optional, max 30 chars",
  "message": "string, required, max 2000 chars"
}
```

**Success response** — `200 OK`

```json
{ "ok": true }
```

**Error response** — `422 Unprocessable Entity` (FastAPI/Pydantic validation)

```json
{ "detail": [{ "loc": ["body", "email"], "msg": "value is not a valid email address" }] }
```

**Error response** — `500 Internal Server Error`

```json
{ "ok": false, "error": "Failed to send message. Please try again." }
```

---

## 3. Security Requirements

### CORS
- `CORSMiddleware` restricted to `https://orbint.github.io` only
- All other origins rejected

### Rate Limiting
- Max **3 requests per IP per 10 minutes** via `slowapi`
- Excess requests return `429 Too Many Requests`

### Input Validation
- All fields validated via **Pydantic v2** models
- Email format validated with `pydantic[email]`
- Fields stripped of leading/trailing whitespace
- HTML tags stripped from all string fields

### Transport
- HTTPS only via Nginx — HTTP redirected to HTTPS
- TLS 1.2+ enforced at Nginx level

---

## 4. Email Delivery

- Sent via SMTP using `aiosmtplib` (async, non-blocking)
- Credentials for `info@orbint.de` supplied via environment variables
- Delivered to a configurable recipient address (env var)
- Sender IP is **not** included in the email body

**Example email:**

```
From: noreply@orbint.de
To: info@orbint.de
Subject: New Contact Form Submission

Name:    Max Mustermann
Email:   max@example.com
Phone:   +49 89 123456 (optional)
Message:
We are interested in learning more about Orbint's capabilities.
```

---

## 5. Data Protection (GDPR)

- **No database** — form data is never written to disk or stored
- **No logging of personal data** — logs record only timestamp, HTTP method, route, and response code; request body is never logged
- **Data in transit only** — data exists in memory for the duration of the SMTP call, then discarded by the garbage collector
- **Retention** — data lifecycle ends when the notification email is delivered; the email inbox is the operator's responsibility
- Processing basis: Art. 6(1)(b) DSGVO — processing necessary to respond to a pre-contractual inquiry

---

## 6. Environment Variables

Configured via a `.env` file loaded by `python-dotenv`. No secrets in code.

| Variable | Description | Example |
|---|---|---|
| `ALLOWED_ORIGIN` | Permitted CORS origin | `https://orbint.github.io` |
| `SMTP_HOST` | SMTP server hostname | `mail.orbint.de` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `info@orbint.de` |
| `SMTP_PASS` | SMTP password | `***` |
| `SMTP_FROM` | Sender address | `noreply@orbint.de` |
| `CONTACT_TO` | Recipient address for submissions | `info@orbint.de` |

---

## 7. Frontend Integration

The form in `contact.html` posts to the endpoint via `fetch()`.

The endpoint URL is defined in a single constant at the top of `js/script.js`:

```js
const CONTACT_ENDPOINT = 'https://api.orbint.de/contact';
```

During development / before the server is live, this constant is `null`, which triggers the mock handler (see Section 8).

---

## 8. Mock Mode (Current)

Until the server is deployed, the form uses a local mock that:
- Simulates a 1-second network delay
- Always returns success
- Logs the payload to the browser console
- Is replaced by setting `CONTACT_ENDPOINT` to the live URL

```js
// Set to live URL when server is deployed:
// const CONTACT_ENDPOINT = 'https://api.orbint.de/contact';
const CONTACT_ENDPOINT = null; // mock mode
```

> **To go live:** in `js/script.js`, replace `const CONTACT_ENDPOINT = null;` with `const CONTACT_ENDPOINT = 'https://api.orbint.de/contact';` — no other frontend changes required.

---

## 9. Server File Structure

```
contact-api/
├── main.py            # FastAPI app, CORS, rate limiting, /contact route
├── mailer.py          # aiosmtplib SMTP wrapper
├── models.py          # Pydantic request model (ContactForm)
├── config.py          # Settings loaded from .env via pydantic-settings
├── .env               # Environment variables (never committed)
├── .env.example       # Template with all required keys, no values
├── requirements.txt   # fastapi, uvicorn, aiosmtplib, pydantic[email], slowapi, python-dotenv
└── README.md          # Deployment instructions
```

---

## 10. Deployment Checklist

- [ ] VPS provisioned in EU region
- [ ] Domain `api.orbint.de` DNS A record pointing to VPS IP
- [ ] Nginx installed and configured as reverse proxy to `127.0.0.1:8000`
- [ ] TLS certificate issued via Certbot
- [ ] Python 3.11+ and virtualenv set up
- [ ] `.env` configured with SMTP credentials
- [ ] systemd service configured and enabled
- [ ] Firewall: only ports 80, 443, 22 open
- [ ] Test POST via curl before going live
- [ ] Update `CONTACT_ENDPOINT` in `js/script.js` to live URL
- [ ] Verify CORS rejects requests from other origins
- [ ] Verify rate limiting triggers after 3 rapid submissions
