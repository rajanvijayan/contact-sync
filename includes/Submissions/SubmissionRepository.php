<?php
/**
 * Submission persistence.
 *
 * @package ContactSync
 */

namespace ContactSync\Submissions;

use ContactSync\Support\Db;

defined( 'ABSPATH' ) || exit;

/**
 * Stores lead submissions, their sync state and the sync log.
 */
class SubmissionRepository {

	const STATUSES = array( 'queued', 'syncing', 'synced', 'failed', 'duplicate' );

	/**
	 * Insert a submission.
	 *
	 * @param array $data form_id, form_version, rep_id, agency_id, batch_id, source, data.
	 * @return int
	 */
	public function insert( array $data ) {
		global $wpdb;
		$now = Db::now();
		$wpdb->insert(
			Db::table( 'submissions' ),
			array(
				'form_id'      => (int) $data['form_id'],
				'form_version' => (int) $data['form_version'],
				'rep_id'       => (int) $data['rep_id'],
				'agency_id'    => $data['agency_id'] ? (int) $data['agency_id'] : null,
				'batch_id'     => ! empty( $data['batch_id'] ) ? (int) $data['batch_id'] : null,
				'source'       => $data['source'] ?? 'form',
				'data'         => wp_json_encode( $data['data'] ),
				'sync_status'  => 'queued',
				'created_at'   => $now,
				'updated_at'   => $now,
			)
		);
		return (int) $wpdb->insert_id;
	}

	/**
	 * Raw row (data decoded).
	 *
	 * @param int $id Submission ID.
	 * @return array|null
	 */
	public function row( $id ) {
		global $wpdb;
		$table = Db::table( 'submissions' );
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( ! $row ) {
			return null;
		}
		$row['data'] = json_decode( $row['data'], true );
		return $row;
	}

	/**
	 * Formatted submission with related names.
	 *
	 * @param int $id Submission ID.
	 * @return array|null
	 */
	public function find( $id ) {
		$result = $this->query(
			array(
				'id'       => (int) $id,
				'per_page' => 1,
			)
		);
		return $result['items'][0] ?? null;
	}

	/**
	 * Update columns.
	 *
	 * @param int   $id     Submission ID.
	 * @param array $fields Columns.
	 */
	public function update( $id, array $fields ) {
		global $wpdb;
		$fields['updated_at'] = Db::now();
		$wpdb->update( Db::table( 'submissions' ), $fields, array( 'id' => (int) $id ) );
	}

	/**
	 * Delete a submission and its log.
	 *
	 * @param int $id Submission ID.
	 * @return bool
	 */
	public function delete( $id ) {
		global $wpdb;
		$wpdb->delete( Db::table( 'sync_log' ), array( 'submission_id' => (int) $id ) );
		return (bool) $wpdb->delete( Db::table( 'submissions' ), array( 'id' => (int) $id ) );
	}

