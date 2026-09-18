# Security Policy

## Reporting a vulnerability

Do **not** open a public issue for a security problem.

Report privately through one of:

1. **GitHub private vulnerability reporting** — the Security tab of this repository,
   "Report a vulnerability". Preferred: it reaches the maintaining team directly and
   keeps the discussion attached to the code.
2. **Email** `security@entur.org` — Entur's security mailbox, monitored by Team
   Sikkerhet.

Include what you need to describe the problem: affected URL or endpoint, the request
that triggers it, what you observed, and what you expected. A proof of concept helps,
but a clear description is enough to start.

You will get an acknowledgement. If a report turns out to affect more than this
service, Team Sikkerhet coordinates the response across the affected teams.

## Scope

This repository is the Uniformen layout service — the header and footer Entur's B2B
applications embed — and the `@entur/uniformen` client package.

In scope: the service in this repository, its container image, and the published
package.

Out of scope: the applications that embed Uniformen, Entur's Auth0 tenants, and the
`*.entur.no` / `*.entur.io` / `*.entur.org` hosts the app switcher links to. Those are
owned by other teams; `security@entur.org` still routes such reports to the right
place.

## Supported versions

The deployed service is supported at its current release only. For the
`@entur/uniformen` package, fixes go to the latest minor version; older versions are
not patched.

## What this service handles

Uniformen validates bearer tokens from Entur's Auth0 tenants to decide what the
header renders, and holds no persistent user data. Reports about token validation,
the JWKS handling, or the login and environment-switch links are especially relevant.
