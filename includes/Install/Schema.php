<?php
/**
 * Database schema.
 *
 * @package ContactSync
 */

namespace ContactSync\Install;

use ContactSync\Support\Db;

defined( 'ABSPATH' ) || exit;

/**
 * Creates and upgrades the custom tables.
 */
class Schema {

	const DB_VERSION = '1.0.2';
	const OPTION     = 'contact_sync_db_version';

	/**
	 * Run dbDelta when the stored schema version is behind.
	 */
	public static function maybe_upgrade() {
		$from = get_option( self::OPTION );
		if ( self::DB_VERSION !== $from ) {
			self::install();
			if ( $from && version_compare( $from, '1.0.1', '<' ) ) {
				( new \ContactSync\Crm\SyncJob() )->release_waiting();
			}
			if ( $from && version_compare( $from, '1.0.2', '<' ) ) {
				( new \ContactSync\Submissions\SubmissionRepository() )->backfill_emails();
			}
		}
	}

	/**
	 * Create or update all tables.
	 */
	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();

		$agencies    = Db::table( 'agencies' );
		$domains     = Db::table( 'agency_domains' );
		$forms       = Db::table( 'forms' );
		$submissions = Db::table( 'submissions' );
		$batches     = Db::table( 'import_batches' );
		$log         = Db::table( 'sync_log' );

		dbDelta(
			"CREATE TABLE {$agencies} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				name varchar(190) NOT NULL,
				status varchar(20) NOT NULL DEFAULT 'active',
				crm_account_id varchar(64) DEFAULT NULL,
				notes text NULL,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY status (status)
			) {$charset};

			CREATE TABLE {$domains} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				agency_id bigint(20) unsigned NOT NULL,
				domain varchar(190) NOT NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY domain (domain),
				KEY agency_id (agency_id)
			) {$charset};

			CREATE TABLE {$forms} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				title varchar(190) NOT NULL,
				status varchar(20) NOT NULL DEFAULT 'active',
				schema_json longtext NOT NULL,
				version int(10) unsigned NOT NULL DEFAULT 1,
				is_default tinyint(1) NOT NULL DEFAULT 0,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY is_default (is_default)
			) {$charset};

			CREATE TABLE {$submissions} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				form_id bigint(20) unsigned NOT NULL,
				form_version int(10) unsigned NOT NULL DEFAULT 1,
				rep_id bigint(20) unsigned NOT NULL,
				agency_id bigint(20) unsigned DEFAULT NULL,
				batch_id bigint(20) unsigned DEFAULT NULL,
				source varchar(20) NOT NULL DEFAULT 'form',
				data longtext NOT NULL,
				sync_status varchar(20) NOT NULL DEFAULT 'queued',
				email varchar(190) DEFAULT NULL,
				duplicate_of bigint(20) unsigned DEFAULT NULL,
				reviewed_at datetime DEFAULT NULL,
				crm_lead_id varchar(64) DEFAULT NULL,
				attempts smallint(5) unsigned NOT NULL DEFAULT 0,
				last_error text NULL,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				synced_at datetime DEFAULT NULL,
				PRIMARY KEY  (id),
				KEY rep_id (rep_id),
				KEY agency_id (agency_id),
				KEY batch_id (batch_id),
				KEY sync_status (sync_status),
				KEY email (email),
				KEY created_at (created_at)
			) {$charset};

			CREATE TABLE {$batches} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				rep_id bigint(20) unsigned NOT NULL,
				form_id bigint(20) unsigned NOT NULL,
				filename varchar(190) NOT NULL DEFAULT '',
				total int(10) unsigned NOT NULL DEFAULT 0,
				created_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY rep_id (rep_id)
			) {$charset};

			CREATE TABLE {$log} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				submission_id bigint(20) unsigned NOT NULL,
				attempt smallint(5) unsigned NOT NULL DEFAULT 1,
				action varchar(40) NOT NULL DEFAULT 'create_lead',
				http_status smallint(5) unsigned DEFAULT NULL,
				message text NULL,
				request_body longtext NULL,
				response_body longtext NULL,
				created_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY submission_id (submission_id)
			) {$charset};"
		);

		update_option( self::OPTION, self::DB_VERSION, false );
	}

	/**
	 * Drop all plugin tables (used on uninstall).
	 */
	public static function drop() {
		global $wpdb;
		foreach ( array( 'agencies', 'agency_domains', 'forms', 'submissions', 'import_batches', 'sync_log' ) as $name ) {
			$table = Db::table( $name );
			$wpdb->query( "DROP TABLE IF EXISTS {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
		delete_option( self::OPTION );
	}
}
