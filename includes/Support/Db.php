<?php
/**
 * Table name helpers.
 *
 * @package ContactSync
 */

namespace ContactSync\Support;

defined( 'ABSPATH' ) || exit;

/**
 * Central place for custom table names.
 */
class Db {

	/**
	 * Return the fully prefixed name of a plugin table.
	 *
	 * @param string $name Short table name, e.g. "agencies".
	 * @return string
	 */
	public static function table( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'cs_' . $name;
	}

	/**
	 * Current UTC time in MySQL format.
	 *
	 * @return string
	 */
	public static function now() {
		return current_time( 'mysql', true );
	}

	/**
	 * Convert a stored UTC datetime to ISO 8601 for API responses.
	 *
	 * @param string|null $value MySQL datetime (UTC).
	 * @return string|null
	 */
	public static function iso( $value ) {
		if ( empty( $value ) || '0000-00-00 00:00:00' === $value ) {
			return null;
		}
		return gmdate( 'c', strtotime( $value . ' UTC' ) );
	}
}
