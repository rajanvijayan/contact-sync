<?php
/**
 * Activation and deactivation routines.
 *
 * @package ContactSync
 */

namespace ContactSync\Install;

use ContactSync\Forms\FormRepository;
use ContactSync\Forms\FormSchema;
use ContactSync\Portal\Router;
use ContactSync\Roles;

defined( 'ABSPATH' ) || exit;

/**
 * Plugin lifecycle.
 */
class Installer {

	/**
	 * Activation: tables, roles, default form, rewrite rules.
	 */
	public static function activate() {
		Schema::install();
		Roles::install();

		$forms = new FormRepository();
		if ( ! $forms->get_default() ) {
			$forms->create(
				array(
					'title'      => __( 'Lead Form', 'contact-sync' ),
					'schema'     => FormSchema::starter(),
					'is_default' => true,
				)
			);
		}

		Router::add_rewrites();
		flush_rewrite_rules();
	}

	/**
	 * Deactivation: stop background jobs and clean rewrite rules.
	 */
	public static function deactivate() {
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			as_unschedule_all_actions( '', array(), 'contact-sync' );
		}
		flush_rewrite_rules();
	}
}
