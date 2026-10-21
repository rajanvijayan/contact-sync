# Troubleshooting

## Leads stay "Queued"

- **Is sync paused?** Check **Settings › Sync › Send leads to Dynamics 365**.
- **Is WordPress cron running?** Leads are sent in the background. On quiet sites cron runs only when someone visits. Add a server cron (see [Installation › Background processing](installation.md#background-processing-recommended)).
- Check **Tools › Scheduled Actions** (group `contact-sync`) for pending or failed actions.
- **Settings › Sync › Sync queued leads now** re-schedules everything still queued.

## "Authentication failed: AADSTS…"

| Message contains | Fix |
| --- | --- |
| `AADSTS7000215` Invalid client secret | Create a new secret in Azure and paste its **Value** (not the Secret ID) |
| `AADSTS7000222` secret expired | Create a new secret and update Settings |
| `AADSTS700016` application not found | Check the client ID and tenant ID |
| `AADSTS90002` tenant not found | Check the tenant ID |

## "Unauthorized" or "Forbidden" after authentication succeeds

- **401 Unauthorized:** the application user is missing in that Dynamics environment, or the organization URL points to a different environment.
- **403 Forbidden:** the application user's security role cannot create Leads. Assign a role such as Salesperson.

## A lead failed with a Dynamics validation error

Open the lead in **Submissions**. The error comes straight from Dynamics, for example:

- *"… exceeds the maximum length …"*: the answer is longer than the Lead column allows. Add a max length to the field in the form builder.
- *"… is outside the valid range"* on a Choice column: the option value doesn't match a Dynamics option set value. Use the numeric values (e.g. `100000000`).
- *"Required field … is missing"*: map a form field to that column, or add a fixed value in **Form settings**.
- Unknown attribute: the logical name in the Dynamics tab is misspelled.

Fix the cause, then click **Retry sync** (or **Retry all** on the dashboard).

## Reps don't receive emails

1. **Settings › Emails › Send test email.**
2. If that fails, install an SMTP plugin (e.g. connected to Microsoft 365 or SendGrid) so WordPress can send mail reliably.
3. Ask reps to check spam. Set a proper **From email** on your own domain.
4. As a fallback, **Reps › ⋮ › Mark as verified** activates a pending account manually.

## "Sign up is only available for approved partner email domains"

The email domain isn't on an active agency. Add it under **Agencies**, or invite the rep. For subdomains such as `uk.agency.com`, either add that domain or turn on **Settings › Security › Allow subdomains**.

## "Too many sign-in attempts"

The lockout clears automatically after the time set in **Settings › Security** (15 minutes by default). Administrators can reset the rep's password from **Users** if needed.

## Bulk upload problems

| Symptom | Fix |
| --- | --- |
| Accented characters look wrong | Save the file as **CSV UTF-8** |
| "The file has … rows; the limit is …" | Split the file, or raise the limit in **Settings › Security** |
| Choice values rejected | Use the option labels from the **Column reference** exactly |
| Required column unmapped warning | Map the column in step 2, or add it to the spreadsheet |

## The portal shows a blank page or 404

- **Settings › Permalinks:** choose any option other than Plain and save. This also refreshes the portal routes.
- If you installed from source, run `composer install` and `npm run build`. A notice in the admin tells you when assets are missing.

## Where to find logs

- Every sync attempt is recorded on the submission (**Submissions › open a lead › Sync history**), with the payload sent and the Dynamics response.
- Background job history: **Tools › Scheduled Actions**.
