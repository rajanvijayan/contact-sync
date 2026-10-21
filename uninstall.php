<?php
/**
 * Uninstall: remove tables, options, roles and user meta.
 *
 * @package ContactSync
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/vendor/autoload.php';

\ContactSync\Install\Schema::drop();

delete_option( 'contact_sync_settings' );
delete_transient( 'contact_sync_token' );

remove_role( 'cs_rep' );
remove_role( 'cs_agency_manager' );
$contact_sync_admin = get_role( 'administrator' );
if ( $contact_sync_admin ) {
	$contact_sync_admin->remove_cap( 'manage_contact_sync' );
	$contact_sync_admin->remove_cap( 'cs_submit_leads' );
	$contact_sync_admin->remove_cap( 'cs_view_agency_leads' );
}

global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE 'cs\\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
