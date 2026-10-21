<?php
/**
 * Plugin bootstrap.
 *
 * @package ContactSync
 */

namespace ContactSync;

use ContactSync\Admin\Menu;
use ContactSync\Auth\AuthService;
use ContactSync\Crm\SyncJob;
use ContactSync\Install\Schema;
use ContactSync\Portal\Lockdown;
use ContactSync\Portal\Router;

defined( 'ABSPATH' ) || exit;

/**
 * Wires up every component.
 */
final class Plugin {

	/**
	 * Singleton.
	 *
	 * @var Plugin|null
	 */
	private static $instance = null;

	/**
	 * Get (and boot) the plugin.
	 *
	 * @return Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
			self::$instance->boot();
		}
		return self::$instance;
	}

	/**
	 * Register hooks.
	 */
	private function boot() {
		load_plugin_textdomain( 'contact-sync', false, dirname( plugin_basename( CONTACT_SYNC_FILE ) ) . '/languages' );

		Schema::maybe_upgrade();
		Router::register();
		Lockdown::register();
		AuthService::register();
		SyncJob::register();

		if ( is_admin() ) {
			Menu::register();
		}

		add_action( 'rest_api_init', array( $this, 'rest' ) );
	}

	/**
	 * Register REST controllers.
	 */
	public function rest() {
		$controllers = array(
			new Rest\AuthController(),
			new Rest\PortalController(),
			new Rest\AgenciesController(),
			new Rest\RepsController(),
			new Rest\FormsController(),
			new Rest\SubmissionsController(),
			new Rest\ReportsController(),
			new Rest\SettingsController(),
		);
		foreach ( $controllers as $controller ) {
			$controller->routes();
		}
	}
}
