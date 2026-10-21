<?php
/**
 * Plugin Name:       Contact Sync
 * Description:       Lead capture portal for agency and independent reps with Microsoft Dynamics 365 synchronisation.
 * Version:           1.0.0
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Rajan Vijayan
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       contact-sync
 * Domain Path:       /languages
 *
 * @package ContactSync
 */

defined( 'ABSPATH' ) || exit;

define( 'CONTACT_SYNC_VERSION', '1.0.0' );
define( 'CONTACT_SYNC_FILE', __FILE__ );
define( 'CONTACT_SYNC_DIR', plugin_dir_path( __FILE__ ) );
define( 'CONTACT_SYNC_URL', plugin_dir_url( __FILE__ ) );

if ( ! file_exists( CONTACT_SYNC_DIR . 'vendor/autoload.php' ) ) {
	add_action(
		'admin_notices',
		function () {
			echo '<div class="notice notice-error"><p>';
			esc_html_e( 'Contact Sync is missing its dependencies. Please install the release build or run "composer install".', 'contact-sync' );
			echo '</p></div>';
		}
	);
	return;
}

require_once CONTACT_SYNC_DIR . 'vendor/autoload.php';
require_once CONTACT_SYNC_DIR . 'vendor/woocommerce/action-scheduler/action-scheduler.php';

register_activation_hook( __FILE__, array( \ContactSync\Install\Installer::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( \ContactSync\Install\Installer::class, 'deactivate' ) );

add_action( 'plugins_loaded', array( \ContactSync\Plugin::class, 'instance' ) );
