# Security policy

## Supported version

Security fixes are provided for the latest released 1.x version. Development snapshots on `main` may
change without migration guarantees until they are included in a release.

## Reporting a vulnerability

Do not place credentials, private routine data, or an exploitable proof of concept in a public
issue. Send a concise report to `support@d-score.app` after the support domain is active. Before
then, open a minimal GitHub issue asking the maintainers for a private reporting channel.

Include the affected version, platform, reproduction conditions, impact, and a safe description of
the issue. The operator will acknowledge a usable report, assess impact, and coordinate disclosure;
no bug-bounty program is currently offered.

Ordinary scoring disagreements without a security or data-loss impact belong in the source-backed
rules correction form.

## Product security model

D-Score Gymnastics has no account or application backend. Routine data is stored in IndexedDB on web
or SQLite on native and is not encrypted by the app beyond protections provided by the device and
operating system. Exported backups are plain JSON and should be handled like any other user-owned
file.

The public site includes no analytics, advertising, crash-reporting SDK, or third-party user-data
service. Any feature that changes this model requires a privacy, threat-model, store-disclosure, and
release review before shipping.
