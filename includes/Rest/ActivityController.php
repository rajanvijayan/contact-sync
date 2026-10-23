<?php
/**
 * Activity log endpoint.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Support\ActivityLog;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Read-only access to the admin activity log.
 */
class ActivityController extends Controller {

	/**
	 * Register routes.
	 */
	public function routes() {
		$this->route(
			'/activity',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'index' ),
				'permission_callback' => array( $this, 'can_manage' ),
				'args'                => $this->pagination_args(),
			)
		);
	}

	/**
	 * GET /activity
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function index( WP_REST_Request $request ) {
		$result = ( new ActivityLog() )->query(
			array(
				'action'      => (string) $request['action'],
				'object_type' => (string) $request['object_type'],
				'object_id'   => (int) $request['object_id'],
				'search'      => (string) $request['search'],
				'date_from'   => (string) $request['date_from'],
				'date_to'     => (string) $request['date_to'],
				'page'        => $request['page'],
				'per_page'    => $request['per_page'],
			)
		);
		return $this->paginated( $result, (int) $request['per_page'] );
	}
}
