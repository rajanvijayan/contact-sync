<?php
/**
 * Script and style registration.
 *
 * @package ContactSync
 */

namespace ContactSync\Portal;

use ContactSync\Forms\FormSchema;
use ContactSync\Reps\RepService;
use ContactSync\Support\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Enqueues the compiled portal and admin apps with their boot configuration.
 */
class Assets {

	/**
	 * Register a compiled entry point.
	 *
	 * @param string $entry  portal|admin.
	 * @param string $handle Handle.
	 * @return bool
	 */
	private static function register( $entry, $handle ) {
		$asset_file = CONTACT_SYNC_DIR . 'build/' . $entry . '.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return false;
		}
		$asset = include $asset_file;

		wp_register_script( $handle, CONTACT_SYNC_URL . 'build/' . $entry . '.js', $asset['dependencies'], $asset['version'], true );
		wp_set_script_translations( $handle, 'contact-sync', CONTACT_SYNC_DIR . 'languages' );

		foreach ( array( $entry . '.css', 'style-' . $entry . '.css' ) as $css ) {
			if ( file_exists( CONTACT_SYNC_DIR . 'build/' . $css ) ) {
				wp_register_style( $handle, CONTACT_SYNC_URL . 'build/' . $css, array(), $asset['version'] );
				break;
			}
		}
		return true;
	}

	/**
	 * Branding values shared by both apps.
	 *
	 * @return array
	 */
	public static function branding() {
		$branding = Settings::get( 'branding' );
		if ( '' === $branding['product_name'] ) {
			$branding['product_name'] = get_bloginfo( 'name' );
		}
		return $branding;
	}

	/**
	 * Enqueue the portal app.
	 *
	 * @param string $route Current route.
	 */
	public static function enqueue_portal( $route ) {
		if ( ! self::register( 'portal', 'contact-sync-portal' ) ) {
			return;
		}
		$user   = wp_get_current_user();
		$config = array(
			'route'        => $route,
			'basePath'     => (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH ),
			'urls'         => array(
				'home'   => home_url( '/' ),
				'login'  => Router::url( 'login' ),
				'signup' => Router::url( 'signup' ),
				'forgot' => Router::url( 'forgot-password' ),
				'app'    => Router::url( 'app' ),
				'admin'  => current_user_can( 'manage_contact_sync' ) ? admin_url( 'admin.php?page=contact-sync' ) : '',
			),
			'branding'     => self::branding(),
			'crmConnected' => Settings::dynamics_configured(),
			'user'         => $user->exists() ? ( new RepService() )->profile( $user ) : null,
			'limits'       => array(
				'maxRows' => (int) Settings::get( 'security.max_csv_rows', 1000 ),
				'maxKb'   => (int) Settings::get( 'security.max_csv_kb', 2048 ),
			),
		);
		wp_add_inline_script( 'contact-sync-portal', 'window.contactSync = ' . wp_json_encode( $config ) . ';', 'before' );
	}

	/**
	 * Enqueue the admin app.
	 */
	public static function enqueue_admin() {
		if ( ! self::register( 'admin', 'contact-sync-admin' ) ) {
			return;
		}
		wp_enqueue_script( 'contact-sync-admin' );
		wp_enqueue_style( 'contact-sync-admin' );
		wp_enqueue_media();

		$config = array(
			'branding'      => self::branding(),
			'portalUrl'     => Router::url( 'app' ),
			'loginUrl'      => Router::url( 'login' ),
			'signupUrl'     => Router::url( 'signup' ),
			'crmAttributes' => FormSchema::crm_attributes(),
			'operators'     => FormSchema::OPERATORS,
			'currentUser'   => wp_get_current_user()->display_name,
			'permalinks'    => (bool) get_option( 'permalink_structure' ),
			'version'       => CONTACT_SYNC_VERSION,
			'crmConnected'  => Settings::dynamics_configured(),
		);
		wp_add_inline_script( 'contact-sync-admin', 'window.contactSyncAdmin = ' . wp_json_encode( $config ) . ';', 'before' );
	}
}
