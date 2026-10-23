<?php
/**
 * Admin menu.
 *
 * @package ContactSync
 */

namespace ContactSync\Admin;

use ContactSync\Portal\Assets;
use ContactSync\Roles;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the Contact Sync admin screens (a single React app with hash routes).
 */
class Menu {

	const SLUG = 'contact-sync';

	/**
	 * Register hooks.
	 */
	public static function register() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_menu', array( __CLASS__, 'hide_content_menus' ), 99 );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_filter( 'admin_body_class', array( __CLASS__, 'body_class' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notices' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( CONTACT_SYNC_FILE ), array( __CLASS__, 'action_links' ) );
	}

	/**
	 * Add the menu and hash-route submenu links.
	 */
	public static function menu() {
		global $submenu;

		add_menu_page(
			__( 'Contact Sync', 'contact-sync' ),
			__( 'Contact Sync', 'contact-sync' ),
			Roles::CAP_MANAGE,
			self::SLUG,
			array( __CLASS__, 'render' ),
			'dashicons-cloud-upload',
			3
		);

		$items = array(
			'dashboard'   => __( 'Dashboard', 'contact-sync' ),
			'submissions' => __( 'Submissions', 'contact-sync' ),
			'reports'     => __( 'Reports', 'contact-sync' ),
			'agencies'    => __( 'Agencies', 'contact-sync' ),
			'reps'        => __( 'Reps', 'contact-sync' ),
			'forms'       => __( 'Forms', 'contact-sync' ),
			'activity'    => __( 'Activity log', 'contact-sync' ),
			'settings'    => __( 'Settings', 'contact-sync' ),
		);

		$submenu[ self::SLUG ] = array(); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		foreach ( $items as $route => $label ) {
			$submenu[ self::SLUG ][] = array( $label, Roles::CAP_MANAGE, 'admin.php?page=' . self::SLUG . '#/' . $route ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		}
	}

	/**
	 * The front end is locked down, so posts, pages and comments have no audience.
	 * Hide their menus to keep the admin focused. Filter to keep them.
	 */
	public static function hide_content_menus() {
		if ( ! apply_filters( 'contact_sync_hide_content_menus', true ) ) {
			return;
		}
		remove_menu_page( 'edit.php' );
		remove_menu_page( 'edit.php?post_type=page' );
		remove_menu_page( 'edit-comments.php' );
	}

	/**
	 * App mount point.
	 */
	public static function render() {
		echo '<div id="contact-sync-admin" class="cs-root"><div class="cs-boot"><span class="cs-boot__spinner"></span></div></div>';
	}

	/**
	 * Enqueue the app on our screen only.
	 *
	 * @param string $hook Screen hook.
	 */
	public static function enqueue( $hook ) {
		if ( 'toplevel_page_' . self::SLUG === $hook ) {
			Assets::enqueue_admin();
		}
	}

	/**
	 * Body class used for full-bleed styling.
	 *
	 * @param string $classes Classes.
	 * @return string
	 */
	public static function body_class( $classes ) {
		$screen = get_current_screen();
		if ( $screen && 'toplevel_page_' . self::SLUG === $screen->id ) {
			$classes .= ' cs-admin-screen';
		}
		return $classes;
	}

	/**
	 * Warn when pretty permalinks or the build are missing.
	 */
	public static function notices() {
		if ( ! current_user_can( Roles::CAP_MANAGE ) ) {
			return;
		}
		if ( ! get_option( 'permalink_structure' ) ) {
			printf(
				'<div class="notice notice-warning"><p>%s <a href="%s">%s</a></p></div>',
				esc_html__( 'Contact Sync needs pretty permalinks for the rep portal (/login, /app).', 'contact-sync' ),
				esc_url( admin_url( 'options-permalink.php' ) ),
				esc_html__( 'Update permalink settings', 'contact-sync' )
			);
		}
		if ( ! file_exists( CONTACT_SYNC_DIR . 'build/admin.js' ) ) {
			echo '<div class="notice notice-error"><p>' . esc_html__( 'Contact Sync assets are missing. Install the release build or run "npm run build".', 'contact-sync' ) . '</p></div>';
		}
	}

	/**
	 * Plugin list links.
	 *
	 * @param array $links Links.
	 * @return array
	 */
	public static function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG . '#/settings' ) ) . '">' . esc_html__( 'Settings', 'contact-sync' ) . '</a>' );
		return $links;
	}
}
