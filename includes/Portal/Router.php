<?php
/**
 * Portal routes.
 *
 * @package ContactSync
 */

namespace ContactSync\Portal;

use ContactSync\Roles;
use ContactSync\Reps\RepService;

defined( 'ABSPATH' ) || exit;

/**
 * Maps /login, /signup, /app/* etc. to the single-page portal shell.
 */
class Router {

	const PUBLIC_ROUTES = array( 'login', 'signup', 'verify', 'forgot-password', 'reset-password' );

	/**
	 * Register hooks.
	 */
	public static function register() {
		add_action( 'init', array( __CLASS__, 'add_rewrites' ) );
		add_filter(
			'query_vars',
			function ( $vars ) {
				$vars[] = 'cs_route';
				return $vars;
			}
		);
		add_action( 'template_redirect', array( __CLASS__, 'render' ), 0 );
	}

	/**
	 * Rewrite rules for portal URLs.
	 */
	public static function add_rewrites() {
		add_rewrite_rule( '^(' . implode( '|', self::PUBLIC_ROUTES ) . ')/?$', 'index.php?cs_route=$matches[1]', 'top' );
		add_rewrite_rule( '^app(/.*)?/?$', 'index.php?cs_route=app', 'top' );
	}

	/**
	 * Absolute URL of a portal route.
	 *
	 * @param string $route Route, e.g. "login" or "app/new".
	 * @return string
	 */
	public static function url( $route = 'app' ) {
		return home_url( '/' . trim( $route, '/' ) . '/' );
	}

	/**
	 * Current portal route, if any.
	 *
	 * @return string
	 */
	public static function current() {
		return (string) get_query_var( 'cs_route' );
	}

	/**
	 * Serve the portal shell for portal routes.
	 */
	public static function render() {
		$route = self::current();
		if ( '' === $route ) {
			return;
		}

		$user = wp_get_current_user();

		if ( 'app' === $route ) {
			if ( ! $user->exists() ) {
				$requested = isset( $_SERVER['REQUEST_URI'] ) ? home_url( esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) ) : '';
				wp_safe_redirect( add_query_arg( 'redirect_to', rawurlencode( $requested ), self::url( 'login' ) ) );
				exit;
			}
			if ( ! user_can( $user, Roles::CAP_SUBMIT ) || RepService::STATUS_ACTIVE !== RepService::status( $user->ID ) ) {
				wp_logout();
				wp_safe_redirect( self::url( 'login' ) );
				exit;
			}
		} elseif ( in_array( $route, array( 'login', 'signup', 'forgot-password' ), true ) && $user->exists() ) {
			wp_safe_redirect( user_can( $user, Roles::CAP_SUBMIT ) ? self::url( 'app' ) : admin_url() );
			exit;
		}

		nocache_headers();
		header( 'X-Frame-Options: SAMEORIGIN' );
		header( 'Referrer-Policy: strict-origin-when-cross-origin' );

		Assets::enqueue_portal( $route );
		include CONTACT_SYNC_DIR . 'templates/portal-shell.php';
		exit;
	}
}
