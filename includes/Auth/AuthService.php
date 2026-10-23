<?php
/**
 * Login, password reset and account gating.
 *
 * @package ContactSync
 */

namespace ContactSync\Auth;

use ContactSync\Portal\Router;
use ContactSync\Reps\RepService;
use ContactSync\Roles;
use ContactSync\Support\Mailer;
use ContactSync\Support\Settings;
use WP_Error;
use WP_User;

defined( 'ABSPATH' ) || exit;

/**
 * Portal authentication flows.
 */
class AuthService {

	/**
	 * Hook account status checks into core authentication.
	 */
	public static function register() {
		add_filter( 'authenticate', array( __CLASS__, 'block_inactive' ), 99 );
		add_action(
			'wp_login',
			function ( $login, $user ) {
				( new RepService() )->sync_agency( $user );
			},
			10,
			2
		);
	}

	/**
	 * Stop pending and disabled accounts from signing in anywhere (portal, wp-login, app passwords).
	 *
	 * @param WP_User|WP_Error|null $user Authenticated user.
	 * @return WP_User|WP_Error|null
	 */
	public static function block_inactive( $user ) {
		if ( ! $user instanceof WP_User ) {
			return $user;
		}
		$status = RepService::status( $user->ID );
		if ( RepService::STATUS_PENDING === $status ) {
			return new WP_Error( 'cs_pending', __( 'Please confirm your email address first. Check your inbox for the verification link.', 'contact-sync' ) );
		}
		if ( RepService::STATUS_DISABLED === $status ) {
			return new WP_Error( 'cs_disabled', __( 'Your account has been disabled. Please contact your administrator.', 'contact-sync' ) );
		}
		if ( Roles::is_portal_user( $user ) && RepService::agency_disabled( $user->ID ) ) {
			return new WP_Error( 'cs_agency_disabled', __( 'Access for your agency has been disabled. Please contact your administrator.', 'contact-sync' ) );
		}
		return $user;
	}

	/**
	 * Sign a user in.
	 *
	 * @param string $login       Email or username.
	 * @param string $password    Password.
	 * @param bool   $remember    Remember me.
	 * @param string $redirect_to Requested redirect.
	 * @return array|WP_Error redirect URL.
	 */
	public function login( $login, $password, $remember, $redirect_to = '' ) {
		$security = Settings::get( 'security' );
		$limit    = (int) $security['login_attempts'];
		$window   = (int) $security['lockout_minutes'] * MINUTE_IN_SECONDS;
		$login    = trim( (string) $login );
		$buckets  = array( 'login_ip_' . RateLimiter::ip(), 'login_user_' . strtolower( $login ) );

		foreach ( $buckets as $bucket ) {
			if ( RateLimiter::too_many( $bucket, $limit * ( 0 === strpos( $bucket, 'login_ip_' ) ? 4 : 1 ) ) ) {
				/* translators: %d: minutes */
				return new WP_Error( 'cs_rate_limited', sprintf( __( 'Too many sign-in attempts. Please try again in %d minutes.', 'contact-sync' ), (int) $security['lockout_minutes'] ), array( 'status' => 429 ) );
			}
		}

		if ( is_email( $login ) ) {
			$user = get_user_by( 'email', $login );
			if ( $user ) {
				$login = $user->user_login;
			}
		}

		$user = wp_signon(
			array(
				'user_login'    => $login,
				'user_password' => (string) $password,
				'remember'      => (bool) $remember,
			),
			is_ssl()
		);

		if ( is_wp_error( $user ) ) {
			$code = $user->get_error_code();
			if ( in_array( $code, array( 'cs_pending', 'cs_disabled' ), true ) ) {
				return new WP_Error( $code, $user->get_error_message(), array( 'status' => 403 ) );
			}
			foreach ( $buckets as $bucket ) {
				RateLimiter::hit( $bucket, $window );
			}
			return new WP_Error( 'cs_invalid_login', __( 'The email or password you entered is incorrect.', 'contact-sync' ), array( 'status' => 401 ) );
		}

		RateLimiter::clear( $buckets[1] );
		wp_set_current_user( $user->ID );

		return array( 'redirect' => self::redirect_for( $user, $redirect_to ) );
	}

