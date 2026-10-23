<?php
/**
 * Admin activity log.
 *
 * @package ContactSync
 */

namespace ContactSync\Support;

defined( 'ABSPATH' ) || exit;

/**
 * Records who did what in the admin, for auditing. Entries older than the
 * retention period are removed by Retention.
 */
class ActivityLog {

	/**
	 * Record an entry for the current user (or the system when nobody is signed in).
	 *
	 * @param string   $action      Machine name, e.g. submission_trashed.
	 * @param string   $object_type submission|form|agency|rep|settings|system.
	 * @param int|null $object_id   Object ID.
	 * @param string   $message     Human readable summary.
	 * @param array    $context     Extra details (never secrets).
	 */
	public static function record( $action, $object_type = '', $object_id = null, $message = '', array $context = array() ) {
		global $wpdb;
		$user = function_exists( 'wp_get_current_user' ) ? wp_get_current_user() : null;
		$wpdb->insert(
			Db::table( 'activity_log' ),
			array(
				'user_id'     => $user && $user->exists() ? (int) $user->ID : null,
				'user_name'   => $user && $user->exists() ? substr( $user->display_name, 0, 190 ) : '',
				'action'      => substr( sanitize_key( $action ), 0, 40 ),
				'object_type' => substr( sanitize_key( $object_type ), 0, 20 ),
				'object_id'   => $object_id ? (int) $object_id : null,
				'message'     => (string) $message,
				'context'     => $context ? wp_json_encode( $context ) : null,
				'created_at'  => Db::now(),
			)
		);
	}

	/**
	 * Filtered, paginated entries, newest first.
	 *
	 * @param array $args action, object_type, object_id, user_id, search, date_from, date_to, page, per_page.
	 * @return array{items: array, total: int}
	 */
	public function query( array $args ) {
		global $wpdb;
		$table  = Db::table( 'activity_log' );
		$where  = array( '1=1' );
		$params = array();

		foreach ( array( 'action', 'object_type' ) as $key ) {
			if ( ! empty( $args[ $key ] ) ) {
				$where[]  = "{$key} = %s";
				$params[] = sanitize_key( $args[ $key ] );
			}
		}
		foreach ( array( 'object_id', 'user_id' ) as $key ) {
			if ( ! empty( $args[ $key ] ) ) {
				$where[]  = "{$key} = %d";
				$params[] = (int) $args[ $key ];
			}
		}
		if ( ! empty( $args['search'] ) ) {
			$like     = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where[]  = '(message LIKE %s OR user_name LIKE %s)';
			$params[] = $like;
			$params[] = $like;
		}
		if ( ! empty( $args['date_from'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $args['date_from'] ) ) {
			$where[]  = 'created_at >= %s';
			$params[] = $args['date_from'] . ' 00:00:00';
		}
		if ( ! empty( $args['date_to'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $args['date_to'] ) ) {
			$where[]  = 'created_at <= %s';
			$params[] = $args['date_to'] . ' 23:59:59';
		}

		$where    = implode( ' AND ', $where );
		$per_page = max( 1, min( 100, (int) ( $args['per_page'] ?? 25 ) ) );
		$offset   = ( max( 1, (int) ( $args['page'] ?? 1 ) ) - 1 ) * $per_page;

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
		$count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where}";
		$total     = (int) ( $params ? $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) ) : $wpdb->get_var( $count_sql ) );
		$rows      = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE {$where} ORDER BY id DESC LIMIT %d OFFSET %d", array_merge( $params, array( $per_page, $offset ) ) ), ARRAY_A );
		// phpcs:enable

		return array(
			'items' => array_map( array( $this, 'format' ), $rows ),
			'total' => $total,
		);
	}

	/**
	 * Delete entries older than the given number of days.
	 *
	 * @param int $days Days to keep.
	 * @return int Rows removed.
	 */
	public static function purge( $days ) {
		global $wpdb;
		$table = Db::table( 'activity_log' );
		return (int) $wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", gmdate( 'Y-m-d H:i:s', time() - (int) $days * DAY_IN_SECONDS ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	/**
	 * Shape a row for API output.
	 *
	 * @param array $row Row.
	 * @return array
	 */
	private function format( array $row ) {
		return array(
			'id'          => (int) $row['id'],
			'user'        => $row['user_id'] ? array(
				'id'   => (int) $row['user_id'],
				'name' => $row['user_name'],
			) : null,
			'action'      => $row['action'],
			'object_type' => $row['object_type'],
			'object_id'   => $row['object_id'] ? (int) $row['object_id'] : null,
			'message'     => $row['message'],
			'context'     => $row['context'] ? json_decode( $row['context'], true ) : null,
			'created_at'  => Db::iso( $row['created_at'] ),
		);
	}
}
