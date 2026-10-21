<?php
/**
 * Simple fixed-window rate limiting.
 *
 * @package ContactSync
 */

namespace ContactSync\Auth;

defined( 'ABSPATH' ) || exit;

/**
 * Counts attempts per bucket in transients.
 */
class RateLimiter {

	/**
	 * Whether the bucket is over its limit.
	 *
	 * @param string $bucket Bucket name.
	 * @param int    $limit  Allowed attempts per window.
	 * @return bool
	 */
	public static function too_many( $bucket, $limit ) {
		return (int) get_transient( self::key( $bucket ) ) >= $limit;
	}

	/**
	 * Record an attempt.
	 *
	 * @param string $bucket Bucket name.
	 * @param int    $window Window in seconds.
	 */
	public static function hit( $bucket, $window ) {
		$key   = self::key( $bucket );
		$count = (int) get_transient( $key );
		set_transient( $key, $count + 1, $window );
	}

	/**
	 * Clear a bucket.
	 *
	 * @param string $bucket Bucket name.
	 */
	public static function clear( $bucket ) {
		delete_transient( self::key( $bucket ) );
	}

	/**
	 * Client IP (REMOTE_ADDR only; proxies can be trusted via the filter).
	 *
	 * @return string
	 */
	public static function ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0.0.0.0';
		return (string) apply_filters( 'contact_sync_client_ip', $ip );
	}

	/**
	 * Transient key.
	 *
	 * @param string $bucket Bucket.
	 * @return string
	 */
	private static function key( $bucket ) {
		return 'cs_rl_' . md5( $bucket );
	}
}