	/**
	 * Where to send a user after login.
	 *
	 * @param WP_User $user        User.
	 * @param string  $redirect_to Requested URL.
	 * @return string
	 */
	public static function redirect_for( WP_User $user, $redirect_to = '' ) {
		$fallback = user_can( $user, Roles::CAP_MANAGE ) ? admin_url( 'admin.php?page=contact-sync' ) : Router::url( 'app' );
		if ( ! $redirect_to ) {
			return $fallback;
		}
		$redirect = wp_validate_redirect( $redirect_to, $fallback );
		// Portal users never land in wp-admin.
		if ( Roles::is_portal_user( $user ) && 0 === strpos( $redirect, admin_url() ) ) {
			return $fallback;
		}
		return $redirect;
	}

	/**
	 * Send a password reset email. Always succeeds from the caller's point of view.
	 *
	 * @param string $email Email.
	 * @return true|WP_Error WP_Error only when rate limited.
	 */
	public function forgot( $email ) {
		$bucket = 'forgot_' . RateLimiter::ip();
		if ( RateLimiter::too_many( $bucket, 5 ) ) {
			return new WP_Error( 'cs_rate_limited', __( 'Too many requests. Please try again later.', 'contact-sync' ), array( 'status' => 429 ) );
		}
		RateLimiter::hit( $bucket, HOUR_IN_SECONDS );

		$user = get_user_by( 'email', sanitize_email( $email ) );
		if ( ! $user || RepService::STATUS_DISABLED === RepService::status( $user->ID ) || ( Roles::is_portal_user( $user ) && RepService::agency_disabled( $user->ID ) ) ) {
			return true;
		}
		$key = get_password_reset_key( $user );
		if ( is_wp_error( $key ) ) {
			return true;
		}
		Mailer::send(
			$user->user_email,
			'reset',
			array(
				'first_name' => $user->first_name ? $user->first_name : $user->display_name,
				'link'       => RepService::reset_link( $user, $key ),
			)
		);
		return true;
	}

	/**
	 * Re-send a verification email for a pending account.
	 *
	 * @param string $email Email.
	 * @return true|WP_Error
	 */
	public function resend_verification( $email ) {
		$bucket = 'resend_' . RateLimiter::ip();
		if ( RateLimiter::too_many( $bucket, 5 ) ) {
			return new WP_Error( 'cs_rate_limited', __( 'Too many requests. Please try again later.', 'contact-sync' ), array( 'status' => 429 ) );
		}
		RateLimiter::hit( $bucket, HOUR_IN_SECONDS );

		$user = get_user_by( 'email', sanitize_email( $email ) );
		if ( $user && RepService::STATUS_PENDING === RepService::status( $user->ID ) ) {
			( new RepService() )->send_verification( $user->ID );
		}
		return true;
	}

	/**
	 * Check that a reset key is still valid (used to render the reset page).
	 *
	 * @param string $login Username.
	 * @param string $key   Key.
	 * @return WP_User|WP_Error
	 */
	public function check_reset_key( $login, $key ) {
		$user = check_password_reset_key( (string) $key, (string) $login );
		if ( is_wp_error( $user ) ) {
			return new WP_Error( 'cs_invalid_key', __( 'This link is invalid or has expired. Please request a new one.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		return $user;
	}

	/**
	 * Set a new password from a reset/invite link.
	 *
	 * @param string $login    Username.
	 * @param string $key      Key.
	 * @param string $password New password.
	 * @return true|WP_Error
	 */
	public function reset( $login, $key, $password ) {
		$user = $this->check_reset_key( $login, $key );
		if ( is_wp_error( $user ) ) {
			return $user;
		}
		$error = RepService::password_error( (string) $password );
		if ( $error ) {
			return new WP_Error( 'cs_weak_password', $error, array( 'status' => 400 ) );
		}
		if ( RepService::STATUS_DISABLED === RepService::status( $user->ID ) ) {
			return new WP_Error( 'cs_disabled', __( 'This account has been disabled.', 'contact-sync' ), array( 'status' => 403 ) );
		}

		reset_password( $user, (string) $password );

		// Following an emailed link proves ownership of the address.
		if ( RepService::STATUS_PENDING === RepService::status( $user->ID ) ) {
			update_user_meta( $user->ID, 'cs_status', RepService::STATUS_ACTIVE );
			delete_user_meta( $user->ID, 'cs_verify_hash' );
			delete_user_meta( $user->ID, 'cs_verify_expires' );
		}
		return true;
	}
}
