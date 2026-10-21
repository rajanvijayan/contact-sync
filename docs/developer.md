# Developer reference

## Building from source

```bash
composer install          # PHP dependencies (Action Scheduler) + dev tools
npm install
npm run build             # build/portal.js, build/admin.js
npm run start             # watch mode
composer test             # PHPUnit (unit tests, no database needed)
npm test                  # Jest
composer lint             # PHPCS, WordPress Coding Standards
npm run lint:js && npm run lint:css
npm run zip               # dist/contact-sync.zip, ready to upload
```

## Layout

```
contact-sync.php        bootstrap
includes/
  Agencies/             agency repository, domain matching
  Auth/                 login, reset, rate limiting
  Crm/                  token provider, Dynamics client, lead mapper, sync job
  Forms/                schema, conditional logic, server validation
  Import/               bulk import, sample CSV
  Portal/               routes, front-end lockdown, assets
  Reps/                 sign-up, verification, invitations
  Rest/                 REST controllers (namespace contact-sync/v1)
  Submissions/          storage and creation
src/
  portal/  admin/  shared/   React apps (wp-scripts)
tests/
  php/  js/  fixtures/conditions.json   # shared by the PHP and JS evaluators
```

Conditional logic lives in two mirrored places, `includes/Forms/ConditionEvaluator.php` and `src/shared/conditions.js`. Both are tested against the same fixture, so any change must keep both green.

## Data

Custom tables (prefixed `{$wpdb->prefix}cs_`): `agencies`, `agency_domains`, `forms`, `submissions`, `import_batches`, `sync_log`. Reps are WordPress users with the `cs_rep` or `cs_agency_manager` role; user meta `cs_agency_id`, `cs_status`.

Capabilities: `manage_contact_sync` (administrators), `cs_submit_leads`, `cs_view_agency_leads`.

## Filters

| Filter | Arguments | Use |
| --- | --- | --- |
| `contact_sync_lead_payload` | `$payload, $schema, $values, $context` | Change the Lead body before it is sent |
| `contact_sync_crm_attributes` | `$list` | Add columns to the mapping dropdown (`[ logical_name, label, type ]`) |
| `contact_sync_token_url` | `$url, $tenant_id` | Token endpoint, e.g. `login.microsoftonline.us` for GCC High |
| `contact_sync_client_ip` | `$ip` | Client IP for rate limiting behind a trusted proxy |
| `contact_sync_hide_content_menus` | `bool` | Return `false` to keep Posts/Pages/Comments menus |

```php
// Example: send US Government cloud tokens.
add_filter( 'contact_sync_token_url', function ( $url, $tenant ) {
	return "https://login.microsoftonline.us/{$tenant}/oauth2/v2.0/token";
}, 10, 2 );
```

## Actions

| Action | Arguments |
| --- | --- |
| `contact_sync_submission_created` | `$submission_id, $values, $form` |
| `contact_sync_submission_synced` | `$submission_id, $lead_id, $status` (`synced` or `duplicate`) |
| `contact_sync_sync_submission` | `$submission_id`: the Action Scheduler hook that performs the sync |

## REST API

All routes are under `/wp-json/contact-sync/v1` and use cookie authentication with the `wp_rest` nonce.

| Area | Routes | Permission |
| --- | --- | --- |
| Auth | `POST auth/login, auth/signup, auth/verify, auth/resend, auth/forgot, auth/reset`, `GET auth/reset`, `POST auth/logout` | public / signed in |
| Portal | `GET portal/me`, `GET/POST portal/submissions`, `GET portal/submissions/{id}`, `POST portal/imports/validate`, `GET/POST portal/imports`, `GET portal/imports/{id}`, `GET portal/sample-csv` | active rep |
| Admin | `agencies`, `reps`, `forms`, `submissions`, `submissions/retry`, `submissions/export`, `stats`, `settings`, `settings/test-connection`, `settings/test-email`, `settings/sync-queued` | `manage_contact_sync` |

## Sync behaviour

1. A submission is stored as `queued` and an async action is scheduled.
2. The job builds the payload with `LeadMapper`, optionally looks up an open Lead with the same email, and posts to `/api/data/v{version}/leads`.
3. Network errors, timeouts, HTTP 429 and 5xx are retried after 1 min, 5 min, 15 min, 1 h, 2 h… up to the configured attempts. Other 4xx responses fail immediately with the Dynamics error message.
4. A 401 refreshes the token once before failing.