	/**
	 * Filtered, paginated list.
	 *
	 * @param array $args id, ids, rep_id, agency_id, status, search, batch_id, form_id, source, date_from, date_to, page, per_page, order.
	 * @return array{items: array, total: int}
	 */
	public function query( array $args ) {
		global $wpdb;
		list( $where, $params ) = $this->where( $args );

		$subs     = Db::table( 'submissions' );
		$agencies = Db::table( 'agencies' );
		$forms    = Db::table( 'forms' );
		$per_page = max( 1, min( 500, (int) ( $args['per_page'] ?? 20 ) ) );
		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$offset   = ( $page - 1 ) * $per_page;
		$order    = ( isset( $args['order'] ) && 'asc' === strtolower( $args['order'] ) ) ? 'ASC' : 'DESC';

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
		$count_sql = "SELECT COUNT(*) FROM {$subs} s WHERE {$where}";
		$total     = (int) ( $params ? $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) ) : $wpdb->get_var( $count_sql ) );

		$sql  = "SELECT s.*, a.name AS agency_name, f.title AS form_title FROM {$subs} s
			LEFT JOIN {$agencies} a ON a.id = s.agency_id
			LEFT JOIN {$forms} f ON f.id = s.form_id
			WHERE {$where} ORDER BY s.created_at {$order}, s.id {$order} LIMIT %d OFFSET %d";
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, array_merge( $params, array( $per_page, $offset ) ) ), ARRAY_A );
		// phpcs:enable

		if ( $rows ) {
			cache_users( array_unique( array_map( 'intval', wp_list_pluck( $rows, 'rep_id' ) ) ) );
		}

		return array(
			'items' => array_map( array( $this, 'format' ), $rows ),
			'total' => $total,
		);
	}

	/**
	 * IDs matching filters (for bulk actions and export).
	 *
	 * @param array $args Filters as in query().
	 * @param int   $limit Max IDs.
	 * @return int[]
	 */
	public function ids( array $args, $limit = 5000 ) {
		global $wpdb;
		list( $where, $params ) = $this->where( $args );
		$subs                   = Db::table( 'submissions' );
		$params[]               = (int) $limit;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
		return array_map( 'intval', $wpdb->get_col( $wpdb->prepare( "SELECT s.id FROM {$subs} s WHERE {$where} ORDER BY s.id DESC LIMIT %d", $params ) ) );
	}

	/**
	 * Aggregate counts for dashboards.
	 *
	 * @param array $scope Optional rep_id / agency_id.
	 * @param int   $days  Length of the daily series.
	 * @return array
	 */
	public function stats( array $scope = array(), $days = 14 ) {
		global $wpdb;
		list( $where, $params ) = $this->where( $scope );
		$subs                   = Db::table( 'submissions' );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared
		$status_sql = "SELECT sync_status, COUNT(*) AS total FROM {$subs} s WHERE {$where} GROUP BY sync_status";
		$by_status  = wp_list_pluck( $params ? $wpdb->get_results( $wpdb->prepare( $status_sql, $params ), ARRAY_A ) : $wpdb->get_results( $status_sql, ARRAY_A ), 'total', 'sync_status' );

		$since      = gmdate( 'Y-m-d 00:00:00', time() - ( $days - 1 ) * DAY_IN_SECONDS );
		$series_sql = "SELECT DATE(s.created_at) AS day, COUNT(*) AS total, SUM(s.sync_status = 'synced') AS synced FROM {$subs} s WHERE {$where} AND s.created_at >= %s GROUP BY DATE(s.created_at)";
		$series_raw = $wpdb->get_results( $wpdb->prepare( $series_sql, array_merge( $params, array( $since ) ) ), ARRAY_A );
		// phpcs:enable

		$indexed = array();
		foreach ( $series_raw as $row ) {
			$indexed[ $row['day'] ] = $row;
		}
		$series = array();
		for ( $i = $days - 1; $i >= 0; $i-- ) {
			$day      = gmdate( 'Y-m-d', time() - $i * DAY_IN_SECONDS );
			$series[] = array(
				'date'   => $day,
				'total'  => isset( $indexed[ $day ] ) ? (int) $indexed[ $day ]['total'] : 0,
				'synced' => isset( $indexed[ $day ] ) ? (int) $indexed[ $day ]['synced'] : 0,
			);
		}

		$counts = array();
		foreach ( self::STATUSES as $status ) {
			$counts[ $status ] = (int) ( $by_status[ $status ] ?? 0 );
		}
		$total    = array_sum( $counts );
		$finished = $counts['synced'] + $counts['failed'] + $counts['duplicate'];
		$today    = gmdate( 'Y-m-d' );
		$week     = array_sum( array_slice( wp_list_pluck( $series, 'total' ), -7 ) );

		return array(
			'total'        => $total,
			'by_status'    => $counts,
			'today'        => end( $series )['date'] === $today ? end( $series )['total'] : 0,
			'week'         => $week,
			'success_rate' => $finished ? round( ( $counts['synced'] + $counts['duplicate'] ) / $finished * 100, 1 ) : null,
			'series'       => $series,
		);
	}

	/**
	 * Status counts for an import batch.
	 *
	 * @param int $batch_id Batch ID.
	 * @return array
	 */
	public function batch_counts( $batch_id ) {
		$stats = $this->stats( array( 'batch_id' => (int) $batch_id ), 1 );
		return $stats['by_status'];
	}

	/**
	 * Append a sync log entry.
	 *
	 * @param array $entry submission_id, attempt, action, http_status, message, request_body, response_body.
	 */
	public function log( array $entry ) {
		global $wpdb;
		$wpdb->insert(
			Db::table( 'sync_log' ),
			array(
				'submission_id' => (int) $entry['submission_id'],
				'attempt'       => (int) ( $entry['attempt'] ?? 1 ),
				'action'        => substr( (string) ( $entry['action'] ?? 'create_lead' ), 0, 40 ),
				'http_status'   => isset( $entry['http_status'] ) ? (int) $entry['http_status'] : null,
				'message'       => (string) ( $entry['message'] ?? '' ),
				'request_body'  => isset( $entry['request_body'] ) ? substr( (string) $entry['request_body'], 0, 20000 ) : null,
				'response_body' => isset( $entry['response_body'] ) ? substr( (string) $entry['response_body'], 0, 20000 ) : null,
				'created_at'    => Db::now(),
			)
		);
	}

	/**
	 * Sync log for a submission, newest first.
	 *
	 * @param int $submission_id Submission ID.
	 * @return array[]
	 */
	public function logs( $submission_id ) {
		global $wpdb;
		$table = Db::table( 'sync_log' );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE submission_id = %d ORDER BY id DESC LIMIT 50", $submission_id ), ARRAY_A );
		return array_map(
			function ( $row ) {
				return array(
					'id'            => (int) $row['id'],
					'attempt'       => (int) $row['attempt'],
					'action'        => $row['action'],
					'http_status'   => null === $row['http_status'] ? null : (int) $row['http_status'],
					'message'       => $row['message'],
					'request_body'  => $row['request_body'],
					'response_body' => $row['response_body'],
					'created_at'    => Db::iso( $row['created_at'] ),
				);
			},
			$rows
		);
	}

	/**
	 * Build WHERE clause and params.
	 *
	 * @param array $args Filters.
	 * @return array{0: string, 1: array}
	 */
	private function where( array $args ) {
		global $wpdb;
		$where  = array( '1=1' );
		$params = array();

		if ( ! empty( $args['id'] ) ) {
			$where[]  = 's.id = %d';
			$params[] = (int) $args['id'];
		}
		if ( ! empty( $args['ids'] ) && is_array( $args['ids'] ) ) {
			$ids     = array_map( 'intval', $args['ids'] );
			$where[] = 's.id IN (' . implode( ',', array_fill( 0, count( $ids ), '%d' ) ) . ')';
			$params  = array_merge( $params, $ids );
		}
		if ( ! empty( $args['rep_id'] ) ) {
			$where[]  = 's.rep_id = %d';
			$params[] = (int) $args['rep_id'];
		}
		if ( isset( $args['agency_id'] ) && '' !== $args['agency_id'] && null !== $args['agency_id'] ) {
			if ( 'independent' === $args['agency_id'] ) {
				$where[] = 's.agency_id IS NULL';
			} else {
				$where[]  = 's.agency_id = %d';
				$params[] = (int) $args['agency_id'];
			}
		}
		if ( ! empty( $args['status'] ) && in_array( $args['status'], self::STATUSES, true ) ) {
			$where[]  = 's.sync_status = %s';
			$params[] = $args['status'];
		}
		if ( ! empty( $args['batch_id'] ) ) {
			$where[]  = 's.batch_id = %d';
			$params[] = (int) $args['batch_id'];
		}
		if ( ! empty( $args['form_id'] ) ) {
			$where[]  = 's.form_id = %d';
			$params[] = (int) $args['form_id'];
		}
		if ( ! empty( $args['source'] ) && in_array( $args['source'], array( 'form', 'import' ), true ) ) {
			$where[]  = 's.source = %s';
			$params[] = $args['source'];
		}
		if ( ! empty( $args['date_from'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $args['date_from'] ) ) {
			$where[]  = 's.created_at >= %s';
			$params[] = $args['date_from'] . ' 00:00:00';
		}
		if ( ! empty( $args['date_to'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $args['date_to'] ) ) {
			$where[]  = 's.created_at <= %s';
			$params[] = $args['date_to'] . ' 23:59:59';
		}
		if ( ! empty( $args['search'] ) ) {
			$where[]  = '(s.data LIKE %s OR s.crm_lead_id = %s)';
			$params[] = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$params[] = $args['search'];
		}

		return array( implode( ' AND ', $where ), $params );
	}

	/**
	 * Shape a row for API output.
	 *
	 * @param array $row Row.
	 * @return array
	 */
	private function format( array $row ) {
		$data = json_decode( $row['data'], true );
		$user = get_userdata( (int) $row['rep_id'] );

		return array(
			'id'          => (int) $row['id'],
			'form'        => array(
				'id'      => (int) $row['form_id'],
				'title'   => $row['form_title'] ?? '',
				'version' => (int) $row['form_version'],
			),
			'rep'         => array(
				'id'    => (int) $row['rep_id'],
				'name'  => $user ? $user->display_name : __( 'Deleted user', 'contact-sync' ),
				'email' => $user ? $user->user_email : '',
			),
			'agency'      => $row['agency_id'] ? array(
				'id'   => (int) $row['agency_id'],
				'name' => $row['agency_name'] ?? '',
			) : null,
			'batch_id'    => $row['batch_id'] ? (int) $row['batch_id'] : null,
			'source'      => $row['source'],
			'values'      => $data['values'] ?? array(),
			'labels'      => $data['labels'] ?? array(),
			'display'     => $data['display'] ?? array(),
			'summary'     => $data['summary'] ?? array(),
			'status'      => $row['sync_status'],
			'crm_lead_id' => $row['crm_lead_id'],
			'attempts'    => (int) $row['attempts'],
			'last_error'  => $row['last_error'],
			'created_at'  => Db::iso( $row['created_at'] ),
			'synced_at'   => Db::iso( $row['synced_at'] ),
		);
	}
}
