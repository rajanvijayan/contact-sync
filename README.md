# Contact Sync

A WordPress plugin that turns a WordPress site into a lead capture portal for agency and independent reps. Leads go to Microsoft Dynamics 365 as **Lead** records.

## Features
- Agencies with email domains. Reps who sign up on an approved domain are linked to their agency automatically, after verifying their email.
- Independent reps are invited by an admin.
- A drag-and-drop form builder with conditional logic and a field mapping for each Dynamics column.
- Lead entry one at a time, or bulk CSV upload with column mapping and row validation. A sample CSV is generated from the live form.
- Background sync through Action Scheduler with retries, duplicate detection and a detailed sync log.
- A locked-down front end: only the portal pages (login, signup, app) are reachable.

## Requirements
WordPress 6.2+, PHP 7.4+, pretty permalinks.

## Development
```
composer install
npm install
npm run build     # compile portal and admin apps
npm test          # JS unit tests
composer test     # PHP unit tests
composer lint     # PHPCS (WordPress Coding Standards)
```

Screenshots are in `docs/images/`.
