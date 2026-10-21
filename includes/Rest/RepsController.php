<?php
/**
 * Rep management endpoints.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Reps\RepService;
use ContactSync\Roles;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Admin listing, invitations and updates for reps.
 */
class RepsController extends Controller {

	/**
	 * Register routes.
	 */
	public function routes() {
		$perm = array( $this, 'can_manage' );
		$this->route(
			'/reps',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'index' ),
					'permission_callback' => $perm,
					'args'                => $this->pagination_args(),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'invite' ),
					'permission_callback' => $perm,
				),
			)
		);
		$this->route(
			'/reps/(?P<id>\d+)',
			array(
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
		$this->route(
			'/reps/(?P<id>\d+)/resend',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'resend' ),
				'permission_callback' => $perm,
			)
		);
	}

	/**
	 * GET /reps
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function index( WP_REST_Request $request ) {
		$result = ( new RepService() )->query(
			array(
				'search'   => (string) $request['search'],
				'agency'   => (string) $request['agency'],
				'status'   => (string) $request['status'],
				'role'     => (string) $request['role'],
				'page'     => $request['page'],
				'per_page' => $request['per_page'],
			)
		);
		return $this->paginated( $result, (int) $request['per_page'] );
	}

	/**
	 * POST /reps — invite.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function invite( WP_REST_Request $request ) {
		return $this->respond( ( new RepService() )->invite( (array) $request->get_json_params() ), 201 );
	}

	/**
	 * PUT /reps/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function update( WP_REST_Request $request ) {
		return $this->respond( ( new RepService() )->update( (int) $request['id'], (array) $request->get_json_params() ) );
	}

	/**
	 * POST /reps/{id}/resend — verification for pending users, invitation otherwise.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function resend( WP_REST_Request $request ) {
		$id      = (int) $request['id'];
		$service = new RepService();
		$user    = get_userdata( $id );
		if ( ! $user || ! array_intersect( Roles::portal_roles(), (array) $user->roles ) ) {
			return new WP_Error( 'cs_not_found', __( 'Rep not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		$sent = RepService::STATUS_PENDING === RepService::status( $id ) ? $service->send_verification( $id ) : $service->send_invite( $id );
		if ( ! $sent ) {
			return new WP_Error( 'cs_mail_failed', __( 'The email could not be sent. Check your site email configuration.', 'contact-sync' ), array( 'status' => 500 ) );
		}
		return $this->respond( array( 'sent' => true ) );
	}

	/**
	 * DELETE /reps/{id}. Submissions are kept for reporting.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function destroy( WP_REST_Request $request ) {
		$user = get_userdata( (int) $request['id'] );
		if ( ! $user || ! array_intersect( Roles::portal_roles(), (array) $user->roles ) || user_can( $user, Roles::CAP_MANAGE ) ) {
			return new WP_Error( 'cs_not_found', __( 'Rep not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $user->ID );
		return $this->respond( array( 'deleted' => true ) );
	}
}
