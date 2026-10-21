<?php
/**
 * Public authentication endpoints.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Auth\AuthService;
use ContactSync\Auth\RateLimiter;
use ContactSync\Reps\RepService;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Login, signup, verification and password reset.
 */
class AuthController extends Controller {

	/**
	 * Register routes.
	 */
	public function routes() {
		$public = '__return_true';

		$this->route(
			'/auth/login',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'login' ),
				'permission_callback' => $public,
				'args'                => array(
					'email'       => array(
						'type'     => 'string',
						'required' => true,
					),
					'password'    => array(
						'type'     => 'string',
						'required' => true,
					),
					'remember'    => array(
						'type'    => 'boolean',
						'default' => false,
					),
					'redirect_to' => array(
						'type'    => 'string',
						'default' => '',
					),
				),
			)
		);
		$this->route(
			'/auth/signup',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'signup' ),
				'permission_callback' => $public,
			)
		);
		$this->route(
			'/auth/verify',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'verify' ),
				'permission_callback' => $public,
			)
		);
		$this->route(
			'/auth/resend',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'resend' ),
				'permission_callback' => $public,
			)
		);
		$this->route(
			'/auth/forgot',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'forgot' ),
				'permission_callback' => $public,
			)
		);
		$this->route(
			'/auth/reset',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'check_reset' ),
					'permission_callback' => $public,
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'reset' ),
					'permission_callback' => $public,
				),
			)
		);
		$this->route(
			'/auth/logout',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'logout' ),
				'permission_callback' => 'is_user_logged_in',
			)
		);
	}

	/**
	 * POST /auth/login
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function login( WP_REST_Request $request ) {
		return $this->respond( ( new AuthService() )->login( $request['email'], $request['password'], $request['remember'], $request['redirect_to'] ) );
	}

	/**
	 * POST /auth/signup
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function signup( WP_REST_Request $request ) {
		$bucket = 'signup_' . RateLimiter::ip();
		if ( RateLimiter::too_many( $bucket, 10 ) ) {
			return new \WP_Error( 'cs_rate_limited', __( 'Too many sign up attempts. Please try again later.', 'contact-sync' ), array( 'status' => 429 ) );
		}
		RateLimiter::hit( $bucket, HOUR_IN_SECONDS );

		$result = ( new RepService() )->register(
			array(
				'first_name' => (string) $request['first_name'],
				'last_name'  => (string) $request['last_name'],
				'email'      => (string) $request['email'],
				'password'   => (string) $request['password'],
			)
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $this->respond(
			array(
				'message' => __( 'Account created. We have sent a verification link to your email address.', 'contact-sync' ),
			),
			201
		);
	}

	/**
	 * POST /auth/verify
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function verify( WP_REST_Request $request ) {
		$result = ( new RepService() )->verify( (int) $request['uid'], (string) $request['token'] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $this->respond( array( 'message' => __( 'Your email address has been confirmed. You can now sign in.', 'contact-sync' ) ) );
	}

	/**
	 * POST /auth/resend
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function resend( WP_REST_Request $request ) {
		$result = ( new AuthService() )->resend_verification( (string) $request['email'] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $this->respond( array( 'message' => __( 'If an unverified account exists for this email, a new verification link is on its way.', 'contact-sync' ) ) );
	}

	/**
	 * POST /auth/forgot
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function forgot( WP_REST_Request $request ) {
		$result = ( new AuthService() )->forgot( (string) $request['email'] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $this->respond( array( 'message' => __( 'If an account exists for this email, you will receive a password reset link shortly.', 'contact-sync' ) ) );
	}

	/**
	 * GET /auth/reset — validate a key before showing the form.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function check_reset( WP_REST_Request $request ) {
		$user = ( new AuthService() )->check_reset_key( (string) $request['login'], (string) $request['key'] );
		if ( is_wp_error( $user ) ) {
			return $user;
		}
		return $this->respond(
			array(
				'first_name' => $user->first_name,
				'email'      => $user->user_email,
			)
		);
	}

	/**
	 * POST /auth/reset
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function reset( WP_REST_Request $request ) {
		$result = ( new AuthService() )->reset( (string) $request['login'], (string) $request['key'], (string) $request['password'] );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return $this->respond( array( 'message' => __( 'Your password has been saved. You can now sign in.', 'contact-sync' ) ) );
	}

	/**
	 * POST /auth/logout
	 *
	 * @return mixed
	 */
	public function logout() {
		wp_logout();
		return $this->respond( array( 'redirect' => add_query_arg( 'loggedout', '1', \ContactSync\Portal\Router::url( 'login' ) ) ) );
	}
}
