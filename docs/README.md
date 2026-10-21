# Contact Sync documentation

Contact Sync turns a WordPress site into a lead capture portal. Business reps sign in, submit leads one at a time or in bulk from a spreadsheet, and every lead is delivered to Microsoft Dynamics 365 as a **Lead** record.

| Guide | Who it is for |
| --- | --- |
| [Installation](installation.md) | Whoever sets up the WordPress site |
| [Connecting Dynamics 365](dynamics-setup.md) | IT / CRM administrator |
| [Administrator guide](admin-guide.md) | Marketing and sales operations |
| [Rep guide](rep-guide.md) | Agency and independent reps (share this with them) |
| [Troubleshooting](troubleshooting.md) | Everyone |
| [Developer reference](developer.md) | Developers extending the plugin |

## How it works

```
Rep (portal)                     WordPress + Contact Sync                 Dynamics 365
─────────────                    ────────────────────────                 ────────────
Sign up with work email  ──▶  Domain checked against agencies
                              Email verified, agency assigned
Submit lead / upload CSV ──▶  Validated (incl. conditional rules)
                              Stored + queued                  ──▶  POST /leads
                              Status updated, retried on errors ◀──  leadid
Track status in portal   ◀──  Synced / Duplicate / Failed
```

![Admin dashboard](images/admin-dashboard.jpg)
