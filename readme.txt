=== Contact Sync ===
Contributors: rajanvijayan
Tags: leads, dynamics 365, crm, portal, csv import
Requires at least: 6.2
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Lead capture portal for agency and independent reps, with automatic delivery to Microsoft Dynamics 365.

== Description ==

Contact Sync turns a WordPress site into a focused web application where business reps submit leads and track them, and every lead is created in Microsoft Dynamics 365 automatically.

* **Agencies and domains**: register partner agencies with their email domains. Reps who sign up with a matching email are linked to the agency automatically after verifying their address.
* **Independent reps**: invite reps who don't belong to an agency.
* **Form builder**: drag-and-drop fields, sections, validation, show/hide conditions and a Dynamics column per field.
* **Bulk upload**: CSV import with automatic column matching and a row-by-row review before anything is sent. A sample CSV is generated from the live form.
* **Reliable sync**: background delivery with automatic retries, optional duplicate detection and a full sync history per lead.
* **Locked-down front end**: only the sign-in, sign-up and portal pages are reachable; everything else redirects.

== Installation ==

1. Upload the plugin zip under Plugins > Add New > Upload Plugin and activate it.
2. Settings > Permalinks: choose any option except "Plain".
3. Contact Sync > Settings > Dynamics 365: enter your organization URL, tenant ID, client ID and secret, then click Test connection.
4. Add agencies, review the lead form, and share the portal address (/login) with your reps.

Full documentation is included in the docs folder of the source repository.

== Frequently Asked Questions ==

= Which Dynamics 365 record is created? =

A Lead. Map form fields to any standard or custom Lead column.

= Can reps from any company sign up? =

No. Only emails on an active agency's domains can sign up. Other reps must be invited by an administrator.

= What happens if Dynamics is unavailable? =

Leads are stored and retried automatically with increasing delays. Administrators can retry failed leads at any time.

== Changelog ==

= 1.0.0 =
* Initial release.
