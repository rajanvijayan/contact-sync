<?php
/**
 * Submission management endpoints.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Crm\SyncJob;
use ContactSync\Submissions\DuplicateReview;
use ContactSync\Submissions\SubmissionRepository;
use ContactSync\Support\ActivityLog;
use ContactSync\Support\Settings;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Admin listing, detail, retry, export and stats.
 */
class SubmissionsController extends Controller {

	/**
	 * Register routes.
	 */
	public function routes() {
		$perm = array( $this, 'can_manage' );
		$this->route(
			'/submissions',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'index' ),
				'permission_callback' => $perm,
				'args'                => $this->pagination_args(),
			)
		);
		$this->route(
			'/submissions/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'show' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'destroy' ),
					'permission_callback' => $perm,
				),
			)
		);
		$this->route(
			'/submissions/retry',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'retry' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/submissions/restore',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'restore' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/submissions/empty-trash',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'empty_trash' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/submissions/review',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'review' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/submissions/export',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'export' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/stats',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'stats' ),
				'permission_callback' => $perm,
			)
		);
	}

	/**
	 * Filters from a request.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array
	 */
	private function filters( WP_REST_Request $request ) {
		return array(
			'status'    => (string) $request['status'],
			'search'    => (string) $request['search'],
			'agency_id' => (string) $request['agency_id'],
			'rep_id'    => (int) $request['rep_id'],
			'form_id'   => (int) $request['form_id'],
			'batch_id'  => (int) $request['batch_id'],
			'source'    => (string) $request['source'],
			'date_from' => (string) $request['date_from'],
			'date_to'   => (string) $request['date_to'],
			'trashed'   => rest_sanitize_boolean( $request['trashed'] ) ? 'only' : '',
		);
	}

	/**
	 * GET /submissions
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function index( WP_REST_Request $request ) {
		$args     = array_merge(
			$this->filters( $request ),
			array(
				'page'     => $request['page'],
				'per_page' => $request['per_page'],
			)
		);
		$repo     = new SubmissionRepository();
		$response = $this->paginated( $repo->query( $args ), (int) $request['per_page'] );
		$data     = $response->get_data();

		$data['soft_delete'] = (bool) Settings::get( 'data.soft_delete', false );
		$data['trash_days']  = (int) Settings::get( 'data.trash_days', 30 );
		$data['trashed']     = $repo->query(
			array(
				'trashed'  => 'only',
				'per_page' => 1,
			)
		)['total'];
		$response->set_data( $data );
		return $response;
	}

	/**
	 * GET /submissions/{id} (with sync log).
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function show( WP_REST_Request $request ) {
		$repo = new SubmissionRepository();
		$item = $repo->find( (int) $request['id'], true );
		if ( ! $item ) {
			return new WP_Error( 'cs_not_found', __( 'Submission not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		$item['logs'] = $repo->logs( $item['id'] );
		return $this->respond( $item );
	}

	/**
	 * DELETE /submissions/{id} — moves to the trash when soft delete is on,
	 * otherwise (or for a trashed lead, or with force=1) deletes permanently.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function destroy( WP_REST_Request $request ) {
		$repo = new SubmissionRepository();
		$item = $repo->find( (int) $request['id'], true );
		if ( ! $item ) {
			return new WP_Error( 'cs_not_found', __( 'Submission not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		$name = self::lead_label( $item );

		if ( Settings::get( 'data.soft_delete', false ) && ! $item['deleted_at'] && ! rest_sanitize_boolean( $request['force'] ) ) {
			$repo->trash( $item['id'], get_current_user_id() );
			/* translators: %s: lead name and ID */
			ActivityLog::record( 'submission_trashed', 'submission', $item['id'], sprintf( __( 'Moved lead %s to the trash.', 'contact-sync' ), $name ) );
			return $this->respond( array( 'trashed' => true ) );
		}

		$repo->delete( $item['id'] );
		ActivityLog::record(
			'submission_deleted',
			'submission',
			$item['id'],
			/* translators: %s: lead name and ID */
			sprintf( __( 'Permanently deleted lead %s.', 'contact-sync' ), $name ),
			array(
				'email'       => $item['summary']['email'] ?? '',
				'status'      => $item['status'],
				'crm_lead_id' => $item['crm_lead_id'],
				'rep'         => $item['rep']['name'],
			)
		);
		return $this->respond( array( 'deleted' => true ) );
	}

	/**
	 * POST /submissions/restore — { ids: [] } out of the trash.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function restore( WP_REST_Request $request ) {
		$repo  = new SubmissionRepository();
		$count = 0;
		foreach ( array_unique( array_map( 'intval', $this->array_param( $request, 'ids' ) ) ) as $id ) {
			if ( ! $repo->restore( $id ) ) {
				continue;
			}
			$item = $repo->find( $id );
			// A queued lead's sync job ran (and skipped it) while it was in the trash.
			if ( $item && 'queued' === $item['status'] ) {
				SyncJob::queue( $id );
			}
			/* translators: %s: lead name and ID */
			ActivityLog::record( 'submission_restored', 'submission', $id, sprintf( __( 'Restored lead %s from the trash.', 'contact-sync' ), $item ? self::lead_label( $item ) : '#' . $id ) );
			++$count;
		}
		return $this->respond( array( 'restored' => $count ) );
	}

	/**
	 * POST /submissions/empty-trash — permanently delete everything in the trash.
	 *
	 * @return mixed
	 */
	public function empty_trash() {
		$count = ( new SubmissionRepository() )->purge_trash( 0 );
		if ( $count ) {
			/* translators: %d: number of leads */
			ActivityLog::record( 'trash_emptied', 'submission', null, sprintf( _n( 'Emptied the trash (%d lead permanently deleted).', 'Emptied the trash (%d leads permanently deleted).', $count, 'contact-sync' ), $count ), array( 'count' => $count ) );
		}
		return $this->respond( array( 'deleted' => $count ) );
	}

	/**
	 * Name and ID of a lead for log messages.
	 *
	 * @param array $item Formatted submission.
	 * @return string
	 */
	private static function lead_label( array $item ) {
		$name = trim( (string) ( $item['summary']['name'] ?? '' ) );
		if ( '' === $name ) {
			$name = (string) ( $item['summary']['email'] ?? '' );
		}
		return '' === $name ? '#' . $item['id'] : sprintf( '%s (#%d)', $name, $item['id'] );
	}

	/**
	 * POST /submissions/retry — { ids: [] } or { status: "failed" } / { status: "queued" }.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function retry( WP_REST_Request $request ) {
		$ids = array_map( 'intval', $this->array_param( $request, 'ids' ) );
		if ( ! $ids && in_array( $request['status'], array( 'failed', 'queued', 'syncing' ), true ) ) {
			$ids = ( new SubmissionRepository() )->ids( array( 'status' => $request['status'] ) );
		}
		if ( ! $ids ) {
			return new WP_Error( 'cs_invalid', __( 'Nothing to retry.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		$queued = ( new SyncJob() )->retry( $ids );
		if ( $queued ) {
			/* translators: %d: number of leads */
			ActivityLog::record( 'sync_retried', 'submission', 1 === count( $ids ) ? $ids[0] : null, sprintf( _n( 'Re-queued %d lead for sync.', 'Re-queued %d leads for sync.', $queued, 'contact-sync' ), $queued ), array( 'ids' => array_slice( $ids, 0, 100 ) ) );
		}
		return $this->respond( array( 'queued' => $queued ) );
	}

	/**
	 * POST /submissions/review — { ids: [], decision: "approve"|"reject" } for held duplicates.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function review( WP_REST_Request $request ) {
		$ids      = array_map( 'intval', $this->array_param( $request, 'ids' ) );
		$decision = (string) $request['decision'];
		if ( ! $ids || ! in_array( $decision, array( 'approve', 'reject' ), true ) ) {
			return new WP_Error( 'cs_invalid', __( 'Choose leads and whether to approve or reject them.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		$review = new DuplicateReview();
		$count  = 'approve' === $decision ? $review->approve( $ids ) : $review->reject( $ids );
		if ( $count ) {
			ActivityLog::record(
				'approve' === $decision ? 'duplicate_approved' : 'duplicate_rejected',
				'submission',
				1 === count( $ids ) ? $ids[0] : null,
				'approve' === $decision
					/* translators: %d: number of leads */
					? sprintf( _n( 'Approved %d held duplicate for delivery.', 'Approved %d held duplicates for delivery.', $count, 'contact-sync' ), $count )
					/* translators: %d: number of leads */
					: sprintf( _n( 'Rejected %d held duplicate.', 'Rejected %d held duplicates.', $count, 'contact-sync' ), $count ),
				array( 'ids' => array_slice( $ids, 0, 100 ) )
			);
		}
		return $this->respond( array( 'updated' => $count ) );
	}

	/**
	 * GET /submissions/export — CSV of the filtered list.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function export( WP_REST_Request $request ) {
		$repo  = new SubmissionRepository();
		$items = $repo->query(
			array_merge(
				$this->filters( $request ),
				array( 'per_page' => 500 )
			)
		);
		$all   = $items['items'];
		$pages = min( 20, (int) ceil( $items['total'] / 500 ) );
		for ( $page = 2; $page <= $pages; $page++ ) {
			$all = array_merge(
				$all,
				$repo->query(
					array_merge(
						$this->filters( $request ),
						array(
							'per_page' => 500,
							'page'     => $page,
						)
					)
				)['items']
			);
		}

		$field_keys = array();
		$labels     = array();
		foreach ( $all as $item ) {
			foreach ( $item['labels'] as $key => $label ) {
				if ( ! isset( $labels[ $key ] ) ) {
					$labels[ $key ] = $label;
					$field_keys[]   = $key;
				}
			}
		}

		$headers = array_merge(
			array( 'ID', 'Submitted (UTC)', 'Rep', 'Rep email', 'Agency', 'Source', 'Status', 'Dynamics lead ID', 'Last error' ),
			array_values( $labels )
		);
		$rows    = array();
		foreach ( $all as $item ) {
			$row = array(
				$item['id'],
				$item['created_at'],
				$item['rep']['name'],
				$item['rep']['email'],
				$item['agency'] ? $item['agency']['name'] : 'Independent',
				$item['source'],
				$item['status'],
				$item['crm_lead_id'],
				$item['last_error'],
			);
			foreach ( $field_keys as $key ) {
				$row[] = $item['display'][ $key ] ?? ( $item['values'][ $key ] ?? '' );
			}
			$rows[] = $row;
		}

		return $this->respond(
			array(
				'filename' => 'leads-' . gmdate( 'Y-m-d' ) . '.csv',
				'content'  => self::to_csv( $headers, $rows ),
				'count'    => count( $rows ),
			)
		);
	}

	/**
	 * GET /stats — dashboard data.
	 *
	 * @return mixed
	 */
	public function stats() {
		global $wpdb;
		$repo  = new SubmissionRepository();
		$stats = $repo->stats( array(), 30 );

		$subs     = \ContactSync\Support\Db::table( 'submissions' );
		$agencies = \ContactSync\Support\Db::table( 'agencies' );
		$since    = gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS );
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$top          = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT COALESCE(a.name, %s) AS name, COUNT(*) AS total FROM {$subs} s LEFT JOIN {$agencies} a ON a.id = s.agency_id WHERE s.created_at >= %s AND s.deleted_at IS NULL GROUP BY s.agency_id ORDER BY total DESC LIMIT 5",
				__( 'Independent', 'contact-sync' ),
				$since
			),
			ARRAY_A
		);
		$top_reps_raw = $wpdb->get_results(
			$wpdb->prepare( "SELECT rep_id, COUNT(*) AS total FROM {$subs} WHERE created_at >= %s AND deleted_at IS NULL GROUP BY rep_id ORDER BY total DESC LIMIT 5", $since ),
			ARRAY_A
		);
		// phpcs:enable
		$top_reps = array_map(
			function ( $row ) {
				$user = get_userdata( (int) $row['rep_id'] );
				return array(
					'name'  => $user ? $user->display_name : __( 'Deleted user', 'contact-sync' ),
					'total' => (int) $row['total'],
				);
			},
			$top_reps_raw
		);

		$stats['top_agencies'] = array_map(
			function ( $row ) {
				return array(
					'name'  => $row['name'],
					'total' => (int) $row['total'],
				);
			},
			$top
		);
		$stats['top_reps']     = $top_reps;
		$stats['recent']       = $repo->query( array( 'per_page' => 8 ) )['items'];
		$stats['failures']     = $repo->query(
			array(
				'status'   => 'failed',
				'per_page' => 5,
			)
		)['items'];
		$stats['configured']   = \ContactSync\Support\Settings::dynamics_configured();
		$stats['sync_enabled'] = (bool) \ContactSync\Support\Settings::get( 'sync.enabled', true );
		$stats['counts']       = array(
			'agencies' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$agencies} WHERE status = 'active'" ), // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			'reps'     => (int) ( new \WP_User_Query(
				array(
					'role__in'    => \ContactSync\Roles::portal_roles(),
					'number'      => 1,
					'count_total' => true,
					'fields'      => 'ID',
				)
			) )->get_total(),
		);

		return $this->respond( $stats );
	}
}
