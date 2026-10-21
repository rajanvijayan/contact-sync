# Installation

## Requirements

- WordPress 6.2 or newer (a fresh, dedicated site is recommended)
- PHP 7.4 or newer with the `openssl` extension
- HTTPS (strongly recommended, as reps sign in with passwords)
- Outbound HTTPS access from the server to `login.microsoftonline.com` and your `*.dynamics.com` environment
- A working mail setup for verification and invitation emails (an SMTP plugin is recommended)

## Install the plugin

1. In WordPress go to **Plugins › Add New › Upload Plugin** and upload `contact-sync.zip`.
2. Click **Activate**.

On activation the plugin:

- creates its database tables,
- adds the **Rep** and **Agency Manager** roles,
- creates a starter **Lead Form**,
- registers the portal addresses `/login`, `/signup`, `/app` and others.

## Turn on pretty permalinks

The portal uses clean addresses such as `https://leads.example.com/login`. Go to **Settings › Permalinks** and choose any option except **Plain**, then save. A notice appears in the admin until this is done.

## What changes on the public site

Contact Sync turns the site into an application:

| Address | Behaviour |
| --- | --- |
| `/login`, `/signup`, `/forgot-password` | Portal pages |
| `/app/…` | The rep portal (sign-in required) |
| `/` and every other page, post, feed or archive | Redirects to `/app` (signed in) or `/login` |
| `/wp-login.php` | Redirects to `/login` |
| `/wp-admin` | Administrators only; reps are sent to `/app` |
| XML-RPC, public user listing, comments | Disabled |

The Posts, Pages and Comments admin menus are hidden because nothing on the public site displays them.

## Background processing (recommended)

Leads are delivered in the background by Action Scheduler, which runs on WordPress cron. On low-traffic sites, add a real server cron so leads are sent promptly:

```
*/2 * * * * curl -s https://leads.example.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1
```

or, with WP-CLI:

```
*/2 * * * * cd /path/to/wordpress && wp action-scheduler run --quiet
```

You can then add `define( 'DISABLE_WP_CRON', true );` to `wp-config.php`.

## First-time setup checklist

The Contact Sync **Dashboard** shows a checklist until each step is done:

1. [Connect Dynamics 365](dynamics-setup.md)
2. [Add your first agency](admin-guide.md#agencies)
3. [Invite a rep](admin-guide.md#reps) or let agency reps sign up
4. [Review the lead form](admin-guide.md#form-builder) and submit a test lead

## Uninstalling

Deactivating keeps all data. **Deleting** the plugin from the Plugins screen removes its tables, settings, roles and rep metadata. WordPress user accounts are kept.
