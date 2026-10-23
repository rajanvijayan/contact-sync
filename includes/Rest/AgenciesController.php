<?php
/**
 * Agency endpoints.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Agencies\AgencyRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Admin CRUD for agencies.
 */
class AgenciesController extends Controller {

	/**
	 * Register routes.
	 */
	public function routes() {
		$perm = array( $this, 'can_manage' );
		$this->route(
			'/agencies',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'index' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create' ),
					'permission_callback' => $perm,
				),
			)
		);
		$this->route(
			'/agencies/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'show' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'destroy' ),
					'permission_callback' => $perm,
				),
			)
		);
	}

	/**
	 * GET /agencies
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function index( WP_REST_Request $request ) {
		return $this->respond(
			( new AgencyRepository() )->all(
				array(
					'search' => (string) $request['search'],
					'status' => (string) $request['status'],
				)
			)
		);
	}

	/**
	 * GET /agencies/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function show( WP_REST_Request $request ) {
		$agency = ( new AgencyRepository() )->find( (int) $request['id'] );
		return $agency ? $this->respond( $agency ) : new WP_Error( 'cs_not_found', __( 'Agency not found.', 'contact-sync' ), array( 'status' => 404 ) );
	}

	/**
	 * POST /agencies
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function create( WP_REST_Request $request ) {
		$agency = ( new AgencyRepository() )->create( (array) $request->get_json_params() );
		if ( ! is_wp_error( $agency ) ) {
			/* translators: %s: agency name */
			$this->audit( $agency, 'agency_created', 'agency', $agency['id'], sprintf( __( 'Created agency %s.', 'contact-sync' ), $agency['name'] ) );
		}
		return $this->respond( $agency, 201 );
	}

	/**
	 * PUT /agencies/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function update( WP_REST_Request $request ) {
		$agency = ( new AgencyRepository() )->update( (int) $request['id'], (array) $request->get_json_params() );
		if ( ! is_wp_error( $agency ) ) {
			/* translators: %s: agency name */
			$this->audit( $agency, 'agency_updated', 'agency', $agency['id'], sprintf( __( 'Updated agency %s.', 'contact-sync' ), $agency['name'] ), array( 'fields' => array_keys( (array) $request->get_json_params() ) ) );
		}
		return $this->respond( $agency );
	}

	/**
	 * DELETE /agencies/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function destroy( WP_REST_Request $request ) {
		$repo    = new AgencyRepository();
		$agency  = $repo->find( (int) $request['id'] );
		$deleted = $repo->delete( (int) $request['id'] );
		if ( $deleted && $agency ) {
			/* translators: %s: agency name */
			$this->audit( true, 'agency_deleted', 'agency', $agency['id'], sprintf( __( 'Deleted agency %s.', 'contact-sync' ), $agency['name'] ) );
		}
		return $deleted ? $this->respond( array( 'deleted' => true ) ) : new WP_Error( 'cs_not_found', __( 'Agency not found.', 'contact-sync' ), array( 'status' => 404 ) );
	}
}
