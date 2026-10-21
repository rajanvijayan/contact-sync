<?php
/**
 * Front-end lockdown.
 *
 * @package ContactSync
 */

namespace ContactSync\Portal;

use ContactSync\Roles;

defined( 'ABSPATH' ) || exit;

/**
 * Turns the site into an application: no public theme pages, no wp-login.php, no XML-RPC.
 */
class Lockdown {

	/**
	 * Register hooks.
	 */
	public static function register() {
		add_action( 'template_redirect', array( __CLASS__, 'redirect_front_end' ), 1 );
		add_action( 'login_init', array( __CLASS__, 'redirect_login' ), 1 );
		add_action( 'admin_init', array( __CLASS__, 'block_admin' ), 1 );
		add_filter( 'show_admin_bar', array( __CLASS__, 'admin_bar' ) );
		add_filter( 'logout_redirect', array( __CLASS__, 'logout_redirect' ), 10, 3 );
		add_filter( 'lostpassword_url', array( __CLASS__, 'lostpassword_url' ) );
		add_filter( 'login_url', array( __CLASS__, 'login_url' ), 10, 2 );
		add_filter( 'register_url', array( __CLASS__, 'register_url' ) );

		add_filter( 'xmlrpc_enabled', '__return_false' );
		add_filter( 'wp_sitemaps_enabled', '__return_false' );
		add_filter( 'comments_open', '__return_false', 20 );
		add_filter( 'pings_open', '__return_false', 20 );
		add_filter( 'rest_endpoints', array( __CLASS__, 'restrict_rest' ) );
		add_filter( 'retrieve_password_message', array( __CLASS__, 'core_reset_message' ), 10, 4 );
	}

	/**
	 * Send every non-portal front-end request to the app or the login page.
	 */
	public static function redirect_front_end() {
		if ( Router::current() || is_robots() || is_favicon() ) {
			return;
		}
		if ( ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || wp_doing_ajax() || wp_doing_cron() ) {
			return;
		}
		$user = wp_get_current_user();
		if ( $user->exists() && ! user_can( $user, Roles::CAP_SUBMIT ) ) {
			wp_safe_redirect( admin_url() );
			exit;
		}
		wp_safe_redirect( Router::url( $user->exists() ? 'app' : 'login' ) );
		exit;
	}

	/**
	 * Route wp-login.php to the portal equivalents.
	 */
	public static function redirect_login() {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended
		$action = isset( $_REQUEST['action'] ) ? sanitize_key( wp_unslash( $_REQUEST['action'] ) ) : 'login';
		if ( in_array( $action, array( 'logout', 'postpass', 'confirmaction', 'confirm_admin_email', 'entered_recovery_mode' ), true ) ) {
			return;
		}
		if ( isset( $_REQUEST['interim-login'] ) ) {
			return;
		}

		switch ( $action ) {
			case 'lostpassword':
			case 'retrievepassword':
				$target = Router::url( 'forgot-password' );
				break;
			case 'rp':
			case 'resetpass':
				$target = Router::url( 'reset-password' );
				if ( isset( $_GET['key'], $_GET['login'] ) ) {
					$target = add_query_arg(
						array(
							'key'   => rawurlencode( sanitize_text_field( wp_unslash( $_GET['key'] ) ) ),
							'login' => rawurlencode( sanitize_user( wp_unslash( $_GET['login'] ) ) ),
						),
						$target
					);
				}
				break;
			case 'register':
				$target = Router::url( 'signup' );
				break;
			default:
				$target = Router::url( 'login' );
				if ( ! empty( $_REQUEST['redirect_to'] ) ) {
					$target = add_query_arg( 'redirect_to', rawurlencode( esc_url_raw( wp_unslash( $_REQUEST['redirect_to'] ) ) ), $target );
				}
		}
		// phpcs:enable
		wp_safe_redirect( $target );
		exit;
	}

	/**
	 * Keep reps and agency managers out of wp-admin.
	 */
	public static function block_admin() {
		if ( wp_doing_ajax() ) {
			return;
		}
		if ( Roles::is_portal_user( wp_get_current_user() ) ) {
			wp_safe_redirect( Router::url( 'app' ) );
			exit;
		}
	}

	/**
	 * Hide the toolbar for portal users.
	 *
	 * @param bool $show Show.
	 * @return bool
	 */
	public static function admin_bar( $show ) {
		return Roles::is_portal_user( wp_get_current_user() ) ? false : $show;
	}

	/**
	 * After logout go to the portal login.
	 *
	 * @param string $redirect_to Redirect.
	 * @param string $requested   Requested.
	 * @param mixed  $user        User.
	 * @return string
	 */
	public static function logout_redirect( $redirect_to, $requested, $user ) {
		unset( $redirect_to, $user );
		return $requested ? $requested : add_query_arg( 'loggedout', '1', Router::url( 'login' ) );
	}

	/**
	 * Lost password URL.
	 *
	 * @return string
	 */
	public static function lostpassword_url() {
		return Router::url( 'forgot-password' );
	}

	/**
	 * Login URL.
	 *
	 * @param string $url      Default URL.
	 * @param string $redirect Redirect target.
	 * @return string
	 */
	public static function login_url( $url, $redirect ) {
		unset( $url );
		$login = Router::url( 'login' );
		return $redirect ? add_query_arg( 'redirect_to', rawurlencode( $redirect ), $login ) : $login;
	}

	/**
	 * Registration URL.
	 *
	 * @return string
	 */
	public static function register_url() {
		return Router::url( 'signup' );
	}

	/**
	 * Hide the core users endpoints from anyone who cannot list users.
	 *
	 * @param array $endpoints Endpoints.
	 * @return array
	 */
	public static function restrict_rest( $endpoints ) {
		if ( current_user_can( 'list_users' ) ) {
			return $endpoints;
		}
		foreach ( array_keys( $endpoints ) as $route ) {
			if ( 0 === strpos( $route, '/wp/v2/users' ) ) {
				unset( $endpoints[ $route ] );
			}
		}
		return $endpoints;
	}

	/**
	 * Point core reset emails (sent from wp-admin "Send password reset") at the portal.
	 *
	 * @param string   $message    Message.
	 * @param string   $key        Key.
	 * @param string   $user_login Login.
	 * @param \WP_User $user       User.
	 * @return string
	 */
	public static function core_reset_message( $message, $key, $user_login, $user ) {
		unset( $user );
		$core   = network_site_url( 'wp-login.php?action=rp&key=' . $key . '&login=' . rawurlencode( $user_login ), 'login' );
		$portal = add_query_arg(
			array(
				'key'   => $key,
				'login' => rawurlencode( $user_login ),
			),
			Router::url( 'reset-password' )
		);
		return str_replace( $core, $portal, $message );
	}
}
