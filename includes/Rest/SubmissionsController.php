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
		);
	}

	/**
	 * GET /submissions
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function index( WP_REST_Request $request ) {
		$args = array_merge(
			$this->filters( $request ),
			array(
				'page'     => $request['page'],
				'per_page' => $request['per_page'],
			)
		);
		return $this->paginated( ( new SubmissionRepository() )->query( $args ), (int) $request['per_page'] );
	}

	/**
	 * GET /submissions/{id} (with sync log).
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function show( WP_REST_Request $request ) {
		$repo = new SubmissionRepository();
		$item = $repo->find( (int) $request['id'] );
		if ( ! $item ) {
			return new WP_Error( 'cs_not_found', __( 'Submission not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		$item['logs'] = $repo->logs( $item['id'] );
		return $this->respond( $item );
	}

	/**
	 * DELETE /submissions/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function destroy( WP_REST_Request $request ) {
		$deleted = ( new SubmissionRepository() )->delete( (int) $request['id'] );
		return $deleted ? $this->respond( array( 'deleted' => true ) ) : new WP_Error( 'cs_not_found', __( 'Submission not found.', 'contact-sync' ), array( 'status' => 404 ) );
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
		return $this->respond( array( 'queued' => ( new SyncJob() )->retry( $ids ) ) );
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
				"SELECT COALESCE(a.name, %s) AS name, COUNT(*) AS total FROM {$subs} s LEFT JOIN {$agencies} a ON a.id = s.agency_id WHERE s.created_at >= %s GROUP BY s.agency_id ORDER BY total DESC LIMIT 5",
				__( 'Independent', 'contact-sync' ),
				$since
			),
			ARRAY_A
		);
		$top_reps_raw = $wpdb->get_results(
			$wpdb->prepare( "SELECT rep_id, COUNT(*) AS total FROM {$subs} WHERE created_at >= %s GROUP BY rep_id ORDER BY total DESC LIMIT 5", $since ),
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
