<?php
/**
 * Settings endpoints.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Crm\CrmException;
use ContactSync\Crm\DynamicsClient;
use ContactSync\Crm\SyncJob;
use ContactSync\Support\Mailer;
use ContactSync\Support\Settings;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Read/update settings, test the Dynamics connection and email delivery.
 */
class SettingsController extends Controller {

	/**
	 * Register routes.
	 */
	public function routes() {
		$perm = array( $this, 'can_manage' );
		$this->route(
			'/settings',
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
			)
		);
		$this->route(
			'/settings/test-connection',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'test_connection' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/settings/test-email',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'test_email' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/settings/sync-queued',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'sync_queued' ),
				'permission_callback' => $perm,
			)
		);
	}

	/**
	 * GET /settings
	 *
	 * @return mixed
	 */
	public function show() {
		return $this->respond( Settings::for_admin() );
	}

	/**
	 * PUT /settings
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function update( WP_REST_Request $request ) {
		$was_ready = SyncJob::active();
		Settings::update( (array) $request->get_json_params() );
		if ( ! $was_ready && SyncJob::active() ) {
			( new SyncJob() )->release_waiting();
		}
		return $this->respond( Settings::for_admin() );
	}

	/**
	 * POST /settings/test-connection
	 *
	 * @return mixed
	 */
	public function test_connection() {
		if ( ! Settings::dynamics_configured() ) {
			return new WP_Error( 'cs_not_configured', __( 'Fill in the organization URL, tenant ID, client ID and client secret first.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		try {
			delete_transient( 'contact_sync_token' );
			$who = ( new DynamicsClient() )->who_am_i();
			return $this->respond(
				array(
					'ok'              => true,
					'user_id'         => $who['UserId'] ?? '',
					'organization_id' => $who['OrganizationId'] ?? '',
					'message'         => __( 'Connected to Dynamics 365 successfully.', 'contact-sync' ),
				)
			);
		} catch ( CrmException $e ) {
			return new WP_Error( 'cs_connection_failed', $e->getMessage(), array( 'status' => 400 ) );
		}
	}

	/**
	 * POST /settings/test-email
	 *
	 * @return mixed
	 */
	public function test_email() {
		$user = wp_get_current_user();
		$sent = Mailer::send(
			$user->user_email,
			'verify',
			array(
				'first_name' => $user->first_name ? $user->first_name : $user->display_name,
				'link'       => \ContactSync\Portal\Router::url( 'login' ),
			)
		);
		if ( ! $sent ) {
			return new WP_Error( 'cs_mail_failed', __( 'WordPress could not send the email. Configure an SMTP plugin or check your server mail settings.', 'contact-sync' ), array( 'status' => 500 ) );
		}
		/* translators: %s: email address */
		return $this->respond( array( 'message' => sprintf( __( 'Test email sent to %s.', 'contact-sync' ), $user->user_email ) ) );
	}

	/**
	 * POST /settings/sync-queued — queue every submission still waiting.
	 *
	 * @return mixed
	 */
	public function sync_queued() {
		return $this->respond( array( 'queued' => ( new SyncJob() )->release_waiting() ) );
	}
}
