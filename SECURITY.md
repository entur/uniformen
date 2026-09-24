# Security Policy

## Reporting a vulnerability

Do **not** open a public issue for a security problem.

Report it privately in one of these ways:

1. **GitHub private vulnerability reporting.** Go to the Security tab of this
   repository and click "Report a vulnerability". We prefer this way, because the
   report goes directly to the team that maintains the code and the discussion stays
   next to the code.
2. **Email** `security@entur.org`. This is Entur's security mailbox. Team Sikkerhet
   reads it.

Describe the problem: the affected URL or endpoint, the request that causes it, what
you saw, and what you expected. A proof of concept helps, but a clear description is
enough to start.

We will confirm that we received your report. If the problem affects more than this
service, Team Sikkerhet coordinates the work with the other affected teams.

## Scope

This repository contains the Uniformen layout service, which renders the header and
footer that Entur's B2B applications embed. It also contains the `@entur/uniformen`
client package.

In scope: the service in this repository, its container image, and the published
package.

Out of scope: the applications that embed Uniformen, Entur's Auth0 tenants, and the
`*.entur.no`, `*.entur.io` and `*.entur.org` hosts the app switcher links to. Other
teams own these. You can still report problems with them to `security@entur.org`,
and they will be sent to the right team.

## Supported versions

For the deployed service, only the current release is supported. For the
`@entur/uniformen` package, fixes are made in the latest minor version only. Older
versions are not patched.

## What this service handles

Uniformen validates bearer tokens from Entur's Auth0 tenants to decide what the
header shows. It does not store user data permanently. We are especially interested in
reports about token validation, JWKS handling, and the login and environment switcher
links.
